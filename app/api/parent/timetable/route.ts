import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { jsonNoStore } from "@/lib/requests";
import { getParentPortalProfile } from "@/lib/attendance-portal";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const context = await getParentPortalProfile();
  if (!context) {
    return jsonNoStore(
      { error: "No live parent profile is linked to this account yet." },
      { status: 404 },
    );
  }

  const children = context.profile.studentLinks.map((link) => ({
    id: link.studentProfile.id,
    studentId: link.studentProfile.studentId,
    displayName: link.studentProfile.displayName,
    className: link.studentProfile.currentClass.displayName,
    relationship: link.relationship,
    isPrimary: link.isPrimary,
  }));

  if (!children.length) {
    return jsonNoStore({
      parent: { displayName: context.profile.displayName },
      children: [],
      selectedChild: null,
      schedule: [],
    });
  }

  const requestedStudentId = request.nextUrl.searchParams.get("studentId");
  const selectedChild = children.find((child) => child.id === requestedStudentId) || children[0];

  // The selected child's current class -> timetable slots.
  const student = await prisma.studentProfile.findFirst({
    where: { id: selectedChild.id, schoolId: context.user.schoolId },
    include: { currentClass: true },
  });

  const slots = student?.currentClassId
    ? await prisma.timetableSlot.findMany({
        where: { schoolId: context.user.schoolId, classId: student.currentClassId },
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
      })
    : [];

  return jsonNoStore({
    parent: { displayName: context.profile.displayName },
    children,
    selectedChild: {
      id: selectedChild.id,
      displayName: selectedChild.displayName,
      className: selectedChild.className,
    },
    className: student?.currentClass?.displayName ?? selectedChild.className,
    schedule: slots.map((s) => ({
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
