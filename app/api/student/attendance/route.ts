import { NextRequest } from "next/server";
import { jsonNoStore } from "@/lib/requests";
import { getStudentAttendanceMonth, getStudentPortalProfile } from "@/lib/attendance-portal";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const context = await getStudentPortalProfile();
  if (!context) {
    return jsonNoStore(
      { error: "No live student profile is linked to this account yet." },
      { status: 404 },
    );
  }

  const attendance = await getStudentAttendanceMonth(
    context.profile.id,
    request.nextUrl.searchParams.get("month"),
  );

  return jsonNoStore({
    student: {
      id: context.profile.studentId,
      displayName: context.profile.displayName,
      className: context.profile.currentClass.displayName,
    },
    month: attendance.month,
    monthLabel: attendance.monthLabel,
    year: attendance.year,
    days: attendance.days,
    summary: attendance.summary,
  });
}
