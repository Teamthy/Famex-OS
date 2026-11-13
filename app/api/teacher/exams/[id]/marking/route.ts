import { ExamAttemptStatus, ExamQuestionType } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { essayMarkingRefusal } from "@/lib/exam-marking";
import { attemptRequiresPacketReview, readOfflineManualReview } from "@/lib/offline-packet";
import { requireExamTeacherContext } from "@/lib/exams";
import { getClientIp } from "@/lib/requests";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function requireTeacherExamAccess(examId: string) {
  const guard = await requireExamTeacherContext();
  if (!guard.ok) return guard.response;
  const ctx = guard.context;
  const exam = await prisma.exam.findFirst({
    where: { id: examId, teacherProfileId: ctx.teacherProfile.id },
    include: { classroom: { select: { displayName: true } } },
  });
  if (!exam) return NextResponse.json({ error: "Exam not found." }, { status: 404 });
  return { user: ctx.user, teacher: ctx.teacherProfile, exam };
}

/**
 * Teacher theory-marking queue.
 *
 * Returns SUBMITTED attempts for the teacher's exam with the per-question
 * responses that are NOT auto-marked (ESSAY and FILL_BLANK with null
 * awardedMarks so the teacher can assign partial marks). Grouped by
 * question so the teacher can mark one question across all scripts at once
 * (faster, more consistent marking) OR per-student.
 *
 * Teacher access is gated via requireTeacherExamAccess (same gate the rest
 * of the teacher exam views use), so a teacher can only mark their own
 * exam.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requireTeacherExamAccess(id);
  if (ctx instanceof NextResponse) return ctx;

  const { view = "by-question" } = Object.fromEntries(new URL(_req.url).searchParams);

  const exam = await prisma.exam.findUnique({
    where: { id },
    include: {
      classroom: { select: { displayName: true } },
      questions: {
        where: { type: { in: [ExamQuestionType.ESSAY, ExamQuestionType.FILL_BLANK] } },
        orderBy: { sortOrder: "asc" },
      },
    },
  });
  if (!exam) return NextResponse.json({ error: "Exam not found." }, { status: 404 });

  const attempts = await prisma.examAttempt.findMany({
    where: {
      examId: id,
      status: { in: [ExamAttemptStatus.SUBMITTED, ExamAttemptStatus.GRADED] },
    },
    include: {
      studentProfile: { select: { id: true, displayName: true, studentId: true } },
      answers: { include: { question: true } },
    },
    orderBy: { studentProfile: { displayName: "asc" } },
  });

  // Flatten into a queue of items needing a mark (ESSAY/FILL_BLANK with awardedMarks == null).
  const items = attempts.flatMap((a) =>
    readOfflineManualReview(a.metadata)
      ? []
      : a.answers
          .filter(
            (ans) =>
              ans.question.type !== ExamQuestionType.MCQ &&
              ans.question.type !== ExamQuestionType.TRUE_FALSE,
          )
          .map((ans) => ({
            attemptId: a.id,
            answerId: ans.id,
            questionId: ans.question.id,
            student: {
              id: a.studentProfile.id,
              name: a.studentProfile.displayName,
              studentId: a.studentProfile.studentId,
            },
            questionText: ans.question.questionText,
            marks: ans.question.marks,
            questionType: ans.question.type,
            sortOrder: ans.question.sortOrder,
            response: ans.response,
            awardedMarks: ans.awardedMarks,
            isCorrect: ans.isCorrect,
          })),
  );

  const pendingCount = items.filter((i) => i.awardedMarks == null).length;
  const totalStudents = attempts.length;
  const totalMarked = items.length - pendingCount;

  return NextResponse.json({
    exam: {
      id: exam.id,
      title: exam.title,
      subjectName: exam.subjectName,
      className: exam.classroom.displayName,
      theoryMinutes: exam.theoryMinutes,
      totalMarks: exam.totalMarks,
      status: exam.status,
    },
    summary: { totalStudents, pendingCount, totalMarked, totalTheory: items.length },
    questions: exam.questions.map((q) => ({
      id: q.id,
      type: q.type,
      questionText: q.questionText,
      marks: q.marks,
      sortOrder: q.sortOrder,
      pendingCount: items.filter((i) => i.questionId === q.id && i.awardedMarks == null).length,
    })),
    view,
    items,
  });
}

const markSchema = z.object({
  marks: z.array(
    z.object({
      answerId: z.string().min(1),
      awardedMarks: z.coerce.number().int().min(0),
    }),
  ),
  finalize: z.boolean().optional(),
});

/**
 * Award marks for one or more theory answers. If all answers for an attempt
 * are now marked AND finalize=true, bump the attempt to GRADED and compute
 * totals.
 */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requireTeacherExamAccess(id);
  if (ctx instanceof NextResponse) return ctx;
  if (ctx.exam.resultsReleased) {
    return NextResponse.json(
      { error: "Results have been released; use the approved correction workflow." },
      { status: 409 },
    );
  }

  let body: z.infer<typeof markSchema>;
  try {
    body = markSchema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: "Invalid marks payload." }, { status: 400 });
  }

  // Re-read and validate under SERIALIZABLE isolation so a concurrent release,
  // result adoption, or second marking request cannot slip between validation
  // and persistence. The audit event commits with the marks and derived total.
  const outcome = await prisma.$transaction(
    async (tx) => {
      const currentExam = await tx.exam.findFirst({
        where: { id, teacherProfileId: ctx.teacher.id },
        select: { resultsReleased: true },
      });
      if (!currentExam) {
        return { status: 404, error: "Exam not found." };
      }
      if (currentExam.resultsReleased) {
        return {
          status: 409,
          error: "Results have been released; use the approved correction workflow.",
        };
      }

      const answerIds = body.marks.map((mark) => mark.answerId);
      const answers = await tx.examAnswer.findMany({
        where: { id: { in: answerIds } },
        include: {
          question: true,
          attempt: {
            include: { exam: { select: { resultsReleased: true } } },
          },
        },
      });
      const perAnswerCap = new Map(
        answers.map((answer) => [
          answer.id,
          {
            maxMarks: answer.question.marks,
            questionType: answer.question.type,
            attemptStatus: answer.attempt.status,
            resultAdoptedAt: answer.attempt.resultAdoptedAt,
            requiresPacketReview: attemptRequiresPacketReview(answer.attempt.metadata),
            manualReviewCompleted: Boolean(readOfflineManualReview(answer.attempt.metadata)),
            examId: answer.attempt.examId,
            examResultsReleased: answer.attempt.exam.resultsReleased,
          },
        ]),
      );

      for (const mark of body.marks) {
        const cap = perAnswerCap.get(mark.answerId);
        if (!cap) return { status: 404, error: `Answer ${mark.answerId} not found.` };
        if (cap.examId !== id) {
          return { status: 403, error: "Answer does not belong to this exam." };
        }
        if (cap.manualReviewCompleted) {
          return {
            status: 409,
            error:
              "This offline attempt has a completed manual review; use the result correction workflow to change it.",
            code: "OFFLINE_REVIEW_COMPLETED",
          };
        }
        if (cap.requiresPacketReview) {
          return {
            status: 409,
            error: "This offline attempt used a changed paper and must be reviewed before marking.",
            code: "PACKET_REVIEW_REQUIRED",
          };
        }
        const refusal = essayMarkingRefusal({
          questionType: cap.questionType,
          attemptStatus: cap.attemptStatus,
          resultAdoptedAt: cap.resultAdoptedAt,
          examResultsReleased: cap.examResultsReleased,
        });
        if (refusal) {
          return { status: 409, error: refusal.message, code: refusal.code };
        }
        if (mark.awardedMarks > cap.maxMarks) {
          return {
            status: 400,
            error: `Awarded ${mark.awardedMarks} exceeds question maximum (${cap.maxMarks}).`,
          };
        }
      }

      await Promise.all(
        body.marks.map((mark) =>
          tx.examAnswer.update({
            where: { id: mark.answerId },
            data: {
              awardedMarks: mark.awardedMarks,
              isCorrect: mark.awardedMarks >= (perAnswerCap.get(mark.answerId)?.maxMarks ?? 0),
            },
          }),
        ),
      );

      // When finalize is set, scan unadopted submitted attempts — any attempt
      // whose answers are all marked gets a server-computed total.
      if (body.finalize) {
        const allAttempts = await tx.examAttempt.findMany({
          where: {
            examId: id,
            status: ExamAttemptStatus.SUBMITTED,
            resultAdoptedAt: null,
          },
          include: { answers: { include: { question: true } } },
        });
        for (const attempt of allAttempts) {
          if (attemptRequiresPacketReview(attempt.metadata)) continue;
          const allMarked = attempt.answers.every((answer) => answer.awardedMarks != null);
          if (!allMarked) continue;
          const theory = attempt.answers
            .filter(
              (answer) =>
                answer.question.type !== ExamQuestionType.MCQ &&
                answer.question.type !== ExamQuestionType.TRUE_FALSE,
            )
            .reduce((sum, answer) => sum + (answer.awardedMarks ?? 0), 0);
          await tx.examAttempt.update({
            where: { id: attempt.id },
            data: {
              essayScore: theory,
              totalScore: attempt.autoScore + theory,
              status: ExamAttemptStatus.GRADED,
            },
          });
        }
      }

      await tx.auditLog.create({
        data: {
          schoolId: ctx.user.schoolId,
          actorUserId: ctx.user.id,
          action: "EXAM_ANSWERS_MARKED",
          entityType: "Exam",
          entityId: id,
          metadata: { marked: body.marks.length, finalized: Boolean(body.finalize) },
          ipAddress: getClientIp(req),
        },
      });

      return null;
    },
    { isolationLevel: "Serializable" },
  );
  if (outcome) {
    return NextResponse.json(
      { error: outcome.error, ...("code" in outcome ? { code: outcome.code } : {}) },
      { status: outcome.status },
    );
  }

  return NextResponse.json({ ok: true, marked: body.marks.length });
}
