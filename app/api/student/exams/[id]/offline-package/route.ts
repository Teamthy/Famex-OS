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
 * what the student needs to answer.
 *
 * Modes (controlled by ?createAttempt=):
 *   default (false): package only — no server attempt created. The device
 *     will create a local OFFLINE attempt when the student taps Start and
 *     replay a POST to create the server-side attempt on sync. This is the
 *     right mode for "download tonight, sit tomorrow morning" because the
 *     exam duration clock doesn't start ticking until the student actually
 *     opens the paper.
 *
 *   ?createAttempt=true: also provisions an IN_PROGRESS attempt (used when
 *     the student explicitly clicks "Start offline" while online).
 *
 * Rules:
 * - Only PUBLISHED exams for this student's class.
 * - The exam must be within its sitting window or scheduled within 24 hours
 *   (pre-download allowance).
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const url = new URL(req.url);
  const createAttempt = url.searchParams.get("createAttempt") === "true";

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

  // When explicitly requested, provision an IN_PROGRESS attempt now (timer
  // starts). Otherwise return package with a null attempt — the device
  // creates one locally on first Start.
  let attempt: { id: string; startedAt: Date; deadlineAt: Date } | null = null;
  if (createAttempt) {
    const existing = await prisma.examAttempt.findFirst({
      where: { examId: exam.id, studentProfileId: profile.id, status: "IN_PROGRESS" },
      select: { id: true, deadlineAt: true, startedAt: true },
    });
    if (existing) {
      attempt = existing;
    } else {
      const deadline = new Date(now.getTime() + exam.durationMinutes * 60 * 1000);
      attempt = await prisma.examAttempt.create({
        data: {
          examId: exam.id,
          studentProfileId: profile.id,
          deadlineAt: deadline,
          status: "IN_PROGRESS",
        },
        select: { id: true, deadlineAt: true, startedAt: true },
      });
    }
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
    attempt: attempt
      ? {
          id: attempt.id,
          startedAt: attempt.startedAt.toISOString(),
          deadlineAt: attempt.deadlineAt.toISOString(),
          secondsLeft: Math.max(0, Math.floor((attempt.deadlineAt.getTime() - now.getTime()) / 1000)),
        }
      : null,
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
