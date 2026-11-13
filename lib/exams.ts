import { ExamAttemptStatus, ExamQuestionType, UserRole } from "@prisma/client";
import { NextResponse } from "next/server";
import { requireModule } from "@/lib/module-guard";
import { prisma } from "@/lib/prisma";
import { requireRole, type SessionUser } from "@/lib/session";
import { gradeObjectiveAnswer } from "@/lib/exam-questions";

export const EXAM_TEACHER_ROLES: UserRole[] = [
  UserRole.TEACHER,
  UserRole.HOD,
  UserRole.ADMIN,
  UserRole.DIRECTOR,
];

export type ExamTeacherContext = {
  user: SessionUser;
  teacherProfile: {
    id: string;
    displayName: string;
    subjectAssignments: Array<{
      id: string;
      subjectName: string;
      classroom: { id: string; displayName: string; level: string };
    }>;
  };
};

export async function getExamTeacherContext(
  authorizedUser?: SessionUser,
): Promise<ExamTeacherContext | null> {
  const user = authorizedUser ?? (await requireRole(EXAM_TEACHER_ROLES));
  if (!user) return null;

  const teacherProfile = await prisma.teacherProfile.findFirst({
    where: { schoolId: user.schoolId, userId: user.id, isActive: true },
    select: {
      id: true,
      displayName: true,
      classAssignments: {
        where: { isActive: true, subjectName: { not: null } },
        orderBy: [{ classroom: { displayName: "asc" } }],
        select: {
          id: true,
          subjectName: true,
          classroom: { select: { id: true, displayName: true, level: true } },
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

export type ExamTeacherModuleContext =
  { ok: true; context: ExamTeacherContext } | { ok: false; response: NextResponse };

/** Authenticate, authorize the exam role, check the school entitlement, then load scope. */
export async function requireExamTeacherContext(): Promise<ExamTeacherModuleContext> {
  const guard = await requireModule("exams", EXAM_TEACHER_ROLES);
  if (!guard.ok) return { ok: false, response: guard.response };

  const context = await getExamTeacherContext(guard.user);
  if (!context) {
    return {
      ok: false,
      response: NextResponse.json({ error: "No active teacher profile." }, { status: 403 }),
    };
  }
  return { ok: true, context };
}

export type StudentExamModuleContext =
  | { ok: true; context: NonNullable<Awaited<ReturnType<typeof getStudentExamContext>>> }
  | { ok: false; response: NextResponse };

export async function requireStudentExamContext(): Promise<StudentExamModuleContext> {
  const guard = await requireModule("exams", [UserRole.STUDENT]);
  if (!guard.ok) return { ok: false, response: guard.response };

  const context = await getStudentExamContext(guard.user);
  if (!context) {
    return {
      ok: false,
      response: NextResponse.json({ error: "No active student profile." }, { status: 403 }),
    };
  }
  return { ok: true, context };
}

export async function getStudentExamContext(authorizedUser?: SessionUser) {
  const user = authorizedUser ?? (await requireRole([UserRole.STUDENT]));
  if (!user) return null;
  const studentProfile = await prisma.studentProfile.findFirst({
    where: { schoolId: user.schoolId, userId: user.id, isActive: true },
    select: { id: true, displayName: true, studentId: true, currentClassId: true },
  });
  if (!studentProfile) return null;
  return { user, studentProfile };
}

/* ------------------------------------------------------------------
   Pure exam logic lives in lib/exam-questions.ts
   ------------------------------------------------------------------

   Re-exported here so existing server-side imports keep working. Client
   components must import from "@/lib/exam-questions" directly — importing
   this module from the browser drags in next/headers via lib/session and
   fails the build.
*/

export {
  parseBulkQuestions,
  gradeObjectiveAnswer,
  examStatusLabel,
  type ParsedQuestion,
} from "@/lib/exam-questions";

export async function finalizeAttempt(attemptId: string) {
  const attempt = await prisma.examAttempt.findUnique({
    where: { id: attemptId },
    include: {
      answers: {
        include: {
          question: {
            select: { type: true, correctKey: true, correctText: true, marks: true },
          },
        },
      },
      exam: {
        select: {
          id: true,
          questions: {
            select: { id: true, type: true, correctKey: true, correctText: true, marks: true },
          },
        },
      },
    },
  });
  // Grading is a one-way transition: a retry, stale reference, or future
  // caller must never recalculate a submitted/released attempt against changed
  // answer keys and overwrite its stored result.
  if (!attempt || attempt.status !== ExamAttemptStatus.IN_PROGRESS) return null;

  let autoScore = 0;
  const examQuestions = attempt.exam.questions ?? [];
  let hasEssay = examQuestions.some((question) => question.type === ExamQuestionType.ESSAY);
  const existingQuestionIds = new Set(attempt.answers.map((answer) => answer.questionId));
  const missingAnswers = examQuestions
    .filter(
      (question) =>
        question.type === ExamQuestionType.ESSAY && !existingQuestionIds.has(question.id),
    )
    .map((question) => ({
      attemptId: attempt.id,
      questionId: question.id,
      response: null,
      isCorrect: null,
      awardedMarks: null,
    }));

  /**
   * Grading used to issue one UPDATE per answer, awaited in sequence. A
   * 60-question paper meant 60 sequential round trips at submit time — the
   * single moment a student is least willing to wait, and the moment a whole
   * class hits the server at once because the timer expires for everyone
   * together.
   *
   * The marks awarded only ever take a handful of distinct values (0, or the
   * question's mark value), so answers are bucketed by the (isCorrect,
   * awardedMarks) pair they resolve to and written with one `updateMany` per
   * bucket. 60 round trips becomes 2–3, and the whole thing is one
   * transaction so a mid-grade failure cannot leave an attempt half-scored.
   */
  const buckets = new Map<string, { isCorrect: boolean; awardedMarks: number; ids: string[] }>();

  for (const answer of attempt.answers) {
    if (answer.question.type === ExamQuestionType.ESSAY) {
      hasEssay = true;
      continue;
    }
    const graded = gradeObjectiveAnswer({
      type: answer.question.type,
      correctKey: answer.question.correctKey,
      correctText: answer.question.correctText,
      marks: answer.question.marks,
      response: answer.response,
    });
    const awardedMarks = graded.awardedMarks || 0;
    const isCorrect = graded.isCorrect === true;
    autoScore += awardedMarks;

    const key = `${isCorrect}:${awardedMarks}`;
    const bucket = buckets.get(key);
    if (bucket) bucket.ids.push(answer.id);
    else buckets.set(key, { isCorrect, awardedMarks, ids: [answer.id] });
  }

  // Unanswered objective questions count as zero — ensured by autoScore accumulation.
  // Claim the one-way state transition with a conditional update inside the same
  // transaction as the answer marks. A second submit/timer worker that read the
  // stale IN_PROGRESS row cannot also publish a score.
  return prisma.$transaction(
    async (tx) => {
      const nextStatus = hasEssay ? ExamAttemptStatus.SUBMITTED : ExamAttemptStatus.GRADED;
      const claimed = await tx.examAttempt.updateMany({
        where: { id: attempt.id, status: ExamAttemptStatus.IN_PROGRESS },
        data: { status: nextStatus },
      });
      if (claimed.count !== 1) {
        // Another submit/timer worker won after our initial read. Return its
        // canonical row so callers can answer idempotently with stored status.
        return tx.examAttempt.findUnique({ where: { id: attempt.id } });
      }

      if (missingAnswers.length) {
        await tx.examAnswer.createMany({ data: missingAnswers });
      }

      await Promise.all(
        [...buckets.values()].map((bucket) =>
          tx.examAnswer.updateMany({
            where: { id: { in: bucket.ids } },
            data: { isCorrect: bucket.isCorrect, awardedMarks: bucket.awardedMarks },
          }),
        ),
      );

      return tx.examAttempt.update({
        where: { id: attempt.id },
        data: {
          status: nextStatus,
          submittedAt: new Date(),
          autoScore,
          totalScore: autoScore + attempt.essayScore,
        },
      });
    },
    { isolationLevel: "Serializable" },
  );
}

/**
 * How long a sitting on this paper actually is.
 *
 * An exam can have two halves: objective questions, marked automatically, and
 * a theory section the teacher marks by hand. `durationMinutes` is the
 * objective window; `theoryMinutes` is the extra time for the written part.
 *
 * The student list has always advertised "40 min objective + 20 min theory".
 * The attempt, the offline package and the replay all derived the deadline from
 * `durationMinutes` alone, so a child was told they had an hour and given
 * forty minutes — a lost theory script every time, and an indefensible one,
 * because the screen said otherwise.
 *
 * Forty minutes is the fallback for a paper with no duration set at all: an
 * exam that cannot be timed is not an exam that should last forever.
 */
export function examMinutes(exam: {
  durationMinutes?: number | null;
  theoryMinutes?: number | null;
}): number {
  const objective = Math.max(0, exam.durationMinutes ?? 0);
  const theory = Math.max(0, exam.theoryMinutes ?? 0);
  const total = objective + theory;
  return total > 0 ? total : 40;
}
