import { GradebookStatus, UserRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireRole, type SessionUser } from "@/lib/session";

export const GRADEBOOK_TEACHER_ROLES: UserRole[] = [
  UserRole.TEACHER,
  UserRole.HOD,
  UserRole.ADMIN,
  UserRole.DIRECTOR,
];

export const GRADEBOOK_ADMIN_ROLES: UserRole[] = [
  UserRole.ADMIN,
  UserRole.DIRECTOR,
  UserRole.COORDINATOR,
];

export const SCORE_LIMITS = {
  ca1: 10,
  ca2: 10,
  midterm: 10,
  assignment: 10,
  exam: 60,
} as const;

export type ScoreField = keyof typeof SCORE_LIMITS;

export function currentSessionLabel() {
  const now = new Date();
  const year = now.getMonth() >= 8 ? now.getFullYear() : now.getFullYear() - 1;
  return `${year}/${year + 1}`;
}

export function currentTermLabel() {
  const month = new Date().getMonth();
  if (month >= 8 && month <= 11) return "First Term";
  if (month >= 0 && month <= 3) return "Second Term";
  return "Third Term";
}

/**
 * Calendar boundaries of the current term, matching currentTermLabel().
 *
 *   First Term   Sep – Dec
 *   Second Term  Jan – Apr
 *   Third Term   May – Aug
 *
 * Needed wherever "this term" has to be expressed as a date range rather than
 * a label — budget spend, for instance, is computed from Expense.spentAt,
 * which has no termLabel column to filter on.
 */
export function currentTermWindow(now: Date = new Date()) {
  const month = now.getMonth();
  const year = now.getFullYear();

  if (month >= 8) {
    // First Term: 1 Sep – 31 Dec of this year.
    return { from: new Date(year, 8, 1), to: new Date(year + 1, 0, 1) };
  }
  if (month <= 3) {
    // Second Term: 1 Jan – 30 Apr.
    return { from: new Date(year, 0, 1), to: new Date(year, 4, 1) };
  }
  // Third Term: 1 May – 31 Aug.
  return { from: new Date(year, 4, 1), to: new Date(year, 8, 1) };
}

export function waecGrade(total: number) {
  if (total >= 75) return "A1";
  if (total >= 70) return "B2";
  if (total >= 65) return "B3";
  if (total >= 60) return "C4";
  if (total >= 55) return "C5";
  if (total >= 50) return "C6";
  if (total >= 45) return "D7";
  if (total >= 40) return "E8";
  return "F9";
}

export function clampScore(field: ScoreField, value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(SCORE_LIMITS[field], Math.round(value)));
}

export function computeEntryTotals(scores: Record<ScoreField, number>) {
  const clamped = {
    ca1: clampScore("ca1", scores.ca1),
    ca2: clampScore("ca2", scores.ca2),
    midterm: clampScore("midterm", scores.midterm),
    assignment: clampScore("assignment", scores.assignment),
    exam: clampScore("exam", scores.exam),
  };
  const total = clamped.ca1 + clamped.ca2 + clamped.midterm + clamped.assignment + clamped.exam;
  return { ...clamped, total, grade: waecGrade(total) };
}

export type GradebookTeacherContext = {
  user: SessionUser;
  teacherProfile: {
    id: string;
    displayName: string;
    subjectAssignments: Array<{
      id: string;
      subjectName: string;
      classroom: { id: string; displayName: string; level: string; arm: string };
    }>;
  };
};

export async function getGradebookTeacherContext(): Promise<GradebookTeacherContext | null> {
  const user = await requireRole(GRADEBOOK_TEACHER_ROLES);
  if (!user) return null;

  const teacherProfile = await prisma.teacherProfile.findFirst({
    where: { schoolId: user.schoolId, userId: user.id, isActive: true },
    select: {
      id: true,
      displayName: true,
      classAssignments: {
        where: { isActive: true, subjectName: { not: null } },
        orderBy: [{ classroom: { displayName: "asc" } }, { subjectName: "asc" }],
        select: {
          id: true,
          role: true,
          subjectName: true,
          classroom: { select: { id: true, displayName: true, level: true, arm: true } },
        },
      },
    },
  });

  if (!teacherProfile) return null;

  return {
    user,
    teacherProfile: {
      id: teacherProfile.id,
      displayName: teacherProfile.displayName,
      subjectAssignments: teacherProfile.classAssignments
        .filter((assignment) => Boolean(assignment.subjectName))
        .map((assignment) => ({
          id: assignment.id,
          subjectName: assignment.subjectName as string,
          classroom: assignment.classroom,
        })),
    },
  };
}

export async function ensureGradebook(input: {
  schoolId: string;
  classId: string;
  teacherProfileId: string;
  subjectName: string;
  sessionLabel: string;
  termLabel: string;
}) {
  const gradebook = await prisma.subjectGradebook.upsert({
    where: {
      classId_subjectName_sessionLabel_termLabel: {
        classId: input.classId,
        subjectName: input.subjectName,
        sessionLabel: input.sessionLabel,
        termLabel: input.termLabel,
      },
    },
    update: {},
    create: {
      schoolId: input.schoolId,
      classId: input.classId,
      teacherProfileId: input.teacherProfileId,
      subjectName: input.subjectName,
      sessionLabel: input.sessionLabel,
      termLabel: input.termLabel,
      status: GradebookStatus.OPEN,
    },
  });

  const students = await prisma.studentProfile.findMany({
    where: { currentClassId: input.classId, isActive: true },
    select: { id: true },
  });

  const existingEntries = await prisma.gradebookEntry.findMany({
    where: { gradebookId: gradebook.id },
    select: { studentProfileId: true },
  });
  const existingIds = new Set(existingEntries.map((entry) => entry.studentProfileId));
  const missing = students.filter((student) => !existingIds.has(student.id));

  if (missing.length) {
    await prisma.gradebookEntry.createMany({
      data: missing.map((student) => ({
        gradebookId: gradebook.id,
        studentProfileId: student.id,
      })),
      skipDuplicates: true,
    });
  }

  return gradebook;
}

export function gradebookStatusLabel(status: GradebookStatus) {
  if (status === GradebookStatus.LOCKED) return "Locked";
  if (status === GradebookStatus.SUBMITTED) return "Submitted";
  return "Open";
}
