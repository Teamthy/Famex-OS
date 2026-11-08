import { SubjectCategory, type Prisma } from "@prisma/client";

/** The subset of the Prisma client a transaction delegate exposes. */
type Tx = Prisma.TransactionClient;

/**
 * Assigning subjects at enrolment.
 *
 * A student row without StudentSubject rows is not enrolled in anything: they
 * sit no exams, appear on no subject teacher's roster, are skipped by the
 * promotion rollover and collect no report-card marks. Every path that creates
 * a student has to decide which subjects they take, and until now all but one
 * (admissions) silently decided "none".
 *
 * ── The free-text problem ──────────────────────────────────────────────────
 * A teacher's subject lives in TeacherClassAssignment.subjectName, which is a
 * free-text box on Admin → Staff assignments. StudentSubject.subjectId is a
 * foreign key to Subject. So "which subjects does this teacher teach?" has no
 * direct answer, and a naive `subject.name = assignment.subjectName` join
 * matches nothing the moment an admin types "Maths" instead of "Mathematics"
 * or "Further Maths " with a trailing space.
 *
 * resolveTeacherSubjects() is the bridge. It matches case-insensitively,
 * collapses whitespace, and also accepts the subject's short code, because a
 * school that types "MTH" into that box still means Mathematics. Anything that
 * cannot be resolved is reported rather than dropped: a teacher whose subject
 * does not exist in the catalogue needs to be told, not left with a class of
 * students who mysteriously have no marks.
 */

/** Collapse case and whitespace so " Maths  " and "MATHS" compare equal. */
function key(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

export type ResolvedSubject = {
  /** The assignment the teacher holds. */
  assignmentId: string;
  classId: string;
  /** What the admin typed. */
  typed: string;
  /** The catalogue row it resolved to, or null when nothing matched. */
  subjectId: string | null;
  subjectName: string | null;
  /** Two catalogue rows that both match — the assignment is ambiguous. */
  ambiguous: boolean;
};

/**
 * Resolve a teacher's assigned subjects (optionally restricted to one class)
 * against the subject catalogue for that class's level.
 *
 * Matching order, first hit wins:
 *   1. exact name, case- and whitespace-insensitive
 *   2. exact code, case-insensitive ("MTH" → Mathematics)
 *   3. unique case-insensitive name across the whole level
 *
 * Level matters: Mathematics exists separately for JSS1 and SS1, and a JSS1
 * teacher must not be resolved to the SS1 row.
 */
export async function resolveTeacherSubjects(
  tx: Tx,
  params: { schoolId: string; teacherProfileId: string; classId?: string },
): Promise<ResolvedSubject[]> {
  const assignments = (await tx.teacherClassAssignment.findMany({
    where: {
      schoolId: params.schoolId,
      teacherProfileId: params.teacherProfileId,
      isActive: true,
      subjectName: { not: null },
      ...(params.classId ? { classId: params.classId } : {}),
    },
    select: {
      id: true,
      classId: true,
      subjectName: true,
      classroom: { select: { level: true } },
    },
    orderBy: { subjectName: "asc" },
  })) as Array<{
    id: string;
    classId: string;
    subjectName: string | null;
    classroom: { level: string };
  }>;

  if (!assignments.length) return [];

  // One catalogue query per level, not per assignment.
  const levels = [...new Set(assignments.map((a) => a.classroom.level))];
  const subjects = (await tx.subject.findMany({
    where: { schoolId: params.schoolId, isActive: true, level: { in: levels } },
    select: { id: true, name: true, code: true, level: true, category: true },
  })) as Array<{
    id: string;
    name: string;
    code: string | null;
    level: string;
    category: SubjectCategory;
  }>;

  const byLevel = new Map<string, typeof subjects>();
  for (const subject of subjects) {
    if (!byLevel.has(subject.level)) byLevel.set(subject.level, []);
    byLevel.get(subject.level)!.push(subject);
  }

  return assignments.map((assignment) => {
    const typed = assignment.subjectName ?? "";
    const catalogue = byLevel.get(assignment.classroom.level) ?? [];
    const wanted = key(typed);

    let match = catalogue.find((s) => key(s.name) === wanted) ?? null;
    if (!match) match = catalogue.find((s) => s.code && key(s.code) === wanted) ?? null;

    if (!match) {
      // Fuzzy: a unique prefix or containment match still resolves "Further
      // Math" to "Further Mathematics" without guessing between two rows.
      //
      // Both directions matter. "Further Math" is a prefix of a subject name;
      // "Math" is a prefix of "Mathematics". Where two catalogue rows both
      // match, the assignment is ambiguous and must be reported rather than
      // resolved to whichever row the catalogue returned first.
      const loose = catalogue.filter((s) => {
        const n = key(s.name);
        return n.startsWith(wanted) || wanted.startsWith(n);
      });
      if (loose.length === 1) match = loose[0];
      else if (loose.length > 1)
        return {
          assignmentId: assignment.id,
          classId: assignment.classId,
          typed,
          subjectId: null,
          subjectName: null,
          ambiguous: true,
        };
    }

    return {
      assignmentId: assignment.id,
      classId: assignment.classId,
      typed,
      subjectId: match?.id ?? null,
      subjectName: match?.name ?? null,
      ambiguous: false,
    };
  });
}

export type AssignOutcome = {
  assigned: number;
  alreadyPresent: number;
  /** Subjects the caller asked for that are not in the catalogue at this level. */
  rejected: string[];
};

/**
 * Give a student a set of subjects. Idempotent: re-running with the same ids
 * reports them as alreadyPresent and creates nothing.
 *
 * Compulsory subjects are always included, because a student who takes only
 * the electives a teacher ticked is still missing their core subjects.
 */
export async function assignStudentSubjects(
  tx: Tx,
  params: {
    schoolId: string;
    studentProfileId: string;
    level: string;
    /** Subject ids the caller explicitly wants. */
    subjectIds: string[];
  },
): Promise<AssignOutcome> {
  // Validate against the catalogue: level-correct and active. A stale form or
  // a tampered request must not enrol a JSS1 student in SS3 Physics.
  const valid = (await tx.subject.findMany({
    where: {
      schoolId: params.schoolId,
      level: params.level,
      isActive: true,
      id: { in: params.subjectIds },
    },
    select: { id: true, name: true, category: true },
  })) as Array<{ id: string; name: string; category: SubjectCategory }>;
  const validIds = new Set(valid.map((s) => s.id));
  const rejected = params.subjectIds.filter((id) => !validIds.has(id));

  if (!params.subjectIds.length) {
    return { assigned: 0, alreadyPresent: 0, rejected };
  }

  const existing = (await tx.studentSubject.findMany({
    where: { schoolId: params.schoolId, studentProfileId: params.studentProfileId },
    select: { subjectId: true, isActive: true },
  })) as Array<{ subjectId: string; isActive: boolean }>;
  const existingActive = new Set(existing.filter((e) => e.isActive).map((e) => e.subjectId));

  let assigned = 0;
  let alreadyPresent = 0;
  for (const id of validIds) {
    if (existingActive.has(id)) {
      alreadyPresent += 1;
      continue;
    }
    // Upsert, not create: the row may exist but be deactivated from an earlier
    // drop, and re-adding a subject must reactivate it rather than violate the
    // (studentProfileId, subjectId) unique constraint.
    await tx.studentSubject.upsert({
      where: {
        studentProfileId_subjectId: {
          studentProfileId: params.studentProfileId,
          subjectId: id,
        },
      },
      update: { isActive: true },
      create: {
        schoolId: params.schoolId,
        studentProfileId: params.studentProfileId,
        subjectId: id,
      },
    });
    assigned += 1;
  }

  return { assigned, alreadyPresent, rejected };
}
