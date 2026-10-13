import { NextRequest } from "next/server";
import { DOCUMENT_RULES, uploadUrlSchema } from "@/lib/admissions";
import { findAuthorizedApplication } from "@/lib/admission-service";
import { getClientIp, jsonNoStore } from "@/lib/requests";
import { enforceRateLimit } from "@/lib/rate-limit";
import { createSecureUploadUrl, StorageNotConfiguredError } from "@/lib/storage";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const ipAddress = getClientIp(request);
  const limit = await enforceRateLimit("upload", ipAddress);
  if (!limit.success) {
    return jsonNoStore(
      {
        error: limit.configurationError
          ? "The upload service is temporarily unavailable."
          : "Too many upload attempts. Please wait and try again.",
      },
      {
        status: limit.configurationError ? 503 : 429,
        headers: { "Retry-After": String(limit.retryAfterSeconds) },
      },
    );
  }

  try {
    const payload = uploadUrlSchema.parse(await request.json());
    const rule = DOCUMENT_RULES[payload.documentType];

    if (!rule.acceptedTypes.includes(payload.contentType) || payload.sizeBytes > rule.maxBytes) {
      return jsonNoStore(
        { error: `This file does not meet the requirements for ${rule.label}.` },
        { status: 422 },
      );
    }

    const application = await findAuthorizedApplication(payload.applicationId, payload.uploadToken);
    if (!application || application.status !== "DRAFT") {
      return jsonNoStore(
        { error: "Your upload session has expired. Please restart your application." },
        { status: 401 },
      );
    }

    const { storageKey, uploadUrl } = await createSecureUploadUrl(payload);
    return jsonNoStore({ storageKey, uploadUrl, expiresInSeconds: 600 });
  } catch (error: unknown) {
    if (error instanceof Error && "issues" in error) {
      return jsonNoStore(
        { error: "Please check the selected file and try again." },
        { status: 422 },
      );
    }
    if (error instanceof StorageNotConfiguredError) {
      logger.error("Admission uploads unavailable: object storage is not configured", {
        error: error.message,
      });
      return jsonNoStore(
        {
          error:
            "Document uploads are temporarily unavailable. Please try again later, or contact the school office.",
        },
        { status: 503 },
      );
    }
    logger.error("Admission upload URL failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    return jsonNoStore(
      { error: "We could not prepare your upload. Please try again." },
      { status: 500 },
    );
  }
}
