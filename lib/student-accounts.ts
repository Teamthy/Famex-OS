import { createHash, createHmac, randomBytes } from "node:crypto";
import {
  Prisma,
  StudentActivationChannel,
  StudentActivationDeliveryStatus,
  UserRole,
} from "@prisma/client";
import { logger } from "@/lib/logger";
import { sendGuardianContactVerificationEmail, sendStudentActivationEmail } from "@/lib/email";
import { passwordHash, oneTimeSecret } from "@/lib/people";
import { prisma } from "@/lib/prisma";
import { sendSmsWithResult } from "@/lib/sms";
import { resolveSiteUrl } from "@/lib/site-url";
import { loginDomain, studentLoginEmail } from "@/lib/student-login";

const TOKEN_TTL_MS = 48 * 60 * 60 * 1000;

type ContactDelivery = {
  tokenId: string;
  token: string;
  schoolId: string;
  studentProfileId: string;
  userId: string;
  studentLogin: string;
  guardianEmail: string | null;
  guardianPhone: string | null;
  channel: StudentActivationChannel;
};

export type GuardianVerificationDelivery = ContactDelivery;
export type StudentActivationDelivery = ContactDelivery;

export type StudentActivationResult = {
  acceptedByProvider: boolean;
  channel: StudentActivationChannel;
};

function tokenHash(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function hashGuardianContact(channel: StudentActivationChannel, contact: string): string {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 32) throw new Error("AUTH_SECRET must be at least 32 characters.");
  return createHmac("sha256", secret).update(`${channel}:${contact}`).digest("hex");
}

function selectedContact(input: { guardianEmail?: string | null; guardianPhone?: string | null }) {
  const guardianEmail = input.guardianEmail?.trim().toLowerCase() || null;
  const guardianPhone = input.guardianPhone?.trim() || null;
  const channel = guardianEmail ? StudentActivationChannel.EMAIL : StudentActivationChannel.SMS;
  if (channel === StudentActivationChannel.SMS && !guardianPhone) {
    throw new Error("A guardian email or phone is required to activate the student account.");
  }
  return { guardianEmail, guardianPhone, channel };
}

function linkUrl(path: string, token: string): string {
  const base = resolveSiteUrl();
  if (!base) throw new Error("Canonical site URL is not configured.");
  const site = new URL(base);
  if (site.protocol !== "https:" || site.hostname === "localhost") {
    throw new Error("Student account links require the canonical HTTPS site URL.");
  }
  const url = new URL(path, site);
  url.searchParams.set("token", token);
  return url.toString();
}

async function createDeliveryToken(
  tx: Prisma.TransactionClient,
  input: ContactDelivery & { purpose: "guardian" | "activation" },
): Promise<ContactDelivery> {
  const data = {
    schoolId: input.schoolId,
    studentProfileId: input.studentProfileId,
    userId: input.userId,
    tokenHash: tokenHash(input.token),
    channel: input.channel,
    expiresAt: new Date(Date.now() + TOKEN_TTL_MS),
  };
  const created =
    input.purpose === "guardian"
      ? await tx.guardianContactVerificationToken.create({
          data: {
            ...data,
            contactHash: hashGuardianContact(
              input.channel,
              input.channel === StudentActivationChannel.EMAIL
                ? input.guardianEmail!
                : input.guardianPhone!,
            ),
          },
          select: { id: true },
        })
      : await tx.studentActivationToken.create({ data, select: { id: true } });
  return { ...input, tokenId: created.id };
}

/** Issue a one-time possession-verification link to the enrollment-supplied contact. */
export async function issueGuardianVerificationInTransaction(
  tx: Prisma.TransactionClient,
  input: Omit<
    ContactDelivery,
    "tokenId" | "token" | "channel" | "guardianEmail" | "guardianPhone"
  > & {
    guardianEmail?: string | null;
    guardianPhone?: string | null;
  },
): Promise<GuardianVerificationDelivery> {
  const contact = selectedContact(input);
  const token = randomBytes(32).toString("base64url");
  const delivery: ContactDelivery = {
    tokenId: "",
    token,
    ...input,
    ...contact,
  };
  await tx.guardianContactVerificationToken.updateMany({
    where: { schoolId: input.schoolId, userId: input.userId, usedAt: null, revokedAt: null },
    data: { revokedAt: new Date() },
  });
  return createDeliveryToken(tx, { ...delivery, purpose: "guardian" });
}

/** Create an active, individually linked STUDENT account with a one-time password. */
export async function provisionStudentAccountInTransaction(
  tx: Prisma.TransactionClient,
  input: {
    schoolId: string;
    studentProfileId: string;
    studentId: string;
    studentName: string;
  },
): Promise<{ email: string; temporaryPassword: string }> {
  const email = studentLoginEmail({
    studentId: input.studentId,
    domain: loginDomain(process.env.STUDENT_EMAIL_DOMAIN || process.env.NEXTAUTH_URL),
  });
  const occupied = await tx.user.findFirst({
    where: { schoolId: input.schoolId, email },
    select: { id: true },
  });
  if (occupied) throw new Error("STUDENT_LOGIN_EMAIL_TAKEN");

  const temporaryPassword = oneTimeSecret();
  const user = await tx.user.create({
    data: {
      schoolId: input.schoolId,
      email,
      name: input.studentName,
      role: UserRole.STUDENT,
      passwordHash: await passwordHash(temporaryPassword),
      isActive: true,
      mustChangePassword: true,
    },
    select: { id: true },
  });
  const linked = await tx.studentProfile.updateMany({
    where: { id: input.studentProfileId, schoolId: input.schoolId, userId: null },
    data: { userId: user.id },
  });
  if (linked.count !== 1) throw new Error("STUDENT_ACCOUNT_LINK_CONFLICT");

  return { email, temporaryPassword };
}

/** Create the student activation link only after the guardian token has been redeemed. */
export async function issueStudentActivationInTransaction(
  tx: Prisma.TransactionClient,
  input: {
    schoolId: string;
    studentProfileId: string;
    userId: string;
    studentLogin: string;
    guardianEmail?: string | null;
    guardianPhone?: string | null;
  },
): Promise<StudentActivationDelivery> {
  const contact = selectedContact(input);
  const token = randomBytes(32).toString("base64url");
  const delivery: ContactDelivery = { tokenId: "", token, ...input, ...contact };
  await tx.studentActivationToken.updateMany({
    where: { schoolId: input.schoolId, userId: input.userId, usedAt: null, revokedAt: null },
    data: { revokedAt: new Date() },
  });
  return createDeliveryToken(tx, { ...delivery, purpose: "activation" });
}

/** Send the guardian possession-verification link; provider acceptance is not delivery. */
export async function deliverGuardianVerification(
  verification: GuardianVerificationDelivery,
): Promise<StudentActivationResult> {
  const acceptedByProvider = await dispatchContactLink(verification, "guardian");
  try {
    await prisma.guardianContactVerificationToken.updateMany({
      where: {
        id: verification.tokenId,
        schoolId: verification.schoolId,
        deliveryStatus: StudentActivationDeliveryStatus.PENDING,
      },
      data: {
        deliveryStatus: acceptedByProvider
          ? StudentActivationDeliveryStatus.ACCEPTED
          : StudentActivationDeliveryStatus.FAILED,
        acceptedAt: acceptedByProvider ? new Date() : null,
      },
    });
  } catch (error) {
    logger.error("Guardian verification provider result could not be recorded", {
      studentProfileId: verification.studentProfileId,
      error: error instanceof Error ? error.message : String(error),
    });
  }
  return { acceptedByProvider, channel: verification.channel };
}

/** Send a student activation link, only called after guardian possession proof. */
export async function deliverStudentActivation(
  activation: StudentActivationDelivery,
): Promise<StudentActivationResult> {
  const acceptedByProvider = await dispatchContactLink(activation, "activation");
  try {
    await prisma.studentActivationToken.updateMany({
      where: {
        id: activation.tokenId,
        schoolId: activation.schoolId,
        deliveryStatus: StudentActivationDeliveryStatus.PENDING,
      },
      data: {
        deliveryStatus: acceptedByProvider
          ? StudentActivationDeliveryStatus.ACCEPTED
          : StudentActivationDeliveryStatus.FAILED,
        acceptedAt: acceptedByProvider ? new Date() : null,
      },
    });
  } catch (error) {
    logger.error("Student activation provider result could not be recorded", {
      studentProfileId: activation.studentProfileId,
      channel: activation.channel,
      error: error instanceof Error ? error.message : String(error),
    });
  }
  return { acceptedByProvider, channel: activation.channel };
}

async function dispatchContactLink(
  delivery: ContactDelivery,
  purpose: "guardian" | "activation",
): Promise<boolean> {
  try {
    if (delivery.channel === StudentActivationChannel.EMAIL) {
      const to = delivery.guardianEmail;
      if (!to) throw new Error("Guardian email is missing.");
      if (purpose === "guardian") {
        await sendGuardianContactVerificationEmail({
          to,
          token: delivery.token,
        });
      } else {
        await sendStudentActivationEmail({
          to,
          studentLogin: delivery.studentLogin,
          token: delivery.token,
        });
      }
      return true;
    }
    const to = delivery.guardianPhone;
    if (!to) throw new Error("Guardian phone is missing.");
    const url = linkUrl(
      purpose === "guardian" ? "/student/verify-guardian" : "/student/activate",
      delivery.token,
    );
    const message =
      purpose === "guardian"
        ? `Verify the guardian contact for a student portal account: ${url}. This link expires in 48 hours. If you did not expect this, contact the school office.`
        : `Set the password for student login ${delivery.studentLogin}: ${url}`;
    const result = await sendSmsWithResult({ to, message });
    return result.accepted;
  } catch (error) {
    logger.warn(
      purpose === "guardian"
        ? "Guardian verification link dispatch failed"
        : "Student activation link dispatch failed",
      {
        studentProfileId: delivery.studentProfileId,
        channel: delivery.channel,
        error: error instanceof Error ? error.message : String(error),
      },
    );
    return false;
  }
}

/** Check an incoming one-time account token without exposing whether it belongs to a user. */
export function hashStudentActivationToken(token: string): string {
  return tokenHash(token);
}

export function normalizeGuardianContact(input: { email?: string | null; phone?: string | null }) {
  return {
    email: input.email?.trim().toLowerCase() || null,
    phone: input.phone?.trim() || null,
  };
}
