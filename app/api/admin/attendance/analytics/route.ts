import {
  AlertChannel,
  AlertDeliveryStatus,
  AttendanceCorrectionStatus,
  AttendanceStatus,
  UserRole,
} from "@prisma/client";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { jsonNoStore } from "@/lib/requests";
import { parseMonth } from "@/lib/attendance-portal";
import { requireRole } from "@/lib/session";

export const runtime = "nodejs";

const allowedRoles = [UserRole.ADMIN, UserRole.DIRECTOR, UserRole.COORDINATOR];

export async function GET(request: NextRequest) {
  const user = await requireRole(allowedRoles);
  if (!user) {
    return jsonNoStore({ error: "Unauthorized" }, { status: 401 });
  }

  const classId = request.nextUrl.searchParams.get("classId")?.trim() || null;
  const month = parseMonth(request.nextUrl.searchParams.get("month"));

  const classes = await prisma.schoolClass.findMany({
    where: {
      schoolId: user.schoolId,
      isActive: true,
    },
    orderBy: [{ level: "asc" }, { arm: "asc" }],
    select: {
      id: true,
      displayName: true,
      level: true,
      arm: true,
      students: {
        where: { isActive: true },
        select: { id: true },
      },
    },
  });

  const validClassId = classId && classes.some((item) => item.id === classId) ? classId : null;

  const [sessions, correctionRequests] = await Promise.all([
    prisma.attendanceSession.findMany({
      where: {
        schoolId: user.schoolId,
        ...(validClassId ? { classId: validClassId } : {}),
        sessionDate: {
          gte: month.from,
          lt: month.to,
        },
      },
      orderBy: [{ sessionDate: "asc" }, { createdAt: "asc" }],
      select: {
        id: true,
        sessionDate: true,
        periodKey: true,
        isLocked: true,
        submittedAt: true,
        classroom: {
          select: {
            id: true,
            displayName: true,
          },
        },
        teacherProfile: {
          select: {
            displayName: true,
          },
        },
        entries: {
          select: {
            status: true,
            studentProfile: {
              select: {
                id: true,
                studentId: true,
                displayName: true,
              },
            },
          },
        },
        alertJobs: {
          select: {
            channel: true,
            status: true,
          },
        },
      },
    }),
    prisma.attendanceCorrectionRequest.findMany({
      where: {
        schoolId: user.schoolId,
        ...(validClassId ? { attendanceSession: { classId: validClassId } } : {}),
      },
      orderBy: [{ createdAt: "desc" }],
      take: 8,
      select: {
        id: true,
        status: true,
        reason: true,
        createdAt: true,
        reviewedAt: true,
        resolutionNote: true,
        attendanceSession: {
          select: {
            sessionDate: true,
            classroom: {
              select: {
                displayName: true,
              },
            },
          },
        },
        teacherProfile: {
          select: {
            displayName: true,
          },
        },
      },
    }),
  ]);

  const allEntries = sessions.flatMap((session) => session.entries);
  const presentCount = allEntries.filter(
    (entry) => entry.status === AttendanceStatus.PRESENT,
  ).length;
  const absentCount = allEntries.filter((entry) => entry.status === AttendanceStatus.ABSENT).length;
  const lateCount = allEntries.filter((entry) => entry.status === AttendanceStatus.LATE).length;
  const totalEntryCount = allEntries.length;
  const lockedSessions = sessions.filter((session) => session.isLocked).length;
  const queuedAlerts = sessions
    .flatMap((session) => session.alertJobs)
    .filter((job) => job.status === AlertDeliveryStatus.PENDING).length;
  const sentAlerts = sessions
    .flatMap((session) => session.alertJobs)
    .filter((job) => job.status === AlertDeliveryStatus.SENT).length;
  const failedAlerts = sessions
    .flatMap((session) => session.alertJobs)
    .filter((job) => job.status === AlertDeliveryStatus.FAILED).length;
  const skippedAlerts = sessions
    .flatMap((session) => session.alertJobs)
    .filter((job) => job.status === AlertDeliveryStatus.SKIPPED).length;
  const activeStudentCount = validClassId
    ? classes.find((item) => item.id === validClassId)?.students.length || 0
    : classes.reduce((sum, item) => sum + item.students.length, 0);

  const classStats = classes
    .filter((item) => !validClassId || item.id === validClassId)
    .map((item) => {
      const classSessions = sessions.filter((session) => session.classroom.id === item.id);
      const classEntries = classSessions.flatMap((session) => session.entries);
      const classPresent = classEntries.filter(
        (entry) => entry.status === AttendanceStatus.PRESENT,
      ).length;
      const classAbsent = classEntries.filter(
        (entry) => entry.status === AttendanceStatus.ABSENT,
      ).length;
      const classLate = classEntries.filter(
        (entry) => entry.status === AttendanceStatus.LATE,
      ).length;
      const classTotal = classEntries.length;
      const lastSession = classSessions[classSessions.length - 1];

      return {
        id: item.id,
        displayName: item.displayName,
        activeStudents: item.students.length,
        sessions: classSessions.length,
        present: classPresent,
        absent: classAbsent,
        late: classLate,
        attendanceRate: classTotal ? Math.round((classPresent / classTotal) * 100) : 0,
        lockedSessions: classSessions.filter((session) => session.isLocked).length,
        lastSessionDate: lastSession ? lastSession.sessionDate.toISOString() : null,
      };
    })
    .sort(
      (left, right) =>
        right.attendanceRate - left.attendanceRate ||
        left.displayName.localeCompare(right.displayName),
    );

  const dailyTrendMap = new Map<
    string,
    { date: string; present: number; absent: number; late: number; total: number; sessions: number }
  >();

  for (const session of sessions) {
    const key = session.sessionDate.toISOString().slice(0, 10);
    const current = dailyTrendMap.get(key) || {
      date: key,
      present: 0,
      absent: 0,
      late: 0,
      total: 0,
      sessions: 0,
    };

    current.sessions += 1;
    for (const entry of session.entries) {
      if (entry.status === AttendanceStatus.PRESENT) current.present += 1;
      if (entry.status === AttendanceStatus.ABSENT) current.absent += 1;
      if (entry.status === AttendanceStatus.LATE) current.late += 1;
      current.total += 1;
    }
    dailyTrendMap.set(key, current);
  }

  const dailyTrend = [...dailyTrendMap.values()]
    .sort((left, right) => left.date.localeCompare(right.date))
    .map((item) => ({
      ...item,
      attendanceRate: item.total ? Math.round((item.present / item.total) * 100) : 0,
    }));

  const studentConcernMap = new Map<
    string,
    { studentId: string; displayName: string; absent: number; late: number; total: number }
  >();

  for (const entry of allEntries) {
    const key = entry.studentProfile.id;
    const current = studentConcernMap.get(key) || {
      studentId: entry.studentProfile.studentId,
      displayName: entry.studentProfile.displayName,
      absent: 0,
      late: 0,
      total: 0,
    };

    current.total += 1;
    if (entry.status === AttendanceStatus.ABSENT) current.absent += 1;
    if (entry.status === AttendanceStatus.LATE) current.late += 1;
    studentConcernMap.set(key, current);
  }

  const studentsOfConcern = [...studentConcernMap.values()]
    .map((item) => ({
      ...item,
      concernScore: item.absent * 2 + item.late,
      attendanceRate: item.total
        ? Math.round(((item.total - item.absent - item.late) / item.total) * 100)
        : 0,
    }))
    .filter((item) => item.concernScore > 0)
    .sort(
      (left, right) =>
        right.concernScore - left.concernScore || left.displayName.localeCompare(right.displayName),
    )
    .slice(0, 8);

  const alertBreakdownByChannel = [AlertChannel.SMS, AlertChannel.WHATSAPP, AlertChannel.EMAIL].map(
    (channel) => ({
      channel,
      total: sessions
        .flatMap((session) => session.alertJobs)
        .filter((job) => job.channel === channel).length,
      pending: sessions
        .flatMap((session) => session.alertJobs)
        .filter((job) => job.channel === channel && job.status === AlertDeliveryStatus.PENDING)
        .length,
    }),
  );

  const alertBreakdownByStatus = [
    AlertDeliveryStatus.PENDING,
    AlertDeliveryStatus.SENT,
    AlertDeliveryStatus.FAILED,
    AlertDeliveryStatus.SKIPPED,
  ].map((status) => ({
    status,
    total: sessions.flatMap((session) => session.alertJobs).filter((job) => job.status === status)
      .length,
  }));

  const recentSessions = [...sessions]
    .sort((left, right) => right.sessionDate.getTime() - left.sessionDate.getTime())
    .slice(0, 6)
    .map((session) => {
      const present = session.entries.filter(
        (entry) => entry.status === AttendanceStatus.PRESENT,
      ).length;
      const absent = session.entries.filter(
        (entry) => entry.status === AttendanceStatus.ABSENT,
      ).length;
      const late = session.entries.filter((entry) => entry.status === AttendanceStatus.LATE).length;
      const total = session.entries.length;
      return {
        id: session.id,
        date: session.sessionDate.toISOString(),
        className: session.classroom.displayName,
        teacherName: session.teacherProfile.displayName,
        periodKey: session.periodKey,
        isLocked: session.isLocked,
        submittedAt: session.submittedAt?.toISOString() || null,
        present,
        absent,
        late,
        total,
        attendanceRate: total ? Math.round((present / total) * 100) : 0,
      };
    });

  const pendingCorrections = correctionRequests.filter(
    (request) => request.status === AttendanceCorrectionStatus.PENDING,
  ).length;

  return jsonNoStore({
    filters: {
      month: month.key,
      monthLabel: month.monthLabel,
      year: month.year,
      selectedClassId: validClassId,
    },
    availableClasses: classes.map((item) => ({
      id: item.id,
      displayName: item.displayName,
      level: item.level,
      arm: item.arm,
      activeStudents: item.students.length,
    })),
    summary: {
      sessionsTracked: sessions.length,
      classesCovered: new Set(sessions.map((session) => session.classroom.id)).size,
      activeStudents: activeStudentCount,
      presentCount,
      absentCount,
      lateCount,
      totalEntryCount,
      attendanceRate: totalEntryCount ? Math.round((presentCount / totalEntryCount) * 100) : 0,
      lockedSessions,
      queuedAlerts,
      sentAlerts,
      failedAlerts,
      skippedAlerts,
      pendingCorrections,
    },
    classStats,
    dailyTrend,
    studentsOfConcern,
    alertBreakdown: {
      byChannel: alertBreakdownByChannel,
      byStatus: alertBreakdownByStatus,
    },
    recentCorrections: correctionRequests.map((request) => ({
      id: request.id,
      status: request.status,
      reason: request.reason,
      resolutionNote: request.resolutionNote,
      createdAt: request.createdAt.toISOString(),
      reviewedAt: request.reviewedAt?.toISOString() || null,
      className: request.attendanceSession.classroom.displayName,
      sessionDate: request.attendanceSession.sessionDate.toISOString(),
      teacherName: request.teacherProfile.displayName,
    })),
    recentSessions,
  });
}
