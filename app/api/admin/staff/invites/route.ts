import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { STAFF_ROLES, PEOPLE_ADMIN_ROLES, hashValue, oneTimeSecret } from "@/lib/people";
import { getClientIp } from "@/lib/requests";
import { requireRole } from "@/lib/session";
import { sendStaffInviteEmail } from "@/lib/email";
const schema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().toLowerCase().email(),
  role: z.enum(STAFF_ROLES),
});
export async function GET() {
  const user = await requireRole(PEOPLE_ADMIN_ROLES);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const staff = await prisma.user.findMany({
    take: 500,
    where: { schoolId: user.schoolId, role: { in: [...STAFF_ROLES] } },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      isActive: true,
      isSuspended: true,
      createdAt: true,
      teacherProfile: { select: { id: true, roleLabel: true } },
    },
    orderBy: { name: "asc" },
  });
  const invites = await prisma.staffInvite.findMany({
    take: 500,
    where: {
      schoolId: user.schoolId,
      acceptedAt: null,
      revokedAt: null,
      expiresAt: { gt: new Date() },
    },
    select: { id: true, name: true, email: true, role: true, expiresAt: true, createdAt: true },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json({ staff, invites });
}
export async function POST(request: NextRequest) {
  const user = await requireRole(PEOPLE_ADMIN_ROLES);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  let input: z.infer<typeof schema>;
  try {
    input = schema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: "Invalid staff details." }, { status: 400 });
  }
  if (await prisma.user.findFirst({ where: { email: input.email, schoolId: user.schoolId } }))
    return NextResponse.json({ error: "An account already uses this email." }, { status: 409 });

  // Refuse a second live invitation for the same address. Without this, an
  // admin re-inviting someone whose email had gone to spam created a second
  // valid token — two working activation links for one person, and no way to
  // tell which was in use. Reissue the existing invitation instead.
  const pending = await prisma.staffInvite.findFirst({
    where: {
      schoolId: user.schoolId,
      email: input.email,
      acceptedAt: null,
      revokedAt: null,
      expiresAt: { gt: new Date() },
    },
    select: { id: true, expiresAt: true },
  });
  if (pending) {
    return NextResponse.json(
      {
        error: "This person already has a pending invitation. Resend or revoke it instead.",
        code: "INVITE_EXISTS",
        inviteId: pending.id,
        expiresAt: pending.expiresAt,
      },
      { status: 409 },
    );
  }
  const token = oneTimeSecret();
  const invite = await prisma.staffInvite.create({
    data: {
      schoolId: user.schoolId,
      name: input.name,
      email: input.email,
      role: input.role,
      tokenHash: hashValue(token),
      expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7),
      createdById: user.id,
    },
  });
  await prisma.auditLog.create({
    data: {
      schoolId: user.schoolId,
      actorUserId: user.id,
      action: "STAFF_INVITED",
      entityType: "StaffInvite",
      entityId: invite.id,
      ipAddress: getClientIp(request),
      metadata: { email: input.email, role: input.role },
    },
  });

  // ── Send the activation email (best-effort — never block invite creation).
  //    If Resend isn't configured, the activation token is still returned below
  //    so the admin can share the link manually. ──
  try {
    await sendStaffInviteEmail({
      to: input.email,
      name: input.name,
      token,
      email: input.email,
      role: input.role,
    });
  } catch (e) {
    console.warn(
      "Staff invite email could not be sent — activation token still returned to admin.",
      e,
    );
  }

  return NextResponse.json(
    {
      invite: { id: invite.id, email: invite.email, expiresAt: invite.expiresAt },
      activationToken: token,
    },
    { status: 201 },
  );
}
