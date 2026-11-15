import { UserRole } from "@prisma/client";
import bcrypt from "bcryptjs";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { hashStudentActivationToken } from "@/lib/student-accounts";
import { getClientIp } from "@/lib/requests";
import { enforceRateLimit } from "@/lib/rate-limit";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({
  token: z.string().min(20).max(200),
  password: z
    .string()
    .min(12)
    .max(128)
    .regex(/[A-Z]/, "Use an uppercase letter.")
    .regex(/[a-z]/, "Use a lowercase letter.")
    .regex(/[0-9]/, "Use a number."),
});

export async function POST(request: NextRequest) {
  const limit = await enforceRateLimit("studentActivate", getClientIp(request));
  if (!limit.success) {
    return NextResponse.json(
      { error: "Too many activation attempts. Please wait and try again." },
      {
        status: limit.configurationError ? 503 : 429,
        headers: { "Retry-After": String(limit.retryAfterSeconds) },
      },
    );
  }

  let input: z.infer<typeof schema>;
  try {
    input = schema.parse(await request.json());
  } catch {
    return NextResponse.json(
      { error: "Use a 12+ character password with uppercase, lowercase and a number." },
      { status: 400 },
    );
  }

  const activation = await prisma.studentActivationToken.findUnique({
    where: { tokenHash: hashStudentActivationToken(input.token) },
    select: {
      id: true,
      schoolId: true,
      studentProfileId: true,
      userId: true,
      expiresAt: true,
      deliveryStatus: true,
      usedAt: true,
      revokedAt: true,
    },
  });
  const now = new Date();
  if (
    !activation ||
    activation.usedAt ||
    activation.revokedAt ||
    activation.expiresAt <= now ||
    activation.deliveryStatus !== "ACCEPTED"
  ) {
    return NextResponse.json(
      { error: "This student activation link is invalid or expired." },
      { status: 410 },
    );
  }

  const newPasswordHash = await bcrypt.hash(input.password, 12);
  try {
    await prisma.$transaction(async (tx) => {
      // Lock in user → profile → activation-token order, matching password reset
      // and guardian-contact edits so concurrent reset/activation cannot deadlock
      // or revive a credential for a contact that changed during redemption.
      await tx.$queryRaw`SELECT "id" FROM "User" WHERE "id" = ${activation.userId} AND "schoolId" = ${activation.schoolId} FOR UPDATE`;
      await tx.$queryRaw`SELECT "id" FROM "StudentProfile" WHERE "id" = ${activation.studentProfileId} AND "schoolId" = ${activation.schoolId} FOR UPDATE`;
      const claimed = await tx.studentActivationToken.updateMany({
        where: {
          id: activation.id,
          schoolId: activation.schoolId,
          deliveryStatus: "ACCEPTED",
          usedAt: null,
          revokedAt: null,
          expiresAt: { gt: now },
        },
        data: { usedAt: now },
      });
      if (claimed.count !== 1) throw new Error("STUDENT_ACTIVATION_INVALID");

      const linkedProfile = await tx.studentProfile.findFirst({
        where: {
          id: activation.studentProfileId,
          schoolId: activation.schoolId,
          userId: activation.userId,
        },
        select: { id: true },
      });
      if (!linkedProfile) throw new Error("STUDENT_ACTIVATION_INVALID");

      const activated = await tx.user.updateMany({
        where: {
          id: activation.userId,
          schoolId: activation.schoolId,
          role: UserRole.STUDENT,
          isActive: false,
          isSuspended: false,
        },
        data: {
          passwordHash: newPasswordHash,
          isActive: true,
          mustChangePassword: false,
          tokenVersion: { increment: 1 },
        },
      });
      if (activated.count !== 1) throw new Error("STUDENT_ACTIVATION_INVALID");

      await tx.studentActivationToken.updateMany({
        where: {
          userId: activation.userId,
          id: { not: activation.id },
          usedAt: null,
          revokedAt: null,
        },
        data: { revokedAt: now },
      });
      await tx.auditLog.create({
        data: {
          schoolId: activation.schoolId,
          action: "STUDENT_ACCOUNT_ACTIVATED",
          entityType: "StudentProfile",
          entityId: activation.studentProfileId,
          metadata: { activationTokenId: activation.id },
        },
      });
    });

    // Deliberately do not create a session here: the guardian verifies the
    // channel, while the student signs in separately with their own account.
    return NextResponse.json({
      ok: true,
      message: "Student account activated. The student can now sign in.",
    });
  } catch (error) {
    if (error instanceof Error && error.message === "STUDENT_ACTIVATION_INVALID") {
      return NextResponse.json(
        { error: "This student activation link is invalid or expired." },
        { status: 410 },
      );
    }
    logger.error("Student account activation failed", {
      schoolId: activation.schoolId,
      studentProfileId: activation.studentProfileId,
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { error: "Could not activate this student account. Please try again." },
      { status: 500 },
    );
  }
}
