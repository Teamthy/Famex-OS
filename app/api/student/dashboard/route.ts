import { AttendanceStatus, ReportCardStatus, UserRole } from "@prisma/client";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await requireRole([UserRole.STUDENT]);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const profile = await prisma.studentProfile.findFirst({
    where: { schoolId: user.schoolId, userId: user.id, isActive: true },
    include: {
      currentClass: { select: { displayName: true } },
      attendanceEntries: {
        orderBy: { markedAt: "desc" },
        take: 60,
        select: { status: true, markedAt: true, session: { select: { sessionDate: true } } },
      },
      reportCards: {
        where: { status: ReportCardStatus.RELEASED },
        orderBy: { generatedAt: "desc" },
        take: 1,
        select: {
          reportNumber: true,
          termLabel: true,
          sessionLabel: true,
          overallAverage: true,
          overallGrade: true,
          classPosition: true,
          releasedAt: true,
        },
      },
      feeInvoices: {
        where: { status: { in: ["UNPAID", "PARTIAL", "OVERDUE"] } },
        select: { balanceDue: true },
      },
    },
  });

  if (!profile) {
    return NextResponse.json(
      { error: "No student profile is linked to this account. Contact the school administrator." },
      { status: 404 },
    );
  }

  const totalMarked = profile.attendanceEntries.length;
  const presentCount = profile.attendanceEntries.filter(
    (entry) => entry.status === AttendanceStatus.PRESENT,
  ).length;
  const attendanceRate = totalMarked ? Math.round((presentCount / totalMarked) * 100) : null;
  const latestReport = profile.reportCards[0] || null;
  const feeBalance = profile.feeInvoices.reduce((sum, invoice) => sum + invoice.balanceDue, 0);

  const activity = await prisma.auditLog.findMany({
    where: { schoolId: user.schoolId, actorUserId: user.id },
    orderBy: { createdAt: "desc" },
    take: 6,
    select: { action: true, entityType: true, createdAt: true },
  });

  const recentAttendance = profile.attendanceEntries.slice(0, 7).map((entry) => ({
    date: entry.session.sessionDate.toISOString(),
    status: entry.status,
  }));

  // AUD-F5: the portal footer used to hardcode YKAY College's contact on
  // every tenant. Expose this school's public contact so the dashboard can
  // render the tenant's own details (a missing email is "" — the footer hides
  // the row rather than showing another school's address).
  const school = await prisma.school.findUnique({
    where: { id: user.schoolId },
    select: { address: true, phone: true, email: true },
  });

  return NextResponse.json({
    student: {
      displayName: profile.displayName,
      studentId: profile.studentId,
      className: profile.currentClass.displayName,
    },
    schoolContact: school
      ? { address: school.address, phone: school.phone, email: school.email ?? "" }
      : null,
    stats: {
      attendanceRate,
      averageScore: latestReport?.overallAverage ?? null,
      overallGrade: latestReport?.overallGrade ?? null,
      feeBalance,
    },
    latestReport: latestReport
      ? {
          reportNumber: latestReport.reportNumber,
          termLabel: latestReport.termLabel,
          sessionLabel: latestReport.sessionLabel,
          overallAverage: latestReport.overallAverage,
          overallGrade: latestReport.overallGrade,
          classPosition: latestReport.classPosition,
          releasedAt: latestReport.releasedAt?.toISOString() || null,
        }
      : null,
    recentAttendance,
    activity: activity.map((entry) => ({
      action: entry.action,
      entityType: entry.entityType,
      at: entry.createdAt.toISOString(),
    })),
  });
}
