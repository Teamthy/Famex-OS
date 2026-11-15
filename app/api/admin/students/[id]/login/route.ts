import { UserRole } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { PEOPLE_ADMIN_ROLES } from "@/lib/people";
import { provisionStudentAccountInTransaction } from "@/lib/student-accounts";
import { oneTimeSecret, passwordHash } from "@/lib/people";
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
 * POST provisions an active student login with a strong one-time password.
 * The password is returned once to authorized school staff for direct handoff;
 * the student must change it at first sign-in.
 *
 * PATCH revokes existing sessions, rotates the password, keeps the account
 * active, and requires a password change at next sign-in.
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

  const activation = await prisma.$transaction(async (tx) => {
    const issued = await provisionStudentAccountInTransaction(tx, {
      schoolId: user.schoolId,
      studentProfileId: student.id,
      studentId: student.studentId as string,
      studentName: student.displayName,
    });
    await tx.auditLog.create({
      data: {
        schoolId: user.schoolId,
        actorUserId: user.id,
        action: "STUDENT_LOGIN_PROVISIONED",
        entityType: "StudentProfile",
        entityId: student.id,
        ipAddress: getClientIp(request),
        metadata: {
          email: issued.email,
          studentId: student.studentId,
          accountActivated: true,
        },
      },
    });
    return issued;
  });
  return NextResponse.json({
    ok: true,
    login: {
      email: activation.email,
      isActive: true,
      temporaryPassword: activation.temporaryPassword,
      mustChangePassword: true,
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
      displayName: true,
      isActive: true,
      userId: true,
      guardianEmail: true,
      guardianPhone: true,
      user: { select: { id: true, email: true, role: true, isSuspended: true } },
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
  if (student.user.role !== UserRole.STUDENT || student.user.isSuspended) {
    return NextResponse.json(
      {
        error:
          "This linked account cannot be reset as a student login. Contact the platform administrator.",
      },
      { status: 409 },
    );
  }

  const temporaryPassword = oneTimeSecret();
  await prisma.$transaction(async (tx) => {
    const updated = await tx.user.updateMany({
      where: {
        id: student.user!.id,
        schoolId: user.schoolId,
        role: UserRole.STUDENT,
        isSuspended: false,
      },
      data: {
        passwordHash: await passwordHash(temporaryPassword),
        isActive: true,
        mustChangePassword: true,
        tokenVersion: { increment: 1 },
      },
    });
    if (updated.count !== 1) throw new Error("STUDENT_ACCOUNT_RESET_CONFLICT");
    await tx.studentActivationToken.updateMany({
      where: { userId: student.user!.id, usedAt: null, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    await tx.guardianContactVerificationToken.updateMany({
      where: { userId: student.user!.id, usedAt: null, revokedAt: null },
      data: { revokedAt: new Date() },
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
      isActive: true,
      temporaryPassword,
      mustChangePassword: true,
      sessionsRevoked: true,
    },
  });
}
