import { ExamAttemptStatus, ExamQuestionType, UserRole } from "@prisma/client";
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

export async function getExamTeacherContext(): Promise<ExamTeacherContext | null> {
  const user = await requireRole(EXAM_TEACHER_ROLES);
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

export async function getStudentExamContext() {
  const user = await requireRole([UserRole.STUDENT]);
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
      exam: { select: { id: true } },
    },
  });
  if (!attempt) return null;

  let autoScore = 0;
  let hasEssay = false;

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
  const results = await prisma.$transaction([
    ...[...buckets.values()].map((bucket) =>
      prisma.examAnswer.updateMany({
        where: { id: { in: bucket.ids } },
        data: { isCorrect: bucket.isCorrect, awardedMarks: bucket.awardedMarks },
      }),
    ),
    prisma.examAttempt.update({
      where: { id: attempt.id },
      data: {
        status: hasEssay ? ExamAttemptStatus.SUBMITTED : ExamAttemptStatus.GRADED,
        submittedAt: new Date(),
        autoScore,
        totalScore: autoScore + attempt.essayScore,
      },
    }),
  ]);

  // The attempt update is always the last entry in the batch.
  return results[results.length - 1] as Awaited<ReturnType<typeof prisma.examAttempt.update>>;
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
