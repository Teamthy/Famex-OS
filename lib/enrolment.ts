/**
 * Student onboarding — one place that makes a new student real.
 *
 * Admitting a student used to create a `StudentProfile` and stop. The
 * consequences were quiet and expensive:
 *
 *   • no `StudentSubject` rows, so every subject-scoped screen was empty and
 *     the student could not see — or sit — a single exam;
 *   • no `StudentEnrolment` row, so the student was invisible to the promotion
 *     plan, and the year-end rollover silently skipped them;
 *   • an elective choice was never written, so a student who chose Further
 *     Mathematics at admission was treated as not taking it, and their paper
 *     never reached the teacher who teaches it.
 *
 * ── Subject teachers and class teachers are different things
 *
 * Routing a score to the right adult needs both, and they are independent:
 *
 *   class teacher   ← `TeacherClassAssignment{classId, role: FORM_TEACHER}`
 *   subject teacher ← `TeacherClassAssignment{classId, role: SUBJECT_TEACHER,
 *                                             subjectName}`
 *
 * A teacher can hold both, in the same class or in different ones. Nothing
 * here writes a combined "owner" — the two rows stay separate, so a form
 * teacher who does not teach the subject gets the remark but not the marks,
 * and a subject teacher who is not the form teacher gets the marks but not the
 * remark. That separation is what the results screen enforces, and it only
 * works if the assignment rows are correct in the first place.
 *
 * ── Why this is idempotent
 *
 * Admission is retried (a clerk double-clicks, a request times out after
 * committing). Everything here uses upserts and `skipDuplicates`, so a retry
 * adds nothing and removes nothing. It is also safe to run for an existing
 * student — that is how a mid-year correction is applied.
 */
import { EnrolmentOutcome, Prisma, SubjectCategory } from "@prisma/client";

type Tx = Prisma.TransactionClient;

export type OnboardingOutcome = {
  subjectsAssigned: number;
  compulsoryAssigned: number;
  electivesAssigned: number;
  electivesDropped: number;
  enrolmentCreated: boolean;
  /** Subject teachers who should now see this student in their class. */
  subjectTeachers: Array<{ subjectName: string; teacherName: string | null }>;
  classTeacher: string | null;
  warnings: string[];
};

/**
 * Assign a student's subjects and open their enrolment for the current session.
 *
 * MUST run inside the enrolment transaction: a student who exists without
 * subjects is the exact failure this function prevents, and a half-applied
 * onboarding has no way to be distinguished from "not yet onboarded".
 *
 * ── What is auto-assigned, and what is not
 *
 * Compulsory subjects for the student's level are assigned automatically. That
 * is safe: they are compulsory by definition. Electives are assigned ONLY when
 * they are passed in — an automatic elective is a subject nobody chose, and a
 * student enrolled in Further Mathematics by default would sit an exam they
 * never studied for.
 *
 * `electiveSubjectIds: undefined` means "the caller is not managing electives"
 * and leaves existing choices alone. An empty array means "this student takes
 * none", which deactivates them. The distinction matters on a retry.
 */
export async function onboardStudent(params: {
  tx: Tx;
  schoolId: string;
  studentProfileId: string;
  classId: string;
  /** Elective ids from the admission form. `undefined` = do not touch. */
  electiveSubjectIds?: string[];
  sessionId?: string | null;
}): Promise<OnboardingOutcome> {
  const { tx, schoolId, studentProfileId, classId } = params;

  const classroom = await tx.schoolClass.findFirst({
    where: { id: classId, schoolId },
    select: { id: true, level: true, displayName: true },
  });
  if (!classroom) throw new Error("CLASS_NOT_FOUND");

  const warnings: string[] = [];

  // ── Compulsory subjects for this level ────────────────────────────────────
  const compulsory = await tx.subject.findMany({
    where: {
      schoolId,
      level: classroom.level,
      category: SubjectCategory.COMPULSORY,
      isActive: true,
    },
    select: { id: true, name: true },
  });
  if (!compulsory.length) {
    // Not fatal — a school may run electives only, or have not set up its
    // catalogue yet. But it must be visible, because an empty catalogue means
    // the student will see no exams and nobody will know why.
    warnings.push(
      `No compulsory subjects are configured for ${classroom.level}. The student will have no subjects until the catalogue is set up.`,
    );
  }

  if (compulsory.length) {
    await tx.studentSubject.createMany({
      data: compulsory.map((subject) => ({
        schoolId,
        studentProfileId,
        subjectId: subject.id,
      })),
      skipDuplicates: true,
    });
  }

  // ── Electives ─────────────────────────────────────────────────────────────
  let electivesAssigned = 0;
  let electivesDropped = 0;

  if (params.electiveSubjectIds !== undefined) {
    const valid = await tx.subject.findMany({
      where: {
        schoolId,
        level: classroom.level,
        category: SubjectCategory.ELECTIVE,
        isActive: true,
        id: { in: params.electiveSubjectIds },
      },
      select: { id: true },
    });
    const validIds = new Set(valid.map((subject) => subject.id));

    // Anything the caller named that is not an elective at this student's level
    // is dropped rather than trusted: a stale form, or a tampered request,
    // must not enrol a JSS1 student in SS3 Physics.
    const rejected = params.electiveSubjectIds.filter((id) => !validIds.has(id));
    if (rejected.length) {
      warnings.push(
        `${rejected.length} chosen subject(s) are not electives at ${classroom.level} and were ignored.`,
      );
    }

    const existing = await tx.studentSubject.findMany({
      where: { schoolId, studentProfileId },
      select: { subjectId: true, isActive: true },
    });
    const electiveIds = new Set(validIds);

    for (const subjectId of validIds) {
      await tx.studentSubject.upsert({
        where: { studentProfileId_subjectId: { studentProfileId, subjectId } },
        update: { isActive: true },
        create: { schoolId, studentProfileId, subjectId },
      });
      electivesAssigned += 1;
    }

    // Deactivate the electives that were dropped, reversibly.
    for (const row of existing) {
      if (!row.isActive) continue;
      if (!electiveIds.has(row.subjectId)) {
        // Only electives: a compulsory subject is never dropped here, however
        // stale the form is.
        const isCompulsory = compulsory.some((subject) => subject.id === row.subjectId);
        if (isCompulsory) continue;
        await tx.studentSubject.updateMany({
          where: { schoolId, studentProfileId, subjectId: row.subjectId },
          data: { isActive: false },
        });
        electivesDropped += 1;
      }
    }
  }

  // ── Session enrolment ─────────────────────────────────────────────────────
  //
  // Without this row the student does not exist for promotion, the class
  // rollover, or the end-of-session report. It is created for the CURRENT
  // session when there is one; a school between sessions gets none, which is
  // correct — the student will be picked up by the next session's rollover.
  let enrolmentCreated = false;
  const sessionId =
    params.sessionId ??
    (
      await tx.academicSession.findFirst({
        where: { schoolId, isCurrent: true },
        select: { id: true },
      })
    )?.id ??
    null;

  if (sessionId) {
    const existingEnrolment = await tx.studentEnrolment.findFirst({
      where: { schoolId, studentProfileId, sessionId },
      select: { id: true },
    });
    if (!existingEnrolment) {
      await tx.studentEnrolment.create({
        data: {
          schoolId,
          studentProfileId,
          classId,
          sessionId,
          outcome: EnrolmentOutcome.IN_PROGRESS,
        },
      });
      enrolmentCreated = true;
    } else {
      // A student placed into a different class mid-session: move the
      // enrolment with them, or the promotion plan reads the wrong class.
      await tx.studentEnrolment.updateMany({
        where: { schoolId, studentProfileId, sessionId, outcome: EnrolmentOutcome.IN_PROGRESS },
        data: { classId },
      });
    }
  } else {
    warnings.push(
      "No academic session is currently open, so no enrolment row was created. The student will be included at the next session rollover.",
    );
  }

  // ── Who should see this student ───────────────────────────────────────────
  //
  // Reported, not written. The assignments already exist; what a new student
  // changes is the roster those assignments resolve to. Reading them back makes
  // a routing gap visible at admission time rather than at marking time —
  // a subject with no teacher assigned is the single most common reason a
  // score never reaches anyone.
  // Read back from the database rather than from what was just written: this
  // reports the student's ACTUAL state, which is the thing that routes scores.
  const assigned = await tx.studentSubject.findMany({
    where: { schoolId, studentProfileId, isActive: true },
    select: { subject: { select: { name: true } } },
  });
  const uniqueSubjectNames = [
    ...new Set(assigned.map((row) => row.subject.name)),
  ].sort((a, b) => a.localeCompare(b));

  const assignments = await tx.teacherClassAssignment.findMany({
    where: { schoolId, classId, isActive: true },
    select: {
      role: true,
      subjectName: true,
      teacherProfile: { select: { displayName: true } },
    },
  });

  const subjectTeachers = assignments
    .filter(
      (assignment) =>
        assignment.role === "SUBJECT_TEACHER" &&
        assignment.subjectName &&
        uniqueSubjectNames.some(
          (name) => name.toLowerCase() === assignment.subjectName!.toLowerCase(),
        ),
    )
    .map((assignment) => ({
      subjectName: assignment.subjectName as string,
      teacherName: assignment.teacherProfile?.displayName ?? null,
    }));

  const taught = new Set(subjectTeachers.map((entry) => entry.subjectName.toLowerCase()));
  const unassigned = uniqueSubjectNames.filter((name) => !taught.has(name.toLowerCase()));
  if (unassigned.length) {
    warnings.push(
      `No subject teacher is assigned for: ${unassigned.join(", ")}. Scores for these subjects will not reach a teacher until an assignment is added.`,
    );
  }

  const classTeacher =
    assignments.find((assignment) => assignment.role === "FORM_TEACHER")?.teacherProfile
      ?.displayName ?? null;
  if (!classTeacher) {
    warnings.push(
      `${classroom.displayName} has no form teacher, so nobody will receive this student's class results or write their remark.`,
    );
  }

  return {
    subjectsAssigned: compulsory.length + electivesAssigned,
    compulsoryAssigned: compulsory.length,
    electivesAssigned,
    electivesDropped,
    enrolmentCreated,
    subjectTeachers,
    classTeacher,
    warnings,
  };
}

/**
 * The subjects a student takes, by name — the list a results screen and a
 * report card both need.
 *
 * Distinct from `studentSubjectIds` (which returns ids for exam filtering):
 * results are keyed by subject NAME because a gradebook line, an exam and a
 * subject catalogue entry are joined by the teacher's subject label, and that
 * is what a card prints.
 */
export async function studentSubjectNames(params: {
  tx: Tx | Prisma.DefaultPrismaClient;
  studentProfileId: string;
}): Promise<string[]> {
  const rows = await params.tx.studentSubject.findMany({
    where: { studentProfileId: params.studentProfileId, isActive: true },
    select: { subject: { select: { name: true } } },
    orderBy: { subject: { name: "asc" } },
  });
  return rows.map((row) => row.subject.name);
}

/** What a student's subject list looks like after a move to a new class. */
export type SubjectRolloverOutcome = {
  added: number;
  reactivated: number;
  deactivated: number;
  keptElectives: number;
  warnings: string[];
};

/**
 * Carry a student's SUBJECTS forward when their class changes.
 *
 * A student's subjects are stored once, against the student, with no link to
 * the class they were assigned for. Promotion moved the class and left the
 * subjects alone, which is right for nine cases out of ten and wrong for the
 * one that matters:
 *
 *   JSS3 → SS1. The senior compulsory subjects (English, Mathematics plus the
 *   student's chosen science/arts/commercial track) are different, and the
 *   junior ones are not theirs any more. The student arrived in SS1 still
 *   enrolled in Basic Science, saw no senior exam they were entitled to, and
 *   appeared on nobody's register for one they should have been on.
 *
 * The same thing happens in reverse for a transfer down, and on any move where
 * a level's compulsory list changed between sessions.
 *
 * ── The rules
 *
 *   Compulsory subjects at the new level are assigned automatically, exactly
 *   as at admission: they are compulsory by definition.
 *
 *   Compulsory subjects from the OLD level are deactivated — but only those the
 *   new level does not also require. A subject both levels call compulsory
 *   (English, Mathematics) is untouched, so no history is rewritten.
 *
 *   Electives are KEPT. They were a real choice by the student, and the ones
 *   that do not exist at the new level were almost certainly not offered;
 *   dropping them silently would be guessing. They are deactivated only when
 *   they cannot belong to the student any more, and the caller is told.
 *
 * MUST run inside the same transaction as the class move: a student whose class
 * changed and whose subjects did not is exactly the half-state this prevents.
 */
export async function rolloverSubjectsForClassChange(params: {
  tx: Tx;
  schoolId: string;
  studentProfileId: string;
  /** The class the student is leaving. Null when this is their first class. */
  fromClassId: string | null;
  toClassId: string;
}): Promise<SubjectRolloverOutcome> {
  const { tx, schoolId, studentProfileId } = params;
  const warnings: string[] = [];

  const to = await tx.schoolClass.findFirst({
    where: { id: params.toClassId, schoolId },
    select: { id: true, level: true, displayName: true },
  });
  if (!to) throw new Error("CLASS_NOT_FOUND");

  const from = params.fromClassId
    ? await tx.schoolClass.findFirst({
        where: { id: params.fromClassId, schoolId },
        select: { id: true, level: true },
      })
    : null;

  // Nothing to do when the level is unchanged: same level, same catalogue.
  if (from && from.level === to.level) {
    return { added: 0, reactivated: 0, deactivated: 0, keptElectives: 0, warnings };
  }

  const newCompulsory = await tx.subject.findMany({
    where: {
      schoolId,
      level: to.level,
      category: SubjectCategory.COMPULSORY,
      isActive: true,
    },
    select: { id: true, name: true },
  });
  const newCompulsoryIds = new Set(newCompulsory.map((subject) => subject.id));

  if (!newCompulsory.length) {
    warnings.push(
      `No compulsory subjects are configured for ${to.level}. ${to.displayName} will see no subjects until the catalogue is set up.`,
    );
  }

  // Everything the student is currently enrolled in — active or not — so a
  // re-run reactivates rather than duplicates.
  const existing = await tx.studentSubject.findMany({
    where: { schoolId, studentProfileId },
    select: {
      id: true,
      subjectId: true,
      isActive: true,
      subject: { select: { name: true, level: true, category: true } },
    },
  });
  const existingById = new Map(existing.map((row) => [row.subjectId, row]));

  // ── Assign the new level's compulsory subjects ─────────────────────────────
  let added = 0;
  let reactivated = 0;
  for (const subject of newCompulsory) {
    const row = existingById.get(subject.id);
    if (!row) {
      await tx.studentSubject.create({
        data: { schoolId, studentProfileId, subjectId: subject.id },
      });
      added += 1;
    } else if (!row.isActive) {
      // A compulsory subject the student had dropped — possibly a bad edit, or
      // a level they passed through before. Compulsory is compulsory.
      await tx.studentSubject.update({
        where: { id: row.id },
        data: { isActive: true },
      });
      reactivated += 1;
    }
  }

  // ── Retire what the new level does not require ─────────────────────────────
  //
  // Only COMPULSORY rows from a different level are retired. An elective is
  // left alone: it is the student's choice, and whether the new level offers it
  // is not something to guess at from here.
  let deactivated = 0;
  let keptElectives = 0;
  for (const row of existing) {
    if (!row.isActive) continue;
    if (newCompulsoryIds.has(row.subjectId)) continue;
    if (row.subject.category !== SubjectCategory.COMPULSORY) {
      keptElectives += 1;
      continue;
    }
    if (row.subject.level === to.level) continue;
    await tx.studentSubject.updateMany({
      where: { schoolId, studentProfileId, subjectId: row.subjectId },
      data: { isActive: false },
    });
    deactivated += 1;
  }

  return { added, reactivated, deactivated, keptElectives, warnings };
}
