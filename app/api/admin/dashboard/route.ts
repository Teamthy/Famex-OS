import { ApplicationStatus, AttendanceStatus, ReportCardStatus, UserRole } from "@prisma/client";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAcademicAlerts } from "@/lib/academic-alerts";
import { requireRole } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await requireRole([
    UserRole.ADMIN,
    UserRole.DIRECTOR,
    UserRole.COORDINATOR,
    UserRole.BURSAR,
  ]);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const schoolId = user.schoolId;
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const [
    studentCount,
    teacherCount,
    parentCount,
    classCount,
    pendingApplications,
    pendingCorrections,
    draftReports,
    releasedReports,
    openInvoices,
    todayEntries,
    itEnrollmentCount,
    recentActivity,
  ] = await Promise.all([
    prisma.studentProfile.count({ where: { schoolId, isActive: true } }),
    prisma.teacherProfile.count({ where: { schoolId, isActive: true } }),
    prisma.parentProfile.count({ where: { schoolId, isActive: true } }),
    prisma.schoolClass.count({ where: { schoolId, isActive: true } }),
    prisma.admissionApplication.count({
      where: { schoolId, status: ApplicationStatus.PENDING_REVIEW },
    }),
    prisma.attendanceCorrectionRequest.count({ where: { schoolId, status: "PENDING" } }),
    prisma.reportCard.count({ where: { schoolId, status: ReportCardStatus.DRAFT } }),
    prisma.reportCard.count({ where: { schoolId, status: ReportCardStatus.RELEASED } }),
    prisma.feeInvoice.aggregate({
      where: { schoolId, status: { in: ["UNPAID", "PARTIAL", "OVERDUE"] } },
      _sum: { balanceDue: true },
      _count: true,
    }),
    prisma.attendanceEntry.findMany({
      where: { session: { schoolId, sessionDate: { gte: startOfDay } } },
      select: { status: true },
    }),
    prisma.itEnrollment.count({ where: { schoolId, status: "ACTIVE" } }),
    prisma.auditLog.findMany({
      where: { schoolId },
      orderBy: { createdAt: "desc" },
      take: 10,
      include: { actor: { select: { name: true, role: true } } },
    }),
  ]);

  const presentToday = todayEntries.filter(
    (entry) => entry.status === AttendanceStatus.PRESENT,
  ).length;

  // Calendar drift warnings — an un-advanced term produces no error anywhere,
  // so the dashboard is the only place it can surface.
  const academicAlerts = await getAcademicAlerts(schoolId);

  return NextResponse.json({
    academicAlerts,
    admin: { name: user.name, role: user.role },
    stats: {
      studentCount,
      teacherCount,
      parentCount,
      classCount,
      pendingApplications,
      pendingCorrections,
      draftReports,
      releasedReports,
      outstandingFees: openInvoices._sum.balanceDue || 0,
      openInvoiceCount: openInvoices._count,
      attendanceMarkedToday: todayEntries.length,
      presentToday,
      attendanceRateToday: todayEntries.length
        ? Math.round((presentToday / todayEntries.length) * 100)
        : null,
      itEnrollments: itEnrollmentCount,
    },
    activity: recentActivity.map((entry) => ({
      action: entry.action,
      entityType: entry.entityType,
      actorName: entry.actor?.name || "System",
      actorRole: entry.actor?.role || null,
      at: entry.createdAt.toISOString(),
    })),
  });
}
