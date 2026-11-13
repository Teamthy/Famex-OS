import { ExamAttemptStatus, ExamDeliveryMode, ExamQuestionType, Prisma } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireExamTeacherContext } from "@/lib/exams";
import {
  attemptRequiresPacketReview,
  readOfflinePacketSnapshot,
  readOfflineReplayAnswers,
  verifyPacket,
} from "@/lib/offline-packet";
import { prisma } from "@/lib/prisma";
import { getClientIp } from "@/lib/requests";

export const dynamic = "force-dynamic";

const schema = z.object({
  attemptId: z.string().trim().min(1),
  reason: z.string().trim().min(4).max(500),
  marks: z
    .array(
      z.object({
        questionId: z.string().trim().min(1),
        awardedMarks: z.number().int().min(0).max(100),
      }),
    )
    .min(1)
    .max(1000),
});

/**
 * Explicitly resolve a changed-paper offline sitting. The server does not
 * transfer the previous answer key's score; a teacher reviews every question
 * against the original signed snapshot and supplies a mark plus a reason.
 */
export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const guard = await requireExamTeacherContext();
  if (!guard.ok) return guard.response;
  const teacher = guard.context;
  const { id: examId } = await context.params;

  let input: z.infer<typeof schema>;
  try {
    input = schema.parse(await request.json());
  } catch {
    return NextResponse.json(
      { error: "Provide a reason and a mark for every original question." },
      { status: 400 },
    );
  }

  const ipAddress = getClientIp(request);
  try {
    const outcome = await prisma.$transaction(
      async (tx) => {
        const attempt = await tx.examAttempt.findFirst({
          where: {
            id: input.attemptId,
            examId,
            exam: { teacherProfileId: teacher.teacherProfile.id },
          },
          select: {
            id: true,
            status: true,
            deliveryMode: true,
            resultAdoptedAt: true,
            metadata: true,
            exam: { select: { schoolId: true, resultsReleased: true } },
          },
        });
        if (!attempt) return { status: 404 as const, error: "Attempt not found." };
        if (attempt.exam.resultsReleased || attempt.resultAdoptedAt) {
          return {
            status: 409 as const,
            error: "This result is already released or adopted and cannot be changed here.",
          };
        }
        if (
          attempt.status !== ExamAttemptStatus.SUBMITTED ||
          attempt.deliveryMode !== ExamDeliveryMode.SYNCED ||
          !attemptRequiresPacketReview(attempt.metadata)
        ) {
          return {
            status: 409 as const,
            error: "This attempt is not waiting for changed-paper review.",
          };
        }

        const snapshot = readOfflinePacketSnapshot(attempt.metadata);
        if (
          !snapshot ||
          snapshot.manifest.examId !== examId ||
          !verifyPacket({
            manifest: snapshot.manifest,
            signature: snapshot.signature,
            currentQuestions: snapshot.questions,
          }).ok
        ) {
          return {
            status: 409 as const,
            error:
              "The original signed paper snapshot is unavailable or invalid. No score was changed.",
          };
        }

        const questionIds = snapshot.questions.map((question) => question.id);
        const submittedAnswers = readOfflineReplayAnswers(attempt.metadata);
        if (
          new Set(questionIds).size !== questionIds.length ||
          new Set(submittedAnswers.map((answer) => answer.questionId)).size !==
            submittedAnswers.length
        ) {
          return {
            status: 409 as const,
            error: "The stored paper or answers contain duplicate question ids.",
          };
        }

        const marksById = new Map(input.marks.map((mark) => [mark.questionId, mark.awardedMarks]));
        if (
          marksById.size !== questionIds.length ||
          questionIds.some((questionId) => !marksById.has(questionId)) ||
          input.marks.some((mark) => !questionIds.includes(mark.questionId))
        ) {
          return {
            status: 400 as const,
            error:
              "Submit exactly one mark for every question in the original paper, including unanswered questions.",
          };
        }

        const outOfRange = snapshot.questions.find(
          (question) => (marksById.get(question.id) ?? -1) > question.marks,
        );
        if (outOfRange) {
          return {
            status: 400 as const,
            error: `The mark for question ${outOfRange.sortOrder} exceeds its ${outOfRange.marks}-mark maximum.`,
          };
        }

        const objectiveScore = snapshot.questions
          .filter(
            (question) =>
              question.type === ExamQuestionType.MCQ ||
              question.type === ExamQuestionType.TRUE_FALSE,
          )
          .reduce((sum, question) => sum + (marksById.get(question.id) ?? 0), 0);
        const theoryScore = snapshot.questions
          .filter(
            (question) =>
              question.type !== ExamQuestionType.MCQ &&
              question.type !== ExamQuestionType.TRUE_FALSE,
          )
          .reduce((sum, question) => sum + (marksById.get(question.id) ?? 0), 0);
        const score = objectiveScore + theoryScore;
        const reviewMarks = snapshot.questions.map((question) => ({
          questionId: question.id,
          awardedMarks: marksById.get(question.id) ?? 0,
        }));
        const metadata =
          attempt.metadata &&
          typeof attempt.metadata === "object" &&
          !Array.isArray(attempt.metadata)
            ? attempt.metadata
            : {};
        const updated = await tx.examAttempt.updateMany({
          where: {
            id: attempt.id,
            status: ExamAttemptStatus.SUBMITTED,
            resultAdoptedAt: null,
          },
          data: {
            status: ExamAttemptStatus.GRADED,
            autoScore: objectiveScore,
            essayScore: theoryScore,
            totalScore: score,
            metadata: {
              ...metadata,
              requiresManualReview: false,
              manualReviewCompleted: true,
              offlineManualReview: {
                reviewedAt: new Date().toISOString(),
                reviewedByUserId: teacher.user.id,
                reason: input.reason,
                marks: reviewMarks,
                score,
              },
            } as Prisma.InputJsonObject,
          },
        });
        if (updated.count !== 1) {
          return {
            status: 409 as const,
            error: "The attempt changed while you were reviewing it. Refresh and retry.",
          };
        }

        await tx.auditLog.create({
          data: {
            schoolId: attempt.exam.schoolId,
            actorUserId: teacher.user.id,
            action: "OFFLINE_EXAM_ATTEMPT_REVIEWED",
            entityType: "ExamAttempt",
            entityId: attempt.id,
            ipAddress,
            metadata: {
              examId,
              packetFingerprint: snapshot.manifest.fingerprint,
              questionCount: questionIds.length,
              totalScore: score,
              reason: input.reason,
            },
          },
        });
        return { status: 200 as const, score, totalMarks: snapshot.manifest.totalMarks };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );

    if (outcome.status !== 200) {
      return NextResponse.json({ error: outcome.error }, { status: outcome.status });
    }
    return NextResponse.json({
      ok: true,
      score: outcome.score,
      totalMarks: outcome.totalMarks,
      message: `Offline attempt reviewed and scored ${outcome.score}/${outcome.totalMarks}.`,
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034") {
      return NextResponse.json(
        { error: "Another result update happened during review. Refresh and try again." },
        { status: 409 },
      );
    }
    throw error;
  }
}
