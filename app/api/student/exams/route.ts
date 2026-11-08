import { ExamAttemptStatus, ExamStatus } from "@prisma/client";
import { NextResponse } from "next/server";
import { getStudentExamContext } from "@/lib/exams";
import { getStudentFeeLock } from "@/lib/fee-lock";
import { prisma } from "@/lib/prisma";
import { availabilityLabel, examAvailability, studentSubjectIds } from "@/lib/subjects";

export const dynamic = "force-dynamic";

export async function GET() {
  const context = await getStudentExamContext();
  if (!context) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [feeLock, mySubjectIds] = await Promise.all([
    getStudentFeeLock(context.user.schoolId, context.studentProfile.id),
    studentSubjectIds(context.studentProfile.id),
  ]);

  // Show exams for this class, but only for subjects this student actually
  // takes. An exam with no subjectId is legacy free-text and stays visible to
  // the whole class — removing those silently would hide real exams.
  const takenSubjects = new Set(mySubjectIds);

  const exams = await prisma.exam.findMany({
    where: {
      classId: context.studentProfile.currentClassId,
      status: { in: [ExamStatus.PUBLISHED, ExamStatus.CLOSED] },
      ...(mySubjectIds.length
        ? { OR: [{ subjectId: null }, { subjectId: { in: mySubjectIds } }] }
        : {}),
    },
    // Soonest first: a student wants to know what is next, not what was
    // created most recently.
    orderBy: [{ scheduledFor: "asc" }, { createdAt: "desc" }],
    include: {
      teacherProfile: { select: { displayName: true } },
      questions: { select: { id: true, marks: true, type: true } },
      attempts: {
        where: { studentProfileId: context.studentProfile.id },
        orderBy: { attemptNumber: "desc" },
      },
      retakes: { where: { studentProfileId: context.studentProfile.id } },
    },
  });

  return NextResponse.json({
    feeLock,
    student: {
      displayName: context.studentProfile.displayName,
      studentId: context.studentProfile.studentId,
    },
    exams: exams.map((exam) => {
      const latestAttempt = exam.attempts[0] || null;
      const retake = exam.retakes[0] || null;
      const totalMarks = exam.questions.reduce((sum, question) => sum + question.marks, 0);
      const hasUnusedRetake = Boolean(retake && !retake.used);
      const hasSubmitted = Boolean(
        latestAttempt && latestAttempt.status !== ExamAttemptStatus.IN_PROGRESS,
      );

      // One definition of "can this be sat right now", shared with the runner.
      const availability = examAvailability({
        scheduledFor: exam.scheduledFor,
        availableUntil: exam.availableUntil,
        hasSubmitted: hasSubmitted && !hasUnusedRetake,
        // A granted retake re-opens a paper whose window has closed. Without
        // this the student would see "Missed — window closed" on a paper a
        // teacher had just enabled for them.
        hasRetake: hasUnusedRetake,
      });

      const canStart =
        exam.status === ExamStatus.PUBLISHED &&
        availability === "READY" &&
        (!latestAttempt ||
          (latestAttempt.status !== ExamAttemptStatus.IN_PROGRESS && hasUnusedRetake));
      const canResume = Boolean(
        latestAttempt && latestAttempt.status === ExamAttemptStatus.IN_PROGRESS,
      );

      return {
        id: exam.id,
        title: exam.title,
        subjectName: exam.subjectName,
        teacherName: exam.teacherProfile.displayName,
        examType: exam.examType,
        durationMinutes: exam.durationMinutes,
        theoryMinutes: exam.theoryMinutes ?? 0,
        subjectId: exam.subjectId,
        // Term provenance, so the student list can say which term a paper counts
        // towards and the runner can file an offline sitting under it.
        sessionLabel: exam.sessionLabel,
        termIndex: exam.termIndex,
        termLabel: exam.termIndex ? `Term ${exam.termIndex}` : null,
        // Everything needed to sit with no network: the questions carry no
        // answer key, the duration bounds the clock, and a paper with no
        // questions cannot be started offline at all.
        offlineReady: exam.questions.length > 0 && exam.status === ExamStatus.PUBLISHED,
        // When to sit it — the whole point of the student exam list.
        scheduledFor: exam.scheduledFor?.toISOString() || null,
        availableUntil: exam.availableUntil?.toISOString() || null,
        availability,
        availabilityLabel: availabilityLabel(availability),
        isElective: exam.subjectId ? takenSubjects.has(exam.subjectId) : false,
        questionCount: exam.questions.length,
        totalMarks,
        passMark: exam.passMark,
        hasEssay: exam.questions.some((question) => question.type === "ESSAY"),
        status: exam.status,
        instructions: exam.instructions,
        canStart: feeLock ? false : canStart,
        canResume: feeLock ? false : canResume,
        feeLocked: Boolean(feeLock),
        attempt: latestAttempt
          ? {
              id: latestAttempt.id,
              status: latestAttempt.status,
              totalScore: latestAttempt.totalScore,
              submittedAt: latestAttempt.submittedAt?.toISOString() || null,
              deliveryMode: latestAttempt.deliveryMode,
              offlineStartedAt: latestAttempt.offlineStartedAt?.toISOString() ?? null,
              scoreVisible:
                exam.resultsReleased && latestAttempt.status === ExamAttemptStatus.GRADED,
              percent:
                exam.resultsReleased &&
                latestAttempt.status === ExamAttemptStatus.GRADED &&
                totalMarks
                  ? Math.round((latestAttempt.totalScore / totalMarks) * 100)
                  : null,
            }
          : null,
      };
    }),
  });
}
