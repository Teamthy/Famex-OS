import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getTeacherContext } from "@/lib/teacher-context";

export const dynamic = "force-dynamic";

export async function GET() {
  const ctx = await getTeacherContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!ctx.formClassId) {
    return NextResponse.json({ className: null, parents: [] });
  }

  const links = await prisma.parentStudentLink.findMany({
    take: 100,
    where: {
      studentProfile: { currentClassId: ctx.formClassId, isActive: true },
    },
    include: {
      parentProfile: { select: { id: true, displayName: true, phone: true } },
      studentProfile: { select: { id: true, displayName: true, studentId: true } },
    },
    orderBy: { studentProfile: { displayName: "asc" } },
  });

  const parents = links.map((link) => ({
    id: link.parentProfile.id,
    parentName: link.parentProfile.displayName,
    phone: link.parentProfile.phone,
    relationship: link.relationship,
    isPrimary: link.isPrimary,
    studentName: link.studentProfile.displayName,
    studentId: link.studentProfile.studentId,
  }));

  return NextResponse.json({
    className: ctx.formClassName,
    parents,
  });
}
