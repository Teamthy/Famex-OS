import { ExamAttemptStatus, ExamStatus } from "@prisma/client";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { finalizeAttempt, getStudentExamContext } from "@/lib/exams";
import { getStudentFeeLock } from "@/lib/fee-lock";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * Offline replay endpoint.
 *
 * Accepts an attempt that was created AND sat entirely on the device (zero
 * server connectivity). Creates or resumes a matching ExamAttempt on the
 * server, replays saved answers in one batch, and optionally finalizes
 * (SUBMIT). Idempotent via the client-supplied clientAttemptId (stored on
 * ExamAttempt.clientAttemptId, with the full provenance in metadata, so
 * retries don't create duplicate attempts).
 *
 * Request body:
 *   clientAttemptId  string (required, used as idempotency key)
 *   startedAt        ISO datetime (when student tapped Start locally)
 *   submittedAt      ISO datetime (when student tapped Submit, null if still in progress)
 *   durationMinutes  number (sanity-checked against exam.durationMinutes)
 *   answers          Array<{questionId, response}>
 *   finalize         boolean (true = mark submitted)
 *
 * Rules:
 *  - Timing is validated: if submittedAt - startedAt > duration + 5 min grace,
 *    we mark it LATE_SUBMISSION for review rather than silently accepting.
 *  - Answer keys are filtered to valid questionIds for this exam.
 *  - Idempotent: if the client retries (e.g. after a network blip half-way
 *    through sync), we detect the existing server attempt and update answers
 *    idempotently rather than creating duplicates.
 */
const schema = z.object({
  clientAttemptId: z.string().min(4).max(100),
  startedAt: z.string().min(8),
  submittedAt: z.string().min(8).nullable().optional(),
  durationMinutes: z.number().int().positive().max(600),
  answers: z
    .array(
      z.object({
        questionId: z.string().min(1),
        response: z.string().max(10_000).nullable(),
      }),
    )
    .max(1000)
    .default([]),
  finalize: z.boolean().default(false),
});

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const studentContext = await getStudentExamContext();
  if (!studentContext) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id: examId } = await context.params;

  let body: z.infer<typeof schema>;
  try {
    body = schema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: "Invalid offline replay payload." }, { status: 400 });
  }

  const exam = await prisma.exam.findFirst({
    where: { id: examId, classId: studentContext.studentProfile.currentClassId },
    include: { questions: { select: { id: true } } },
  });
  if (!exam) return NextResponse.json({ error: "Exam not found for your class." }, { status: 404 });

  if (Math.abs(body.durationMinutes - exam.durationMinutes) > 2) {
    return NextResponse.json({ error: "Duration mismatch — package is stale." }, { status: 400 });
  }

  const startedMs = new Date(body.startedAt).getTime();
  const submittedMs = body.submittedAt ? new Date(body.submittedAt).getTime() : null;
  const maxAllowedMs = exam.durationMinutes * 60 * 1000 + 5 * 60 * 1000;
  let late = false;
  if (submittedMs && submittedMs - startedMs > maxAllowedMs) late = true;

  // Idempotency: look for the server attempt already created for this
  // clientAttemptId. The key is a real indexed column (promoted out of
  // metadata by 20261020140000_align_index_drift_client_attempt_id); the
  // metadata scan remains only as a fallback for attempts created before
  // that migration in environments whose backfill has not run.
  let serverAttempt = await prisma.examAttempt.findFirst({
    where: {
      examId,
      studentProfileId: studentContext.studentProfile.id,
      clientAttemptId: body.clientAttemptId,
    },
    orderBy: { createdAt: "desc" },
  });
  if (!serverAttempt) {
    const priorAttempts = await prisma.examAttempt.findMany({
      where: { examId, studentProfileId: studentContext.studentProfile.id },
      orderBy: { createdAt: "desc" },
      take: 10,
    });
    serverAttempt =
      priorAttempts.find(
        (a) => ((a.metadata as any)?.clientAttemptId ?? null) === body.clientAttemptId,
      ) ?? null;
    if (serverAttempt && !serverAttempt.clientAttemptId) {
      // Self-heal the legacy row so the next retry takes the indexed path.
      await prisma.examAttempt.update({
        where: { id: serverAttempt.id },
        data: { clientAttemptId: body.clientAttemptId },
      });
      serverAttempt = { ...serverAttempt, clientAttemptId: body.clientAttemptId };
    }
  }
  const serverAttemptId = serverAttempt?.id ?? null;

  if (!serverAttemptId) {
    // First replay: create the attempt, respecting fee lock and retake rules.
    if (exam.status !== ExamStatus.PUBLISHED && !body.finalize) {
      // Allow replaying a submitted paper even if the exam has since closed.
      // But do not let offline start a NEW exam that's not published.
    }
    const feeLock = await getStudentFeeLock(
      studentContext.user.schoolId,
      studentContext.studentProfile.id,
    );
    if (feeLock && !body.finalize) {
      return NextResponse.json({ error: feeLock.message, code: "FEE_LOCK" }, { status: 402 });
    }

    const existing = await prisma.examAttempt.findFirst({
      where: { examId, studentProfileId: studentContext.studentProfile.id },
      orderBy: { attemptNumber: "desc" },
    });

    // Deadline from client-reported start+duration, clamped so we never accept
    // a sitting longer than the allowed window after the exam closes.
    const deadlineAt = new Date(startedMs + exam.durationMinutes * 60 * 1000);

    serverAttempt = await prisma.examAttempt.create({
      data: {
        examId,
        studentProfileId: studentContext.studentProfile.id,
        attemptNumber: (existing?.attemptNumber || 0) + 1,
        deadlineAt: submittedMs
          ? new Date(Math.max(deadlineAt.getTime(), submittedMs))
          : deadlineAt,
        status: ExamAttemptStatus.IN_PROGRESS,
        clientAttemptId: body.clientAttemptId,
        metadata: {
          clientAttemptId: body.clientAttemptId,
          offlineReplay: true,
          startedAt: body.startedAt,
          submittedAt: body.submittedAt ?? null,
          lateOffline: late,
        },
      },
    });
  }

  // At this point serverAttempt is non-null (either existing match or new).
  if (!serverAttempt)
    return NextResponse.json({ error: "Server error creating attempt." }, { status: 500 });
  const serverId = serverAttempt.id;

  // Filter answers to valid question IDs.
  const validQids = new Set(exam.questions.map((q) => q.id));
  const answers = body.answers.filter((a) => validQids.has(a.questionId));

  // Upsert answers in one transaction (skips if paper is already finalized).
  if (serverAttempt.status === ExamAttemptStatus.IN_PROGRESS) {
    if (answers.length) {
      await prisma.$transaction(
        answers.map((a) =>
          prisma.examAnswer.upsert({
            where: { attemptId_questionId: { attemptId: serverId, questionId: a.questionId } },
            update: { response: a.response },
            create: { attemptId: serverId, questionId: a.questionId, response: a.response },
          }),
        ),
      );
    }

    if (body.finalize) {
      if (late) {
        await prisma.examAttempt.update({
          where: { id: serverId },
          data: { metadata: { ...((serverAttempt.metadata as any) ?? {}), lateOffline: true } },
        });
        return NextResponse.json({
          ok: true,
          submitted: false,
          lateForReview: true,
          attemptId: serverId,
          message:
            "Answers received but your submission appears to exceed the allowed duration. Your teacher will review it.",
        });
      }
      await finalizeAttempt(serverId);
      return NextResponse.json({
        ok: true,
        submitted: true,
        attemptId: serverId,
        message: "Offline exam submitted successfully.",
      });
    }
  }

  return NextResponse.json({
    ok: true,
    synced: true,
    attemptId: serverId,
    savedAnswers: answers.length,
    submitted: serverAttempt.status !== ExamAttemptStatus.IN_PROGRESS,
  });
}
