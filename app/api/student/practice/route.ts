import { ExamAttemptStatus, ExamStatus } from "@prisma/client";
import { NextResponse } from "next/server";
import { getStudentExamContext } from "@/lib/exams";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * Student exam-practice catalogue (WAEC / JAMB / BECE prep).
 *
 * Practice exams are ordinary Exam rows with examType = "PRACTICE", created by
 * teachers in the CBT centre. This endpoint groups them by subject and reports
 * the student's own attempt history so the page can show real progress.
 *
 * Two deliberate differences from graded CBT (see /api/student/exams):
 *
 *  1. No fee lock. Fee gating exists to stop an unpaid student sitting a
 *     graded assessment. Blocking revision would punish exactly the students
 *     most likely to be behind on fees, and it earns the school nothing.
 *  2. Unlimited attempts. Practice is for repetition — requiring a teacher to
 *     grant a retake before a second go would make the feature unusable.
 *
 * Both rules are enforced server-side in ./[id]/attempt.
 */
export async function GET() {
  const context = await getStudentExamContext();
  if (!context) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const exams = await prisma.exam.findMany({
    where: {
      schoolId: context.user.schoolId,
      classId: context.studentProfile.currentClassId,
      examType: "PRACTICE",
      status: { in: [ExamStatus.PUBLISHED, ExamStatus.CLOSED] },
    },
    orderBy: [{ subjectName: "asc" }, { createdAt: "desc" }],
    take: 200,
    select: {
      id: true,
      title: true,
      subjectName: true,
      durationMinutes: true,
      passMark: true,
      instructions: true,
      status: true,
      questions: { select: { marks: true } },
      attempts: {
        where: { studentProfileId: context.studentProfile.id },
        orderBy: { attemptNumber: "desc" },
        take: 50,
        select: {
          id: true,
          status: true,
          totalScore: true,
          attemptNumber: true,
          submittedAt: true,
        },
      },
    },
  });

  const cards = exams.map((exam) => {
    const totalMarks = exam.questions.reduce((sum, question) => sum + question.marks, 0);
    const finished = exam.attempts.filter(
      (attempt) => attempt.status !== ExamAttemptStatus.IN_PROGRESS,
    );
    const inProgress = exam.attempts.find(
      (attempt) => attempt.status === ExamAttemptStatus.IN_PROGRESS,
    );

    const percentages = totalMarks
      ? finished.map((attempt) => Math.round((attempt.totalScore / totalMarks) * 100))
      : [];
    const bestPercent = percentages.length ? Math.max(...percentages) : null;
    const lastPercent = percentages.length ? percentages[0] : null;

    return {
      id: exam.id,
      title: exam.title,
      subjectName: exam.subjectName,
      durationMinutes: exam.durationMinutes,
      passMark: exam.passMark,
      instructions: exam.instructions,
      questionCount: exam.questions.length,
      totalMarks,
      // Practice never locks: a student may retake as often as they like.
      canStart: exam.status === ExamStatus.PUBLISHED && exam.questions.length > 0,
      canResume: Boolean(inProgress),
      resumeAttemptId: inProgress?.id ?? null,
      attemptCount: finished.length,
      bestPercent,
      lastPercent,
      lastAttemptAt: finished[0]?.submittedAt?.toISOString() ?? null,
    };
  });

  // Group by subject for the picker.
  const bySubject = new Map<string, typeof cards>();
  for (const card of cards) {
    const list = bySubject.get(card.subjectName) ?? [];
    list.push(card);
    bySubject.set(card.subjectName, list);
  }

  const subjects = [...bySubject.entries()]
    .map(([name, list]) => {
      const scored = list.filter((item) => item.bestPercent !== null);
      return {
        name,
        examCount: list.length,
        questionCount: list.reduce((sum, item) => sum + item.questionCount, 0),
        attemptCount: list.reduce((sum, item) => sum + item.attemptCount, 0),
        bestPercent: scored.length
          ? Math.max(...scored.map((item) => item.bestPercent as number))
          : null,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));

  // Whole-catalogue summary — real numbers, replacing the hardcoded tiles.
  const allFinished = cards.flatMap((card) =>
    card.attemptCount > 0 && card.bestPercent !== null ? [card] : [],
  );
  const summary = {
    testsTaken: cards.reduce((sum, card) => sum + card.attemptCount, 0),
    questionsAnswered: cards.reduce((sum, card) => sum + card.attemptCount * card.questionCount, 0),
    averagePercent: allFinished.length
      ? Math.round(
          allFinished.reduce((sum, card) => sum + (card.lastPercent ?? 0), 0) / allFinished.length,
        )
      : null,
    bestPercent: allFinished.length
      ? Math.max(...allFinished.map((card) => card.bestPercent as number))
      : null,
  };

  return NextResponse.json({
    student: {
      displayName: context.studentProfile.displayName,
      studentId: context.studentProfile.studentId,
    },
    subjects,
    exams: cards,
    summary,
  });
}
