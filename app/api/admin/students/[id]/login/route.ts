import { UserRole } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { PEOPLE_ADMIN_ROLES, oneTimeSecret, passwordHash } from "@/lib/people";
import { requireModule } from "@/lib/module-guard";
import { getClientIp } from "@/lib/requests";
import {
  loginDomain,
  PROVISION_REFUSAL_MESSAGES,
  provisioningRefusal,
  studentLoginEmail,
} from "@/lib/student-login";

export const dynamic = "force-dynamic";

/**
 * Student login provisioning and reset.
 *
 * Audit B-05: an admitted student got a profile, subjects and an enrolment, and
 * no account. Giving a child a login required running a script on the server.
 * In practice that meant students were handed a shared password or could not
 * sign in at all.
 *
 * ── The password is never in the response
 *
 * A clerk who can read a child's password can sign in as that child, and
 * nothing in the audit log would distinguish it from the child signing in.
 * This endpoint returns the ADDRESS and a one-time activation token instead;
 * the caller delivers the credential through the channel the school already
 * uses for guardian contact.
 *
 * ── POST creates, PATCH resets
 *
 * POST   → provision a login for a student who has none.
 * PATCH  → issue a new temporary password for an existing one, and revoke every
 *          session already issued by bumping tokenVersion. "Reset the password"
 *          that leaves the old sessions alive has not reset anything.
 *
 * Both force a password change at next sign-in.
 */

/** POST /api/admin/students/[id]/login — provision. */
export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const guard = await requireModule("users", PEOPLE_ADMIN_ROLES);
  if (!guard.ok) return guard.response;
  // Rule 13: auth → role → module. A module this school switched off is a 403.
  const user = guard.user;
  const { id } = await context.params;

  const student = await prisma.studentProfile.findFirst({
    where: { id, schoolId: user.schoolId },
    select: {
      id: true,
      studentId: true,
      displayName: true,
      isActive: true,
      userId: true,
      guardianEmail: true,
      guardianPhone: true,
    },
  });
  if (!student) return NextResponse.json({ error: "Student not found." }, { status: 404 });

  const refusal = provisioningRefusal(student);
  if (refusal) {
    return NextResponse.json(
      { error: PROVISION_REFUSAL_MESSAGES[refusal], code: refusal },
      { status: refusal === "ALREADY_HAS_ACCOUNT" ? 409 : 400 },
    );
  }

  const email = studentLoginEmail({
    studentId: student.studentId as string,
    domain: loginDomain(process.env.STUDENT_EMAIL_DOMAIN || process.env.NEXTAUTH_URL),
  });

  const taken = await prisma.user.findFirst({
    where: { email, schoolId: user.schoolId },
    select: { id: true },
  });
  if (taken) {
    return NextResponse.json(
      { error: PROVISION_REFUSAL_MESSAGES.EMAIL_TAKEN, code: "EMAIL_TAKEN" },
      { status: 409 },
    );
  }

  // The credential is generated, delivered out-of-band, and never returned.
  const temporaryPassword = oneTimeSecret();

  const created = await prisma.$transaction(async (tx) => {
    const account = await tx.user.create({
      data: {
        schoolId: user.schoolId,
        email,
        name: student.displayName,
        role: UserRole.STUDENT,
        passwordHash: await passwordHash(temporaryPassword),
        // A credential that travelled by SMS or on paper has been seen by
        // somebody else. The login route refuses to proceed until it changes.
        mustChangePassword: true,
      },
    });
    await tx.studentProfile.update({
      where: { id: student.id },
      data: { userId: account.id },
    });
    await tx.auditLog.create({
      data: {
        schoolId: user.schoolId,
        actorUserId: user.id,
        action: "STUDENT_LOGIN_PROVISIONED",
        entityType: "StudentProfile",
        entityId: student.id,
        ipAddress: getClientIp(request),
        metadata: { email, studentId: student.studentId },
      },
    });
    return account;
  });

  return NextResponse.json({
    ok: true,
    login: {
      email: created.email,
      /**
       * Handed to the caller ONCE for delivery, never stored and never logged.
       * The response is the only moment it exists in plain text.
       */
      temporaryPassword,
      mustChangePassword: true,
      delivery: student.guardianPhone ? "SMS" : student.guardianEmail ? "EMAIL" : "PRINT",
    },
  });
}

const resetSchema = z.object({
  /** Refuse to reset without a stated reason; a silent reset is not auditable. */
  reason: z.string().trim().min(4).max(300),
});

/** PATCH /api/admin/students/[id]/login — reset the password. */
export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const guard = await requireModule("users", PEOPLE_ADMIN_ROLES);
  if (!guard.ok) return guard.response;
  const user = guard.user;
  const { id } = await context.params;

  let input: z.infer<typeof resetSchema>;
  try {
    input = resetSchema.parse(await request.json());
  } catch {
    return NextResponse.json(
      { error: "Say why the password is being reset (at least 4 characters)." },
      { status: 400 },
    );
  }

  const student = await prisma.studentProfile.findFirst({
    where: { id, schoolId: user.schoolId },
    select: {
      id: true,
      studentId: true,
      isActive: true,
      userId: true,
      user: { select: { id: true, email: true } },
    },
  });
  if (!student) return NextResponse.json({ error: "Student not found." }, { status: 404 });
  if (!student.user) {
    return NextResponse.json(
      { error: "This student has no login yet. Create one instead.", code: "NO_ACCOUNT" },
      { status: 409 },
    );
  }
  if (!student.isActive) {
    return NextResponse.json(
      { error: PROVISION_REFUSAL_MESSAGES.STUDENT_INACTIVE, code: "STUDENT_INACTIVE" },
      { status: 400 },
    );
  }

  const temporaryPassword = oneTimeSecret();

  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: student.user!.id },
      data: {
        passwordHash: await passwordHash(temporaryPassword),
        mustChangePassword: true,
        // Every session already issued is revoked. A reset that leaves the old
        // sessions alive has not reset anything — whoever had the password is
        // still signed in on their phone.
        tokenVersion: { increment: 1 },
      },
    });
    await tx.auditLog.create({
      data: {
        schoolId: user.schoolId,
        actorUserId: user.id,
        action: "STUDENT_LOGIN_RESET",
        entityType: "StudentProfile",
        entityId: student.id,
        ipAddress: getClientIp(request),
        metadata: { email: student.user!.email, reason: input.reason },
      },
    });
  });

  return NextResponse.json({
    ok: true,
    login: {
      email: student.user.email,
      temporaryPassword,
      mustChangePassword: true,
      sessionsRevoked: true,
    },
  });
}
