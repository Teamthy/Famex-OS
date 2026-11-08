import { ClassResultStatus, UserRole } from "@prisma/client";
import { NextResponse, type NextRequest } from "next/server";
import { resolveCurrentLabels } from "@/lib/academic-session";
import { prisma } from "@/lib/prisma";
import { getStudentSessionCumulative } from "@/lib/results";
import { cumulativeTermsFor, isFinalTerm } from "@/lib/results-engine";
import { requireRole } from "@/lib/session";

export const dynamic = "force-dynamic";

/**
 * A student's own results.
 *
 * ── The one rule that matters
 *
 * A term is visible only when its ClassTermResult is RELEASED. Compiled is not
 * released: a class teacher compiles, an admin reviews, then releases. Showing a
 * compiled-but-unreleased result would publish a number an adult has not yet
 * signed off — and the position can still move while corrections are being
 * entered.
 *
 * ── What a pending term looks like
 *
 * "Your result is being prepared" — not an error, not a blank. A student who
 * sat the exams and sees nothing concludes their paper was lost.
 *
 * ── Cumulative
 *
 * The running year average is available from the second released term, and the
 * full-year figure is only offered once the third term is released. Offering a
 * "year average" composed of one term is a claim the school cannot stand behind.
 */
export async function GET(request: NextRequest) {
  const user = await requireRole([UserRole.STUDENT]);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const student = await prisma.studentProfile.findFirst({
    where: { schoolId: user.schoolId, userId: user.id, isActive: true },
    select: {
      id: true,
      displayName: true,
      studentId: true,
      currentClassId: true,
      currentClass: { select: { id: true, displayName: true } },
    },
  });
  if (!student) return NextResponse.json({ error: "No active student profile." }, { status: 403 });

  const url = new URL(request.url);
  const requestedSession = url.searchParams.get("sessionLabel");
  const sessionLabel = requestedSession ?? (await resolveCurrentLabels(user.schoolId)).sessionLabel;

  // Which terms of this session has the school compiled at all? A term the
  // school has not even compiled is not "pending for you" — it simply has not
  // happened yet, and telling a student it is pending is a lie that makes them
  // chase the exams office.
  const classResults = student.currentClassId
    ? await prisma.classTermResult.findMany({
        where: { classId: student.currentClassId, sessionLabel },
        select: { termIndex: true, status: true, releasedAt: true, compiledAt: true },
        orderBy: { termIndex: "asc" },
      })
    : [];
  const releasedTerms = new Set(
    classResults
      .filter((row) => row.status === ClassResultStatus.RELEASED)
      .map((row) => row.termIndex),
  );

  const rows = await prisma.termResult.findMany({
    where: {
      schoolId: user.schoolId,
      studentProfileId: student.id,
      sessionLabel,
      termIndex: { in: [...releasedTerms] },
    },
    orderBy: { termIndex: "asc" },
    include: { subjects: { orderBy: { sortOrder: "asc" } } },
  });

  const terms = rows.map((row) => ({
    id: row.id,
    termIndex: row.termIndex,
    termLabel: row.termLabel,
    className: row.classNameSnapshot,
    totalScore: row.totalScore,
    subjectCount: row.subjectCount,
    average: row.average,
    grade: row.grade,
    position: row.position,
    positionNumber: row.positionNumber,
    cumulativeAverage: row.cumulativeAverage,
    cumulativeGrade: row.cumulativeGrade,
    termsCounted: row.termsCounted,
    attendancePresent: row.attendancePresent,
    attendanceTotal: row.attendanceTotal,
    feeBalance: row.feeBalance,
    classTeacherRemark: row.classTeacherRemark,
    directorRemark: row.directorRemark,
    nextResumption: row.nextResumption,
    releasedAt:
      classResults.find((cr) => cr.termIndex === row.termIndex)?.releasedAt?.toISOString() ?? null,
    subjects: row.subjects
      .filter((subject) => subject.status !== "EXCLUDED")
      .map((subject) => ({
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
        // Deliberately not exposed: which paper an exam mark came from, and the
        // raw CBT totals. That is exams-office detail and invites disputes the
        // student cannot resolve from here.
      })),
  }));

  const pending = classResults
    .filter(
      (row) =>
        (row.status === ClassResultStatus.COMPILED || row.status === ClassResultStatus.DRAFT) &&
        !releasedTerms.has(row.termIndex),
    )
    .map((row) => ({
      termIndex: row.termIndex,
      state: row.status === ClassResultStatus.DRAFT ? "BEING_COMPILED" : "AWAITING_RELEASE",
      message:
        row.status === ClassResultStatus.DRAFT
          ? "Your result for this term is being prepared."
          : "Your result for this term is waiting to be released by the school.",
    }));

  // Cumulative: only over released terms, and only offered as a year figure at
  // the final term.
  const latest = terms[terms.length - 1] ?? null;
  const finalTerm = isFinalTerm(latest?.termIndex ?? 0);
  const cumulative = student.currentClassId
    ? await getStudentSessionCumulative({
        schoolId: user.schoolId,
        studentProfileId: student.id,
        sessionLabel,
      })
    : null;

  const releasedCumulativeTerms = cumulativeTermsFor(latest?.termIndex ?? 0).filter((index) =>
    releasedTerms.has(index),
  );

  return NextResponse.json({
    student: {
      displayName: student.displayName,
      studentId: student.studentId,
      className: student.currentClass?.displayName ?? null,
    },
    sessionLabel,
    terms,
    pending,
    cumulative: cumulative
      ? {
          ...cumulative,
          // Rebuilt from RELEASED terms only: the raw figure could include a
          // term that was compiled and then unreleased for correction.
          terms: cumulative.terms.filter((term) => releasedTerms.has(term.termIndex)),
          available: releasedCumulativeTerms.length > 0,
          isYearFigure: finalTerm && releasedCumulativeTerms.length >= 3,
          note:
            finalTerm && releasedCumulativeTerms.length >= 3
              ? "This is your cumulative result for the session."
              : releasedCumulativeTerms.length > 1
                ? `Running average across ${releasedCumulativeTerms.length} released term(s). The full session figure is issued at the Third Term.`
                : null,
        }
      : null,
  });
}
