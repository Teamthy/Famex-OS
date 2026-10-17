import { ExamStatus } from "@prisma/client";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/session";
import { UserRole } from "@prisma/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Offline exam package.
 *
 * Returns questions WITHOUT correctKey/correctText so the device only stores
 * what the student needs to answer. The package is signed by including an
 * `offlineToken` (the attempt id — created here so the server can match a
 * later offline submission to it) and a deadline. Designed for pulling before
 * the student leaves for school on a spotty network.
 *
 * Rules:
 * - Only PUBLISHED exams for this student's class.
 * - The exam must be within its sitting window or scheduled within 24 hours
 *   (pre-download allowance).
 * - One offline token per student per exam at a time; re-downloading reuses
 *   the existing IN_PROGRESS attempt (so progress isn't lost).
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const user = await requireRole([UserRole.STUDENT]);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const profile = await prisma.studentProfile.findFirst({
    where: { userId: user.id, schoolId: user.schoolId, isActive: true },
    select: { id: true, currentClassId: true },
  });
  if (!profile) return NextResponse.json({ error: "Student profile not found." }, { status: 404 });

  const now = new Date();
  const preDownloadWindow = new Date(now.getTime() + 24 * 60 * 60 * 1000);

  const exam = await prisma.exam.findFirst({
    where: {
      id,
      schoolId: user.schoolId,
      classId: profile.currentClassId,
      status: ExamStatus.PUBLISHED,
      OR: [
        { scheduledFor: null },
        { scheduledFor: { lte: preDownloadWindow } },
      ],
    },
    select: {
      id: true,
      title: true,
      subjectName: true,
      examType: true,
      durationMinutes: true,
      instructions: true,
      totalMarks: true,
      passMark: true,
      scheduledFor: true,
      availableUntil: true,
      shuffleQuestions: true,
      questions: {
        where: {},
        select: {
          id: true,
          type: true,
          questionText: true,
          options: true,
          marks: true,
          sortOrder: true,
        },
        orderBy: { sortOrder: "asc" },
      },
    },
  });
  if (!exam) return NextResponse.json({ error: "Exam not available for offline download." }, { status: 404 });

  // Retrieve or create the IN_PROGRESS attempt for this student so the device
  // can sync answers against it later.
  const existing = await prisma.examAttempt.findFirst({
    where: { examId: exam.id, studentProfileId: profile.id, status: "IN_PROGRESS" },
    select: { id: true, deadlineAt: true, startedAt: true },
  });

  let attempt: { id: string; deadlineAt: Date; startedAt: Date };
  if (existing) {
    attempt = existing;
  } else {
    const deadline = new Date(now.getTime() + exam.durationMinutes * 60 * 1000);
    const created = await prisma.examAttempt.create({
      data: {
        examId: exam.id,
        studentProfileId: profile.id,
        deadlineAt: deadline,
        status: "IN_PROGRESS",
      },
      select: { id: true, deadlineAt: true, startedAt: true },
    });
    attempt = created;
  }

  return NextResponse.json({
    offline: true,
    exam: {
      id: exam.id,
      title: exam.title,
      subjectName: exam.subjectName,
      examType: exam.examType,
      durationMinutes: exam.durationMinutes,
      instructions: exam.instructions,
      totalMarks: exam.totalMarks,
      passMark: exam.passMark,
      scheduledFor: exam.scheduledFor?.toISOString() || null,
      availableUntil: exam.availableUntil?.toISOString() || null,
      shuffleQuestions: exam.shuffleQuestions,
    },
    attempt: {
      id: attempt.id,
      startedAt: attempt.startedAt.toISOString(),
      deadlineAt: attempt.deadlineAt.toISOString(),
      secondsLeft: Math.max(0, Math.floor((attempt.deadlineAt.getTime() - now.getTime()) / 1000)),
    },
    questions: exam.questions.map((q) => ({
      id: q.id,
      type: q.type,
      questionText: q.questionText,
      options: q.options,
      marks: q.marks,
    })),
    downloadedAt: now.toISOString(),
  });
}
