import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { UserRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireRole, type SessionUser } from "@/lib/session";
import { getClientIp } from "@/lib/requests";

export const dynamic = "force-dynamic";

const STAFF_EXAM_ROLES = new Set<UserRole>([UserRole.TEACHER, UserRole.HOD]);
const OVERSIGHT_ROLES = new Set<UserRole>([UserRole.ADMIN, UserRole.DIRECTOR]);

async function resolveExamAndTeacher(user: SessionUser, examId: string) {
  const exam = await prisma.exam.findFirst({
    where: { id: examId, schoolId: user.schoolId },
    select: {
      id: true,
      title: true,
      subjectName: true,
      classId: true,
      teacherProfileId: true,
      classroom: { select: { displayName: true } },
    },
  });
  if (!exam) return null;

  if (STAFF_EXAM_ROLES.has(user.role)) {
    const profile = await prisma.teacherProfile.findFirst({
      where: { userId: user.id, schoolId: user.schoolId, isActive: true },
      select: { id: true },
    });
    if (!profile || exam.teacherProfileId !== profile.id) return null;
    return { profile, exam, oversight: false };
  }

  if (OVERSIGHT_ROLES.has(user.role)) {
    return { profile: null, exam, oversight: true };
  }

  return null;
}

/** GET /api/teacher/exams/[id]/retake — exam + its class students + who already has a retake. */
export async function GET(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const user = await requireRole([
    UserRole.TEACHER,
    UserRole.HOD,
    UserRole.ADMIN,
    UserRole.DIRECTOR,
  ]);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await context.params;
  const ctx = await resolveExamAndTeacher(user, id);
  if (!ctx) return NextResponse.json({ error: "Exam not found." }, { status: 404 });

  const [students, retakes] = await Promise.all([
    prisma.studentProfile.findMany({
      where: { schoolId: user.schoolId, currentClassId: ctx.exam.classId, isActive: true },
      select: { id: true, studentId: true, displayName: true },
      orderBy: { displayName: "asc" },
    }),
    prisma.examRetake.findMany({
      where: { examId: ctx.exam.id },
      select: { studentProfileId: true, used: true },
    }),
  ]);

  const retakeMap = new Map(retakes.map((r) => [r.studentProfileId, r.used]));
  return NextResponse.json({
    exam: {
      id: ctx.exam.id,
      title: ctx.exam.title,
      subjectName: ctx.exam.subjectName,
      className: ctx.exam.classroom.displayName,
    },
    students: students.map((s) => ({
      id: s.id,
      studentId: s.studentId,
      displayName: s.displayName,
      hasRetake: retakeMap.has(s.id),
      retakeUsed: retakeMap.get(s.id) === true,
    })),
  });
}

const grantSchema = z.object({
  /** Grant directly — the old behaviour, kept working. */
  studentProfileIds: z.array(z.string().min(1)).min(1).max(500).optional(),
  /**
   * Decide a request the student made. Exactly one of studentProfileIds /
   * decision is expected; a request carrying both is ambiguous and refused.
   */
  decision: z
    .object({
      studentProfileId: z.string().min(1),
      outcome: z.enum(["GRANT", "DECLINE"]),
      /** Why, for DECLINE. Required there, ignored for GRANT. */
      note: z.string().trim().max(300).optional(),
    })
    .optional(),
});

/** POST /api/teacher/exams/[id]/retake — grant a retake to one or many students (idempotent upsert). */
export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const user = await requireRole([
    UserRole.TEACHER,
    UserRole.HOD,
    UserRole.ADMIN,
    UserRole.DIRECTOR,
  ]);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await context.params;
  const ctx = await resolveExamAndTeacher(user, id);
  if (!ctx) return NextResponse.json({ error: "Exam not found." }, { status: 404 });

  let input: z.infer<typeof grantSchema>;
  try {
    input = grantSchema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  /**
   * Decide a student's request.
   *
   * Kept in this route rather than a new one: granting and answering are the
   * same authority on the same row, and splitting them would let the two paths
   * disagree about who may write `used`.
   */
  if (input.decision) {
    if (input.decision.outcome === "DECLINE" && !input.decision.note)
      return NextResponse.json(
        { error: "Say why, so the student knows what to do next." },
        { status: 400 },
      );

    const profile = await prisma.studentProfile.findFirst({
      where: {
        id: input.decision.studentProfileId,
        schoolId: user.schoolId,
        currentClassId: ctx.exam.classId,
        isActive: true,
      },
      select: { id: true },
    });
    if (!profile)
      return NextResponse.json({ error: "Student not in this exam's class." }, { status: 404 });

    const existing = await prisma.examRetake.findUnique({
      where: {
        examId_studentProfileId: {
          examId: ctx.exam.id,
          studentProfileId: profile.id,
        },
      },
    });
    if (!existing || existing.status !== "REQUESTED")
      return NextResponse.json(
        { error: "There is no pending request from this student for this paper." },
        { status: 409 },
      );

    const grant = input.decision.outcome === "GRANT";
    await prisma.examRetake.update({
      where: { id: existing.id },
      data: {
        status: grant ? "GRANTED" : "DECLINED",
        used: false,
        grantedByUserId: user.id,
        decidedByUserId: user.id,
        decidedAt: new Date(),
        decisionNote: grant ? (input.decision.note ?? null) : input.decision.note,
      },
    });

    await prisma.auditLog.create({
      data: {
        schoolId: user.schoolId,
        actorUserId: user.id,
        action: grant ? "EXAM_RETAKE_APPROVED" : "EXAM_RETAKE_DECLINED",
        entityType: "ExamRetake",
        entityId: existing.id,
        ipAddress: getClientIp(request),
        metadata: { examTitle: ctx.exam.title, note: input.decision.note ?? null } as never,
      },
    });

    return NextResponse.json({
      ok: true,
      status: grant ? "GRANTED" : "DECLINED",
      message: grant
        ? "Resit approved. The student can sit the paper now."
        : "Request declined. The student will see your reason.",
    });
  }

  if (!input.studentProfileIds?.length)
    return NextResponse.json(
      { error: "Send studentProfileIds to grant, or a decision to answer a request." },
      { status: 400 },
    );

  // Only grant retakes to active students in this exam's class and school.
  const eligible = await prisma.studentProfile.findMany({
    where: {
      id: { in: input.studentProfileIds },
      schoolId: user.schoolId,
      currentClassId: ctx.exam.classId,
      isActive: true,
    },
    select: { id: true },
  });
  const eligibleIds = new Set(eligible.map((s) => s.id));

  let granted = 0;
  for (const sid of input.studentProfileIds) {
    if (!eligibleIds.has(sid)) continue;
    await prisma.examRetake.upsert({
      where: { examId_studentProfileId: { examId: ctx.exam.id, studentProfileId: sid } },
      update: { used: false, status: "GRANTED", grantedByUserId: user.id }, // re-arm
      create: {
        examId: ctx.exam.id,
        studentProfileId: sid,
        grantedByUserId: user.id,
        status: "GRANTED",
      },
    });
    granted++;
  }

  await prisma.auditLog.create({
    data: {
      schoolId: user.schoolId,
      actorUserId: user.id,
      action: ctx.oversight ? "EXAM_RETAKE_GRANTED_BY_OVERSIGHT" : "EXAM_RETAKE_GRANTED",
      entityType: "Exam",
      entityId: ctx.exam.id,
      ipAddress: getClientIp(request),
      metadata: { examTitle: ctx.exam.title, count: granted, oversight: ctx.oversight } as never,
    },
  });

  return NextResponse.json({ granted, message: `Retake enabled for ${granted} student(s).` });
}
