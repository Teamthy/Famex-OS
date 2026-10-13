import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { PEOPLE_ADMIN_ROLES, hashValue, oneTimeSecret } from "@/lib/people";
import { getClientIp } from "@/lib/requests";
import { requireRole } from "@/lib/session";
import { sendStaffInviteEmail } from "@/lib/email";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Manage a pending staff invitation.
 *
 *   DELETE — revoke it
 *   POST   — reissue it (new token, fresh 7-day expiry, email resent)
 *
 * Neither existed before. The StaffInvite model has a `revokedAt` column and
 * the activation endpoint checks it, but no route ever set it — so a mistyped
 * email address created a live, valid, un-cancellable activation token that
 * stayed usable for seven days. Whoever received it could create a staff
 * account on the school's system.
 *
 * Reissue matters just as much in practice: invite emails land in spam, and
 * without this the only recovery was to invite the same person again, leaving
 * two live tokens for one member of staff.
 */

async function loadPendingInvite(id: string, schoolId: string) {
  return prisma.staffInvite.findFirst({ where: { id, schoolId } });
}

/** DELETE — revoke a pending invitation. */
export async function DELETE(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const user = await requireRole(PEOPLE_ADMIN_ROLES);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await context.params;
  const invite = await loadPendingInvite(id, user.schoolId);
  if (!invite) return NextResponse.json({ error: "Invitation not found." }, { status: 404 });

  if (invite.acceptedAt) {
    // Revoking here would be misleading — the account already exists. Suspend
    // the user instead, which is a different (and reversible) action.
    return NextResponse.json(
      { error: "This invitation was already accepted. Suspend the staff account instead." },
      { status: 409 },
    );
  }

  // Idempotent: revoking twice is a no-op, not an error.
  if (invite.revokedAt) {
    return NextResponse.json({ ok: true, alreadyRevoked: true, email: invite.email });
  }

  await prisma.$transaction(async (tx) => {
    await tx.staffInvite.update({ where: { id: invite.id }, data: { revokedAt: new Date() } });
    await tx.auditLog.create({
      data: {
        schoolId: user.schoolId,
        actorUserId: user.id,
        action: "STAFF_INVITE_REVOKED",
        entityType: "StaffInvite",
        entityId: invite.id,
        ipAddress: getClientIp(_request),
        metadata: { email: invite.email, role: invite.role },
      },
    });
  });

  return NextResponse.json({ ok: true, email: invite.email });
}

/** POST — reissue: mint a fresh token, extend expiry, resend the email. */
export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const user = await requireRole(PEOPLE_ADMIN_ROLES);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await context.params;
  const invite = await loadPendingInvite(id, user.schoolId);
  if (!invite) return NextResponse.json({ error: "Invitation not found." }, { status: 404 });

  if (invite.acceptedAt) {
    return NextResponse.json({ error: "This invitation was already accepted." }, { status: 409 });
  }
  if (invite.revokedAt) {
    return NextResponse.json(
      { error: "This invitation was revoked. Send a new invitation instead." },
      { status: 409 },
    );
  }

  // A new token invalidates the old one: tokenHash is overwritten, so the
  // previous link stops resolving. That keeps exactly one live token per
  // invitation, however many times it is resent.
  const token = oneTimeSecret();
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 7);

  await prisma.$transaction(async (tx) => {
    await tx.staffInvite.update({
      where: { id: invite.id },
      data: { tokenHash: hashValue(token), expiresAt },
    });
    await tx.auditLog.create({
      data: {
        schoolId: user.schoolId,
        actorUserId: user.id,
        action: "STAFF_INVITE_REISSUED",
        entityType: "StaffInvite",
        entityId: invite.id,
        ipAddress: getClientIp(request),
        metadata: { email: invite.email, role: invite.role },
      },
    });
  });

  let emailSent = false;
  try {
    await sendStaffInviteEmail({
      to: invite.email,
      name: invite.name,
      token,
      email: invite.email,
      role: invite.role,
    });
    emailSent = true;
  } catch (error) {
    console.warn("Staff invite resend failed — token still returned to the admin.", error);
  }

  return NextResponse.json({
    invite: { id: invite.id, email: invite.email, expiresAt },
    activationToken: token,
    emailSent,
  });
}
