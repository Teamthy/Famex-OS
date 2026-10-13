import { NextResponse } from "next/server";
import { getTeacherContext } from "@/lib/teacher-context";

export const dynamic = "force-dynamic";

export async function GET() {
  const ctx = await getTeacherContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Timetable model not yet implemented — return empty with class info
  return NextResponse.json({
    className: ctx.formClassName,
    schedule: [],
  });
}
