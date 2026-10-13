import { BehaviorRecordType, NotificationKind } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getTeacherContext } from "@/lib/teacher-context";
import { reachableStudentIds } from "@/lib/messaging";
import { notificationTitle, summarise } from "@/lib/behavior";

export const dynamic = "force-dynamic";

/**
 * GET /api/teacher/class/behavior
 *
 * Roster plus each student's real behaviour history. This previously returned
 * `records: []` with a comment naming a "future BehaviorRecord model", while
 * the web page kept everything in useState — so notes vanished on refresh.
 *
 * Scope: a teacher sees students in the classes they are assigned to, reusing
 * reachableStudentIds() so this rule lives in exactly one place and cannot
 * drift away from the messaging permission model.
 */
export async function GET(request: NextRequest) {
  const ctx = await getTeacherContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const studentIds = await reachableStudentIds(ctx.user);
  if (studentIds.length === 0) {
    return NextResponse.json({
      className: ctx.formClassName,
      students: [],
      summary: emptySummary(),
    });
  }

  const studentFilter = request.nextUrl.searchParams.get("studentId")?.trim();
  const scoped = studentFilter && studentIds.includes(studentFilter) ? [studentFilter] : studentIds;

  const [students, records] = await Promise.all([
    prisma.studentProfile.findMany({
      where: { id: { in: scoped }, schoolId: ctx.user.schoolId, isActive: true },
      orderBy: { displayName: "asc" },
      take: 500,
      select: {
        id: true,
        studentId: true,
        displayName: true,
        currentClass: { select: { displayName: true } },
      },
    }),
    prisma.behaviorRecord.findMany({
      where: { schoolId: ctx.user.schoolId, studentProfileId: { in: scoped } },
      orderBy: { occurredAt: "desc" },
      take: 400,
      select: {
        id: true,
        studentProfileId: true,
        type: true,
        category: true,
        description: true,
        occurredAt: true,
        parentNotifiedAt: true,
        teacherProfile: { select: { displayName: true } },
      },
    }),
  ]);

  const byStudent = new Map<string, typeof records>();
  for (const r of records) {
    if (!byStudent.has(r.studentProfileId)) byStudent.set(r.studentProfileId, []);
    byStudent.get(r.studentProfileId)!.push(r);
  }

  const shape = (r: (typeof records)[number]) => ({
    id: r.id,
    type: r.type,
    category: r.category,
    description: r.description,
    at: r.occurredAt.toISOString(),
    parentNotified: r.parentNotifiedAt !== null,
    recordedBy: r.teacherProfile?.displayName ?? "Staff",
  });

  return NextResponse.json({
    className: ctx.formClassName,
    students: students.map((s) => ({
      id: s.id,
      studentId: s.studentId,
      displayName: s.displayName,
      className: s.currentClass?.displayName ?? null,
      records: (byStudent.get(s.id) ?? []).map(shape),
    })),
    recent: records.slice(0, 50).map((r) => ({
      ...shape(r),
      studentProfileId: r.studentProfileId,
      studentName: students.find((s) => s.id === r.studentProfileId)?.displayName ?? "Student",
    })),
    summary: summarise(records),
  });
}

function emptySummary() {
  return { total: 0, commendations: 0, warnings: 0, notes: 0 };
}

const createSchema = z.object({
  studentProfileId: z.string().trim().min(1),
  type: z.nativeEnum(BehaviorRecordType),
  category: z.string().trim().max(80).optional(),
  description: z.string().trim().min(2).max(2000),
  notifyParent: z.boolean().optional(),
});

/** POST /api/teacher/class/behavior — log a record against a student. */
export async function POST(request: NextRequest) {
  const ctx = await getTeacherContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let input: z.infer<typeof createSchema>;
  try {
    input = createSchema.parse(await request.json());
  } catch {
    return NextResponse.json(
      { error: "Choose a student, a type and write a description." },
      { status: 400 },
    );
  }

  // A teacher may only record against a student they actually teach.
  const allowed = await reachableStudentIds(ctx.user);
  if (!allowed.includes(input.studentProfileId)) {
    return NextResponse.json(
      { error: "You cannot record behaviour for this student." },
      { status: 403 },
    );
  }

  const record = await prisma.behaviorRecord.create({
    data: {
      schoolId: ctx.user.schoolId,
      studentProfileId: input.studentProfileId,
      teacherProfileId: ctx.profile.id,
      type: input.type,
      category: input.category || null,
      description: input.description,
      parentNotifiedAt: input.notifyParent ? new Date() : null,
    },
    select: { id: true, occurredAt: true },
  });

  // Notifying the guardian is part of the same intent as writing the note, so
  // it happens here rather than needing a second deliberate action.
  if (input.notifyParent) {
    const student = await prisma.studentProfile.findFirst({
      where: { id: input.studentProfileId, schoolId: ctx.user.schoolId },
      select: {
        displayName: true,
        parentLinks: { select: { parentProfile: { select: { userId: true } } } },
      },
    });
    const parentUserIds = (student?.parentLinks ?? [])
      .map((l) => l.parentProfile?.userId)
      .filter((v): v is string => !!v);

    if (parentUserIds.length > 0) {
      await prisma.userNotification.createMany({
        data: parentUserIds.map((userId) => ({
          schoolId: ctx.user.schoolId,
          userId,
          kind: NotificationKind.SYSTEM,
          title: notificationTitle(input.type, student?.displayName),
          body: input.description,
        })),
      });
    }
  }

  await prisma.auditLog.create({
    data: {
      schoolId: ctx.user.schoolId,
      actorUserId: ctx.user.id,
      action: "BEHAVIOR_RECORD_CREATED",
      entityType: "BehaviorRecord",
      entityId: record.id,
      metadata: { type: input.type, studentProfileId: input.studentProfileId },
    },
  });

  return NextResponse.json({ record: { id: record.id } }, { status: 201 });
}

/** DELETE /api/teacher/class/behavior?id= — remove a record you authored. */
export async function DELETE(request: NextRequest) {
  const ctx = await getTeacherContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const id = request.nextUrl.searchParams.get("id")?.trim();
  if (!id) return NextResponse.json({ error: "Record id required." }, { status: 400 });

  // Deliberately narrow: you may only delete your OWN record. A teacher should
  // not be able to erase a colleague's warning about a student.
  const existing = await prisma.behaviorRecord.findFirst({
    where: { id, schoolId: ctx.user.schoolId, teacherProfileId: ctx.profile.id },
    select: { id: true, type: true },
  });
  if (!existing) {
    return NextResponse.json(
      { error: "Record not found, or it was written by someone else." },
      { status: 404 },
    );
  }

  await prisma.behaviorRecord.delete({ where: { id } });
  await prisma.auditLog.create({
    data: {
      schoolId: ctx.user.schoolId,
      actorUserId: ctx.user.id,
      action: "BEHAVIOR_RECORD_DELETED",
      entityType: "BehaviorRecord",
      entityId: id,
      metadata: { type: existing.type },
    },
  });

  return NextResponse.json({ ok: true });
}
