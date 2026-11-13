import { ExamAttemptStatus, ExamStatus, type Prisma } from "@prisma/client";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { finalizeAttempt, requireStudentExamContext } from "@/lib/exams";
import { getStudentFeeLock } from "@/lib/fee-lock";
import {
  classifyOfflineTiming,
  isAuthenticatedPacket,
  offlineTimingProblem,
  packetMatchesStoredSnapshot,
  readOfflinePacketSnapshot,
  reconcileAnswers,
  verifyPacket,
} from "@/lib/offline-packet";
import { prisma } from "@/lib/prisma";
import { examMinutes } from "@/lib/exams";
import { studentSubjectIds } from "@/lib/subjects";

export const dynamic = "force-dynamic";

/**
 * Offline replay endpoint.
 *
 * A paper was downloaded, sat with no connectivity, and is now being handed in.
 * The device supplies its answers, the times it saw, and the manifest+signature
 * it was given at download. This route's job is to take that sitting and lose
 * none of it:
 *
 *   • IDEMPOTENT — the client attempt id is derived from the exam and the moment
 *     the paper was opened, so a double-tap, a retry after a dropped connection
 *     and a replay after a force-quit all resolve to the same ExamAttempt. It is
 *     never used to create a second attempt for the same sitting.
 *
 *   • NOTHING IS DISCARDED SILENTLY — answers whose questions no longer exist are
 *     counted and recorded, not filtered away. Previously the route filtered and
 *     returned `savedAnswers: 6` for a student who had answered twelve.
 *
 *   • NOTHING IS GRADED ON THE CLIENT'S WORD — the server re-grades from the
 *     stored responses using `finalizeAttempt`, the same code that grades a live
 *     sitting. The device never had the answer key.
 *
 *   • A CHANGED PAPER IS REPORTED — if the paper was edited after download, the
 *     signature still verifies (the manifest is intact) but the fingerprint no
 *     longer matches the questions. That is recorded on the attempt and the
 *     sitting is accepted: a teacher fixing a typo overnight must not destroy a
 *     paper a child actually sat.
 *
 *   • A LATE SITTING IS KEPT — timing is compared against the paper's own
 *     duration, and a sitting past its window is recorded for review rather than
 *     silently accepted or silently binned.
 */
const schema = z.object({
  clientAttemptId: z.string().min(4).max(120),
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
  /** Manifest + signature handed out with the paper. Optional for old clients. */
  manifest: z
    .object({
      examId: z.string().min(1),
      packetId: z.string(),
      fingerprint: z.string(),
      questionCount: z.number().int().min(0),
      totalMarks: z.number().int().min(0),
      durationMinutes: z.number().int().positive(),
      sessionLabel: z.string().nullable(),
      termIndex: z.number().int().nullable(),
      downloadedAt: z.string(),
    })
    .nullable()
    .optional(),
  signature: z.string().nullable().optional(),
});

type AttemptMetadata = Record<string, Prisma.InputJsonValue | null>;

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const guard = await requireStudentExamContext();
  if (!guard.ok) return guard.response;
  const studentContext = guard.context;
  const { id: examId } = await context.params;

  let body: z.infer<typeof schema>;
  try {
    body = schema.parse(await request.json());
  } catch {
    return NextResponse.json(
      { error: "Invalid offline replay payload.", code: "BAD_PAYLOAD" },
      { status: 400 },
    );
  }

  const exam = await prisma.exam.findFirst({
    where: {
      id: examId,
      classId: studentContext.studentProfile.currentClassId,
      schoolId: studentContext.user.schoolId,
    },
    include: {
      questions: { orderBy: { sortOrder: "asc" } },
    },
  });
  if (!exam) return NextResponse.json({ error: "Exam not found for your class." }, { status: 404 });

  // A paper whose duration no longer matches the device's is genuinely stale —
  // the sitting cannot be mapped onto this paper at all.
  if (Math.abs(body.durationMinutes - examMinutes(exam)) > 2) {
    return NextResponse.json(
      {
        error: "This paper changed since it was downloaded. Your answers were not saved.",
        code: "STALE_PACKAGE",
      },
      { status: 409 },
    );
  }

  const startedMs = new Date(body.startedAt).getTime();
  const submittedMs = body.submittedAt ? new Date(body.submittedAt).getTime() : null;
  if (!Number.isFinite(startedMs)) {
    return NextResponse.json({ error: "Invalid start time." }, { status: 400 });
  }

  // Before grading anything: could this sitting have happened? The only
  // timing evidence here is the device's own account, and without a
  // plausibility bound a device can write an attempt into a term that has
  // already been compiled and released.
  const timingProblem = offlineTimingProblem({
    startedAt: body.startedAt,
    submittedAt: body.submittedAt ?? null,
    downloadedAt: body.manifest?.downloadedAt ?? null,
    availableUntil: exam.availableUntil ? exam.availableUntil.toISOString() : null,
    scheduledFor: exam.scheduledFor ? exam.scheduledFor.toISOString() : null,
  });
  if (timingProblem) {
    return NextResponse.json(
      { error: timingProblem.message, code: timingProblem.code },
      { status: 409 },
    );
  }

  const timing = classifyOfflineTiming({
    startedAt: body.startedAt,
    submittedAt: body.submittedAt ?? null,
    durationMinutes: examMinutes(exam),
  });

  // Verify the packet the device sat, against the paper as it stands now.
  const verification = body.manifest
    ? verifyPacket({
        manifest: body.manifest,
        signature: body.signature,
        currentQuestions: exam.questions.map((question) => ({
          id: question.id,
          type: question.type,
          marks: question.marks,
          sortOrder: question.sortOrder,
          questionText: question.questionText,
          options: question.options,
          correctKey: question.correctKey,
          correctText: question.correctText,
        })),
      })
    : null;
  // ── Idempotency ────────────────────────────────────────────────────────────
  // The indexed clientAttemptId is the fast path. The metadata scan remains for
  // attempts created before that column existed, and self-heals them.
  let serverAttempt = await prisma.examAttempt.findFirst({
    where: {
      examId,
      studentProfileId: studentContext.studentProfile.id,
      clientAttemptId: body.clientAttemptId,
    },
    orderBy: { createdAt: "desc" },
  });

  if (!serverAttempt) {
    const prior = await prisma.examAttempt.findMany({
      where: { examId, studentProfileId: studentContext.studentProfile.id },
      orderBy: { createdAt: "desc" },
      take: 10,
    });
    const legacy = prior.find(
      (attempt) =>
        ((attempt.metadata as AttemptMetadata | null)?.clientAttemptId ?? null) ===
        body.clientAttemptId,
    );
    if (legacy) {
      if (!legacy.clientAttemptId) {
        await prisma.examAttempt.update({
          where: { id: legacy.id },
          data: { clientAttemptId: body.clientAttemptId },
        });
      }
      serverAttempt = legacy;
    }
  }

  const storedPacketSnapshot = readOfflinePacketSnapshot(serverAttempt?.metadata);
  const packetBelongsToAttempt =
    !storedPacketSnapshot ||
    packetMatchesStoredSnapshot(body.manifest, body.signature, storedPacketSnapshot);
  const packetMismatch = !packetBelongsToAttempt
    ? "BAD_SIGNATURE"
    : verification && !verification.ok
      ? verification.reason
      : null;
  const packetMismatchDetail = !packetBelongsToAttempt
    ? "The packet does not match the version assigned to this attempt."
    : verification && !verification.ok
      ? verification.detail
      : null;
  const authenticatedPacket =
    packetBelongsToAttempt &&
    isAuthenticatedPacket(verification) &&
    body.manifest?.examId === exam.id &&
    body.manifest.durationMinutes === examMinutes(exam) &&
    body.manifest.durationMinutes === body.durationMinutes;

  // Replays for a server-known sitting remain valid if enrolment changed after
  // the paper was downloaded. A first-time replay cannot create an attempt for
  // a subject this student is not enrolled in.
  if (
    !serverAttempt &&
    exam.subjectId &&
    !(await studentSubjectIds(studentContext.studentProfile.id)).includes(exam.subjectId)
  ) {
    return NextResponse.json(
      { error: "You are not enrolled in this subject.", code: "NOT_ENROLLED" },
      { status: 403 },
    );
  }

  const metadata = {
    ...((serverAttempt?.metadata as AttemptMetadata | null) ?? {}),
    clientAttemptId: body.clientAttemptId,
    offlineReplay: true,
    offlineStartedAt: body.startedAt,
    offlineSubmittedAt: body.submittedAt ?? null,
    lateOffline: timing.late,
    offlineOverrunMinutes: timing.overrunMinutes,
    packetMismatch,
    packetMismatchDetail,
    packetFingerprint: body.manifest?.fingerprint ?? null,
    ...(packetMismatch ? { offlineReplayAnswers: body.answers } : {}),
  };

  if (!serverAttempt) {
    // First contact for this sitting: create the attempt.
    //
    // A replayed paper is accepted even if the exam has since closed — it was
    // sat while open, and refusing it would destroy work. A NEW paper (not
    // published, no window) is still refused unless the student is finalising
    // something they legitimately started.
    const feeLock = await getStudentFeeLock(
      studentContext.user.schoolId,
      studentContext.studentProfile.id,
    );
    const signedOfflineFinalization = body.finalize && authenticatedPacket;
    if (feeLock && !signedOfflineFinalization) {
      return NextResponse.json({ error: feeLock.message, code: "FEE_LOCK" }, { status: 402 });
    }

    if (exam.status !== ExamStatus.PUBLISHED && !signedOfflineFinalization) {
      return NextResponse.json(
        { error: "This exam is not open for new attempts.", code: "NOT_OPEN" },
        { status: 409 },
      );
    }

    const latest = await prisma.examAttempt.findFirst({
      where: { examId, studentProfileId: studentContext.studentProfile.id },
      orderBy: { attemptNumber: "desc" },
    });

    if (latest && latest.status !== ExamAttemptStatus.IN_PROGRESS) {
      // A finished attempt exists and this is a DIFFERENT sitting. It is only
      // allowed if the teacher granted a retake — otherwise a device replaying
      // twice would create a free second sitting.
      const grant = await prisma.examRetake.findUnique({
        where: {
          examId_studentProfileId: {
            examId,
            studentProfileId: studentContext.studentProfile.id,
          },
        },
      });
      if (!grant || grant.used) {
        return NextResponse.json(
          {
            error: "You have already taken this exam. Ask your teacher to enable a retake.",
            code: "RETAKE_REQUIRED",
          },
          { status: 409 },
        );
      }
    }

    const deadlineAt = new Date(startedMs + examMinutes(exam) * 60_000);
    try {
      serverAttempt = await prisma.$transaction(async (tx) => {
        if (latest && latest.status !== ExamAttemptStatus.IN_PROGRESS) {
          const grant = await tx.examRetake.findUnique({
            where: {
              examId_studentProfileId: {
                examId,
                studentProfileId: studentContext.studentProfile.id,
              },
            },
          });
          if (!grant || grant.used) throw new Error("RETAKE_REQUIRED");
          await tx.examRetake.update({ where: { id: grant.id }, data: { used: true } });
        }
        return tx.examAttempt.create({
          data: {
            examId,
            studentProfileId: studentContext.studentProfile.id,
            attemptNumber: (latest?.attemptNumber || 0) + 1,
            // Never earlier than the moment the student handed in: clock skew
            // on a device must not produce a deadline in the past for a sitting
            // that has already been completed.
            deadlineAt: submittedMs
              ? new Date(Math.max(deadlineAt.getTime(), submittedMs))
              : deadlineAt,
            status: ExamAttemptStatus.IN_PROGRESS,
            clientAttemptId: body.clientAttemptId,
            deliveryMode: "SYNCED",
            offlineStartedAt: new Date(startedMs),
            offlineEndedAt: submittedMs ? new Date(submittedMs) : null,
            metadata,
          },
        });
      });
    } catch (error) {
      if (error instanceof Error && error.message === "RETAKE_REQUIRED") {
        return NextResponse.json(
          {
            error: "You have already taken this exam. Ask your teacher to enable a retake.",
            code: "RETAKE_REQUIRED",
          },
          { status: 409 },
        );
      }
      if (
        typeof error === "object" &&
        error !== null &&
        (error as { code?: unknown }).code === "P2002"
      ) {
        // A concurrent retry won; serve its attempt.
        const raced = await prisma.examAttempt.findFirst({
          where: {
            examId,
            studentProfileId: studentContext.studentProfile.id,
            clientAttemptId: body.clientAttemptId,
          },
        });
        if (raced) serverAttempt = raced;
        else throw error;
      } else {
        throw error;
      }
    }
  }

  if (!serverAttempt) {
    return NextResponse.json(
      { error: "Could not record this sitting. Your answers are still on the device." },
      { status: 500 },
    );
  }

  const serverId = serverAttempt.id;
  const alreadyFinalized = serverAttempt.status !== ExamAttemptStatus.IN_PROGRESS;

  // ── Answers ────────────────────────────────────────────────────────────────
  // The reconciliation is computed over EVERY answer the device sent, so the
  // orphaned count is the student's whole paper, not a filtered subset.
  const reconciliation = reconcileAnswers({
    answers: body.answers,
    currentQuestions: exam.questions.map((question) => ({
      id: question.id,
      marks: question.marks,
    })),
  });

  if (!alreadyFinalized) {
    const existing = await prisma.examAnswer.findMany({
      where: { attemptId: serverId },
      select: { questionId: true, response: true },
    });
    const stored = new Map(existing.map((answer) => [answer.questionId, answer.response]));
    const changed = reconciliation.accepted.filter(
      (answer) =>
        !stored.has(answer.questionId) || stored.get(answer.questionId) !== answer.response,
    );

    // Merge, never replace: an answer the device no longer sends (because it
    // was cleared by a crash, or the student reopened a fresh copy) must not
    // erase a response the server already holds. Losing a saved answer is the
    // one failure this pipeline exists to prevent.
    if (changed.length) {
      await prisma.$transaction(
        changed.map((answer) =>
          prisma.examAnswer.upsert({
            where: { attemptId_questionId: { attemptId: serverId, questionId: answer.questionId } },
            update: { response: answer.response },
            create: {
              attemptId: serverId,
              questionId: answer.questionId,
              response: answer.response,
            },
          }),
        ),
      );
    }

    await prisma.examAttempt.update({
      where: { id: serverId },
      data: {
        deliveryMode: "SYNCED",
        offlineStartedAt: serverAttempt.offlineStartedAt ?? new Date(startedMs),
        offlineEndedAt: submittedMs ? new Date(submittedMs) : serverAttempt.offlineEndedAt,
        metadata,
      },
    });
  }

  // Questions that vanished between download and sync are recorded next to the
  // answers that referred to them, so a teacher sees what was asked and could
  // not be marked.
  const orphanCount = reconciliation.orphaned.length;
  const missingCount = reconciliation.missing.length;

  if (body.finalize && !alreadyFinalized) {
    if (packetMismatch) {
      // Preserve the sitting and all accepted answers, but never compute a
      // score against a question set different from the signed packet. A
      // teacher must review the changed-paper attempt before any result can be
      // treated as authoritative.
      await prisma.examAttempt.update({
        where: { id: serverId },
        data: {
          status: ExamAttemptStatus.SUBMITTED,
          submittedAt: new Date(),
          metadata: {
            ...metadata,
            requiresManualReview: true,
            orphanedAnswers: orphanCount,
            missingAnswers: missingCount,
          },
        },
      });
      return NextResponse.json({
        ok: true,
        submitted: true,
        reviewRequired: true,
        attemptId: serverId,
        acceptedAnswers: reconciliation.accepted.length,
        orphanedAnswers: orphanCount,
        missingAnswers: missingCount,
        packetMismatch,
        message:
          "Your answers are saved, but the paper changed after download. Your teacher must review this sitting before it can be scored.",
      });
    }

    if (timing.late) {
      // Late sittings are held for a human. Marking them would put a score in a
      // permanent result that may have been earned with the paper open overnight.
      await prisma.examAttempt.update({
        where: { id: serverId },
        data: {
          status: ExamAttemptStatus.SUBMITTED,
          submittedAt: new Date(),
          metadata: {
            ...metadata,
            lateOffline: true,
            orphanedAnswers: orphanCount,
            missingAnswers: missingCount,
          },
        },
      });
      return NextResponse.json({
        ok: true,
        submitted: true,
        lateForReview: true,
        attemptId: serverId,
        acceptedAnswers: reconciliation.accepted.length,
        orphanedAnswers: orphanCount,
        missingAnswers: missingCount,
        packetMismatch,
        message:
          "Your answers are saved. This sitting ran past the paper's time, so your teacher will review it before it is scored.",
      });
    }

    const finalized = await finalizeAttempt(serverId);
    if (finalized) {
      await prisma.examAttempt.update({
        where: { id: serverId },
        data: {
          metadata: { ...metadata, orphanedAnswers: orphanCount, missingAnswers: missingCount },
        },
      });
    }
    return NextResponse.json({
      ok: true,
      submitted: true,
      attemptId: serverId,
      status: finalized?.status ?? null,
      acceptedAnswers: reconciliation.accepted.length,
      orphanedAnswers: orphanCount,
      missingAnswers: missingCount,
      packetMismatch,
      message: packetMismatch
        ? "Submitted. Your paper changed after you downloaded it, so your teacher may review this sitting."
        : "Offline exam submitted successfully.",
    });
  }

  return NextResponse.json({
    ok: true,
    synced: true,
    submitted: alreadyFinalized,
    attemptId: serverId,
    acceptedAnswers: reconciliation.accepted.length,
    orphanedAnswers: orphanCount,
    missingAnswers: missingCount,
    packetMismatch,
    message: packetMismatch ? "Answers saved. Your teacher may need to review this sitting." : null,
  });
}
