import {
  StudentActivationChannel,
  StudentActivationDeliveryStatus,
  UserRole,
} from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  deliverStudentActivation,
  hashGuardianContact,
  hashStudentActivationToken,
  issueStudentActivationInTransaction,
  normalizeGuardianContact,
} from "@/lib/student-accounts";
import { getClientIp } from "@/lib/requests";
import { enforceRateLimit } from "@/lib/rate-limit";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({ token: z.string().min(20).max(200) });
const invalidResponse = () =>
  NextResponse.json(
    { error: "This guardian verification link is invalid or expired." },
    { status: 410 },
  );

export async function POST(request: NextRequest) {
  const limit = await enforceRateLimit("studentActivate", getClientIp(request));
  if (!limit.success) {
    return NextResponse.json(
      { error: "Too many verification attempts. Please wait and try again." },
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
      { error: "This guardian verification link is invalid or expired." },
      { status: 400 },
    );
  }

  const record = await prisma.guardianContactVerificationToken.findUnique({
    where: { tokenHash: hashStudentActivationToken(input.token) },
    select: {
      id: true,
      schoolId: true,
      studentProfileId: true,
      userId: true,
      contactHash: true,
      channel: true,
      deliveryStatus: true,
      expiresAt: true,
      usedAt: true,
      revokedAt: true,
    },
  });
  const now = new Date();
  if (
    !record ||
    record.usedAt ||
    record.revokedAt ||
    record.expiresAt <= now ||
    record.deliveryStatus !== StudentActivationDeliveryStatus.ACCEPTED
  ) {
    return invalidResponse();
  }

  try {
    const activation = await prisma.$transaction(async (tx) => {
      // Match the student-profile-first lock order used by guardian-contact edits.
      // A contact cannot change between snapshot validation and activation-link creation.
      await tx.$queryRaw`SELECT "id" FROM "StudentProfile" WHERE "id" = ${record.studentProfileId} AND "schoolId" = ${record.schoolId} FOR UPDATE`;
      const claimed = await tx.guardianContactVerificationToken.updateMany({
        where: {
          id: record.id,
          schoolId: record.schoolId,
          deliveryStatus: StudentActivationDeliveryStatus.ACCEPTED,
          usedAt: null,
          revokedAt: null,
          expiresAt: { gt: now },
        },
        data: { usedAt: now, verifiedAt: now },
      });
      if (claimed.count !== 1) throw new Error("GUARDIAN_VERIFICATION_INVALID");

      const profile = await tx.studentProfile.findFirst({
        where: {
          id: record.studentProfileId,
          schoolId: record.schoolId,
          userId: record.userId,
        },
        select: {
          id: true,
          isActive: true,
          guardianEmail: true,
          guardianPhone: true,
          user: {
            select: { id: true, email: true, role: true, isActive: true, isSuspended: true },
          },
        },
      });
      if (
        !profile?.user ||
        !profile.isActive ||
        profile.user.id !== record.userId ||
        profile.user.role !== UserRole.STUDENT ||
        profile.user.isActive ||
        profile.user.isSuspended
      ) {
        throw new Error("GUARDIAN_VERIFICATION_INVALID");
      }

      const contacts = normalizeGuardianContact({
        email: profile.guardianEmail,
        phone: profile.guardianPhone,
      });
      const verifiedContact =
        record.channel === StudentActivationChannel.EMAIL ? contacts.email : contacts.phone;
      if (
        !verifiedContact ||
        hashGuardianContact(record.channel, verifiedContact) !== record.contactHash
      ) {
        throw new Error("GUARDIAN_VERIFICATION_INVALID");
      }

      const issued = await issueStudentActivationInTransaction(tx, {
        schoolId: record.schoolId,
        studentProfileId: profile.id,
        userId: profile.user.id,
        studentLogin: profile.user.email,
        guardianEmail: record.channel === StudentActivationChannel.EMAIL ? contacts.email : null,
        guardianPhone: record.channel === StudentActivationChannel.SMS ? contacts.phone : null,
      });

      await tx.auditLog.create({
        data: {
          schoolId: record.schoolId,
          action: "GUARDIAN_CONTACT_VERIFIED",
          entityType: "StudentProfile",
          entityId: profile.id,
          metadata: {
            verificationTokenId: record.id,
            activationTokenId: issued.tokenId,
            channel: record.channel,
          },
        },
      });
      return issued;
    });

    const delivery = await deliverStudentActivation(activation);
    return NextResponse.json({
      ok: true,
      contactVerified: true,
      activationLinkAcceptedByProvider: delivery.acceptedByProvider,
      activationChannel: delivery.channel,
      message: delivery.acceptedByProvider
        ? "Guardian contact verified. A separate student activation link was accepted by the delivery provider."
        : "Guardian contact verified, but the student activation link was not accepted for delivery. Contact the school office to request a new link.",
    });
  } catch (error) {
    if (error instanceof Error && error.message === "GUARDIAN_VERIFICATION_INVALID")
      return invalidResponse();
    logger.error("Guardian contact verification failed", {
      schoolId: record.schoolId,
      studentProfileId: record.studentProfileId,
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { error: "Could not verify this guardian contact. Please contact the school office." },
      { status: 500 },
    );
  }
}
