import { ExamAttemptStatus, ExamStatus } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { finalizeAttempt, getStudentExamContext } from "@/lib/exams";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type OptionShape = { key: string; text: string };

/** Deterministic per-attempt shuffle so a refresh keeps the same order. */
function shuffled<T>(items: T[], seed: string): T[] {
  let hash = 0;
  for (const char of seed) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  const array = [...items];
  for (let index = array.length - 1; index > 0; index -= 1) {
    hash = (hash * 1103515245 + 12345) >>> 0;
    const swap = hash % (index + 1);
    [array[index], array[swap]] = [array[swap], array[index]];
  }
  return array;
}

/**
 * Load a PRACTICE exam that belongs to the student's own class and school.
 *
 * The examType check is the security boundary for this whole route group: it
 * stops a student pointing the practice endpoints at a real CA or end-of-term exam to
 * get unlimited attempts with no fee lock.
 */
async function loadPracticeExam(examId: string, schoolId: string, classId: string) {
  return prisma.exam.findFirst({
    where: { id: examId, schoolId, classId, examType: "PRACTICE" },
    include: { questions: { orderBy: { sortOrder: "asc" } } },
  });
}

/**
 * POST — start, or resume, a practice attempt.
 *
 * Differs from the graded runner (/api/student/exams/[id]/attempt) in two ways,
 * both intentional:
 *   • no fee lock — revision must not be paywalled;
 *   • unlimited attempts — no ExamRetake grant needed.
 */
export async function POST(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const studentContext = await getStudentExamContext();
  if (!studentContext) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await context.params;
  const exam = await loadPracticeExam(
    id,
    studentContext.user.schoolId,
    studentContext.studentProfile.currentClassId,
  );
  if (!exam) {
    return NextResponse.json({ error: "Practice exam not found for your class." }, { status: 404 });
  }
  if (!exam.questions.length) {
    return NextResponse.json({ error: "This practice set has no questions yet." }, { status: 409 });
  }

  const existing = await prisma.examAttempt.findFirst({
    where: { examId: exam.id, studentProfileId: studentContext.studentProfile.id },
    orderBy: { attemptNumber: "desc" },
  });

  let attempt = existing;

  if (existing && existing.status === ExamAttemptStatus.IN_PROGRESS) {
    // Resume — unless the clock already ran out, in which case submit it.
    if (existing.deadlineAt.getTime() < Date.now()) {
      await finalizeAttempt(existing.id);
      return NextResponse.json(
        { error: "Time elapsed. That attempt was submitted — start a fresh one." },
        { status: 409 },
      );
    }
  } else {
    if (exam.status !== ExamStatus.PUBLISHED) {
      return NextResponse.json({ error: "This practice set is closed." }, { status: 409 });
    }

    // Unlimited retakes: just increment the attempt number.
    attempt = await prisma.examAttempt.create({
      data: {
        examId: exam.id,
        studentProfileId: studentContext.studentProfile.id,
        attemptNumber: (existing?.attemptNumber || 0) + 1,
        deadlineAt: new Date(Date.now() + exam.durationMinutes * 60_000),
      },
    });
  }

  if (!attempt) {
    return NextResponse.json({ error: "Unable to start the attempt." }, { status: 500 });
  }

  const savedAnswers = await prisma.examAnswer.findMany({
    where: { attemptId: attempt.id },
    select: { questionId: true, response: true },
  });
  const responses = Object.fromEntries(
    savedAnswers.map((answer) => [answer.questionId, answer.response]),
  );

  const ordered = exam.shuffleQuestions ? shuffled(exam.questions, attempt.id) : exam.questions;

  return NextResponse.json({
    attempt: {
      id: attempt.id,
      attemptNumber: attempt.attemptNumber,
      deadlineAt: attempt.deadlineAt.toISOString(),
      secondsLeft: Math.max(0, Math.floor((attempt.deadlineAt.getTime() - Date.now()) / 1000)),
    },
    exam: {
      id: exam.id,
      title: exam.title,
      subjectName: exam.subjectName,
      instructions: exam.instructions,
      durationMinutes: exam.durationMinutes,
      totalMarks: exam.questions.reduce((sum, question) => sum + question.marks, 0),
    },
    questions: ordered.map((question) => ({
      id: question.id,
      type: question.type,
      questionText: question.questionText,
      marks: question.marks,
      options: (question.options as OptionShape[] | null) || null,
      savedResponse: responses[question.id] ?? null,
    })),
  });
}

const saveSchema = z.object({
  attemptId: z.string().trim().min(1),
  action: z.enum(["SAVE", "SUBMIT"]),
  answers: z
    .array(
      z.object({
        questionId: z.string().trim().min(1),
        response: z.string().max(10_000).nullable(),
      }),
    )
    .max(200),
});

/**
 * PATCH — save progress, or submit.
 *
 * On submit the attempt is graded immediately and, unlike a graded exam, the
 * correct answers are returned straight away: instant feedback is the entire
 * point of practice.
 */
export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const studentContext = await getStudentExamContext();
  if (!studentContext) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await context.params;

  let payload: z.infer<typeof saveSchema>;
  try {
    payload = saveSchema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: "Invalid submission." }, { status: 400 });
  }

  const exam = await loadPracticeExam(
    id,
    studentContext.user.schoolId,
    studentContext.studentProfile.currentClassId,
  );
  if (!exam) {
    return NextResponse.json({ error: "Practice exam not found for your class." }, { status: 404 });
  }

  // The attempt must belong to this student AND this exam — never trust the id.
  const attempt = await prisma.examAttempt.findFirst({
    where: {
      id: payload.attemptId,
      examId: exam.id,
      studentProfileId: studentContext.studentProfile.id,
    },
  });
  if (!attempt) return NextResponse.json({ error: "Attempt not found." }, { status: 404 });
  if (attempt.status !== ExamAttemptStatus.IN_PROGRESS) {
    return NextResponse.json({ error: "This attempt is already submitted." }, { status: 409 });
  }

  const validQuestionIds = new Set(exam.questions.map((question) => question.id));
  const answers = payload.answers.filter((answer) => validQuestionIds.has(answer.questionId));

  if (answers.length) {
    await prisma.$transaction(
      answers.map((answer) =>
        prisma.examAnswer.upsert({
          where: {
            attemptId_questionId: { attemptId: attempt.id, questionId: answer.questionId },
          },
          create: {
            attemptId: attempt.id,
            questionId: answer.questionId,
            response: answer.response,
          },
          update: { response: answer.response },
        }),
      ),
    );
  }

  if (payload.action === "SAVE") {
    const expired = attempt.deadlineAt.getTime() < Date.now();
    if (expired) {
      const finalized = await finalizeAttempt(attempt.id);
      return NextResponse.json({
        ok: true,
        autoSubmitted: true,
        totalScore: finalized?.totalScore ?? 0,
      });
    }
    return NextResponse.json({
      ok: true,
      secondsLeft: Math.max(0, Math.floor((attempt.deadlineAt.getTime() - Date.now()) / 1000)),
    });
  }

  const finalized = await finalizeAttempt(attempt.id);
  const totalMarks = exam.questions.reduce((sum, question) => sum + question.marks, 0);

  // Instant review — correct answers and per-question marks. Safe here because
  // practice sets are revision material, not assessed work.
  const graded = await prisma.examAnswer.findMany({
    where: { attemptId: attempt.id },
    select: { questionId: true, response: true, isCorrect: true, awardedMarks: true },
  });
  const gradedByQuestion = new Map(graded.map((answer) => [answer.questionId, answer]));

  return NextResponse.json({
    ok: true,
    result: {
      totalScore: finalized?.totalScore ?? 0,
      totalMarks,
      percent: totalMarks ? Math.round(((finalized?.totalScore ?? 0) / totalMarks) * 100) : 0,
      passMark: exam.passMark,
      attemptNumber: attempt.attemptNumber,
    },
    review: exam.questions.map((question) => {
      const answer = gradedByQuestion.get(question.id);
      return {
        id: question.id,
        questionText: question.questionText,
        type: question.type,
        marks: question.marks,
        options: (question.options as OptionShape[] | null) || null,
        yourResponse: answer?.response ?? null,
        isCorrect: answer?.isCorrect ?? null,
        awardedMarks: answer?.awardedMarks ?? null,
        correctKey: question.correctKey,
        correctText: question.correctText,
      };
    }),
  });
}
