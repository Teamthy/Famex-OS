import { AssignmentStatus } from "@prisma/client";
import {
  assignmentSubmissionIsLate,
  canStudentSubmitAssignment,
  getLearningStudentContext,
} from "@/lib/assignments";
import { prisma } from "@/lib/prisma";
import { jsonNoStore } from "@/lib/requests";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const context = await getLearningStudentContext();
  if (!context) {
    return jsonNoStore(
      { error: "No live student profile is linked to this account yet." },
      { status: 404 },
    );
  }

  const assignments = await prisma.assignment.findMany({
    where: {
      schoolId: context.user.schoolId,
      classId: context.profile.currentClass.id,
      status: { in: [AssignmentStatus.PUBLISHED, AssignmentStatus.CLOSED] },
    },
    orderBy: [{ dueAt: "asc" }, { createdAt: "desc" }],
    include: {
      classroom: { select: { displayName: true } },
      teacherProfile: { select: { displayName: true } },
      submissions: {
        where: { studentProfileId: context.profile.id },
        take: 1,
      },
    },
  });

  const now = new Date();
  return jsonNoStore({
    student: {
      displayName: context.profile.displayName,
      studentId: context.profile.studentId,
      className: context.profile.currentClass.displayName,
    },
    assignments: assignments.map((assignment) => {
      const submission = assignment.submissions[0] ?? null;
      const decision = canStudentSubmitAssignment({
        assignmentStatus: assignment.status,
        dueAt: assignment.dueAt,
        existingStatus: submission?.status ?? null,
        now,
      });
      return {
        id: assignment.id,
        subjectName: assignment.subjectName,
        teacherName: assignment.teacherProfile.displayName,
        className: assignment.classroom.displayName,
        title: assignment.title,
        instructions: assignment.instructions,
        dueAt: assignment.dueAt.toISOString(),
        maxScore: assignment.maxScore,
        status: assignment.status,
        isOverdue: now > assignment.dueAt && assignment.status === AssignmentStatus.PUBLISHED,
        canSubmit: decision.allowed,
        submitBlockedReason: decision.reason,
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
