import { NextRequest } from "next/server";
import { createDraftSchema, draftAccessSchema } from "@/lib/admissions";
import {
  admissionDraftToData,
  findAuthorizedApplication,
  updateDraft,
  writeAdmissionAuditLog,
} from "@/lib/admission-service";
import { prisma } from "@/lib/prisma";
import { getClientIp, jsonNoStore } from "@/lib/requests";
import { enforceRateLimit } from "@/lib/rate-limit";
import { createApplicationId, createOpaqueToken, hashToken } from "@/lib/security";
import { getSchool } from "@/lib/school";
import { z } from "zod";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";

const updateDraftSchema = z.object({
  applicationId: draftAccessSchema.shape.applicationId,
  uploadToken: draftAccessSchema.shape.uploadToken,
  draft: createDraftSchema,
});

export async function POST(request: NextRequest) {
  const ipAddress = getClientIp(request);
  const limit = await enforceRateLimit("draft", ipAddress);

  if (!limit.success) {
    return jsonNoStore(
      {
        error: limit.configurationError
          ? "The application service is temporarily unavailable. Please try again shortly."
          : "Too many attempts. Please wait before trying again.",
      },
      {
        status: limit.configurationError ? 503 : 429,
        headers: { "Retry-After": String(limit.retryAfterSeconds) },
      },
    );
  }

  try {
    const payload = createDraftSchema.parse(await request.json());
    const school = await getSchool();
    const uploadToken = createOpaqueToken();
    const uploadTokenExpiresAt = new Date(Date.now() + 2 * 60 * 60 * 1000);

    for (let attempt = 0; attempt < 5; attempt += 1) {
      const applicationId = createApplicationId();
      try {
        await prisma.admissionApplication.create({
          data: {
            applicationId,
            schoolId: school.id,
            ...admissionDraftToData(payload),
            uploadTokenHash: hashToken(uploadToken),
            uploadTokenExpiresAt,
          },
        });

        await writeAdmissionAuditLog({
          schoolId: school.id,
          action: "ADMISSION_DRAFT_CREATED",
          entityId: applicationId,
          ipAddress,
        });

        return jsonNoStore(
          {
            applicationId,
            uploadToken,
            uploadTokenExpiresAt: uploadTokenExpiresAt.toISOString(),
          },
          { status: 201 },
        );
      } catch (error: unknown) {
        if (!(typeof error === "object" && error && "code" in error && error.code === "P2002"))
          throw error;
      }
    }

    return jsonNoStore({ error: "Please try creating your application again." }, { status: 503 });
  } catch (error: unknown) {
    if (error instanceof Error && "issues" in error) {
      return jsonNoStore(
        { error: "Please correct the highlighted fields and try again." },
        { status: 422 },
      );
    }
    logger.error("Admission draft creation failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    return jsonNoStore(
      { error: "We could not start your application. Please try again." },
      { status: 500 },
    );
  }
}

export async function PUT(request: NextRequest) {
  const ipAddress = getClientIp(request);
  const limit = await enforceRateLimit("draft", ipAddress);
  if (!limit.success) {
    return jsonNoStore(
      { error: "Please wait before trying again." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } },
    );
  }

  try {
    const payload = updateDraftSchema.parse(await request.json());
    const application = await findAuthorizedApplication(payload.applicationId, payload.uploadToken);
    if (!application || application.status !== "DRAFT") {
      return jsonNoStore(
        { error: "Your application session has expired. Please restart your application." },
        { status: 401 },
      );
    }

    await updateDraft(application.applicationId, payload.draft);
    return jsonNoStore({ ok: true });
  } catch (error: unknown) {
    if (error instanceof Error && "issues" in error) {
      return jsonNoStore(
        { error: "Please correct the highlighted fields and try again." },
        { status: 422 },
      );
    }
    logger.error("Admission draft update failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    return jsonNoStore(
      { error: "We could not save your changes. Please try again." },
      { status: 500 },
    );
  }
}
