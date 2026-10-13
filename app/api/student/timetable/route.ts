import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/session";
import { UserRole } from "@prisma/client";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await requireRole([UserRole.STUDENT]);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Get the student's class
  const student = await prisma.studentProfile.findFirst({
    where: { schoolId: user.schoolId, userId: user.id },
    include: { currentClass: true },
  });

  if (!student?.currentClass) {
    return NextResponse.json({ schedule: [], class: null });
  }

  // The full schedule for this student's class, ordered by day and start time.
  const slots = await prisma.timetableSlot.findMany({
    where: { schoolId: user.schoolId, classId: student.currentClassId },
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
    schedule: slots.map((slot) => ({
      id: slot.id,
      day: slot.dayOfWeek,
      start: slot.startTime,
      end: slot.endTime,
      subject: slot.subjectName,
      teacher: slot.teacherName,
      room: slot.room,
    })),
    class: student.currentClass.displayName,
  });
}
