import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getTeacherContext } from "@/lib/teacher-context";

export const dynamic = "force-dynamic";

/**
 * The timetable for a teacher's form class.
 *
 * This route used to answer `{ schedule: [] }` behind a comment claiming the
 * timetable schema model did not exist yet — but TimetableSlot had long since
 * been added, and the student and parent timetables both read it. A teacher
 * opening their class timetable saw an empty week, which reads as "no
 * timetable was entered" rather than "this screen was never finished".
 *
 * A teacher can hold more than one class assignment; `formClassId` is the one
 * they are form teacher of. Returning that class's schedule is what the screen
 * is for. A teacher with no form class gets an empty list and the class name is
 * null — a real state, not an error.
 */
export async function GET() {
  const ctx = await getTeacherContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!ctx.formClassId) {
    return NextResponse.json({ className: null, schedule: [] });
  }

  const slots = await prisma.timetableSlot.findMany({
    where: { schoolId: ctx.user.schoolId, classId: ctx.formClassId },
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
    className: ctx.formClassName,
    // Same shape as the student and parent timetables, so one component can
    // render all three.
    schedule: slots.map((slot) => ({
      id: slot.id,
      day: slot.dayOfWeek,
      start: slot.startTime,
      end: slot.endTime,
      subject: slot.subjectName,
      teacher: slot.teacherName,
      room: slot.room,
    })),
  });
}
