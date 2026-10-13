import { Prisma, SubjectCategory, UserRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";

/**
 * Subject catalogue and per-student enrolment.
 *
 * Subjects used to be free-text strings. That was fine while every student in
 * a class took every subject, but it could not express the real Nigerian
 * curriculum: Maths and English are compulsory, Further Maths and Literature
 * are chosen. With no record of who takes what, every exam appeared for every
 * student in the class — including ones they had never been taught.
 */

export const SUBJECT_ADMIN_ROLES: UserRole[] = [
  UserRole.ADMIN,
  UserRole.DIRECTOR,
  UserRole.COORDINATOR,
  UserRole.SUPER_ADMIN,
];

/** Roles allowed to change which subjects a student takes. */
export const SUBJECT_ASSIGN_ROLES: UserRole[] = [
  ...SUBJECT_ADMIN_ROLES,
  UserRole.TEACHER,
  UserRole.HOD,
];

/**
 * A sensible Nigerian secondary starting catalogue.
 *
 * Junior school is almost entirely compulsory; senior school splits into
 * science/arts/commercial electives. Offered as a seed an admin edits, not as
 * something enforced.
 */
export const DEFAULT_CATALOGUE: Record<
  string,
  Array<{ name: string; category: SubjectCategory }>
> = {
  JSS1: [
    { name: "Mathematics", category: SubjectCategory.COMPULSORY },
    { name: "English Language", category: SubjectCategory.COMPULSORY },
    { name: "Basic Science", category: SubjectCategory.COMPULSORY },
    { name: "Basic Technology", category: SubjectCategory.COMPULSORY },
    { name: "Social Studies", category: SubjectCategory.COMPULSORY },
    { name: "Civic Education", category: SubjectCategory.COMPULSORY },
    { name: "Computer Studies", category: SubjectCategory.COMPULSORY },
    { name: "French", category: SubjectCategory.ELECTIVE },
  ],
  SS1: [
    { name: "Mathematics", category: SubjectCategory.COMPULSORY },
    { name: "English Language", category: SubjectCategory.COMPULSORY },
    { name: "Civic Education", category: SubjectCategory.COMPULSORY },
    { name: "Biology", category: SubjectCategory.ELECTIVE },
    { name: "Chemistry", category: SubjectCategory.ELECTIVE },
    { name: "Physics", category: SubjectCategory.ELECTIVE },
    { name: "Further Mathematics", category: SubjectCategory.ELECTIVE },
    { name: "Literature in English", category: SubjectCategory.ELECTIVE },
    { name: "Government", category: SubjectCategory.ELECTIVE },
    { name: "Economics", category: SubjectCategory.ELECTIVE },
  ],
};

/** Normalise a subject name so "maths " and "Maths" cannot both be stored. */
export function normaliseSubjectName(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

export async function listSubjects(schoolId: string, level?: string) {
  return prisma.subject.findMany({
    where: { schoolId, isActive: true, ...(level ? { level } : {}) },
    orderBy: [{ level: "asc" }, { category: "asc" }, { name: "asc" }],
    include: { _count: { select: { enrolments: { where: { isActive: true } } } } },
  });
}

export async function upsertSubject(params: {
  schoolId: string;
  level: string;
  name: string;
  code?: string | null;
  category: SubjectCategory;
}) {
  const name = normaliseSubjectName(params.name);
  if (!name) throw new Error("A subject needs a name.");

  return prisma.subject.upsert({
    where: {
      schoolId_level_name: { schoolId: params.schoolId, level: params.level, name },
    },
    update: {
      code: params.code ?? null,
      category: params.category,
      isActive: true,
    },
    create: {
      schoolId: params.schoolId,
      level: params.level,
      name,
      code: params.code ?? null,
      category: params.category,
    },
  });
}

/**
 * Enrol every active student at a level into its COMPULSORY subjects.
 *
 * Idempotent — `skipDuplicates` plus the unique index means re-running after
 * admitting a student enrols only that student. Electives are deliberately
 * untouched: nobody should be auto-assigned a subject they did not choose.
 */
export async function syncCompulsorySubjects(schoolId: string, level?: string) {
  const subjects = await prisma.subject.findMany({
    where: {
      schoolId,
      isActive: true,
      category: SubjectCategory.COMPULSORY,
      ...(level ? { level } : {}),
    },
    select: { id: true, level: true },
  });
  if (!subjects.length) return { created: 0 };

  const students = await prisma.studentProfile.findMany({
    where: {
      schoolId,
      isActive: true,
      ...(level ? { currentClass: { level } } : {}),
    },
    select: { id: true, currentClass: { select: { level: true } } },
  });
  if (!students.length) return { created: 0 };

  const byLevel = new Map<string, string[]>();
  for (const subject of subjects) {
    if (!byLevel.has(subject.level)) byLevel.set(subject.level, []);
    byLevel.get(subject.level)!.push(subject.id);
  }

  const rows: Prisma.StudentSubjectCreateManyInput[] = [];
  for (const student of students) {
    for (const subjectId of byLevel.get(student.currentClass.level) ?? []) {
      rows.push({ schoolId, studentProfileId: student.id, subjectId });
    }
  }
  if (!rows.length) return { created: 0 };

  const result = await prisma.studentSubject.createMany({
    data: rows,
    skipDuplicates: true,
  });
  return { created: result.count };
}

/** The subject ids a student actually takes. */
export async function studentSubjectIds(studentProfileId: string): Promise<string[]> {
  const rows = await prisma.studentSubject.findMany({
    where: { studentProfileId, isActive: true },
    select: { subjectId: true },
  });
  return rows.map((row) => row.subjectId);
}

/**
 * Replace a student's elective choices.
 *
 * Compulsory subjects are never removed here — a teacher un-ticking
 * "Mathematics" by accident should not be able to drop a student from it. Only
 * electives are in scope.
 */
export async function setStudentElectives(params: {
  schoolId: string;
  studentProfileId: string;
  subjectIds: string[];
}) {
  const student = await prisma.studentProfile.findFirst({
    where: { id: params.studentProfileId, schoolId: params.schoolId },
    select: { id: true, currentClass: { select: { level: true } } },
  });
  if (!student) throw new Error("Student not found in this school.");

  const electives = await prisma.subject.findMany({
    where: {
      schoolId: params.schoolId,
      level: student.currentClass.level,
      category: SubjectCategory.ELECTIVE,
      isActive: true,
    },
    select: { id: true },
  });
  const electiveIds = new Set(electives.map((e) => e.id));

  // Silently ignore anything that is not an elective at this student's level —
  // a stale form or a tampered request must not enrol them in SS3 Physics.
  const chosen = params.subjectIds.filter((id) => electiveIds.has(id));

  return prisma.$transaction(async (tx) => {
    await tx.studentSubject.updateMany({
      where: {
        studentProfileId: student.id,
        subjectId: { in: [...electiveIds] },
      },
      data: { isActive: false },
    });

    for (const subjectId of chosen) {
      await tx.studentSubject.upsert({
        where: {
          studentProfileId_subjectId: { studentProfileId: student.id, subjectId },
        },
        update: { isActive: true },
        create: { schoolId: params.schoolId, studentProfileId: student.id, subjectId },
      });
    }

    return { enrolled: chosen.length };
  });
}

/* ------------------------------------------------------------------
   Exam visibility
   ------------------------------------------------------------------ */

export type ExamAvailability = "UPCOMING" | "READY" | "CLOSED" | "COMPLETED";

/**
 * Where an exam stands for one student, right now.
 *
 * A single place for this so the student list, the runner and the API cannot
 * disagree about whether an exam may be started — a disagreement there means a
 * student either sits an exam twice or is locked out of one they can see.
 */
export function examAvailability(params: {
  scheduledFor: Date | null;
  availableUntil: Date | null;
  hasSubmitted: boolean;
  now?: Date;
}): ExamAvailability {
  // A submitted attempt outranks every window: once it is done, it is done.
  if (params.hasSubmitted) return "COMPLETED";

  const now = params.now ?? new Date();
  if (params.scheduledFor && now < params.scheduledFor) return "UPCOMING";
  if (params.availableUntil && now > params.availableUntil) return "CLOSED";
  return "READY";
}

/**
 * Server-side gate for *starting* an attempt.
 *
 * `examAvailability` above is what the list renders. Rendering is not a
 * control: hiding a button stops nobody who keeps a tab open past the close,
 * types the URL, or uses the mobile client. This is the same rule expressed as
 * a refusal, for the one endpoint that actually creates an attempt.
 *
 * Returns null when the start is allowed.
 */
export function startWindowRefusal(params: {
  scheduledFor: Date | null;
  availableUntil: Date | null;
  now?: Date;
}): { code: "NOT_OPEN_YET" | "WINDOW_CLOSED"; message: string } | null {
  const now = params.now ?? new Date();

  if (params.scheduledFor && now < params.scheduledFor) {
    return {
      code: "NOT_OPEN_YET",
      message: `This exam opens ${params.scheduledFor.toLocaleString("en-NG", {
        weekday: "short",
        day: "numeric",
        month: "short",
        hour: "numeric",
        minute: "2-digit",
      })}.`,
    };
  }

  if (params.availableUntil && now > params.availableUntil) {
    return {
      code: "WINDOW_CLOSED",
      message: "The window for this exam has closed. Ask your teacher for a retake.",
    };
  }

  return null;
}

/**
 * When an attempt started now must end.
 *
 * Bounded by BOTH the exam duration and the close of the window — without the
 * clamp, starting one minute before close would hand out the full duration and
 * the closing time would mean nothing.
 */
export function attemptDeadline(params: {
  durationMinutes: number;
  availableUntil: Date | null;
  startedAt?: Date;
}): Date {
  const startedAt = params.startedAt ?? new Date();
  const byDuration = startedAt.getTime() + params.durationMinutes * 60_000;
  if (!params.availableUntil) return new Date(byDuration);
  return new Date(Math.min(byDuration, params.availableUntil.getTime()));
}

/** Human-readable label for the student's exam list. */
export function availabilityLabel(state: ExamAvailability): string {
  switch (state) {
    case "UPCOMING":
      return "Not yet open";
    case "READY":
      return "Ready to take";
    case "CLOSED":
      return "Missed — window closed";
    case "COMPLETED":
      return "Completed";
  }
}
