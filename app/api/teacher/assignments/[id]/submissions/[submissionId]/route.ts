import { AssignmentStatus, AssignmentSubmissionStatus } from "@prisma/client";
import { NextRequest } from "next/server";
import { z } from "zod";
import {
  getAssignmentTeacherContext,
  recordAssignmentAudit,
  validateAssignmentScore,
} from "@/lib/assignments";
import { prisma } from "@/lib/prisma";
import { jsonNoStore } from "@/lib/requests";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const patchSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("GRADE"),
    score: z.number().int(),
    feedback: z.string().trim().max(5_000).optional().nullable(),
  }),
  z.object({
    action: z.literal("RETURN"),
    feedback: z.string().trim().min(3).max(5_000),
  }),
]);

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; submissionId: string }> },
) {
  const { id, submissionId } = await params;
  const context = await getAssignmentTeacherContext();
  if (!context) {
    return jsonNoStore(
      { error: "Assignment access is not available for this account." },
      { status: 403 },
    );
  }

  const assignment = await prisma.assignment.findFirst({
    where: {
      id,
      schoolId: context.user.schoolId,
      teacherProfileId: context.teacherProfile.id,
    },
    select: { id: true, maxScore: true, status: true },
  });
  if (!assignment) return jsonNoStore({ error: "Assignment not found." }, { status: 404 });

  const submission = await prisma.assignmentSubmission.findFirst({
    where: { id: submissionId, assignmentId: assignment.id, schoolId: context.user.schoolId },
  });
  if (!submission) return jsonNoStore({ error: "Submission not found." }, { status: 404 });

  let input: z.infer<typeof patchSchema>;
  try {
    input = patchSchema.parse(await request.json());
  } catch (error) {
    const message =
      error instanceof z.ZodError ? error.issues[0]?.message : "Could not read the grading action.";
    return jsonNoStore({ error: message ?? "Could not read the grading action." }, { status: 422 });
  }

  if (input.action === "GRADE") {
    if (submission.status === AssignmentSubmissionStatus.RETURNED) {
      return jsonNoStore(
        { error: "This work was returned for revision. Wait for the student to resubmit." },
        { status: 409 },
      );
    }
    const scoreError = validateAssignmentScore(input.score, assignment.maxScore);
    if (scoreError) return jsonNoStore({ error: scoreError }, { status: 422 });

    const updated = await prisma.assignmentSubmission.update({
      where: { id: submission.id },
      data: {
        status: AssignmentSubmissionStatus.GRADED,
        score: input.score,
        feedback: input.feedback?.trim() || null,
        gradedAt: new Date(),
        gradedByUserId: context.user.id,
      },
    });
    await recordAssignmentAudit({
      request,
      schoolId: context.user.schoolId,
      actorUserId: context.user.id,
      action: "ASSIGNMENT_SUBMISSION_GRADED",
      entityType: "AssignmentSubmission",
      entityId: submission.id,
      metadata: {
        assignmentId: assignment.id,
        previousScore: submission.score,
        score: updated.score,
        maxScore: assignment.maxScore,
      },
    });
    return jsonNoStore({
      ok: true,
      submission: {
        id: updated.id,
        status: updated.status,
        score: updated.score,
        feedback: updated.feedback,
        gradedAt: updated.gradedAt?.toISOString() ?? null,
      },
    });
  }

  if (assignment.status !== AssignmentStatus.PUBLISHED) {
    return jsonNoStore(
      {
        error:
          "Work can only be returned for revision while the assignment is published, so the student can resubmit it.",
      },
      { status: 409 },
    );
  }

  const updated = await prisma.assignmentSubmission.update({
    where: { id: submission.id },
    data: {
      status: AssignmentSubmissionStatus.RETURNED,
      score: null,
      feedback: input.feedback,
      gradedAt: null,
      gradedByUserId: null,
    },
  });
  await recordAssignmentAudit({
    request,
    schoolId: context.user.schoolId,
    actorUserId: context.user.id,
    action: "ASSIGNMENT_SUBMISSION_RETURNED",
    entityType: "AssignmentSubmission",
    entityId: submission.id,
    metadata: { assignmentId: assignment.id, previousScore: submission.score },
  });
  return jsonNoStore({
    ok: true,
    submission: {
      id: updated.id,
      status: updated.status,
      score: updated.score,
      feedback: updated.feedback,
      gradedAt: null,
    },
  });
}
