import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getClientIp } from "@/lib/requests";
import { requireRole } from "@/lib/session";
import { UserRole } from "@prisma/client";

export const dynamic = "force-dynamic";

const ADMIN_ROLES = [UserRole.ADMIN, UserRole.DIRECTOR, UserRole.COORDINATOR, UserRole.SUPER_ADMIN];

const slotSchema = z.object({
  classId: z.string().min(1),
  dayOfWeek: z.enum(["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY"]),
  startTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use 24h time, e.g. 08:00"),
  endTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use 24h time, e.g. 08:45"),
  subjectName: z.string().trim().min(1).max(80),
  teacherName: z.string().trim().max(80).nullable().optional(),
  room: z.string().trim().max(80).nullable().optional(),
});

export async function GET(request: NextRequest) {
  const user = await requireRole(ADMIN_ROLES);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const classId = request.nextUrl.searchParams.get("classId")?.trim();
  if (!classId) {
    // List classes (with slot counts) when no class is selected.
    const classes = await prisma.schoolClass.findMany({
      where: { schoolId: user.schoolId, isActive: true },
      orderBy: { displayName: "asc" },
      include: { _count: { select: { timetableSlots: true } } },
    });
    return NextResponse.json({
      classes: classes.map((c) => ({
        id: c.id,
        displayName: c.displayName,
        level: c.level,
        arm: c.arm,
        slotCount: c._count.timetableSlots,
      })),
    });
  }

  const slots = await prisma.timetableSlot.findMany({
    where: { schoolId: user.schoolId, classId },
    orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }],
    select: {
      id: true,
      dayOfWeek: true,
      startTime: true,
      endTime: true,
      subjectName: true,
      teacherName: true,
      room: true,
    },
  });

  return NextResponse.json({
    slots: slots.map((s) => ({
      id: s.id,
      day: s.dayOfWeek,
      start: s.startTime,
      end: s.endTime,
      subject: s.subjectName,
      teacher: s.teacherName,
      room: s.room,
    })),
  });
}

export async function POST(request: NextRequest) {
  const user = await requireRole(ADMIN_ROLES);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const ip = getClientIp(request);
  let input: z.infer<typeof slotSchema>;
  try {
    input = slotSchema.parse(await request.json());
  } catch (err) {
    const msg =
      err instanceof z.ZodError ? err.issues[0]?.message || "Invalid slot." : "Invalid slot.";
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  // The class must belong to this school (tenant scoping).
  const cls = await prisma.schoolClass.findFirst({
    where: { id: input.classId, schoolId: user.schoolId },
  });
  if (!cls) return NextResponse.json({ error: "Class not found." }, { status: 404 });

  // Reject inverted times.
  if (input.startTime >= input.endTime) {
    return NextResponse.json({ error: "End time must be after start time." }, { status: 400 });
  }

  const slot = await prisma.timetableSlot.create({
    data: {
      schoolId: user.schoolId,
      classId: input.classId,
      dayOfWeek: input.dayOfWeek,
      startTime: input.startTime,
      endTime: input.endTime,
      subjectName: input.subjectName,
      teacherName: input.teacherName ?? null,
      room: input.room ?? null,
    },
  });

  await prisma.auditLog.create({
    data: {
      schoolId: user.schoolId,
      actorUserId: user.id,
      action: "TIMETABLE_SLOT_CREATED",
      entityType: "TimetableSlot",
      entityId: slot.id,
      ipAddress: ip,
    },
  });

  return NextResponse.json({ slot: { id: slot.id } }, { status: 201 });
}

export async function DELETE(request: NextRequest) {
  const user = await requireRole(ADMIN_ROLES);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const id = request.nextUrl.searchParams.get("id")?.trim();
  if (!id) return NextResponse.json({ error: "Slot id is required." }, { status: 400 });

  // Tenant-scoped delete: only delete a slot that belongs to this school's class.
  const slot = await prisma.timetableSlot.findFirst({
    where: { id, schoolId: user.schoolId },
    select: { id: true },
  });
  if (!slot) return NextResponse.json({ error: "Slot not found." }, { status: 404 });

  await prisma.timetableSlot.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
