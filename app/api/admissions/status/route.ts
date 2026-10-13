import { ApplicationStatus } from "@prisma/client";
import { NextRequest } from "next/server";
import { applicationStatusSchema } from "@/lib/admissions";
import { getApplicationForStatus } from "@/lib/admission-service";
import { getClientIp, jsonNoStore } from "@/lib/requests";
import { enforceRateLimit } from "@/lib/rate-limit";
import { logger } from "@/lib/logger";

const statusContent: Record<
  ApplicationStatus,
  { label: string; message: string; tone: "info" | "warning" | "success" | "error" }
> = {
  DRAFT: { label: "Draft", message: "This application has not been submitted yet.", tone: "info" },
  PENDING_REVIEW: {
    label: "Pending review",
    message:
      "Your application is with our admissions team. We will contact you using your registered email and phone number within 3–5 business days.",
    tone: "info",
  },
  DOCUMENTS_REQUESTED: {
    label: "Documents requested",
    message:
      "Our admissions team needs additional information before a decision can be made. Please check your registered email or contact the admissions office.",
    tone: "warning",
  },
  APPROVED: {
    label: "Approved",
    message:
      "Congratulations. Your application has been approved. Please check your registered email and phone for the next enrolment steps.",
    tone: "success",
  },
  DECLINED: {
    label: "Decision completed",
    message:
      "A decision has been made on this application. Please contact the admissions office if you need further guidance.",
    tone: "error",
  },
  WAITLISTED: {
    label: "Waitlisted",
    message:
      "Your application is on our waitlist. We will contact you if a place becomes available.",
    tone: "warning",
  },
};

export async function GET(request: NextRequest) {
  const ipAddress = getClientIp(request);
  const limit = await enforceRateLimit("status", ipAddress);
  if (!limit.success) {
    return jsonNoStore(
      { error: "Please wait before trying again." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } },
    );
  }

  const parsed = applicationStatusSchema.safeParse({
    applicationId: request.nextUrl.searchParams.get("applicationId") || "",
  });

  if (!parsed.success) {
    return jsonNoStore({ error: "Enter a valid Application ID." }, { status: 422 });
  }

  try {
    const application = await getApplicationForStatus(parsed.data.applicationId);
    if (!application) {
      return jsonNoStore(
        {
          error:
            "We could not find a submitted application with that ID. Check the ID and try again.",
        },
        { status: 404 },
      );
    }

    const content = statusContent[application.status];
    return jsonNoStore({
      applicationId: application.applicationId,
      applicant: `${application.firstName} ${application.lastName.slice(0, 1)}.`,
      classApplying: application.classApplying,
      status: application.status,
      statusLabel: content.label,
      message: application.statusNote || content.message,
      tone: content.tone,
      submittedAt: application.submittedAt?.toISOString() || null,
    });
  } catch (error) {
    logger.error("Admission status lookup failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    return jsonNoStore(
      { error: "We could not check the application status right now. Please try again shortly." },
      { status: 500 },
    );
  }
}
