import { AttendanceStatus } from "@prisma/client";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getTeacherContext } from "@/lib/teacher-context";

export const dynamic = "force-dynamic";

export async function GET() {
  const ctx = await getTeacherContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const [attendanceSessions, examStats, gradebooks] = await Promise.all([
    prisma.attendanceSession.findMany({
      take: 200,
      where: {
        teacherProfileId: ctx.profile.id,
        sessionDate: { gte: thirtyDaysAgo },
      },
      include: {
        classroom: { select: { displayName: true } },
        entries: { select: { status: true } },
      },
    }),
    prisma.exam.findMany({
      take: 200,
      where: { teacherProfileId: ctx.profile.id },
      include: {
        classroom: { select: { displayName: true } },
        attempts: { select: { totalScore: true } },
      },
    }),
    prisma.subjectGradebook.findMany({
      take: 200,
      where: { teacherProfileId: ctx.profile.id },
      include: {
        classroom: { select: { displayName: true } },
        entries: { select: { total: true } },
      },
    }),
  ]);

  // Attendance analytics
  let totalPresent = 0;
  let totalEntries = 0;
  const byClass: Record<string, { present: number; total: number }> = {};

  for (const session of attendanceSessions) {
    const present = session.entries.filter((e) => e.status === AttendanceStatus.PRESENT).length;
    const total = session.entries.length;
    totalPresent += present;
    totalEntries += total;

    const name = session.classroom.displayName;
    if (!byClass[name]) byClass[name] = { present: 0, total: 0 };
    byClass[name].present += present;
    byClass[name].total += total;
  }

  // Exam analytics
  const examByClass = examStats.map((e) => {
    const maxMarks = Math.max(1, e.totalMarks);
    const avgScore =
      e.attempts.length > 0
        ? Math.round(
            e.attempts.reduce((sum, a) => sum + (a.totalScore / maxMarks) * 100, 0) /
              e.attempts.length,
          )
        : null;

    return {
      title: e.title,
      className: e.classroom.displayName,
      attempts: e.attempts.length,
      avgScore,
    };
  });

  return NextResponse.json({
    teacher: {
      displayName: ctx.profile.displayName,
      formClassName: ctx.formClassName,
    },
    attendance: {
      overallRate: totalEntries > 0 ? Math.round((totalPresent / totalEntries) * 100) : null,
      totalSessions: attendanceSessions.length,
      byClass: Object.entries(byClass).map(([name, data]) => ({
        className: name,
        rate: data.total > 0 ? Math.round((data.present / data.total) * 100) : null,
        sessions: data.total,
      })),
    },
    exams: examByClass,
    gradebooks: gradebooks.map((g) => ({
      subject: g.subjectName,
      className: g.classroom.displayName,
      entryCount: g.entries.length,
      avgScore:
        g.entries.length > 0
          ? Math.round(g.entries.reduce((sum, e) => sum + (e.total || 0), 0) / g.entries.length)
          : null,
    })),
  });
}
