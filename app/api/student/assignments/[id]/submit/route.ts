import { AssignmentSubmissionStatus } from "@prisma/client";
import { NextRequest } from "next/server";
import { z } from "zod";
import {
  canStudentSubmitAssignment,
  getLearningStudentContext,
  MAX_ASSIGNMENT_CONTENT_LENGTH,
  normalizeHttpsUrl,
  recordAssignmentAudit,
} from "@/lib/assignments";
import { prisma } from "@/lib/prisma";
import { jsonNoStore } from "@/lib/requests";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const submitSchema = z.object({
  content: z.string().trim().min(1).max(MAX_ASSIGNMENT_CONTENT_LENGTH),
  attachmentUrl: z.string().trim().max(2048).optional().nullable(),
});

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const context = await getLearningStudentContext();
  if (!context) {
    return jsonNoStore(
      { error: "No live student profile is linked to this account yet." },
      { status: 404 },
    );
  }

  let input: z.infer<typeof submitSchema>;
  try {
    input = submitSchema.parse(await request.json());
  } catch (error) {
    const message =
      error instanceof z.ZodError ? error.issues[0]?.message : "Could not read the submission.";
    return jsonNoStore({ error: message ?? "Could not read the submission." }, { status: 422 });
  }

  const attachmentUrl = input.attachmentUrl?.trim() ? normalizeHttpsUrl(input.attachmentUrl) : null;
  if (input.attachmentUrl?.trim() && !attachmentUrl) {
    return jsonNoStore(
      { error: "Attachment link must be a valid HTTPS link without embedded credentials." },
      { status: 422 },
    );
  }

  const assignment = await prisma.assignment.findFirst({
    where: {
      id,
      schoolId: context.user.schoolId,
      classId: context.profile.currentClass.id,
    },
  });
  if (!assignment) return jsonNoStore({ error: "Assignment not found." }, { status: 404 });

  const existing = await prisma.assignmentSubmission.findUnique({
    where: {
      assignmentId_studentProfileId: {
        assignmentId: assignment.id,
        studentProfileId: context.profile.id,
      },
    },
  });

  const now = new Date();
  const decision = canStudentSubmitAssignment({
    assignmentStatus: assignment.status,
    dueAt: assignment.dueAt,
    existingStatus: existing?.status ?? null,
    now,
  });
  if (!decision.allowed) {
    return jsonNoStore({ error: decision.reason }, { status: 409 });
  }

  const submission = await prisma.assignmentSubmission.upsert({
    where: {
      assignmentId_studentProfileId: {
        assignmentId: assignment.id,
        studentProfileId: context.profile.id,
      },
    },
    create: {
      schoolId: context.user.schoolId,
      assignmentId: assignment.id,
      studentProfileId: context.profile.id,
      content: input.content,
      attachmentUrl,
      status: AssignmentSubmissionStatus.SUBMITTED,
      submittedAt: now,
    },
    update: {
      content: input.content,
      attachmentUrl,
      status: AssignmentSubmissionStatus.SUBMITTED,
      score: null,
      feedback: null,
      submittedAt: now,
      gradedAt: null,
      gradedByUserId: null,
    },
  });

  await recordAssignmentAudit({
    request,
    schoolId: context.user.schoolId,
    actorUserId: context.user.id,
    action: existing ? "ASSIGNMENT_RESUBMITTED" : "ASSIGNMENT_SUBMITTED",
    entityType: "AssignmentSubmission",
    entityId: submission.id,
    metadata: {
      assignmentId: assignment.id,
      studentProfileId: context.profile.id,
      isLate: decision.isLate,
    },
  });

  return jsonNoStore({
    ok: true,
    isLate: decision.isLate,
    submission: {
      id: submission.id,
      content: submission.content,
      attachmentUrl: submission.attachmentUrl,
      status: submission.status,
      submittedAt: submission.submittedAt.toISOString(),
    },
  });
}
