import { ExamAttemptStatus, ExamQuestionType, Prisma } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireExamTeacherContext } from "@/lib/exams";
import { essayMarkingRefusal } from "@/lib/exam-marking";
import {
  attemptRequiresPacketReview,
  readOfflineManualReview,
  readOfflinePacketSnapshot,
  readOfflineReplayAnswers,
} from "@/lib/offline-packet";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const guard = await requireExamTeacherContext();
  if (!guard.ok) return guard.response;
  const teacherContext = guard.context;

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
    attempts: exam.attempts.map((attempt) => {
      const requiresManualReview = attemptRequiresPacketReview(attempt.metadata);
      const packetSnapshot = readOfflinePacketSnapshot(attempt.metadata);
      const manualReview = readOfflineManualReview(attempt.metadata);
      const attemptMaxMarks = packetSnapshot?.manifest.totalMarks ?? totalMarks;
      return {
        id: attempt.id,
        maxMarks: attemptMaxMarks,
        student: attempt.studentProfile,
        attemptNumber: attempt.attemptNumber,
        status: attempt.status,
        packetMismatch:
          typeof attempt.metadata === "object" &&
          attempt.metadata !== null &&
          "packetMismatch" in attempt.metadata
            ? attempt.metadata.packetMismatch
            : null,
        requiresManualReview,
        offlineReview:
          requiresManualReview || manualReview
            ? {
                questions: packetSnapshot?.questions ?? [],
                answers: readOfflineReplayAnswers(attempt.metadata),
                manualReview,
              }
            : null,
        startedAt: attempt.startedAt.toISOString(),
        submittedAt: attempt.submittedAt?.toISOString() || null,
        autoScore: attempt.autoScore,
        essayScore: attempt.essayScore,
        totalScore: attempt.totalScore,
        tabSwitches: attempt.tabSwitches,
        passed:
          attemptMaxMarks > 0
            ? (attempt.totalScore / attemptMaxMarks) * 100 >= exam.passMark
            : false,
        pendingEssays: attempt.answers.filter(
          (answer) =>
            answer.question.type === ExamQuestionType.ESSAY && answer.awardedMarks === null,
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
      };
    }),
  });
}

const gradeSchema = z.object({
  answerId: z.string().trim().min(1),
  awardedMarks: z.number().int().min(0).max(100),
});

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const guard = await requireExamTeacherContext();
  if (!guard.ok) return guard.response;
  const teacherContext = guard.context;

  const { id } = await context.params;
  let payload: z.infer<typeof gradeSchema>;
  try {
    payload = gradeSchema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: "Invalid grading request." }, { status: 400 });
  }

  try {
    const result = await prisma.$transaction(
      async (tx) => {
        const answer = await tx.examAnswer.findFirst({
          where: {
            id: payload.answerId,
            attempt: { exam: { id, teacherProfileId: teacherContext.teacherProfile.id } },
          },
          include: {
            question: { select: { type: true, marks: true } },
            attempt: {
              select: {
                id: true,
                studentProfileId: true,
                status: true,
                metadata: true,
                resultAdoptedAt: true,
                exam: { select: { schoolId: true, resultsReleased: true } },
              },
            },
          },
        });
        if (!answer) return { error: "Answer not found.", status: 404 as const };

        if (readOfflineManualReview(answer.attempt.metadata)) {
          return {
            error:
              "This offline attempt has a completed manual review; use the result correction workflow to change it.",
            code: "OFFLINE_REVIEW_COMPLETED",
            status: 409 as const,
          };
        }

        if (attemptRequiresPacketReview(answer.attempt.metadata)) {
          return {
            error: "This offline attempt used a changed paper and must be reviewed before marking.",
            code: "PACKET_REVIEW_REQUIRED",
            status: 409 as const,
          };
        }

        const refusal = essayMarkingRefusal({
          questionType: answer.question.type,
          attemptStatus: answer.attempt.status,
          resultAdoptedAt: answer.attempt.resultAdoptedAt,
          examResultsReleased: answer.attempt.exam.resultsReleased,
        });
        if (refusal) {
          return { error: refusal.message, code: refusal.code, status: 409 as const };
        }

        const awarded = Math.min(payload.awardedMarks, answer.question.marks);
        await tx.examAnswer.update({
          where: { id: answer.id },
          data: { awardedMarks: awarded, isCorrect: awarded > 0 },
        });

        // Recompute answer and attempt totals in one serializable transaction.
        const attempt = await tx.examAttempt.findUnique({
          where: { id: answer.attempt.id },
          include: { answers: { include: { question: { select: { type: true } } } } },
        });
        if (!attempt) return { error: "Attempt not found.", status: 404 as const };

        const essayScore = attempt.answers
          .filter((entry) => entry.question.type === ExamQuestionType.ESSAY)
          .reduce((sum, entry) => sum + (entry.awardedMarks || 0), 0);
        const pending = attempt.answers.some(
          (entry) => entry.question.type === ExamQuestionType.ESSAY && entry.awardedMarks === null,
        );
        await tx.examAttempt.update({
          where: { id: attempt.id },
          data: {
            essayScore,
            totalScore: attempt.autoScore + essayScore,
            status: pending ? ExamAttemptStatus.SUBMITTED : ExamAttemptStatus.GRADED,
          },
        });

        await tx.auditLog.create({
          data: {
            schoolId: answer.attempt.exam.schoolId,
            actorUserId: teacherContext.user.id,
            action: "EXAM_ESSAY_GRADED",
            entityType: "ExamAnswer",
            entityId: answer.id,
            metadata: {
              examId: id,
              attemptId: answer.attempt.id,
              studentProfileId: answer.attempt.studentProfileId,
              awardedMarks: awarded,
              previousAwardedMarks: answer.awardedMarks,
              maxMarks: answer.question.marks,
            },
          },
        });

        return { ok: true as const };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );

    if ("error" in result) {
      return NextResponse.json(
        { error: result.error, ...(result.code ? { code: result.code } : {}) },
        { status: result.status },
      );
    }
    return NextResponse.json({ ok: true, message: "Essay score saved." });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034") {
      return NextResponse.json(
        {
          error: "Another marker updated this attempt. Refresh the results and try again.",
          code: "MARKING_CONFLICT",
        },
        { status: 409 },
      );
    }
    throw error;
  }
}
