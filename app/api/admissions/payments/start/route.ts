import { AdmissionDocumentType, PaymentProvider, PaymentStatus } from "@prisma/client";
import { NextRequest } from "next/server";
import { APPLICATION_FEE_KOBO, startPaymentSchema } from "@/lib/admissions";
import { findAuthorizedApplication } from "@/lib/admission-service";
import { getPaystackPublicKey } from "@/lib/paystack";
import { prisma } from "@/lib/prisma";
import { getClientIp, jsonNoStore } from "@/lib/requests";
import { enforceRateLimit } from "@/lib/rate-limit";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";

const requiredDocumentTypes: AdmissionDocumentType[] = [
  "BIRTH_CERTIFICATE",
  "PASSPORT_PHOTO",
  "REPORT_CARD",
];

export async function POST(request: NextRequest) {
  const ipAddress = getClientIp(request);
  const limit = await enforceRateLimit("payment", ipAddress);
  if (!limit.success) {
    return jsonNoStore(
      {
        error: limit.configurationError
          ? "The payment service is temporarily unavailable."
          : "Too many payment attempts. Please wait and try again.",
      },
      {
        status: limit.configurationError ? 503 : 429,
        headers: { "Retry-After": String(limit.retryAfterSeconds) },
      },
    );
  }

  try {
    const payload = startPaymentSchema.parse(await request.json());
    const application = await findAuthorizedApplication(payload.applicationId, payload.uploadToken);

    if (!application || application.status !== "DRAFT") {
      return jsonNoStore(
        { error: "Your application session has expired. Please restart your application." },
        { status: 401 },
      );
    }

    const uploaded = new Set<AdmissionDocumentType>(
      application.documents.map((document) => document.type),
    );
    if (!requiredDocumentTypes.every((type) => uploaded.has(type))) {
      return jsonNoStore(
        { error: "Please upload all required documents before payment." },
        { status: 422 },
      );
    }

    const reference =
      application.paymentReference ||
      `YKC-${application.applicationId}-${crypto.randomUUID().replaceAll("-", "").slice(0, 10).toUpperCase()}`;
    await prisma.admissionApplication.update({
      where: { id: application.id },
      data: { paymentReference: reference, paymentStatus: PaymentStatus.PENDING },
    });

    await prisma.paymentTransaction.upsert({
      where: { applicationId: application.id },
      create: {
        applicationId: application.id,
        reference,
        provider: PaymentProvider.PAYSTACK,
        amountKobo: APPLICATION_FEE_KOBO,
        status: PaymentStatus.PENDING,
      },
      update: { reference, status: PaymentStatus.PENDING },
    });

    return jsonNoStore({
      publicKey: getPaystackPublicKey(),
      reference,
      amountKobo: APPLICATION_FEE_KOBO,
      email: application.parentEmail,
    });
  } catch (error: unknown) {
    if (error instanceof Error && "issues" in error) {
      return jsonNoStore(
        { error: "Please restart your application and try again." },
        { status: 422 },
      );
    }
    logger.error("Admission payment initialization failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    return jsonNoStore(
      { error: "We could not start the payment. Please try again." },
      { status: 500 },
    );
  }
}
