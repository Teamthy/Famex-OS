import { ExamAttemptStatus, ExamStatus, Prisma } from "@prisma/client";
import { NextResponse, type NextRequest } from "next/server";
import { requireStudentExamContext } from "@/lib/exams";
import { getStudentFeeLock } from "@/lib/fee-lock";
import {
  fingerprintQuestions,
  readOfflinePacketSnapshot,
  signPacket,
  verifyPacket,
  type OfflinePacketManifest,
  type OfflinePacketQuestionSnapshot,
} from "@/lib/offline-packet";
import { prisma } from "@/lib/prisma";
import { examMinutes } from "@/lib/exams";
import {
  examAvailability,
  startWindowRefusal,
  studentSubjectIds,
  attemptDeadline,
} from "@/lib/subjects";

export const dynamic = "force-dynamic";

/**
 * Download a paper for offline sitting.
 *
 * ── What the device gets, and what it deliberately does not
 *
 * The response carries everything needed to sit and hand in a paper with no
 * network: the questions, the options, the mark values, the duration, and a
 * signed manifest identifying this exact version of the paper.
 *
 * It does NOT carry `correctKey`, `correctText`, or any explanation. The device
 * cannot mark, and must not be able to. Grading happens on the server from the
 * stored responses, with the same code as a live sitting — which is also why an
 * offline sitting can be trusted at all: the client's role is to record what the
 * student typed, never what it is worth.
 *
 * ── Why the paper is fingerprinted AND signed
 *
 * The fingerprint covers ordered ids, stems, options, types, marks, and answer
 * keys. The HMAC authenticates that digest. The exact signed packet is also
 * stored with the server attempt before it is returned, so an author edit or
 * question deletion cannot rewrite the paper a student actually received.
 *
 * A mismatch is retained for teacher review rather than silently graded against
 * the edited paper or rejected in a way that would lose the student's work.
 *
 * ── Why the attempt is created here when online
 *
 * If the student downloads while connected, the server attempt is created now
 * and its id travels with the package. The offline submit then attaches to that
 * attempt, so the retake the teacher granted is consumed exactly once and the
 * attempt number is assigned by the server rather than guessed by a device.
 * A package downloaded without an attempt (never started) creates it on replay.
 */
export async function GET(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const guard = await requireStudentExamContext();
  if (!guard.ok) return guard.response;
  const studentContext = guard.context;

  const { id: examId } = await context.params;

  const exam = await prisma.exam.findFirst({
    where: {
      id: examId,
      classId: studentContext.studentProfile.currentClassId,
      schoolId: studentContext.user.schoolId,
    },
    include: {
      questions: { orderBy: { sortOrder: "asc" } },
      attempts: {
        where: { studentProfileId: studentContext.studentProfile.id },
        orderBy: { attemptNumber: "desc" },
      },
      retakes: { where: { studentProfileId: studentContext.studentProfile.id } },
    },
  });
  if (!exam) return NextResponse.json({ error: "Exam not found for your class." }, { status: 404 });

  // A new subject paper must match current enrolment; allow a server-known
  // in-progress sitting to resume if enrolment was corrected mid-exam. A missing
  // subjectId is legacy free-text and stays visible to the class.
  if (exam.subjectId && exam.attempts[0]?.status !== ExamAttemptStatus.IN_PROGRESS) {
    const subjectIds = await studentSubjectIds(studentContext.studentProfile.id);
    if (!subjectIds.includes(exam.subjectId)) {
      return NextResponse.json(
        { error: "You are not enrolled in this subject.", code: "NOT_ENROLLED" },
        { status: 403 },
      );
    }
  }

  const latestAttempt = exam.attempts[0] ?? null;
  const latestSnapshotCandidate = readOfflinePacketSnapshot(latestAttempt?.metadata);
  const latestPacketSnapshot =
    latestSnapshotCandidate?.manifest.examId === exam.id &&
    verifyPacket({
      manifest: latestSnapshotCandidate.manifest,
      signature: latestSnapshotCandidate.signature,
      currentQuestions: latestSnapshotCandidate.questions,
    }).ok
      ? latestSnapshotCandidate
      : null;
  if (!exam.questions.length && !latestPacketSnapshot) {
    return NextResponse.json(
      { error: "This paper has no questions yet. Ask your teacher to publish it first." },
      { status: 409 },
    );
  }

  const retake = exam.retakes[0] ?? null;
  const hasUnusedRetake = Boolean(retake && !retake.used);
  const hasSubmitted = Boolean(
    latestAttempt && latestAttempt.status !== ExamAttemptStatus.IN_PROGRESS,
  );

  // A student who has already sat the paper gets the package back only to READ
  // it (review), never to start a second sitting.
  let canStart = exam.status === ExamStatus.PUBLISHED;
  let refusal: string | null = null;
  if (canStart) {
    const windowRefusal = startWindowRefusal({
      scheduledFor: exam.scheduledFor,
      availableUntil: exam.availableUntil,
      hasRetake: hasUnusedRetake,
    });
    if (windowRefusal) {
      canStart = false;
      refusal = windowRefusal.message;
    }
  } else {
    refusal = "This paper is not open for new attempts.";
  }

  if (hasSubmitted && !hasUnusedRetake) {
    canStart = false;
    refusal = "You have already taken this exam. Ask your teacher to enable a retake.";
  }

  const availability = examAvailability({
    scheduledFor: exam.scheduledFor,
    availableUntil: exam.availableUntil,
    hasSubmitted: hasSubmitted && !hasUnusedRetake,
    hasRetake: hasUnusedRetake,
  });

  // Match the online start gate: a fee lock blocks a NEW sitting, but must not
  // strand an attempt that is already in progress and needs its paper to resume.
  if (canStart && latestAttempt?.status !== ExamAttemptStatus.IN_PROGRESS) {
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
  }

  // Create (or reuse) the server attempt so the offline sitting has an identity
  // before it ever reaches the server. Same transaction + unique-constraint
  // discipline as the online start route: a double-tap cannot burn a retake
  // twice, and a race resolves to the attempt that won.
  let serverAttemptId: string | null = null;
  if (canStart) {
    if (latestAttempt && latestAttempt.status === ExamAttemptStatus.IN_PROGRESS) {
      serverAttemptId = latestAttempt.id;
    } else {
      try {
        serverAttemptId = await prisma.$transaction(async (tx) => {
          if (latestAttempt) {
            const grant = await tx.examRetake.findUnique({
              where: {
                examId_studentProfileId: {
                  examId: exam.id,
                  studentProfileId: studentContext.studentProfile.id,
                },
              },
            });
            if (!grant || grant.used) throw new Error("RETAKE_REQUIRED");
            await tx.examRetake.update({ where: { id: grant.id }, data: { used: true } });
          }
          const created = await tx.examAttempt.create({
            data: {
              examId: exam.id,
              studentProfileId: studentContext.studentProfile.id,
              attemptNumber: (latestAttempt?.attemptNumber || 0) + 1,
              // The window bounds the sitting, not just the duration: starting a
              // minute before close must not buy a full extra paper.
              deadlineAt: attemptDeadline({
                durationMinutes: examMinutes(exam),
                availableUntil: exam.availableUntil,
                hasRetake: hasUnusedRetake,
              }),
              deliveryMode: "OFFLINE",
              offlineStartedAt: new Date(),
            },
          });
          return created.id;
        });
      } catch (error) {
        if (error instanceof Error && error.message === "RETAKE_REQUIRED") {
          canStart = false;
          refusal = "You have already taken this exam. Ask your teacher to enable a retake.";
        } else if (
          typeof error === "object" &&
          error !== null &&
          (error as { code?: unknown }).code === "P2002"
        ) {
          // A concurrent download won the race. Serve its attempt instead of a
          // 500 on the one click that has to work.
          const raced = await prisma.examAttempt.findFirst({
            where: { examId: exam.id, studentProfileId: studentContext.studentProfile.id },
            orderBy: { attemptNumber: "desc" },
          });
          if (raced && raced.status === ExamAttemptStatus.IN_PROGRESS) serverAttemptId = raced.id;
          else {
            canStart = false;
            refusal = "This paper was just opened in another window.";
          }
        } else {
          throw error;
        }
      }
    }
  }

  let attemptMetadata: Prisma.JsonValue | null = latestAttempt?.metadata ?? null;
  if (serverAttemptId) {
    const currentAttempt = await prisma.examAttempt.findUnique({
      where: { id: serverAttemptId },
      select: { metadata: true },
    });
    attemptMetadata = currentAttempt?.metadata ?? null;
  }

  const storedSnapshotCandidate = readOfflinePacketSnapshot(attemptMetadata);
  const storedSnapshot =
    storedSnapshotCandidate?.manifest.examId === exam.id &&
    verifyPacket({
      manifest: storedSnapshotCandidate.manifest,
      signature: storedSnapshotCandidate.signature,
      currentQuestions: storedSnapshotCandidate.questions,
    }).ok
      ? storedSnapshotCandidate
      : exam.questions.length === 0
        ? latestPacketSnapshot
        : null;
  const packetQuestions: OfflinePacketQuestionSnapshot[] = storedSnapshot
    ? storedSnapshot.questions
    : exam.questions.map((question) => ({
        id: question.id,
        type: question.type,
        marks: question.marks,
        sortOrder: question.sortOrder,
        questionText: question.questionText,
        options: question.options,
        correctKey: question.correctKey,
        correctText: question.correctText,
      }));
  const fingerprint = fingerprintQuestions(packetQuestions);
  const totalMarks = packetQuestions.reduce((sum, question) => sum + question.marks, 0);

  let manifest: OfflinePacketManifest;
  let signature: string;
  if (storedSnapshot) {
    // A sitting is bound to its first server-issued packet. Redownloading after
    // an author edits the exam returns the original question set and signature.
    manifest = storedSnapshot.manifest;
    signature = storedSnapshot.signature;
  } else {
    // Term provenance travels with the paper so a sitting in January compiles
    // into Second Term even if it syncs in February.
    let sessionLabel = exam.sessionLabel;
    let termIndex = exam.termIndex;
    if (sessionLabel === null || termIndex === null) {
      const term = await prisma.term.findFirst({
        where: {
          schoolId: exam.schoolId,
          startsOn: { lte: exam.createdAt },
          endsOn: { gte: exam.createdAt },
        },
        select: { index: true, session: { select: { label: true } } },
      });
      sessionLabel = sessionLabel ?? term?.session.label ?? null;
      termIndex = termIndex ?? term?.index ?? null;
    }

    manifest = {
      examId: exam.id,
      packetId: "",
      fingerprint,
      questionCount: packetQuestions.length,
      totalMarks,
      durationMinutes: examMinutes(exam),
      sessionLabel,
      termIndex,
      downloadedAt: new Date().toISOString(),
    };

    try {
      const signed = signPacket(manifest);
      manifest.packetId = signed.packetId;
      signature = signed.signature;
    } catch {
      // A server without a usable AUTH_SECRET cannot sign, and an unsigned
      // packet would be rejected on replay after the student had sat the paper.
      return NextResponse.json(
        { error: "Offline papers are not configured on this server.", code: "SIGNING_UNAVAILABLE" },
        { status: 503 },
      );
    }
  }

  if (serverAttemptId && !readOfflinePacketSnapshot(attemptMetadata)) {
    const prior =
      attemptMetadata && typeof attemptMetadata === "object" && !Array.isArray(attemptMetadata)
        ? attemptMetadata
        : {};
    await prisma.examAttempt.update({
      where: { id: serverAttemptId },
      data: {
        metadata: {
          ...prior,
          offlineQuestionSnapshot: {
            manifest,
            signature,
            questions: packetQuestions,
          },
        } as Prisma.InputJsonObject,
      },
    });
  }

  const optionsShape = (options: unknown) => {
    const parsed = Array.isArray(options) ? options : [];
    return parsed
      .filter(
        (option): option is { key: string; text: string } =>
          Boolean(option) &&
          typeof option === "object" &&
          typeof (option as { key?: unknown }).key === "string" &&
          typeof (option as { text?: unknown }).text === "string",
      )
      .map((option) => ({ key: option.key, text: option.text }));
  };

  // Answers already saved on the server (a download of a paper started online)
  // travel with the package so a device that lost its local copy does not lose
  // the student's work.
  const savedAnswers = serverAttemptId
    ? await prisma.examAnswer.findMany({
        where: { attemptId: serverAttemptId },
        select: { questionId: true, response: true },
      })
    : [];

  return NextResponse.json(
    {
      canStart,
      refusal,
      availability,
      attemptId: serverAttemptId,
      savedAnswers,
      exam: {
        id: exam.id,
        title: exam.title,
        subjectName: exam.subjectName,
        examType: exam.examType,
        instructions: exam.instructions,
        durationMinutes: manifest.durationMinutes,
        passMark: exam.passMark,
        className: exam.classId,
        scheduledFor: exam.scheduledFor?.toISOString() ?? null,
        availableUntil: exam.availableUntil?.toISOString() ?? null,
      },
      manifest,
      signature,
      // No answer key, ever: the device is a recording device, not a marker.
      questions: packetQuestions.map((question) => ({
        id: question.id,
        type: question.type,
        questionText: question.questionText,
        marks: question.marks,
        options: optionsShape(question.options),
      })),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
