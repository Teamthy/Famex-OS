import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getTeacherContext } from "@/lib/teacher-context";

export const dynamic = "force-dynamic";

export async function GET() {
  const ctx = await getTeacherContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [gradebooks, exams, attendanceSessions] = await Promise.all([
    prisma.subjectGradebook.findMany({
      take: 100,
      where: { teacherProfileId: ctx.profile.id },
      include: {
        classroom: { select: { displayName: true } },
        entries: { select: { total: true } },
      },
    }),
    prisma.exam.findMany({
      take: 100,
      where: { teacherProfileId: ctx.profile.id },
      include: {
        classroom: { select: { displayName: true } },
        attempts: { select: { totalScore: true } },
      },
    }),
    prisma.attendanceSession.count({
      where: { teacherProfileId: ctx.profile.id, submittedAt: { not: null } },
    }),
  ]);

  const classPerformance = gradebooks.map((g) => {
    const scores = g.entries.map((e) => e.total || 0);
    const avg =
      scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null;
    return {
      subject: g.subjectName,
      className: g.classroom.displayName,
      studentCount: scores.length,
      average: avg,
      passRate:
        avg !== null
          ? Math.round(
              (scores.filter((s: any) => s >= 40).length / Math.max(1, scores.length)) * 100,
            )
          : null,
    };
  });

  return NextResponse.json({
    teacher: { displayName: ctx.profile.displayName },
    stats: {
      totalClasses: ctx.profile.classAssignments.length,
      totalGradebooks: gradebooks.length,
      totalExams: exams.length,
      attendanceSessionsSubmitted: attendanceSessions,
    },
    classPerformance,
  });
}
