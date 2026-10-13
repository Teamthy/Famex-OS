import { ExamAttemptStatus, ExamStatus } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { finalizeAttempt, getStudentExamContext } from "@/lib/exams";
import { getStudentFeeLock } from "@/lib/fee-lock";
import { prisma } from "@/lib/prisma";
import { attemptDeadline, startWindowRefusal } from "@/lib/subjects";

export const dynamic = "force-dynamic";

type OptionShape = { key: string; text: string };

function shuffled<T>(items: T[], seed: string): T[] {
  // Deterministic per-attempt shuffle so refreshes keep the same order.
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

/** POST — start (or resume) an attempt. */
export async function POST(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const studentContext = await getStudentExamContext();
  if (!studentContext) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await context.params;
  const exam = await prisma.exam.findFirst({
    where: { id, classId: studentContext.studentProfile.currentClassId },
    include: { questions: { orderBy: { sortOrder: "asc" } } },
  });
  if (!exam) return NextResponse.json({ error: "Exam not found for your class." }, { status: 404 });

  const existing = await prisma.examAttempt.findFirst({
    where: { examId: exam.id, studentProfileId: studentContext.studentProfile.id },
    orderBy: { attemptNumber: "desc" },
  });

  let attempt = existing;

  if (existing && existing.status === ExamAttemptStatus.IN_PROGRESS) {
    // Resume — but auto-submit if the deadline has passed.
    if (existing.deadlineAt.getTime() < Date.now()) {
      await finalizeAttempt(existing.id);
      return NextResponse.json(
        { error: "Time elapsed. Your attempt was submitted automatically." },
        { status: 409 },
      );
    }
  } else {
    if (exam.status !== ExamStatus.PUBLISHED) {
      return NextResponse.json(
        { error: "This exam is not open for new attempts." },
        { status: 409 },
      );
    }

    // The sitting window, enforced. The student list hides the Start button
    // outside it, but the list is a view — this endpoint is the boundary, and
    // until now it let a stale tab or a typed URL start an exam days early.
    // Note this guards NEW attempts only: an attempt already in progress falls
    // into the resume branch above and keeps its own clock.
    const refusal = startWindowRefusal({
      scheduledFor: exam.scheduledFor,
      availableUntil: exam.availableUntil,
    });
    if (refusal) {
      return NextResponse.json({ error: refusal.message, code: refusal.code }, { status: 409 });
    }

    const feeLock = await getStudentFeeLock(
      studentContext.user.schoolId,
      studentContext.studentProfile.id,
    );
    if (feeLock) {
      return NextResponse.json(
        {
          error: feeLock.message,
          code: "FEE_LOCK",
          totalOutstanding: feeLock.totalOutstanding,
          invoices: feeLock.invoices,
        },
        { status: 402 },
      );
    }

    // Retake consumption and attempt creation must be atomic. A double-tap or
    // a network retry used to consume the retake and then race the create,
    // producing a unique-violation 500 — or burning the retake with no new
    // attempt to show for it. The transaction plus the existing
    // (examId, studentProfileId, attemptNumber) unique constraint make the
    // racing loser roll back entirely and resume the winner's attempt.
    try {
      attempt = await prisma
        .$transaction(async (tx) => {
          if (existing) {
            const retake = await tx.examRetake.findUnique({
              where: {
                examId_studentProfileId: {
                  examId: exam.id,
                  studentProfileId: studentContext.studentProfile.id,
                },
              },
            });
            if (!retake || retake.used) {
              throw new Error("RETAKE_REQUIRED");
            }
            await tx.examRetake.update({ where: { id: retake.id }, data: { used: true } });
          }
          return tx.examAttempt.create({
            data: {
              examId: exam.id,
              studentProfileId: studentContext.studentProfile.id,
              attemptNumber: (existing?.attemptNumber || 0) + 1,
              // Bounded by the window as well as the duration: starting a minute
              // before close must not buy a full extra sitting.
              deadlineAt: attemptDeadline({
                durationMinutes: exam.durationMinutes,
                availableUntil: exam.availableUntil,
              }),
            },
          });
        })
        .catch(async (error: unknown) => {
          if (
            typeof error === "object" &&
            error !== null &&
            (error as { code?: unknown }).code === "P2002"
          ) {
            // A concurrent start won the race and its attempt is IN_PROGRESS:
            // serve the standard resume payload for that attempt instead of a
            // scary 500 on the single most stressful click of exam day.
            const raced = await prisma.examAttempt.findFirst({
              where: { examId: exam.id, studentProfileId: studentContext.studentProfile.id },
              orderBy: { attemptNumber: "desc" },
            });
            if (raced && raced.status === ExamAttemptStatus.IN_PROGRESS) return raced;
          }
          throw error;
        });
    } catch (error) {
      if (error instanceof Error && error.message === "RETAKE_REQUIRED") {
        return NextResponse.json(
          { error: "You have already taken this exam. Ask your teacher to enable a retake." },
          { status: 409 },
        );
      }
      throw error;
    }
  }

  if (!attempt)
    return NextResponse.json({ error: "Unable to start the attempt." }, { status: 500 });

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
      deadlineAt: attempt.deadlineAt.toISOString(),
      secondsLeft: Math.max(0, Math.floor((attempt.deadlineAt.getTime() - Date.now()) / 1000)),
    },
    exam: {
      id: exam.id,
      title: exam.title,
      subjectName: exam.subjectName,
      instructions: exam.instructions,
      durationMinutes: exam.durationMinutes,
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
  action: z.enum(["SAVE", "SUBMIT", "TAB_SWITCH"]),
  answers: z
    .array(
      z.object({
        questionId: z.string().trim().min(1),
        response: z.string().max(10_000).nullable(),
      }),
    )
    .max(300)
    .optional(),
});

/** PATCH — autosave answers, record tab switches, or submit. */
export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const studentContext = await getStudentExamContext();
  if (!studentContext) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await context.params;
  let payload: z.infer<typeof saveSchema>;
  try {
    payload = saveSchema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const attempt = await prisma.examAttempt.findFirst({
    where: {
      id: payload.attemptId,
      examId: id,
      studentProfileId: studentContext.studentProfile.id,
    },
    include: { exam: { select: { questions: { select: { id: true } } } } },
  });
  if (!attempt) return NextResponse.json({ error: "Attempt not found." }, { status: 404 });
  if (attempt.status !== ExamAttemptStatus.IN_PROGRESS) {
    // Idempotent submit retry: if the first SUBMIT reached the server but the
    // mobile client timed out, a repeated SUBMIT should return the canonical
    // submitted state instead of a scary conflict.
    if (payload.action === "SUBMIT") {
      return NextResponse.json({
        ok: true,
        submitted: true,
        message: "Exam was already submitted successfully.",
        status: attempt.status,
      });
    }
    return NextResponse.json({ error: "This attempt is already submitted." }, { status: 409 });
  }

  if (payload.action === "TAB_SWITCH") {
    await prisma.examAttempt.update({
      where: { id: attempt.id },
      data: { tabSwitches: { increment: 1 } },
    });
    return NextResponse.json({ ok: true });
  }

  const validQuestionIds = new Set(attempt.exam.questions.map((question) => question.id));
  const answers = (payload.answers || []).filter((answer) =>
    validQuestionIds.has(answer.questionId),
  );

  /**
   * Autosave is the hottest path in the product: every student in a sitting
   * class hits it every 15 seconds, and the client sends its FULL answer set
   * each time (deliberately — it is what makes a dropped save recoverable).
   *
   * It used to issue one awaited upsert per answer. A 60-question paper was
   * therefore 60 sequential round trips every 15 seconds per student; 40
   * students sitting together is ~9,600 queries a minute to save data that had
   * mostly not changed.
   *
   * Two changes: skip answers whose stored response already matches, then run
   * whatever genuinely changed concurrently in one transaction. A typical save
   * touches one or two answers, so the steady state is now a single read plus
   * a tiny write batch.
   */
  const existingAnswers = await prisma.examAnswer.findMany({
    where: { attemptId: attempt.id },
    select: { questionId: true, response: true },
  });
  const storedByQuestion = new Map(
    existingAnswers.map((entry) => [entry.questionId, entry.response]),
  );

  const changed = answers.filter(
    (answer) =>
      !storedByQuestion.has(answer.questionId) ||
      storedByQuestion.get(answer.questionId) !== answer.response,
  );

  if (changed.length) {
    await prisma.$transaction(
      changed.map((answer) =>
        prisma.examAnswer.upsert({
          where: { attemptId_questionId: { attemptId: attempt.id, questionId: answer.questionId } },
          update: { response: answer.response },
          create: {
            attemptId: attempt.id,
            questionId: answer.questionId,
            response: answer.response,
          },
        }),
      ),
    );
  }

  const expired = attempt.deadlineAt.getTime() < Date.now();
  if (payload.action === "SUBMIT" || expired) {
    const finalized = await finalizeAttempt(attempt.id);
    return NextResponse.json({
      ok: true,
      submitted: true,
      message: expired
        ? "Time elapsed — your answers were submitted automatically."
        : "Exam submitted successfully.",
      status: finalized?.status,
    });
  }

  return NextResponse.json({ ok: true, submitted: false });
}
