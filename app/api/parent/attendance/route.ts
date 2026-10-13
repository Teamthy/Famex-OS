import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { jsonNoStore } from "@/lib/requests";
import { getParentPortalProfile, getStudentAttendanceMonth } from "@/lib/attendance-portal";

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
      month: null,
      monthLabel: null,
      year: null,
      days: [],
      summary: { present: 0, absent: 0, late: 0, total: 0, attendanceRate: 0 },
      recentAlerts: [],
    });
  }

  const requestedStudentId = request.nextUrl.searchParams.get("studentId");
  const selectedChild = children.find((child) => child.id === requestedStudentId) || children[0];
  const attendance = await getStudentAttendanceMonth(
    selectedChild.id,
    request.nextUrl.searchParams.get("month"),
  );

  const recentAlerts = await prisma.attendanceAlertJob.findMany({
    where: {
      schoolId: context.user.schoolId,
      studentProfileId: selectedChild.id,
      OR: [{ parentProfileId: context.profile.id }, { parentProfileId: null }],
    },
    orderBy: { createdAt: "desc" },
    take: 6,
    select: {
      id: true,
      channel: true,
      status: true,
      messagePreview: true,
      createdAt: true,
    },
  });

  return jsonNoStore({
    parent: { displayName: context.profile.displayName },
    children,
    selectedChild,
    month: attendance.month,
    monthLabel: attendance.monthLabel,
    year: attendance.year,
    days: attendance.days,
    summary: attendance.summary,
    recentAlerts: recentAlerts.map((alert) => ({
      id: alert.id,
      channel: alert.channel,
      status: alert.status,
      messagePreview: alert.messagePreview,
      createdAt: alert.createdAt.toISOString(),
    })),
  });
}
