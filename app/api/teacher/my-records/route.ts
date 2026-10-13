import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getTeacherContext } from "@/lib/teacher-context";

export const dynamic = "force-dynamic";

export async function GET() {
  const ctx = await getTeacherContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [attendanceRecords, auditLogs] = await Promise.all([
    prisma.attendanceSession.findMany({
      where: { teacherProfileId: ctx.profile.id },
      orderBy: { sessionDate: "desc" },
      take: 20,
      include: {
        classroom: { select: { displayName: true } },
        entries: { select: { status: true } },
      },
    }),
    prisma.auditLog.findMany({
      where: { actorUserId: ctx.user.id },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
  ]);

  return NextResponse.json({
    teacher: {
      displayName: ctx.profile.displayName,
      email: ctx.user.email,
    },
    attendanceHistory: attendanceRecords.map((s) => ({
      date: s.sessionDate.toISOString(),
      className: s.classroom.displayName,
      present: s.entries.filter((e) => e.status === "PRESENT").length,
      absent: s.entries.filter((e) => e.status === "ABSENT").length,
      late: s.entries.filter((e) => e.status === "LATE").length,
      total: s.entries.length,
      locked: s.isLocked,
    })),
    recentActions: auditLogs.map((a) => ({
      action: a.action,
      entityType: a.entityType,
      at: a.createdAt.toISOString(),
    })),
  });
}
