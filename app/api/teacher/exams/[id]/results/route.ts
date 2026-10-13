import { ExamAttemptStatus, ExamQuestionType } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getExamTeacherContext } from "@/lib/exams";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const teacherContext = await getExamTeacherContext();
  if (!teacherContext) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await context.params;
  const exam = await prisma.exam.findFirst({
    where: { id, teacherProfileId: teacherContext.teacherProfile.id },
    include: {
      classroom: { select: { displayName: true } },
      questions: { orderBy: { sortOrder: "asc" } },
      attempts: {
        orderBy: { startedAt: "desc" },
        include: {
          studentProfile: { select: { id: true, studentId: true, displayName: true } },
          answers: {
            include: {
              question: { select: { id: true, type: true, marks: true, questionText: true } },
            },
          },
        },
      },
    },
  });
  if (!exam) return NextResponse.json({ error: "Exam not found." }, { status: 404 });

  const totalMarks = exam.questions.reduce((sum, question) => sum + question.marks, 0);

  return NextResponse.json({
    exam: {
      id: exam.id,
      title: exam.title,
      subjectName: exam.subjectName,
      className: exam.classroom.displayName,
      totalMarks,
      passMark: exam.passMark,
      resultsReleased: exam.resultsReleased,
    },
    attempts: exam.attempts.map((attempt) => ({
      id: attempt.id,
      student: attempt.studentProfile,
      attemptNumber: attempt.attemptNumber,
      status: attempt.status,
      startedAt: attempt.startedAt.toISOString(),
      submittedAt: attempt.submittedAt?.toISOString() || null,
      autoScore: attempt.autoScore,
      essayScore: attempt.essayScore,
      totalScore: attempt.totalScore,
      tabSwitches: attempt.tabSwitches,
      passed: totalMarks > 0 ? (attempt.totalScore / totalMarks) * 100 >= exam.passMark : false,
      pendingEssays: attempt.answers.filter(
        (answer) => answer.question.type === ExamQuestionType.ESSAY && answer.awardedMarks === null,
      ).length,
      essayAnswers: attempt.answers
        .filter((answer) => answer.question.type === ExamQuestionType.ESSAY)
        .map((answer) => ({
          answerId: answer.id,
          questionText: answer.question.questionText,
          maxMarks: answer.question.marks,
          response: answer.response,
          awardedMarks: answer.awardedMarks,
        })),
    })),
  });
}

const gradeSchema = z.object({
  answerId: z.string().trim().min(1),
  awardedMarks: z.number().int().min(0).max(100),
});

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const teacherContext = await getExamTeacherContext();
  if (!teacherContext) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await context.params;
  let payload: z.infer<typeof gradeSchema>;
  try {
    payload = gradeSchema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: "Invalid grading request." }, { status: 400 });
  }

  const answer = await prisma.examAnswer.findFirst({
    where: {
      id: payload.answerId,
      attempt: { exam: { id, teacherProfileId: teacherContext.teacherProfile.id } },
    },
    include: {
      question: { select: { type: true, marks: true } },
      attempt: { select: { id: true } },
    },
  });
  if (!answer) return NextResponse.json({ error: "Answer not found." }, { status: 404 });
  if (answer.question.type !== ExamQuestionType.ESSAY) {
    return NextResponse.json({ error: "Only essay answers are graded manually." }, { status: 409 });
  }

  const awarded = Math.min(payload.awardedMarks, answer.question.marks);
  await prisma.examAnswer.update({
    where: { id: answer.id },
    data: { awardedMarks: awarded, isCorrect: awarded > 0 },
  });

  // Recompute attempt totals; mark GRADED when no essay is left ungraded.
  const attempt = await prisma.examAttempt.findUnique({
    where: { id: answer.attempt.id },
    include: { answers: { include: { question: { select: { type: true } } } } },
  });
  if (attempt) {
    const essayScore = attempt.answers
      .filter((entry) => entry.question.type === ExamQuestionType.ESSAY)
      .reduce((sum, entry) => sum + (entry.awardedMarks || 0), 0);
    const pending = attempt.answers.some(
      (entry) => entry.question.type === ExamQuestionType.ESSAY && entry.awardedMarks === null,
    );
    await prisma.examAttempt.update({
      where: { id: attempt.id },
      data: {
        essayScore,
        totalScore: attempt.autoScore + essayScore,
        status: pending ? ExamAttemptStatus.SUBMITTED : ExamAttemptStatus.GRADED,
      },
    });
  }

  return NextResponse.json({ ok: true, message: "Essay score saved." });
}
