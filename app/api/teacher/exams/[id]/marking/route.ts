import { ExamAttemptStatus, ExamQuestionType } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getExamTeacherContext } from "@/lib/exams";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function requireTeacherExamAccess(examId: string) {
  const ctx = await getExamTeacherContext();
  if (!ctx) return null;
  const exam = await prisma.exam.findFirst({
    where: { id: examId, teacherProfileId: ctx.teacherProfile.id },
    include: { classroom: { select: { displayName: true } } },
  });
  if (!exam) return null;
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
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

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
    a.answers
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
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: z.infer<typeof markSchema>;
  try {
    body = markSchema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: "Invalid marks payload." }, { status: 400 });
  }

  // Security: every answerId must belong to an answer on an attempt of THIS
  // exam. A forged answerId from a different exam must be rejected.
  const answerIds = body.marks.map((m) => m.answerId);
  const answers = await prisma.examAnswer.findMany({
    where: { id: { in: answerIds } },
    include: { question: true, attempt: true },
  });
  const perAnswerCap = new Map(
    answers.map((a) => [
      a.id,
      { attemptId: a.attemptId, examId: a.attempt.examId, maxMarks: a.question.marks },
    ]),
  );

  for (const m of body.marks) {
    const cap = perAnswerCap.get(m.answerId);
    if (!cap)
      return NextResponse.json({ error: `Answer ${m.answerId} not found.` }, { status: 404 });
    if (cap.examId !== id)
      return NextResponse.json({ error: "Answer does not belong to this exam." }, { status: 403 });
    if (m.awardedMarks > cap.maxMarks) {
      return NextResponse.json(
        { error: `Awarded ${m.awardedMarks} exceeds question maximum (${cap.maxMarks}).` },
        { status: 400 },
      );
    }
  }

  await prisma.$transaction(
    body.marks.map((m) =>
      prisma.examAnswer.update({
        where: { id: m.answerId },
        data: {
          awardedMarks: m.awardedMarks,
          isCorrect: m.awardedMarks >= (perAnswerCap.get(m.answerId)?.maxMarks ?? 0),
        },
      }),
    ),
  );

  // When finalize is set, scan all attempts — any attempt whose answers all
  // have awardedMarks gets totaled and flipped to GRADED.
  if (body.finalize) {
    const allAttempts = await prisma.examAttempt.findMany({
      where: { examId: id, status: ExamAttemptStatus.SUBMITTED },
      include: { answers: { include: { question: true } } },
    });
    for (const a of allAttempts) {
      const allMarked = a.answers.every((ans) => ans.awardedMarks != null);
      if (!allMarked) continue;
      const theory = a.answers
        .filter(
          (ans) =>
            ans.question.type !== ExamQuestionType.MCQ &&
            ans.question.type !== ExamQuestionType.TRUE_FALSE,
        )
        .reduce((s, ans) => s + (ans.awardedMarks ?? 0), 0);
      const objective = a.autoScore;
      await prisma.examAttempt.update({
        where: { id: a.id },
        data: {
          essayScore: theory,
          totalScore: objective + theory,
          status: ExamAttemptStatus.GRADED,
        },
      });
    }
  }

  return NextResponse.json({ ok: true, marked: body.marks.length });
}
