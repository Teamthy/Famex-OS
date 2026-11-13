/**
 * Term results — the database half of the compilation layer.
 *
 * `lib/results-engine.ts` holds the arithmetic and has no database. This module
 * does the reads and writes and is the only place that decides WHICH rows feed a
 * result:
 *
 *   subject score ← SubjectGradebook line (the teacher's record), with the exam
 *                   component optionally filled from CBT sittings when the
 *                   teacher entered none.
 *   term total    ← sum of the student's INCLUDED subject lines.
 *   cumulative    ← subject-count-weighted mean of terms 1..N of the session.
 *
 * ── Why compilation is an explicit step
 *
 * A report card must be reproducible. Computed live, two parents printing the
 * same card a week apart could get different numbers, and a teacher editing a
 * Second Term mark in May would silently change a First Term card. Compiling
 * snapshots the numbers into TermResult and freezes them (`compiledAt`); the
 * card reads the snapshot, and recompiling is a deliberate act that records who
 * did it.
 */
import {
  AttendanceStatus,
  ClassResultStatus,
  ExamAttemptStatus,
  ExamStatus,
  GradebookStatus,
  Prisma,
  ResultLineStatus,
  ResultSource,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { indexFeeBalances, tallyAttendance } from "@/lib/report-cards";
import { readOfflinePacketSnapshot } from "@/lib/offline-packet";
import {
  DEFAULT_PERCENTAGE_BANDS,
  buildSubjectLine,
  compileTerm,
  cumulativeAverage as weightedCumulative,
  gradeFor,
  releasedCumulativeByTerm,
  normaliseScores,
  rankByTotal,
  rankSubjectAcrossClass,
  type CbtContribution,
  type GradeBand,
  type ResultScoreField,
} from "@/lib/results-engine";

/* ------------------------------------------------------------------
   Grading configuration
   ------------------------------------------------------------------ */

/**
 * The grade bands for a class's stage, or the WAEC default.
 *
 * A school that has configured its own bands gets them; one that has not gets
 * the standard nine-point scale rather than a blank grade column. Never throws —
 * a report card must render even if settings are half-written.
 */
export async function gradeBandsForClass(schoolId: string, classId: string): Promise<GradeBand[]> {
  const schoolClass = await prisma.schoolClass.findFirst({
    where: { id: classId, schoolId },
    select: { stage: true },
  });
  if (!schoolClass) return DEFAULT_PERCENTAGE_BANDS;

  const bands = await prisma.gradeBand.findMany({
    where: { schoolId, stage: schoolClass.stage },
    orderBy: { minScore: "desc" },
    select: {
      grade: true,
      minScore: true,
      maxScore: true,
      remark: true,
      points: true,
      order: true,
    },
  });
  return bands.length ? bands : DEFAULT_PERCENTAGE_BANDS;
}

/* ------------------------------------------------------------------
   CBT contributions
   ------------------------------------------------------------------ */

export function cbtKey(studentProfileId: string, subjectName: string) {
  return `${studentProfileId}::${subjectName}`;
}

/**
 * Every graded CBT sitting for a class in a term, grouped by student+subject.
 *
 * Only GRADED attempts count. SUBMITTED means an essay is still waiting for a
 * human — adopting it would put a provisional score into a permanent result,
 * and a teacher who then marks the essay would have no way to tell the compiled
 * number was based on a half-marked paper.
 *
 * A student who sat the same paper twice (a retake) contributes their BEST
 * attempt: a retake exists precisely because the first sitting went wrong.
 */
export async function cbtContributionsForClass(params: {
  schoolId: string;
  classId: string;
  sessionLabel: string;
  termIndex: number;
}): Promise<Map<string, CbtContribution>> {
  const exams = await prisma.exam.findMany({
    where: {
      schoolId: params.schoolId,
      classId: params.classId,
      sessionLabel: params.sessionLabel,
      termIndex: params.termIndex,
      status: { in: [ExamStatus.PUBLISHED, ExamStatus.CLOSED] },
    },
    select: {
      subjectName: true,
      questions: { select: { marks: true } },
      attempts: {
        where: { status: ExamAttemptStatus.GRADED },
        select: { id: true, studentProfileId: true, totalScore: true, metadata: true },
      },
    },
  });

  const out = new Map<string, CbtContribution>();
  for (const exam of exams) {
    const examMaxMarks = exam.questions.reduce((sum, question) => sum + question.marks, 0);

    // Best sitting per student, merged across the (usually single) papers for
    // that subject in the term. Offline attempts use their immutable issued
    // packet maximum, not today's authored question rows.
    const bestByStudent = new Map<
      string,
      { score: number; maxMarks: number; ratio: number; attemptId: string }
    >();
    for (const attempt of exam.attempts) {
      const maxMarks =
        readOfflinePacketSnapshot(attempt.metadata)?.manifest.totalMarks ?? examMaxMarks;
      if (maxMarks <= 0) continue;
      const ratio = attempt.totalScore / maxMarks;
      const current = bestByStudent.get(attempt.studentProfileId);
      if (!current || ratio > current.ratio) {
        bestByStudent.set(attempt.studentProfileId, {
          score: attempt.totalScore,
          maxMarks,
          ratio,
          attemptId: attempt.id,
        });
      }
    }

    for (const [studentProfileId, best] of bestByStudent) {
      const key = cbtKey(studentProfileId, exam.subjectName);
      const existing = out.get(key);
      out.set(key, {
        score: (existing?.score ?? 0) + best.score,
        maxMarks: (existing?.maxMarks ?? 0) + best.maxMarks,
        attempts: (existing?.attempts ?? 0) + 1,
        attemptId: best.attemptId,
      });
    }
  }
  return out;
}

/* ------------------------------------------------------------------
   Compilation
   ------------------------------------------------------------------ */

export type CompileClassInput = {
  schoolId: string;
  classId: string;
  sessionLabel: string;
  termIndex: number;
  termLabel: string;
  actorUserId: string;
  /**
   * Compile over gradebooks a teacher has not locked. Off by default: an
   * unlocked gradebook means a teacher has not finished, and compiling over it
   * freezes a half-entered term.
   */
  allowUnlockedGradebooks?: boolean;
  /** Recompute a class that is already compiled. */
  recompile?: boolean;
};

export type CompileClassResult = {
  studentsCompiled: number;
  linesWritten: number;
  cbtLines: number;
  skipped: Array<{ studentProfileId: string; displayName: string; reason: string }>;
  classAverage: number;
  highestAverage: number;
  lowestAverage: number;
  unlockedGradebooks: string[];
};

/**
 * Compile (or recompile) one class's results for one term.
 *
 * All writes happen in one transaction. A half-compiled class is worse than an
 * uncompiled one: some students would print a result and others would not, with
 * nothing on screen to say why.
 */
export async function compileClassTermResults(
  input: CompileClassInput,
): Promise<CompileClassResult> {
  const schoolClass = await prisma.schoolClass.findFirst({
    where: { id: input.classId, schoolId: input.schoolId, isActive: true },
    select: { id: true, displayName: true },
  });
  if (!schoolClass) throw new Error("CLASS_NOT_FOUND");

  const gradebooks = await prisma.subjectGradebook.findMany({
    where: {
      schoolId: input.schoolId,
      classId: schoolClass.id,
      sessionLabel: input.sessionLabel,
      termLabel: input.termLabel,
    },
    include: { entries: true },
    orderBy: { subjectName: "asc" },
  });

  const unlocked = gradebooks
    .filter((gradebook) => gradebook.status !== GradebookStatus.LOCKED)
    .map((gradebook) => gradebook.subjectName);
  if (unlocked.length && !input.allowUnlockedGradebooks) {
    throw new Error(`UNLOCKED_GRADEBOOKS:${unlocked.join(", ")}`);
  }

  const classResult = await prisma.classTermResult.findUnique({
    where: {
      classId_sessionLabel_termIndex: {
        classId: schoolClass.id,
        sessionLabel: input.sessionLabel,
        termIndex: input.termIndex,
      },
    },
    select: { status: true },
  });
  if (
    classResult &&
    (classResult.status === ClassResultStatus.COMPILED ||
      classResult.status === ClassResultStatus.RELEASED) &&
    !input.recompile
  ) {
    throw new Error("ALREADY_COMPILED");
  }

  // Every active student is a candidate. A student with nothing marked is
  // reported as skipped rather than written as a zero — a zero average is a
  // claim about their performance, not an absence.
  const students = await prisma.studentProfile.findMany({
    where: { schoolId: input.schoolId, currentClassId: schoolClass.id, isActive: true },
    select: { id: true, displayName: true },
    orderBy: { displayName: "asc" },
  });
  if (!students.length) throw new Error("NO_STUDENTS");

  const bands = await gradeBandsForClass(input.schoolId, schoolClass.id);
  const cbt = await cbtContributionsForClass({
    schoolId: input.schoolId,
    classId: schoolClass.id,
    sessionLabel: input.sessionLabel,
    termIndex: input.termIndex,
  });

  // Attempts a previous compile already adopted, so a recompile keeps a
  // CBT-sourced score stable unless the marks genuinely changed.
  const prior = await prisma.termResult.findMany({
    where: {
      studentProfileId: { in: students.map((student) => student.id) },
      sessionLabel: input.sessionLabel,
      termIndex: input.termIndex,
    },
    select: {
      studentProfileId: true,
      subjects: { select: { subjectName: true, cbtAttemptId: true } },
    },
  });
  const adoptedByStudent = new Map<string, Map<string, string | null>>();
  for (const row of prior) {
    adoptedByStudent.set(
      row.studentProfileId,
      new Map(row.subjects.map((subject) => [subject.subjectName, subject.cbtAttemptId])),
    );
  }

  type StudentLine = NonNullable<ReturnType<typeof buildSubjectLine>>;
  const perStudent = new Map<string, StudentLine[]>();
  const skipped: CompileClassResult["skipped"] = [];

  for (const student of students) {
    const lines: StudentLine[] = [];
    const covered = new Set<string>();

    for (const gradebook of gradebooks) {
      const entry = gradebook.entries.find((row) => row.studentProfileId === student.id);
      if (!entry) continue;
      covered.add(gradebook.subjectName);
      const line = buildSubjectLine({
        subjectName: gradebook.subjectName,
        gradebook: {
          scores: {
            ca1: entry.ca1,
            ca2: entry.ca2,
            midterm: entry.midterm,
            assignment: entry.assignment,
            exam: entry.exam,
          },
          comment: entry.comment,
        },
        cbt: cbt.get(cbtKey(student.id, gradebook.subjectName)) ?? null,
        adoptedAttemptId: adoptedByStudent.get(student.id)?.get(gradebook.subjectName) ?? null,
      });
      if (line) lines.push(line);
    }

    // CBT-only subjects: a paper was sat but no gradebook line exists. This is
    // the normal shape for a school running every assessment on the CBT engine.
    for (const [key, contribution] of cbt) {
      const separator = key.indexOf("::");
      const studentId = key.slice(0, separator);
      if (studentId !== student.id) continue;
      const subjectName = key.slice(separator + 2);
      if (covered.has(subjectName)) continue;
      const line = buildSubjectLine({ subjectName, cbt: contribution });
      if (line) lines.push(line);
    }

    if (!lines.length) {
      skipped.push({
        studentProfileId: student.id,
        displayName: student.displayName,
        reason: "No marked subject and no graded CBT sitting in this term.",
      });
      continue;
    }
    perStudent.set(student.id, lines);
  }

  if (!perStudent.size) throw new Error("NOTHING_TO_COMPILE");

  // Subject positions are class-wide, so they are computed after every
  // student's lines exist.
  const subjectRankings = rankSubjectAcrossClass(
    [...perStudent.entries()].flatMap(([studentProfileId, lines]) =>
      lines.map((line) => ({
        studentProfileId,
        subjectName: line.subjectName,
        total: line.total,
      })),
    ),
  );

  // Cumulative averages need the earlier terms of THIS session, read in one
  // query rather than one per student.
  const history = await prisma.termResult.findMany({
    where: {
      schoolId: input.schoolId,
      sessionLabel: input.sessionLabel,
      termIndex: { lt: input.termIndex },
      status: ResultLineStatus.INCLUDED,
      studentProfileId: { in: [...perStudent.keys()] },
    },
    select: { studentProfileId: true, totalScore: true, subjectCount: true },
    orderBy: { termIndex: "asc" },
  });
  const historyByStudent = new Map<string, Array<{ total: number; subjects: number }>>();
  for (const row of history) {
    const bucket = historyByStudent.get(row.studentProfileId) ?? [];
    bucket.push({ total: row.totalScore, subjects: row.subjectCount });
    historyByStudent.set(row.studentProfileId, bucket);
  }

  const totalsByStudent = new Map<string, ReturnType<typeof compileTerm>>();
  for (const [studentId, lines] of perStudent) {
    totalsByStudent.set(
      studentId,
      compileTerm(
        lines.map((line) => ({ subjectName: line.subjectName, total: line.total, included: true })),
      ),
    );
  }
  const ranked = rankByTotal(
    [...totalsByStudent.entries()].map(([id, compilation]) => ({
      id,
      total: compilation.average,
      data: compilation,
    })),
  );
  const positionByStudent = new Map(ranked.map((row) => [row.id, row]));

  // Attendance for THIS term and outstanding fees, snapshotted at compile time.
  //
  // Counting them when the card is printed is what let a card reprinted a month
  // later show a different attendance figure — registers kept being taken after
  // the result was closed. A compiled result is a snapshot; these belong in it.
  const termWindow = await prisma.term.findFirst({
    where: {
      schoolId: input.schoolId,
      index: input.termIndex,
      session: { label: input.sessionLabel },
    },
    select: { startsOn: true, endsOn: true },
  });

  const studentIds = [...perStudent.keys()];
  const attendanceRows = termWindow
    ? await prisma.attendanceEntry.findMany({
        where: {
          studentProfileId: { in: studentIds },
          session: { sessionDate: { gte: termWindow.startsOn, lte: termWindow.endsOn } },
        },
        select: { studentProfileId: true, status: true },
      })
    : [];
  const attendanceByStudent = tallyAttendance(studentIds, attendanceRows, AttendanceStatus.PRESENT);

  // Deliberately NOT term-scoped: what a family OWES is cumulative, and a card
  // reading "₦0 owing" while last term is unpaid tells a parent they are settled
  // when they are not.
  const feeRows = await prisma.feeInvoice.groupBy({
    by: ["studentProfileId"],
    where: {
      studentProfileId: { in: studentIds },
      status: { in: ["UNPAID", "PARTIAL", "OVERDUE"] },
    },
    _sum: { balanceDue: true },
  });
  const feeByStudent = indexFeeBalances(feeRows);

  const now = new Date();
  let linesWritten = 0;
  let cbtLines = 0;

  await prisma.$transaction(async (tx) => {
    for (const [studentId, lines] of perStudent) {
      const compilation = totalsByStudent.get(studentId)!;
      const rank = positionByStudent.get(studentId);
      const cumulative = weightedCumulative([
        ...(historyByStudent.get(studentId) ?? []),
        { total: compilation.totalScore, subjects: compilation.subjectCount },
      ]);
      const attendance = attendanceByStudent.get(studentId) ?? { present: 0, total: 0 };

      const payload = {
        schoolId: input.schoolId,
        studentProfileId: studentId,
        classId: schoolClass.id,
        sessionLabel: input.sessionLabel,
        termIndex: input.termIndex,
        termLabel: input.termLabel,
        status: ResultLineStatus.INCLUDED,
        totalScore: compilation.totalScore,
        subjectCount: compilation.subjectCount,
        average: compilation.average,
        grade: gradeFor(compilation.average, bands),
        position: rank?.label || null,
        positionNumber: rank?.position ?? null,
        cumulativeAverage: cumulative,
        cumulativeGrade: gradeFor(cumulative, bands),
        termsCounted: Math.max(1, input.termIndex),
        compiledAt: now,
        compiledByUserId: input.actorUserId,
        attendancePresent: attendance.present,
        attendanceTotal: attendance.total,
        feeBalance: feeByStudent.get(studentId) ?? 0,
        classNameSnapshot: schoolClass.displayName,
      };

      const termResult = await tx.termResult.upsert({
        where: {
          studentProfileId_sessionLabel_termIndex: {
            studentProfileId: studentId,
            sessionLabel: input.sessionLabel,
            termIndex: input.termIndex,
          },
        },
        update: payload,
        create: payload,
      });

      // Replace the lines rather than diffing: a subject the student stopped
      // taking must disappear, and a stale line must not survive a recompile.
      await tx.termResultSubject.deleteMany({ where: { termResultId: termResult.id } });

      const sorted = [...lines].sort((a, b) => a.subjectName.localeCompare(b.subjectName));
      await tx.termResultSubject.createMany({
        data: sorted.map((line, index) => {
          const ranking = subjectRankings.get(line.subjectName)?.get(studentId);
          return {
            termResultId: termResult.id,
            subjectName: line.subjectName,
            subjectId: line.subjectId,
            source: line.source as ResultSource,
            status: ResultLineStatus.INCLUDED,
            ca1: line.scores.ca1,
            ca2: line.scores.ca2,
            midterm: line.scores.midterm,
            assignment: line.scores.assignment,
            exam: line.scores.exam,
            total: line.total,
            grade: gradeFor(line.total, bands),
            cbtAttempts: line.cbtAttempts,
            cbtScore: line.cbtScore,
            cbtMaxMarks: line.cbtMaxMarks,
            cbtAttemptId: line.cbtAttemptId,
            comment: line.comment,
            positionNumber: ranking?.position ?? null,
            classAverage: ranking?.classAverage ?? 0,
            sortOrder: index + 1,
          } satisfies Prisma.TermResultSubjectCreateManyInput;
        }),
      });
      linesWritten += sorted.length;
      cbtLines += sorted.filter((line) => line.source === "CBT").length;
    }

    const averages = ranked.map((row) => row.total);
    const summary = {
      status: ClassResultStatus.COMPILED,
      compiledAt: now,
      compiledByUserId: input.actorUserId,
      termLabel: input.termLabel,
      studentCount: perStudent.size,
      classAverage: averages.length
        ? Math.round(averages.reduce((a, b) => a + b, 0) / averages.length)
        : 0,
      highestAverage: averages.length ? Math.max(...averages) : 0,
      lowestAverage: averages.length ? Math.min(...averages) : 0,
      notes: skipped.length ? `${skipped.length} student(s) had no results to compile.` : null,
    };
    await tx.classTermResult.upsert({
      where: {
        classId_sessionLabel_termIndex: {
          classId: schoolClass.id,
          sessionLabel: input.sessionLabel,
          termIndex: input.termIndex,
        },
      },
      update: summary,
      create: {
        schoolId: input.schoolId,
        classId: schoolClass.id,
        sessionLabel: input.sessionLabel,
        termIndex: input.termIndex,
        ...summary,
      },
    });

    // Stamp the attempts that fed a CBT line, so an exams officer can trace a
    // compiled score back to a specific sitting.
    const adopted = [...perStudent.values()]
      .flat()
      .map((line) => line.cbtAttemptId)
      .filter((id): id is string => Boolean(id));
    if (adopted.length) {
      await tx.examAttempt.updateMany({
        where: { id: { in: adopted }, resultAdoptedAt: null },
        data: { resultAdoptedAt: now },
      });
    }
  });

  const averages = ranked.map((row) => row.total);
  return {
    studentsCompiled: perStudent.size,
    linesWritten,
    cbtLines,
    skipped,
    classAverage: averages.length
      ? Math.round(averages.reduce((a, b) => a + b, 0) / averages.length)
      : 0,
    highestAverage: averages.length ? Math.max(...averages) : 0,
    lowestAverage: averages.length ? Math.min(...averages) : 0,
    unlockedGradebooks: unlocked,
  };
}

/* ------------------------------------------------------------------
   Reading results back
   ------------------------------------------------------------------ */

/** Every compiled result for a class + term, with its subject lines. */
export async function listClassResults(params: {
  schoolId: string;
  classId: string;
  sessionLabel: string;
  termIndex: number;
}) {
  const rows = await prisma.termResult.findMany({
    where: {
      schoolId: params.schoolId,
      classId: params.classId,
      sessionLabel: params.sessionLabel,
      termIndex: params.termIndex,
    },
    orderBy: [{ positionNumber: "asc" }, { studentProfile: { displayName: "asc" } }],
    include: {
      studentProfile: { select: { id: true, displayName: true, studentId: true } },
      subjects: { orderBy: { sortOrder: "asc" } },
    },
  });

  return rows.map((row) => ({
    id: row.id,
    student: row.studentProfile,
    status: row.status,
    totalScore: row.totalScore,
    subjectCount: row.subjectCount,
    average: row.average,
    grade: row.grade,
    position: row.position,
    positionNumber: row.positionNumber,
    cumulativeAverage: row.cumulativeAverage,
    cumulativeGrade: row.cumulativeGrade,
    termsCounted: row.termsCounted,
    compiledAt: row.compiledAt?.toISOString() ?? null,
    className: row.classNameSnapshot,
    attendancePresent: row.attendancePresent,
    attendanceTotal: row.attendanceTotal,
    feeBalance: row.feeBalance,
    classTeacherRemark: row.classTeacherRemark,
    directorRemark: row.directorRemark,
    nextResumption: row.nextResumption,
    subjects: row.subjects.map((subject) => ({
      id: subject.id,
      subjectName: subject.subjectName,
      source: subject.source,
      status: subject.status,
      ca1: subject.ca1,
      ca2: subject.ca2,
      midterm: subject.midterm,
      assignment: subject.assignment,
      exam: subject.exam,
      total: subject.total,
      grade: subject.grade,
      position: subject.positionNumber,
      classAverage: subject.classAverage,
      cbtAttempts: subject.cbtAttempts,
      cbtScore: subject.cbtScore,
      cbtMaxMarks: subject.cbtMaxMarks,
      cbtAttemptId: subject.cbtAttemptId,
      comment: subject.comment,
    })),
  }));
}

/**
 * One student's results across every compiled term of a session.
 *
 * What a cumulative report card prints: per-term totals and the running year
 * average. Terms with no compiled result are absent rather than zeroed, so a
 * mid-year card shows two terms instead of "Term 3: 0".
 */
export async function getStudentSessionCumulative(params: {
  schoolId: string;
  studentProfileId: string;
  sessionLabel: string;
  classId: string;
  releasedTermIndexes: number[];
}) {
  const rows = await prisma.termResult.findMany({
    where: {
      schoolId: params.schoolId,
      studentProfileId: params.studentProfileId,
      sessionLabel: params.sessionLabel,
      termIndex: { in: params.releasedTermIndexes },
      status: ResultLineStatus.INCLUDED,
    },
    orderBy: { termIndex: "asc" },
    include: { subjects: { orderBy: { sortOrder: "asc" } } },
  });
  const runningByTerm = new Map(
    releasedCumulativeByTerm(
      rows.map((row) => ({
        termIndex: row.termIndex,
        totalScore: row.totalScore,
        subjectCount: row.subjectCount,
      })),
      await gradeBandsForClass(params.schoolId, params.classId),
    ).map((entry) => [entry.termIndex, entry]),
  );

  const terms = rows.map((row) => ({
    termIndex: row.termIndex,
    termLabel: row.termLabel,
    totalScore: row.totalScore,
    subjectCount: row.subjectCount,
    average: row.average,
    grade: row.grade,
    position: row.position,
    cumulativeAverage: runningByTerm.get(row.termIndex)?.cumulativeAverage ?? 0,
    cumulativeGrade: runningByTerm.get(row.termIndex)?.cumulativeGrade ?? "F9",
    termsCounted: runningByTerm.get(row.termIndex)?.termsCounted ?? 0,
    compiledAt: row.compiledAt?.toISOString() ?? null,
    subjects: row.subjects.map((subject) => ({
      subjectName: subject.subjectName,
      ca1: subject.ca1,
      ca2: subject.ca2,
      midterm: subject.midterm,
      assignment: subject.assignment,
      exam: subject.exam,
      total: subject.total,
      grade: subject.grade,
      position: subject.positionNumber,
      classAverage: subject.classAverage,
      comment: subject.comment,
    })),
  }));

  // Subject-by-subject cumulative: the mean of every compiled term's total for
  // that subject. A parent reading a Third Term card wants "Mathematics: 74 this
  // term, 71 on the year", and it must be the mean of the SAME subject, not of
  // the student's whole result.
  const bySubject = new Map<string, { terms: number; total: number }>();
  for (const term of terms) {
    for (const subject of term.subjects) {
      const entry = bySubject.get(subject.subjectName) ?? { terms: 0, total: 0 };
      entry.terms += 1;
      entry.total += subject.total;
      bySubject.set(subject.subjectName, entry);
    }
  }
  const subjectCumulative = [...bySubject.entries()]
    .map(([subjectName, entry]) => ({
      subjectName,
      termsCounted: entry.terms,
      average: Math.round(entry.total / entry.terms),
    }))
    .sort((a, b) => a.subjectName.localeCompare(b.subjectName));

  const latest = terms[terms.length - 1] ?? null;
  return {
    sessionLabel: params.sessionLabel,
    terms,
    termCount: terms.length,
    yearAverage: latest?.cumulativeAverage ?? 0,
    yearGrade: latest?.cumulativeGrade ?? "F9",
    subjectCumulative,
  };
}

/* ------------------------------------------------------------------
   Editing a compiled result
   ------------------------------------------------------------------ */

/**
 * A staff edit of a compiled subject line.
 *
 * Deliberately narrow. A teacher may change the coursework/exam split of a
 * subject line; they cannot change the student's total (always recomputed), the
 * grade (always re-derived from the school's bands), or the position
 * (recomputed for the whole class, so two students can never both be "1st").
 *
 * The reason is required and lands in the audit log. A mark changed after
 * compilation is the most contentious edit in a school, and "why" is exactly
 * the question a parent asks.
 */
export async function editCompiledSubjectLine(params: {
  schoolId: string;
  termResultId: string;
  subjectName: string;
  scores: Partial<Record<ResultScoreField, number>>;
  comment?: string | null;
  actorUserId: string;
  reason: string;
}) {
  const termResult = await prisma.termResult.findFirst({
    where: { id: params.termResultId, schoolId: params.schoolId },
    select: {
      id: true,
      classId: true,
      sessionLabel: true,
      termIndex: true,
      studentProfileId: true,
    },
  });
  if (!termResult) throw new Error("RESULT_NOT_FOUND");

  const lock = await classResultLockState({
    classId: termResult.classId,
    sessionLabel: termResult.sessionLabel,
    termIndex: termResult.termIndex,
  });
  if (lock.locked) throw new Error("RESULT_RELEASED");

  const existing = await prisma.termResultSubject.findFirst({
    where: { termResultId: termResult.id, subjectName: params.subjectName },
  });
  if (!existing) throw new Error("SUBJECT_NOT_FOUND");

  // Merge over the existing line so a partial edit (only `exam`, say) leaves
  // the untouched components exactly as they were.
  const scores = normaliseScores({
    ca1: params.scores.ca1 ?? existing.ca1,
    ca2: params.scores.ca2 ?? existing.ca2,
    midterm: params.scores.midterm ?? existing.midterm,
    assignment: params.scores.assignment ?? existing.assignment,
    exam: params.scores.exam ?? existing.exam,
  });
  const total = scores.ca1 + scores.ca2 + scores.midterm + scores.assignment + scores.exam;
  const bands = await gradeBandsForClass(params.schoolId, termResult.classId);
  const comment = params.comment === undefined ? existing.comment : params.comment;

  await prisma.$transaction(async (tx) => {
    await tx.termResultSubject.update({
      where: { id: existing.id },
      data: {
        ...scores,
        total,
        grade: gradeFor(total, bands),
        comment,
        // A hand edit is no longer CBT-derived. Keeping the attempt link would
        // let a later compile silently overwrite what a teacher just typed.
        source: ResultSource.MANUAL,
        cbtAttemptId: null,
      },
    });
    await recomputeTermResultTotals(tx, termResult.id, bands);
    await recomputeClassRanking(tx, {
      classId: termResult.classId,
      sessionLabel: termResult.sessionLabel,
      termIndex: termResult.termIndex,
      bands,
    });
  });

  await prisma.auditLog.create({
    data: {
      schoolId: params.schoolId,
      actorUserId: params.actorUserId,
      action: "RESULT_LINE_EDITED",
      entityType: "TermResultSubject",
      entityId: existing.id,
      metadata: {
        subjectName: params.subjectName,
        before: {
          ca1: existing.ca1,
          ca2: existing.ca2,
          midterm: existing.midterm,
          assignment: existing.assignment,
          exam: existing.exam,
          total: existing.total,
          grade: existing.grade,
          comment: existing.comment,
        },
        after: { ...scores, total, grade: gradeFor(total, bands), comment },
        reason: params.reason,
      },
    },
  });

  return { ok: true, total, grade: gradeFor(total, bands) };
}

/** Recompute a TermResult's totals from its (possibly edited) subject lines. */
export async function recomputeTermResultTotals(
  tx: Prisma.TransactionClient,
  termResultId: string,
  bands: GradeBand[],
) {
  const lines = await tx.termResultSubject.findMany({
    where: { termResultId },
    select: { subjectName: true, total: true, status: true },
  });
  const compilation = compileTerm(
    lines.map((line) => ({
      subjectName: line.subjectName,
      total: line.total,
      included: line.status === ResultLineStatus.INCLUDED,
    })),
  );

  const existing = await tx.termResult.findUnique({
    where: { id: termResultId },
    select: {
      sessionLabel: true,
      termIndex: true,
      studentProfileId: true,
      schoolId: true,
    },
  });
  if (!existing) return;

  // The cumulative figure has to move with the term, otherwise correcting a
  // First Term mark leaves a Third Term card printing the old year average.
  const earlier = await tx.termResult.findMany({
    where: {
      schoolId: existing.schoolId,
      sessionLabel: existing.sessionLabel,
      termIndex: { lt: existing.termIndex },
      studentProfileId: existing.studentProfileId,
      status: ResultLineStatus.INCLUDED,
    },
    select: { totalScore: true, subjectCount: true },
  });
  const cumulative = weightedCumulative([
    ...earlier.map((row) => ({ total: row.totalScore, subjects: row.subjectCount })),
    { total: compilation.totalScore, subjects: compilation.subjectCount },
  ]);

  await tx.termResult.update({
    where: { id: termResultId },
    data: {
      totalScore: compilation.totalScore,
      subjectCount: compilation.subjectCount,
      average: compilation.average,
      grade: gradeFor(compilation.average, bands),
      cumulativeAverage: cumulative,
      cumulativeGrade: gradeFor(cumulative, bands),
    },
  });

  await refreshLaterCumulatives(tx, {
    schoolId: existing.schoolId,
    studentProfileId: existing.studentProfileId,
    sessionLabel: existing.sessionLabel,
    afterTermIndex: existing.termIndex,
    bands,
  });
}

async function refreshLaterCumulatives(
  tx: Prisma.TransactionClient,
  params: {
    schoolId: string;
    studentProfileId: string;
    sessionLabel: string;
    afterTermIndex: number;
    bands: GradeBand[];
  },
) {
  const rows = await tx.termResult.findMany({
    where: {
      schoolId: params.schoolId,
      studentProfileId: params.studentProfileId,
      sessionLabel: params.sessionLabel,
      status: ResultLineStatus.INCLUDED,
    },
    orderBy: { termIndex: "asc" },
    select: { id: true, termIndex: true, totalScore: true, subjectCount: true },
  });
  const running: Array<{ total: number; subjects: number }> = [];
  for (const row of rows) {
    running.push({ total: row.totalScore, subjects: row.subjectCount });
    if (row.termIndex <= params.afterTermIndex) continue;
    const cumulative = weightedCumulative(running);
    await tx.termResult.update({
      where: { id: row.id },
      data: {
        cumulativeAverage: cumulative,
        cumulativeGrade: gradeFor(cumulative, params.bands),
      },
    });
  }
}

/**
 * Rewrite every student's position for a term.
 *
 * Runs after ANY edit to any line, because a position is a fact about the whole
 * class, not about one row. A student whose mark was raised moves up; the
 * student they passed moves down in the same transaction.
 */
export async function recomputeClassRanking(
  tx: Prisma.TransactionClient,
  params: { classId: string; sessionLabel: string; termIndex: number; bands: GradeBand[] },
) {
  const rows = await tx.termResult.findMany({
    where: {
      classId: params.classId,
      sessionLabel: params.sessionLabel,
      termIndex: params.termIndex,
      status: ResultLineStatus.INCLUDED,
    },
    select: { id: true, studentProfileId: true, average: true },
  });
  if (!rows.length) return;

  const byStudent = new Map(
    rankByTotal(
      rows.map((row) => ({ id: row.studentProfileId, total: row.average, data: row })),
    ).map((row) => [row.id, row]),
  );

  for (const row of rows) {
    const rank = byStudent.get(row.studentProfileId);
    if (!rank) continue;
    await tx.termResult.update({
      where: { id: row.id },
      data: { position: rank.label || null, positionNumber: rank.position },
    });
  }

  const averages = rows.map((row) => row.average);
  await tx.classTermResult.updateMany({
    where: {
      classId: params.classId,
      sessionLabel: params.sessionLabel,
      termIndex: params.termIndex,
    },
    data: {
      studentCount: rows.length,
      classAverage: Math.round(averages.reduce((a, b) => a + b, 0) / averages.length),
      highestAverage: Math.max(...averages),
      lowestAverage: Math.min(...averages),
    },
  });
}

/** Subject positions across a class, after an edit to one subject line. */
export async function recomputeSubjectRanking(
  tx: Prisma.TransactionClient,
  params: {
    termResultId: string;
    classId: string;
    sessionLabel: string;
    termIndex: number;
    subjectName: string;
  },
) {
  const siblings = await tx.termResult.findMany({
    where: {
      classId: params.classId,
      sessionLabel: params.sessionLabel,
      termIndex: params.termIndex,
      status: ResultLineStatus.INCLUDED,
    },
    select: { id: true },
  });
  if (!siblings.length) return;

  const lines = await tx.termResultSubject.findMany({
    where: {
      termResultId: { in: siblings.map((row) => row.id) },
      subjectName: params.subjectName,
    },
    select: { id: true, total: true },
  });
  if (!lines.length) return;

  const ranked = rankByTotal(lines.map((line) => ({ id: line.id, total: line.total, data: line })));
  const classAverage = Math.round(lines.reduce((sum, line) => sum + line.total, 0) / lines.length);
  for (const row of ranked) {
    await tx.termResultSubject.update({
      where: { id: row.id },
      data: { positionNumber: row.position || null, classAverage },
    });
  }
}

/** Whether a class's result for a term may still be edited by staff. */
export async function classResultLockState(params: {
  classId: string;
  sessionLabel: string;
  termIndex: number;
}) {
  const row = await prisma.classTermResult.findUnique({
    where: {
      classId_sessionLabel_termIndex: {
        classId: params.classId,
        sessionLabel: params.sessionLabel,
        termIndex: params.termIndex,
      },
    },
    select: { status: true, compiledAt: true, releasedAt: true },
  });
  return {
    status: row?.status ?? ClassResultStatus.DRAFT,
    locked: row?.status === ClassResultStatus.RELEASED,
    compiled: Boolean(row?.compiledAt),
    compiledAt: row?.compiledAt?.toISOString() ?? null,
    releasedAt: row?.releasedAt?.toISOString() ?? null,
  };
}
