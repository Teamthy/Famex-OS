import { ExamAttemptStatus, ExamStatus } from "@prisma/client";
import { NextResponse, type NextRequest } from "next/server";
import { getStudentExamContext } from "@/lib/exams";
import {
  fingerprintQuestions,
  signPacket,
  type OfflinePacketManifest,
} from "@/lib/offline-packet";
import { prisma } from "@/lib/prisma";
import { examMinutes } from "@/lib/exams";
import { examAvailability, startWindowRefusal, studentSubjectIds, attemptDeadline } from "@/lib/subjects";

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
 * The fingerprint (ids, types and marks) identifies the version. A teacher who
 * adds a question after the paper was handed out changes every score on it. The
 * HMAC makes the manifest unforgeable, so a modified device cannot claim to have
 * sat a paper with different marks.
 *
 * A mismatch is surfaced on replay rather than rejected: the sitting really
 * happened, and throwing it away would lose a student's work because a teacher
 * fixed a typo.
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
  const studentContext = await getStudentExamContext();
  if (!studentContext) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

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

  // An exam for a subject this student does not take is not theirs to download.
  // A missing subjectId is legacy free-text and stays visible to the class.
  if (exam.subjectId) {
    const subjectIds = await studentSubjectIds(studentContext.studentProfile.id);
    if (!subjectIds.includes(exam.subjectId)) {
      return NextResponse.json(
        { error: "You are not enrolled in this subject.", code: "NOT_ENROLLED" },
        { status: 403 },
      );
    }
  }

  if (!exam.questions.length) {
    return NextResponse.json(
      { error: "This paper has no questions yet. Ask your teacher to publish it first." },
      { status: 409 },
    );
  }

  const latestAttempt = exam.attempts[0] ?? null;
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

  const fingerprint = fingerprintQuestions(
    exam.questions.map((question) => ({
      id: question.id,
      type: question.type,
      marks: question.marks,
      sortOrder: question.sortOrder,
    })),
  );
  const totalMarks = exam.questions.reduce((sum, question) => sum + question.marks, 0);

  // Term provenance travels with the paper so a sitting in January compiles into
  // Second Term even if it syncs in February.
  let sessionLabel = exam.sessionLabel;
  let termIndex = exam.termIndex;
  if (sessionLabel === null || termIndex === null) {
    const term = await prisma.term.findFirst({
      where: { schoolId: exam.schoolId, startsOn: { lte: exam.createdAt }, endsOn: { gte: exam.createdAt } },
      select: { index: true, session: { select: { label: true } } },
    });
    sessionLabel = sessionLabel ?? term?.session.label ?? null;
    termIndex = termIndex ?? term?.index ?? null;
  }

  const manifest: OfflinePacketManifest = {
    examId: exam.id,
    packetId: "",
    fingerprint,
    questionCount: exam.questions.length,
    totalMarks,
    durationMinutes: examMinutes(exam),
    sessionLabel,
    termIndex,
    downloadedAt: new Date().toISOString(),
  };

  let signature = "";
  try {
    const signed = signPacket(manifest);
    manifest.packetId = signed.packetId;
    signature = signed.signature;
  } catch {
    // A server without a usable AUTH_SECRET cannot sign, and an unsigned packet
    // would be rejected on replay after the student had already sat the paper.
    return NextResponse.json(
      { error: "Offline papers are not configured on this server.", code: "SIGNING_UNAVAILABLE" },
      { status: 503 },
    );
  }

  const optionsShape = (options: unknown) => {
    const parsed = Array.isArray(options) ? options : [];
    return parsed
      .filter((option): option is { key: string; text: string } =>
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
        durationMinutes: examMinutes(exam),
        passMark: exam.passMark,
        className: exam.classId,
        scheduledFor: exam.scheduledFor?.toISOString() ?? null,
        availableUntil: exam.availableUntil?.toISOString() ?? null,
      },
      manifest,
      signature,
      // No answer key, ever: the device is a recording device, not a marker.
      questions: exam.questions.map((question) => ({
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
