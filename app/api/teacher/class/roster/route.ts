import { NextResponse } from "next/server";
import { getTeacherContext, getFormClassStudents } from "@/lib/teacher-context";

export const dynamic = "force-dynamic";

export async function GET() {
  const ctx = await getTeacherContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const students = await getFormClassStudents(ctx);

  return NextResponse.json({
    className: ctx.formClassName,
    classId: ctx.formClassId,
    studentCount: students.length,
    students: students.map((s) => ({
      id: s.id,
      studentId: s.studentId,
      displayName: s.displayName,
      firstName: s.firstName,
      lastName: s.lastName,
      gender: s.gender,
      guardianName: s.guardianName,
      guardianPhone: s.guardianPhone,
    })),
  });
}
