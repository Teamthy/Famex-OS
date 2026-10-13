import { StaffAttendanceEventType } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  ensureTeacherBadge,
  getStaffAttendanceAdmin,
  lateCutoffHm,
  parseBadgeInput,
  recordStaffScan,
  workDateKey,
} from "@/lib/staff-attendance";
import { prisma } from "@/lib/prisma";
import { getClientIp } from "@/lib/requests";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const scanSchema = z.object({
  badgeCode: z.string().trim().min(4).max(200),
  eventType: z.enum(["CHECK_IN", "CHECK_OUT", "AUTO"]).default("AUTO"),
  note: z.string().trim().max(300).optional(),
});

export async function GET(request: NextRequest) {
  const user = await getStaffAttendanceAdmin();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const dateParam = request.nextUrl.searchParams.get("date")?.trim();
  const dayKey = dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam) ? dateParam : workDateKey();
  const workDate = new Date(`${dayKey}T12:00:00.000Z`);

  const [events, teachers] = await Promise.all([
    prisma.staffAttendanceEvent.findMany({
      take: 500,
      where: { schoolId: user.schoolId, workDate },
      orderBy: { scannedAt: "asc" },
      include: {
        teacherProfile: {
          select: {
            id: true,
            displayName: true,
            badgeCode: true,
            user: { select: { email: true, role: true } },
          },
        },
      },
    }),
    prisma.teacherProfile.findMany({
      take: 500,
      where: { schoolId: user.schoolId, isActive: true },
      orderBy: { displayName: "asc" },
      select: {
        id: true,
        displayName: true,
        badgeCode: true,
        roleLabel: true,
        user: { select: { email: true, role: true } },
      },
    }),
  ]);

  // Ensure badges exist for listing/QR generation
  for (const t of teachers) {
    if (!t.badgeCode) {
      try {
        await ensureTeacherBadge(t.id);
      } catch {
        /* ignore */
      }
    }
  }

  const refreshed = await prisma.teacherProfile.findMany({
    take: 500,
    where: { schoolId: user.schoolId, isActive: true },
    orderBy: { displayName: "asc" },
    select: {
      id: true,
      displayName: true,
      badgeCode: true,
      roleLabel: true,
      user: { select: { email: true, role: true } },
    },
  });

  type Row = {
    teacherProfileId: string;
    displayName: string;
    email: string;
    role: string;
    badgeCode: string | null;
    checkInAt: string | null;
    checkOutAt: string | null;
    isLate: boolean;
    lateMinutes: number;
    status: "ABSENT" | "IN" | "OUT";
  };

  const byTeacher = new Map<string, Row>();
  for (const t of refreshed) {
    byTeacher.set(t.id, {
      teacherProfileId: t.id,
      displayName: t.displayName,
      email: t.user.email,
      role: t.user.role,
      badgeCode: t.badgeCode,
      checkInAt: null,
      checkOutAt: null,
      isLate: false,
      lateMinutes: 0,
      status: "ABSENT",
    });
  }

  for (const ev of events) {
    const row = byTeacher.get(ev.teacherProfileId);
    if (!row) continue;
    if (ev.eventType === StaffAttendanceEventType.CHECK_IN) {
      if (!row.checkInAt) {
        row.checkInAt = ev.scannedAt.toISOString();
        row.isLate = ev.isLate;
        row.lateMinutes = ev.lateMinutes;
      }
      row.status = "IN";
    } else {
      row.checkOutAt = ev.scannedAt.toISOString();
      row.status = "OUT";
    }
  }

  const rows = [...byTeacher.values()].sort((a, b) => a.displayName.localeCompare(b.displayName));
  const present = rows.filter((r) => r.status !== "ABSENT").length;
  const late = rows.filter((r) => r.isLate).length;
  const stillIn = rows.filter((r) => r.status === "IN").length;

  return NextResponse.json({
    date: dayKey,
    lateCutoff: lateCutoffHm(),
    summary: {
      staffTotal: rows.length,
      present,
      absent: rows.length - present,
      late,
      stillIn,
    },
    rows,
    events: events.map((ev) => ({
      id: ev.id,
      eventType: ev.eventType,
      scannedAt: ev.scannedAt.toISOString(),
      isLate: ev.isLate,
      lateMinutes: ev.lateMinutes,
      source: ev.source,
      staff: {
        id: ev.teacherProfile.id,
        displayName: ev.teacherProfile.displayName,
        email: ev.teacherProfile.user.email,
      },
    })),
  });
}

export async function POST(request: NextRequest) {
  const user = await getStaffAttendanceAdmin();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let input: z.infer<typeof scanSchema>;
  try {
    input = scanSchema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: "Invalid scan payload." }, { status: 400 });
  }

  try {
    let eventType: StaffAttendanceEventType = StaffAttendanceEventType.CHECK_IN;
    if (input.eventType === "CHECK_OUT") eventType = StaffAttendanceEventType.CHECK_OUT;
    if (input.eventType === "CHECK_IN") eventType = StaffAttendanceEventType.CHECK_IN;
    if (input.eventType === "AUTO") {
      const parsed = parseBadgeInput(input.badgeCode);
      if (!parsed) return NextResponse.json({ error: "Invalid badge." }, { status: 400 });
      const teacher = await prisma.teacherProfile.findFirst({
        where: { schoolId: user.schoolId, badgeCode: parsed, isActive: true },
        select: { id: true },
      });
      if (!teacher)
        return NextResponse.json({ error: "Staff badge not recognized." }, { status: 404 });
      const workDate = new Date(`${workDateKey()}T12:00:00.000Z`);
      const last = await prisma.staffAttendanceEvent.findFirst({
        where: { schoolId: user.schoolId, teacherProfileId: teacher.id, workDate },
        orderBy: { scannedAt: "desc" },
      });
      eventType =
        last?.eventType === StaffAttendanceEventType.CHECK_IN
          ? StaffAttendanceEventType.CHECK_OUT
          : StaffAttendanceEventType.CHECK_IN;
    }

    const result = await recordStaffScan({
      schoolId: user.schoolId,
      badgeCode: input.badgeCode,
      eventType,
      scannerUserId: user.id,
      source: "ADMIN_QR",
      note: input.note || null,
    });

    await prisma.auditLog
      .create({
        data: {
          schoolId: user.schoolId,
          actorUserId: user.id,
          action: "STAFF_QR_SCAN",
          entityType: "StaffAttendanceEvent",
          entityId: result.event.id,
          ipAddress: getClientIp(request),
          metadata: { eventType: result.event.eventType, staff: result.staff.displayName },
        },
      })
      .catch(() => undefined);

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Scan failed." },
      { status: 409 },
    );
  }
}
