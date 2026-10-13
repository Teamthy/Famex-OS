import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { hashValue, passwordHash } from "@/lib/people";
import { enforceRateLimit } from "@/lib/rate-limit";
import { getClientIp } from "@/lib/requests";
const schema = z.object({
  token: z.string().min(20),
  password: z
    .string()
    .min(12)
    .max(128)
    .regex(/[A-Z]/, "Use an uppercase letter.")
    .regex(/[a-z]/, "Use a lowercase letter.")
    .regex(/[0-9]/, "Use a number."),
});
export async function POST(request: NextRequest) {
  // Unauthenticated by necessity — the account is created BY this call — so the
  // invite token is the only thing standing between a guesser and a staff
  // account on the school's system. Throttle per IP.
  const ip = getClientIp(request);
  const limit = await enforceRateLimit("staffActivate", ip);
  if (!limit.success) {
    return NextResponse.json(
      { error: "Too many activation attempts. Please wait and try again." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } },
    );
  }

  let input: z.infer<typeof schema>;
  try {
    input = schema.parse(await request.json());
  } catch {
    return NextResponse.json(
      { error: "Use a stronger password (12+ chars, upper/lowercase and number)." },
      { status: 400 },
    );
  }
  const invite = await prisma.staffInvite.findUnique({
    where: { tokenHash: hashValue(input.token) },
  });
  if (!invite || invite.acceptedAt || invite.revokedAt || invite.expiresAt < new Date())
    return NextResponse.json(
      { error: "This activation link is invalid or expired." },
      { status: 410 },
    );
  const exists = await prisma.user.findFirst({
    where: { email: invite.email, schoolId: invite.schoolId },
  });
  if (exists)
    return NextResponse.json(
      { error: "An account already exists for this email." },
      { status: 409 },
    );
  await prisma.$transaction(async (tx) => {
    const staff = await tx.user.create({
      data: {
        schoolId: invite.schoolId,
        email: invite.email,
        name: invite.name,
        role: invite.role,
        passwordHash: await passwordHash(input.password),
        mustChangePassword: false,
      },
    });
    if (invite.role === `TEACHER` || invite.role === `HOD`)
      await tx.teacherProfile.create({
        data: {
          schoolId: invite.schoolId,
          userId: staff.id,
          displayName: invite.name,
          roleLabel: invite.role === `HOD` ? `Head of Department` : `Teacher`,
        },
      });
    await tx.staffInvite.update({ where: { id: invite.id }, data: { acceptedAt: new Date() } });
    await tx.auditLog.create({
      data: {
        schoolId: invite.schoolId,
        actorUserId: staff.id,
        action: "STAFF_ACCOUNT_ACTIVATED",
        entityType: "StaffInvite",
        entityId: invite.id,
      },
    });
  });
  return NextResponse.json({ ok: true });
}
