import { AdmissionDocumentType, ApplicationStatus } from "@prisma/client";
import { NextRequest } from "next/server";
import { APPLICATION_FEE_KOBO, submitApplicationSchema } from "@/lib/admissions";
import {
  findAuthorizedApplication,
  markApplicationPaid,
  writeAdmissionAuditLog,
} from "@/lib/admission-service";
import { verifyPaystackTransaction } from "@/lib/paystack";
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
      { error: "Please wait before trying again." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } },
    );
  }

  try {
    const payload = submitApplicationSchema.parse(await request.json());
    const application = await findAuthorizedApplication(payload.applicationId, payload.uploadToken);

    if (!application) {
      return jsonNoStore(
        { error: "Your application session has expired. Please restart your application." },
        { status: 401 },
      );
    }

    if (application.status !== ApplicationStatus.DRAFT) {
      return jsonNoStore(
        { applicationId: application.applicationId, status: application.status },
        { status: 200 },
      );
    }

    if (application.paymentReference !== payload.paymentReference) {
      return jsonNoStore(
        { error: "The payment reference does not match this application." },
        { status: 422 },
      );
    }

    const uploaded = new Set<AdmissionDocumentType>(
      application.documents.map((document) => document.type),
    );
    if (!requiredDocumentTypes.every((type) => uploaded.has(type))) {
      return jsonNoStore(
        { error: "All required documents must be uploaded before you submit." },
        { status: 422 },
      );
    }

    const transaction = await verifyPaystackTransaction(
      payload.paymentReference,
      APPLICATION_FEE_KOBO,
      application.parentEmail,
    );

    await markApplicationPaid(application.applicationId, payload.paymentReference, transaction);
    const submitted = await prisma.admissionApplication.update({
      where: { id: application.id },
      data: {
        status: ApplicationStatus.PENDING_REVIEW,
        submittedAt: new Date(),
      },
    });

    await writeAdmissionAuditLog({
      schoolId: submitted.schoolId,
      action: "ADMISSION_APPLICATION_SUBMITTED",
      entityId: submitted.applicationId,
      ipAddress,
      metadata: { paymentReference: payload.paymentReference },
    });

    return jsonNoStore(
      {
        applicationId: submitted.applicationId,
        status: submitted.status,
        submittedAt: submitted.submittedAt?.toISOString(),
      },
      { status: 201 },
    );
  } catch (error: unknown) {
    if (error instanceof Error && "issues" in error) {
      return jsonNoStore(
        { error: "Please check your application and try again." },
        { status: 422 },
      );
    }
    const message =
      error instanceof Error
        ? error.message
        : "We could not submit your application. Please try again.";
    logger.error("Admission submission failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    return jsonNoStore({ error: message }, { status: 500 });
  }
}
