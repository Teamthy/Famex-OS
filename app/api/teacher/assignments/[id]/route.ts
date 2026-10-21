import { AssignmentStatus } from "@prisma/client";
import { NextRequest } from "next/server";
import { z } from "zod";
import {
  assignmentSubmissionIsLate,
  getAssignmentTeacherContext,
  MAX_ASSIGNMENT_SCORE,
  recordAssignmentAudit,
  summarizeAssignmentSubmissions,
  validateAssignmentDueDate,
} from "@/lib/assignments";
import { prisma } from "@/lib/prisma";
import { jsonNoStore } from "@/lib/requests";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const patchSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("UPDATE"),
    title: z.string().trim().min(3).max(160).optional(),
    instructions: z.string().trim().min(5).max(10_000).optional(),
    dueAt: z.string().trim().min(1).optional(),
    maxScore: z.number().int().min(1).max(MAX_ASSIGNMENT_SCORE).optional(),
  }),
  z.object({ action: z.literal("PUBLISH") }),
  z.object({ action: z.literal("CLOSE") }),
]);

async function loadOwnedAssignment(id: string) {
  const context = await getAssignmentTeacherContext();
  if (!context) return { context: null, assignment: null };
  const assignment = await prisma.assignment.findFirst({
    where: {
      id,
      schoolId: context.user.schoolId,
      teacherProfileId: context.teacherProfile.id,
    },
    include: { classroom: { select: { id: true, displayName: true } } },
  });
  return { context, assignment };
}

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { context, assignment } = await loadOwnedAssignment(id);
  if (!context) {
    return jsonNoStore(
      { error: "Assignment access is not available for this account." },
      { status: 403 },
    );
  }
  if (!assignment) return jsonNoStore({ error: "Assignment not found." }, { status: 404 });

  const [roster, submissions] = await Promise.all([
    prisma.studentProfile.findMany({
      where: {
        schoolId: context.user.schoolId,
        currentClassId: assignment.classId,
        isActive: true,
      },
      orderBy: { displayName: "asc" },
      select: { id: true, studentId: true, displayName: true },
    }),
    prisma.assignmentSubmission.findMany({
      where: { schoolId: context.user.schoolId, assignmentId: assignment.id },
      orderBy: { submittedAt: "asc" },
      include: {
        studentProfile: { select: { id: true, studentId: true, displayName: true } },
      },
    }),
  ]);

  const submissionByStudent = new Map(
    submissions.map((submission) => [submission.studentProfileId, submission]),
  );

  return jsonNoStore({
    assignment: {
      id: assignment.id,
      classId: assignment.classId,
      className: assignment.classroom.displayName,
      subjectName: assignment.subjectName,
      title: assignment.title,
      instructions: assignment.instructions,
      dueAt: assignment.dueAt.toISOString(),
      maxScore: assignment.maxScore,
      status: assignment.status,
      publishedAt: assignment.publishedAt?.toISOString() ?? null,
      createdAt: assignment.createdAt.toISOString(),
      updatedAt: assignment.updatedAt.toISOString(),
    },
    summary: summarizeAssignmentSubmissions(submissions, roster.length, assignment.dueAt),
    entries: roster.map((student) => {
      const submission = submissionByStudent.get(student.id);
      return {
        studentProfileId: student.id,
        studentId: student.studentId,
        displayName: student.displayName,
        submission: submission
          ? {
              id: submission.id,
              content: submission.content,
              attachmentUrl: submission.attachmentUrl,
              status: submission.status,
              score: submission.score,
              feedback: submission.feedback,
              submittedAt: submission.submittedAt.toISOString(),
              gradedAt: submission.gradedAt?.toISOString() ?? null,
              isLate: assignmentSubmissionIsLate(submission.submittedAt, assignment.dueAt),
            }
          : null,
      };
    }),
  });
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { context, assignment } = await loadOwnedAssignment(id);
  if (!context) {
    return jsonNoStore(
      { error: "Assignment access is not available for this account." },
      { status: 403 },
    );
  }
  if (!assignment) return jsonNoStore({ error: "Assignment not found." }, { status: 404 });

  let input: z.infer<typeof patchSchema>;
  try {
    input = patchSchema.parse(await request.json());
  } catch (error) {
    const message =
      error instanceof z.ZodError ? error.issues[0]?.message : "Could not read the change.";
    return jsonNoStore({ error: message ?? "Could not read the change." }, { status: 422 });
  }

  if (input.action === "PUBLISH") {
    if (assignment.status === AssignmentStatus.PUBLISHED) {
      return jsonNoStore({ ok: true, status: assignment.status });
    }
    if (assignment.status === AssignmentStatus.CLOSED) {
      return jsonNoStore(
        {
          error:
            "A closed assignment cannot be republished. Create a new assignment for the class instead.",
        },
        { status: 409 },
      );
    }
    const dueError = validateAssignmentDueDate(assignment.dueAt);
    if (dueError) return jsonNoStore({ error: dueError }, { status: 422 });
    const updated = await prisma.assignment.update({
      where: { id: assignment.id },
      data: { status: AssignmentStatus.PUBLISHED, publishedAt: new Date() },
    });
    await recordAssignmentAudit({
      request,
      schoolId: context.user.schoolId,
      actorUserId: context.user.id,
      action: "ASSIGNMENT_PUBLISHED",
      entityType: "Assignment",
      entityId: assignment.id,
    });
    return jsonNoStore({ ok: true, status: updated.status });
  }

  if (input.action === "CLOSE") {
    if (assignment.status === AssignmentStatus.CLOSED) {
      return jsonNoStore({ ok: true, status: assignment.status });
    }
    const updated = await prisma.assignment.update({
      where: { id: assignment.id },
      data: { status: AssignmentStatus.CLOSED },
    });
    await recordAssignmentAudit({
      request,
      schoolId: context.user.schoolId,
      actorUserId: context.user.id,
      action: "ASSIGNMENT_CLOSED",
      entityType: "Assignment",
      entityId: assignment.id,
    });
    return jsonNoStore({ ok: true, status: updated.status });
  }

  if (assignment.status === AssignmentStatus.CLOSED) {
    return jsonNoStore(
      { error: "A closed assignment cannot be edited. Create a new assignment instead." },
      { status: 409 },
    );
  }

  const nextDueAt = input.dueAt ? new Date(input.dueAt) : assignment.dueAt;
  const dueError = validateAssignmentDueDate(nextDueAt);
  if (dueError) return jsonNoStore({ error: dueError }, { status: 422 });

  if (input.maxScore !== undefined && input.maxScore < assignment.maxScore) {
    const highest = await prisma.assignmentSubmission.aggregate({
      where: { assignmentId: assignment.id, score: { not: null } },
      _max: { score: true },
    });
    if ((highest._max.score ?? 0) > input.maxScore) {
      return jsonNoStore(
        { error: "The maximum score cannot be lower than a score already awarded." },
        { status: 409 },
      );
    }
  }

  const updated = await prisma.assignment.update({
    where: { id: assignment.id },
    data: {
      ...(input.title !== undefined ? { title: input.title } : {}),
      ...(input.instructions !== undefined ? { instructions: input.instructions } : {}),
      ...(input.dueAt !== undefined ? { dueAt: nextDueAt } : {}),
      ...(input.maxScore !== undefined ? { maxScore: input.maxScore } : {}),
    },
  });

  await recordAssignmentAudit({
    request,
    schoolId: context.user.schoolId,
    actorUserId: context.user.id,
    action: "ASSIGNMENT_UPDATED",
    entityType: "Assignment",
    entityId: assignment.id,
    metadata: { status: updated.status, maxScore: updated.maxScore },
  });

  return jsonNoStore({ ok: true, status: updated.status });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const { context, assignment } = await loadOwnedAssignment(id);
  if (!context) {
    return jsonNoStore(
      { error: "Assignment access is not available for this account." },
      { status: 403 },
    );
  }
  if (!assignment) return jsonNoStore({ error: "Assignment not found." }, { status: 404 });
  if (assignment.status !== AssignmentStatus.DRAFT) {
    return jsonNoStore(
      { error: "Only a draft assignment can be deleted. Close published work instead." },
      { status: 409 },
    );
  }

  await prisma.assignment.delete({ where: { id: assignment.id } });
  await recordAssignmentAudit({
    request,
    schoolId: context.user.schoolId,
    actorUserId: context.user.id,
    action: "ASSIGNMENT_DELETED",
    entityType: "Assignment",
    entityId: assignment.id,
    metadata: { title: assignment.title },
  });
  return jsonNoStore({ ok: true });
}
