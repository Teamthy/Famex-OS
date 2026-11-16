import { DailyAttendanceStatus } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getStaffAttendanceAdmin, workDateKey } from "@/lib/staff-attendance";
import { attendanceWorkDate, lockDailyAttendanceDay } from "@/lib/daily-attendance-session";
import { requireModule } from "@/lib/module-guard";
import { prisma } from "@/lib/prisma";
import { getClientIp } from "@/lib/requests";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const actionSchema = z.object({ action: z.enum(["OPEN", "CLOSE"]) });

export async function GET() {
  const user = await getStaffAttendanceAdmin();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const moduleCheck = await requireModule("staff_attendance");
  if (!moduleCheck.ok) return moduleCheck.response;

  const dayKey = workDateKey();
  const session = await prisma.dailyAttendanceSession.findUnique({
    where: { schoolId_workDate: { schoolId: user.schoolId, workDate: attendanceWorkDate(dayKey) } },
    select: {
      status: true,
      openedAt: true,
      openedByUserId: true,
      closedAt: true,
      closedByUserId: true,
    },
  });
  return NextResponse.json({
    date: dayKey,
    status: session?.status ?? DailyAttendanceStatus.CLOSED,
    openedAt: session?.openedAt?.toISOString() ?? null,
    openedByUserId: session?.openedByUserId ?? null,
    closedAt: session?.closedAt?.toISOString() ?? null,
    closedByUserId: session?.closedByUserId ?? null,
  });
}

export async function POST(request: NextRequest) {
  const user = await getStaffAttendanceAdmin();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const moduleCheck = await requireModule("staff_attendance");
  if (!moduleCheck.ok) return moduleCheck.response;

  const parsed = actionSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success)
    return NextResponse.json({ error: "Choose open or close attendance." }, { status: 400 });

  const dayKey = workDateKey();
  const workDate = attendanceWorkDate(dayKey);
  const action = parsed.data.action;

  try {
    const result = await prisma.$transaction(async (tx) => {
      await lockDailyAttendanceDay(tx, user.schoolId, dayKey);
      const current = await tx.dailyAttendanceSession.findUnique({
        where: { schoolId_workDate: { schoolId: user.schoolId, workDate } },
      });

      if (action === "OPEN") {
        if (current?.status === DailyAttendanceStatus.OPEN)
          return { session: current, changed: false };
        const now = new Date();
        const session = current
          ? await tx.dailyAttendanceSession.update({
              where: { id: current.id },
              data: {
                status: DailyAttendanceStatus.OPEN,
                openedAt: now,
                openedByUserId: user.id,
                closedAt: null,
                closedByUserId: null,
              },
            })
          : await tx.dailyAttendanceSession.create({
              data: {
                schoolId: user.schoolId,
                workDate,
                status: DailyAttendanceStatus.OPEN,
                openedAt: now,
                openedByUserId: user.id,
              },
            });
        await tx.auditLog.create({
          data: {
            schoolId: user.schoolId,
            actorUserId: user.id,
            ipAddress: getClientIp(request),
            action: "DAILY_ATTENDANCE_OPENED",
            entityType: "DailyAttendanceSession",
            entityId: session.id,
            metadata: { workDate: dayKey },
          },
        });
        return { session, changed: true };
      }

      if (!current) throw new Error("Attendance has not been opened for today.");
      if (current.status === DailyAttendanceStatus.CLOSED)
        return { session: current, changed: false };
      const session = await tx.dailyAttendanceSession.update({
        where: { id: current.id },
        data: {
          status: DailyAttendanceStatus.CLOSED,
          closedAt: new Date(),
          closedByUserId: user.id,
        },
      });
      await tx.auditLog.create({
        data: {
          schoolId: user.schoolId,
          actorUserId: user.id,
          ipAddress: getClientIp(request),
          action: "DAILY_ATTENDANCE_CLOSED",
          entityType: "DailyAttendanceSession",
          entityId: session.id,
          metadata: { workDate: dayKey },
        },
      });
      return { session, changed: true };
    });

    return NextResponse.json({
      date: dayKey,
      status: result.session.status,
      openedAt: result.session.openedAt.toISOString(),
      closedAt: result.session.closedAt?.toISOString() ?? null,
      changed: result.changed,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to update attendance status." },
      {
        status:
          error instanceof Error && error.message === "Attendance has not been opened for today."
            ? 409
            : 500,
      },
    );
  }
}
