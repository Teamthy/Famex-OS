import { AssignmentStatus, AssignmentSubmissionStatus, type Prisma } from "@prisma/client";
import { getStudentPortalProfile } from "@/lib/attendance-portal";
import { getGradebookTeacherContext, type GradebookTeacherContext } from "@/lib/gradebook";
import { prisma } from "@/lib/prisma";
import { getClientIp } from "@/lib/requests";

/** F2-03: assignment set → submit → mark/return domain rules. */
export const MAX_ASSIGNMENT_SCORE = 1000;
export const MAX_ASSIGNMENT_CONTENT_LENGTH = 20_000;

export type AssignmentTeacherContext = GradebookTeacherContext;

export async function getAssignmentTeacherContext() {
  return getGradebookTeacherContext();
}

/** Student context with the class used for assignment/virtual-class discovery. */
export async function getLearningStudentContext() {
  return getStudentPortalProfile();
}

export function teacherTeachesClassSubject(
  context: AssignmentTeacherContext,
  classId: string,
  subjectName: string,
) {
  return context.teacherProfile.subjectAssignments.some(
    (assignment) =>
      assignment.classroom.id === classId &&
      assignment.subjectName.localeCompare(subjectName, undefined, { sensitivity: "accent" }) === 0,
  );
}

export function validateAssignmentDueDate(dueAt: Date, now = new Date()): string | null {
  if (Number.isNaN(dueAt.getTime())) return "Enter a valid due date and time.";
  if (dueAt <= now) return "The due date must be in the future when the assignment is saved.";
  return null;
}

export function validateAssignmentScore(score: number, maxScore: number): string | null {
  if (!Number.isInteger(maxScore) || maxScore < 1 || maxScore > MAX_ASSIGNMENT_SCORE) {
    return `Maximum score must be a whole number between 1 and ${MAX_ASSIGNMENT_SCORE}.`;
  }
  if (!Number.isInteger(score) || score < 0 || score > maxScore) {
    return `Score must be a whole number between 0 and ${maxScore}.`;
  }
  return null;
}

export function normalizeHttpsUrl(raw: string | null | undefined): string | null {
  const value = raw?.trim();
  if (!value) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || !url.hostname || url.username || url.password) return null;
    return url.toString();
  } catch {
    return null;
  }
}

export function assignmentSubmissionIsLate(submittedAt: Date, dueAt: Date): boolean {
  return submittedAt > dueAt;
}

export type AssignmentSubmissionDecision = {
  allowed: boolean;
  reason: string | null;
  isLate: boolean;
};

/**
 * Students may submit after the due time while the teacher leaves the work
 * published; the submission is marked late. Closing the assignment is the
 * deliberate hard stop. A graded submission is locked until returned.
 */
export function canStudentSubmitAssignment(input: {
  assignmentStatus: AssignmentStatus;
  dueAt: Date;
  existingStatus?: AssignmentSubmissionStatus | null;
  now?: Date;
}): AssignmentSubmissionDecision {
  const now = input.now ?? new Date();
  const isLate = now > input.dueAt;
  if (input.assignmentStatus !== AssignmentStatus.PUBLISHED) {
    return {
      allowed: false,
      isLate,
      reason:
        input.assignmentStatus === AssignmentStatus.CLOSED
          ? "This assignment is closed and no longer accepts submissions."
          : "This assignment has not been published yet.",
    };
  }
  if (input.existingStatus === AssignmentSubmissionStatus.GRADED) {
    return {
      allowed: false,
      isLate,
      reason:
        "This submission has been graded. Ask your teacher to return it if it needs revision.",
    };
  }
  return { allowed: true, isLate, reason: null };
}

export function summarizeAssignmentSubmissions(
  submissions: Array<{
    status: AssignmentSubmissionStatus;
    score: number | null;
    submittedAt: Date;
  }>,
  classSize: number,
  dueAt: Date,
) {
  const graded = submissions.filter(
    (submission) => submission.status === AssignmentSubmissionStatus.GRADED,
  );
  const scores = graded
    .map((submission) => submission.score)
    .filter((score): score is number => typeof score === "number");
  return {
    submitted: submissions.length,
    awaitingGrade: submissions.filter(
      (submission) => submission.status === AssignmentSubmissionStatus.SUBMITTED,
    ).length,
    graded: graded.length,
    returned: submissions.filter(
      (submission) => submission.status === AssignmentSubmissionStatus.RETURNED,
    ).length,
    missing: Math.max(classSize - submissions.length, 0),
    late: submissions.filter((submission) => submission.submittedAt > dueAt).length,
    averageScore: scores.length
      ? Math.round((scores.reduce((sum, score) => sum + score, 0) / scores.length) * 10) / 10
      : null,
  };
}

export async function recordAssignmentAudit(input: {
  request: Request;
  schoolId: string;
  actorUserId: string;
  action: string;
  entityType: "Assignment" | "AssignmentSubmission";
  entityId: string;
  metadata?: Prisma.InputJsonObject;
}) {
  await prisma.auditLog.create({
    data: {
      schoolId: input.schoolId,
      actorUserId: input.actorUserId,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      metadata: input.metadata,
      ipAddress: getClientIp(input.request),
    },
  });
}
