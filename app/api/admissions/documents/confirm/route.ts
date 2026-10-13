import { NextRequest } from "next/server";
import { confirmDocumentSchema, DOCUMENT_RULES } from "@/lib/admissions";
import { findAuthorizedApplication } from "@/lib/admission-service";
import { scanStoredDocumentSafe } from "@/lib/malware";
import { prisma } from "@/lib/prisma";
import { getClientIp, jsonNoStore } from "@/lib/requests";
import { enforceRateLimit } from "@/lib/rate-limit";
import { StorageNotConfiguredError, verifyStoredDocument } from "@/lib/storage";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const ipAddress = getClientIp(request);
  const limit = await enforceRateLimit("upload", ipAddress);
  if (!limit.success) {
    return jsonNoStore(
      { error: "Please wait before trying again." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } },
    );
  }

  try {
    const payload = confirmDocumentSchema.parse(await request.json());
    const rule = DOCUMENT_RULES[payload.documentType];
    if (!rule.acceptedTypes.includes(payload.contentType) || payload.sizeBytes > rule.maxBytes) {
      return jsonNoStore(
        { error: "This file does not meet the document requirements." },
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

    const expectedPrefix = `${(process.env.S3_ADMISSIONS_PREFIX || "admissions").replace(/^\/+|\/+$/g, "")}/${payload.applicationId}/`;
    if (!payload.storageKey.startsWith(expectedPrefix)) {
      return jsonNoStore({ error: "Invalid upload location." }, { status: 422 });
    }

    const exists = await verifyStoredDocument(payload.storageKey, payload.sizeBytes);
    if (!exists) {
      return jsonNoStore(
        { error: "We could not confirm the uploaded file. Please upload it again." },
        { status: 422 },
      );
    }

    await prisma.admissionDocument.upsert({
      where: {
        applicationId_type: {
          applicationId: application.id,
          type: payload.documentType,
        },
      },
      create: {
        applicationId: application.id,
        type: payload.documentType,
        fileName: payload.fileName,
        contentType: payload.contentType,
        sizeBytes: payload.sizeBytes,
        storageKey: payload.storageKey,
      },
      update: {
        fileName: payload.fileName,
        contentType: payload.contentType,
        sizeBytes: payload.sizeBytes,
        storageKey: payload.storageKey,
        uploadedAt: new Date(),
        // A re-upload invalidates any previous scan verdict.
        scanStatus: "PENDING",
        scannedAt: null,
        scanResult: null,
      },
    });

    // C-006: malware-scan the uploaded bytes before accepting the document.
    // INFECTED is refused outright (the row stays flagged for audit);
    // a scanner outage leaves the document PENDING rather than assumed clean.
    const scan = await scanStoredDocumentSafe(payload.storageKey);
    if (scan.status !== "PENDING") {
      await prisma.admissionDocument.update({
        where: { storageKey: payload.storageKey },
        data: { scanStatus: scan.status, scannedAt: new Date(), scanResult: scan.detail ?? null },
      });
    }
    if (scan.status === "INFECTED") {
      return jsonNoStore(
        { error: "This file did not pass our security scan. Please upload a clean copy." },
        { status: 422 },
      );
    }

    return jsonNoStore({ ok: true, scanStatus: scan.status }, { status: 201 });
  } catch (error: unknown) {
    if (error instanceof Error && "issues" in error) {
      return jsonNoStore({ error: "Please check the file and try again." }, { status: 422 });
    }
    if (error instanceof StorageNotConfiguredError) {
      logger.error("Admission document confirmation skipped: object storage is not configured", {
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
    logger.error("Admission document confirmation failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    return jsonNoStore(
      { error: "We could not save this document. Please try again." },
      { status: 500 },
    );
  }
}
