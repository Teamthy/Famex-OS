import { AlertChannel, NotificationKind, ReportCardStatus, UserRole } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getClientIp } from "@/lib/requests";
import { requireRole } from "@/lib/session";
import { PAGE_LIMITS, getPagination, paginatedResponse } from "@/lib/pagination";
import { createInAppNotification, queueNotificationJob } from "@/lib/notifications";

const allowedRoles = [UserRole.ADMIN, UserRole.DIRECTOR, UserRole.COORDINATOR];
const updateSchema = z.object({
  reportCardId: z.string().trim().min(1),
  status: z.nativeEnum(ReportCardStatus),
});

/**
 * Report-card overview — summary plus a page of reports.
 *
 * This used to load every report card the school had ever generated, each with
 * its student, class and full subject list, then compute the summary with JS
 * filters and a reduce. A report card exists per student per term, so the cost
 * grew every term and the payload was dominated by subject rows nobody had
 * scrolled to yet.
 *
 * Totals now come from SQL aggregate/groupBy and the table is paged, matching
 * the fees overview. Same numbers, bounded work.
 */
export async function GET(request: NextRequest) {
  const user = await requireRole(allowedRoles);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { page, pageSize, skip, take } = getPagination(request, PAGE_LIMITS.STANDARD);

  const [byStatus, average, total, reports] = await Promise.all([
    prisma.reportCard.groupBy({
      by: ["status"],
      where: { schoolId: user.schoolId },
      _count: { _all: true },
    }),
    prisma.reportCard.aggregate({
      where: { schoolId: user.schoolId },
      _avg: { overallAverage: true },
    }),
    prisma.reportCard.count({ where: { schoolId: user.schoolId } }),
    prisma.reportCard.findMany({
      where: { schoolId: user.schoolId },
      orderBy: [{ generatedAt: "desc" }, { createdAt: "desc" }],
      skip,
      take,
      include: {
        studentProfile: { include: { currentClass: true } },
        subjects: { orderBy: { sortOrder: "asc" } },
      },
    }),
  ]);

  const countFor = (status: ReportCardStatus) =>
    byStatus.find((row) => row.status === status)?._count._all ?? 0;

  return NextResponse.json({
    summary: {
      totalReports: total,
      releasedReports: countFor(ReportCardStatus.RELEASED),
      draftReports: countFor(ReportCardStatus.DRAFT),
      averageScore: Math.round(average._avg.overallAverage ?? 0),
    },
    pagination: paginatedResponse([], total, page, pageSize),
    reports: reports.map((report) => ({
      id: report.id,
      reportNumber: report.reportNumber,
      sessionLabel: report.sessionLabel,
      termLabel: report.termLabel,
      classNameSnapshot: report.classNameSnapshot,
      status: report.status,
      overallTotal: report.overallTotal,
      overallAverage: report.overallAverage,
      overallGrade: report.overallGrade,
      classPosition: report.classPosition,
      attendancePresent: report.attendancePresent,
      attendanceTotal: report.attendanceTotal,
      classTeacherRemark: report.classTeacherRemark,
      directorRemark: report.directorRemark,
      nextResumption: report.nextResumption,
      feeBalance: report.feeBalance,
      generatedAt: report.generatedAt.toISOString(),
      releasedAt: report.releasedAt?.toISOString() || null,
      student: {
        studentId: report.studentProfile.studentId,
        displayName: report.studentProfile.displayName,
        className: report.studentProfile.currentClass.displayName,
      },
      subjects: report.subjects,
    })),
  });
}

export async function PATCH(request: NextRequest) {
  const user = await requireRole(allowedRoles);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const payload = updateSchema.parse(await request.json());
    const ipAddress = getClientIp(request);
    const updated = await prisma.$transaction(async (tx) => {
      const owned = await tx.reportCard.findFirst({
        where: { id: payload.reportCardId, schoolId: user.schoolId },
        select: { id: true },
      });
      if (!owned) {
        throw new Error("REPORT_CARD_NOT_FOUND_FOR_SCHOOL");
      }

      const report = await tx.reportCard.update({
        where: { id: owned.id },
        data: {
          status: payload.status,
          releasedAt: payload.status === ReportCardStatus.RELEASED ? new Date() : null,
        },
        include: {
          studentProfile: { include: { currentClass: true } },
          subjects: { orderBy: { sortOrder: "asc" } },
        },
      });

      await tx.auditLog.create({
        data: {
          schoolId: user.schoolId,
          actorUserId: user.id,
          action:
            payload.status === ReportCardStatus.RELEASED
              ? "REPORT_CARD_RELEASED"
              : "REPORT_CARD_REVERTED_TO_DRAFT",
          entityType: "ReportCard",
          entityId: report.id,
          ipAddress,
          metadata: {
            reportNumber: report.reportNumber,
            studentId: report.studentProfile.studentId,
          },
        },
      });

      return report;
    });

    if (payload.status === ReportCardStatus.RELEASED) {
      const student = await prisma.studentProfile.findUnique({
        where: { id: updated.studentProfileId },
        select: {
          userId: true,
          displayName: true,
          guardianName: true,
          guardianEmail: true,
          parentLinks: {
            where: { isPrimary: true },
            take: 1,
            select: { parentProfile: { select: { userId: true, displayName: true } } },
          },
        },
      });

      const message = `The ${updated.termLabel} (${updated.sessionLabel}) report card for ${student?.displayName || "your child"} has been released. Overall: ${updated.overallAverage}% (${updated.overallGrade}). Sign in to the EduPortal to view and download it.`;

      // Resolved before queueing so the email honours the same "Results"
      // preference the push does.
      const parentUserId = student?.parentLinks[0]?.parentProfile?.userId;

      if (student?.guardianEmail) {
        await queueNotificationJob({
          schoolId: user.schoolId,
          kind: NotificationKind.REPORT_RELEASED,
          channel: AlertChannel.EMAIL,
          subject: "Report card released — Ykay College",
          body: message,
          recipientName: student.guardianName,
          recipientEmail: student.guardianEmail,
          recipientUserId: parentUserId ?? null,
          dedupeKey: `report:${updated.id}:email`,
          metadata: { reportCardId: updated.id, reportNumber: updated.reportNumber },
        });
      }
      if (parentUserId) {
        await createInAppNotification({
          schoolId: user.schoolId,
          userId: parentUserId,
          kind: NotificationKind.REPORT_RELEASED,
          title: "Report Card Released",
          body: message,
          link: "/parent/report-cards",
        });
      }
      if (student?.userId) {
        await createInAppNotification({
          schoolId: user.schoolId,
          userId: student.userId,
          kind: NotificationKind.REPORT_RELEASED,
          title: "Your Report Card Is Ready",
          body: `Your ${updated.termLabel} report card has been released. Overall: ${updated.overallAverage}% (${updated.overallGrade}).`,
          link: "/student/report-cards",
        });
      }
    }

    return NextResponse.json({
      report: {
        id: updated.id,
        reportNumber: updated.reportNumber,
        sessionLabel: updated.sessionLabel,
        termLabel: updated.termLabel,
        classNameSnapshot: updated.classNameSnapshot,
        status: updated.status,
        overallTotal: updated.overallTotal,
        overallAverage: updated.overallAverage,
        overallGrade: updated.overallGrade,
        classPosition: updated.classPosition,
        attendancePresent: updated.attendancePresent,
        attendanceTotal: updated.attendanceTotal,
        classTeacherRemark: updated.classTeacherRemark,
        directorRemark: updated.directorRemark,
        nextResumption: updated.nextResumption,
        feeBalance: updated.feeBalance,
        generatedAt: updated.generatedAt.toISOString(),
        releasedAt: updated.releasedAt?.toISOString() || null,
        student: {
          studentId: updated.studentProfile.studentId,
          displayName: updated.studentProfile.displayName,
          className: updated.studentProfile.currentClass.displayName,
        },
        subjects: updated.subjects,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    return NextResponse.json(
      {
        error:
          message === "REPORT_CARD_NOT_FOUND_FOR_SCHOOL"
            ? "Report card not found."
            : "Unable to update report card status.",
      },
      { status: message === "REPORT_CARD_NOT_FOUND_FOR_SCHOOL" ? 404 : 400 },
    );
  }
}
