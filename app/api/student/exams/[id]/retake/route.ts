import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/session";
import { UserRole } from "@prisma/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/student/exams/[id]/retake — ask to re-sit a paper.
 *
 * ── Why this exists ────────────────────────────────────────────────────────
 * A retake could only ever be GRANTED. If a student was ill, or got stuck in
 * traffic, or their device died, the only path to a resit was for a teacher to
 * independently notice and create one. The student had no way to say anything,
 * and the teacher had no queue of requests to work through. So resits happened
 * for the students a teacher happened to remember, which is not a policy.
 *
 * This is a request, not a grant: it moves nothing except a row in the
 * teacher's queue. A teacher still decides.
 *
 * The request is refused when it could not possibly succeed — asking to resit
 * a paper you have not missed yet, or one you already hold an unused grant for,
 * wastes a teacher's attention and teaches the student nothing.
 */

const requestSchema = z.object({
  /** Why they could not sit it. Required: "please" is not a reason. */
  reason: z.string().trim().min(10).max(500),
});

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const user = await requireRole([UserRole.STUDENT]);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await context.params;

  let input: z.infer<typeof requestSchema>;
  try {
    input = requestSchema.parse(await request.json());
  } catch {
    return NextResponse.json(
      { error: "Give a reason of at least 10 characters, so your teacher can decide." },
      { status: 400 },
    );
  }

  const student = await prisma.studentProfile.findFirst({
    where: { schoolId: user.schoolId, userId: user.id, isActive: true },
    select: { id: true, currentClassId: true, displayName: true },
  });
  if (!student) return NextResponse.json({ error: "No student record." }, { status: 403 });

  const exam = await prisma.exam.findFirst({
    where: { id, classId: student.currentClassId },
    select: {
      id: true,
      title: true,
      scheduledFor: true,
      availableUntil: true,
      teacherProfile: { select: { userId: true } },
    },
  });
  if (!exam) return NextResponse.json({ error: "Exam not found for your class." }, { status: 404 });

  // You cannot resit a paper you have not missed. Asking early is not cheating,
  // but a teacher granting it would be — it would re-open a closed window.
  const now = new Date();
  const windowOpen =
    exam.availableUntil !== null && now <= exam.availableUntil && (exam.scheduledFor === null || now >= exam.scheduledFor);
  if (windowOpen)
    return NextResponse.json(
      {
        error: "This paper is still open. Sit it now, or ask again if you miss it.",
        code: "WINDOW_OPEN",
      },
      { status: 409 },
    );

  const existing = await prisma.examRetake.findUnique({
    where: { examId_studentProfileId: { examId: exam.id, studentProfileId: student.id } },
  });

  if (existing?.status === "REQUESTED")
    return NextResponse.json(
      { error: "You have already asked to resit this paper. Your teacher has not answered yet." },
      { status: 409 },
    );

  if (existing?.status === "GRANTED" && !existing.used)
    return NextResponse.json(
      {
        error: "You already have a resit for this paper — open the paper to sit it.",
        code: "ALREADY_GRANTED",
      },
      { status: 409 },
    );

  if (existing?.status === "USED")
    return NextResponse.json(
      { error: "You have already sat a resit for this paper." },
      { status: 409 },
    );

  /**
   * A DECLINED row is revived rather than duplicated: the unique constraint is
   * (examId, studentProfileId), and a student asking twice after a refusal
   * should produce one row a teacher can see, not an error about a row nobody
   * can point at.
   */
  const retake = await prisma.examRetake.upsert({
    where: { examId_studentProfileId: { examId: exam.id, studentProfileId: student.id } },
    update: {
      status: "REQUESTED",
      reason: input.reason,
      requestedAt: now,
      decisionNote: null,
      decidedAt: null,
      decidedByUserId: null,
      grantedByUserId: exam.teacherProfile.userId,
      used: false,
    },
    create: {
      examId: exam.id,
      studentProfileId: student.id,
      // The grant column is non-null and means "the teacher this reaches".
      grantedByUserId: exam.teacherProfile.userId,
      status: "REQUESTED",
      reason: input.reason,
      requestedAt: now,
    },
  });

  await prisma.auditLog.create({
    data: {
      schoolId: user.schoolId,
      actorUserId: user.id,
      action: "EXAM_RETAKE_REQUESTED",
      entityType: "ExamRetake",
      entityId: retake.id,
      metadata: { examTitle: exam.title, student: student.displayName },
    },
  });

  return NextResponse.json({
    ok: true,
    retakeId: retake.id,
    message: `Your request has been sent to your teacher. They will decide, and you will see a resit appear on this paper if it is approved.`,
  });
}

/** GET — what this student has asked for, so the UI can stop offering it. */
export async function GET(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const user = await requireRole([UserRole.STUDENT]);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await context.params;
  const student = await prisma.studentProfile.findFirst({
    where: { schoolId: user.schoolId, userId: user.id, isActive: true },
    select: { id: true },
  });
  if (!student) return NextResponse.json({ error: "No student record." }, { status: 403 });

  const retake = await prisma.examRetake.findUnique({
    where: { examId_studentProfileId: { examId: id, studentProfileId: student.id } },
    select: {
      status: true,
      reason: true,
      requestedAt: true,
      decidedAt: true,
      decisionNote: true,
      used: true,
    },
  });

  return NextResponse.json({ retake });
}
