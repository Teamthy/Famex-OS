import { UserRole } from "@prisma/client";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await requireRole([
    UserRole.ADMIN,
    UserRole.DIRECTOR,
    UserRole.COORDINATOR,
    UserRole.SUPER_ADMIN,
  ]);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const students = await prisma.studentProfile.findMany({
    take: 500,
    where: { schoolId: user.schoolId, isActive: false },
    orderBy: { updatedAt: "desc" },
    include: { currentClass: { select: { displayName: true } } },
  });

  return NextResponse.json({
    students: students.map((student) => ({
      id: student.id,
      studentId: student.studentId,
      displayName: student.displayName,
      className: student.currentClass.displayName,
      guardianName: student.guardianName,
      archivedAt: student.updatedAt.toISOString(),
    })),
  });
}
