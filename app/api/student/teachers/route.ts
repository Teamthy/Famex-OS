import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/session";
import { UserRole } from "@prisma/client";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await requireRole([UserRole.STUDENT]);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const student = await prisma.studentProfile.findFirst({
    where: { schoolId: user.schoolId, userId: user.id },
    include: { currentClass: true },
  });

  if (!student?.currentClass) {
    return NextResponse.json({ teachers: [] });
  }

  // Get teachers assigned to the student's class
  const assignments = await prisma.teacherClassAssignment.findMany({
    take: 100,
    where: { classId: student.currentClass.id, isActive: true },
    include: {
      teacherProfile: { select: { id: true, displayName: true, roleLabel: true, photoUrl: true } },
    },
  });

  return NextResponse.json({
    className: student.currentClass.displayName,
    teachers: assignments.map((a) => ({
      id: a.teacherProfile.id,
      name: a.teacherProfile.displayName,
      role: a.teacherProfile.roleLabel || a.role,
      subject: a.subjectName || (a.role === "FORM_TEACHER" ? "Class Teacher" : ""),
      photoUrl: a.teacherProfile.photoUrl,
    })),
  });
}
