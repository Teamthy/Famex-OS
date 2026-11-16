import { StaffAttendanceEventType, StudentClockEventType } from "@prisma/client";
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
import { requireModule } from "@/lib/module-guard";
import { getSchoolGeofence } from "@/lib/staff-attendance";
import { checkGeofence } from "@/lib/geofence";
import { isDailyAttendanceQr, verifyDailyAttendanceQr } from "@/lib/attendance-daily-qr";
import { recordStudentDailyQrClock } from "@/lib/student-attendance";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const scanSchema = z.object({
  badgeCode: z.string().trim().min(4).max(512),
  eventType: z.enum(["CHECK_IN", "CHECK_OUT", "AUTO"]).default("AUTO"),
  note: z.string().trim().max(300).optional(),
  scannerGps: z
    .object({
      latitude: z.coerce.number().min(-90).max(90),
      longitude: z.coerce.number().min(-180).max(180),
      accuracyM: z.coerce.number().nonnegative().optional().nullable(),
    })
    .optional()
    .nullable(),
});

export async function GET(request: NextRequest) {
  const user = await getStaffAttendanceAdmin();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const moduleCheck = await requireModule("staff_attendance");
  if (!moduleCheck.ok) return moduleCheck.response;

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

  // Surface the geofence so the scanner UI can attach its own GPS for
  // off-site flagging.
  const fence = await getSchoolGeofence(user.schoolId);

  return NextResponse.json({
    date: dayKey,
    lateCutoff: lateCutoffHm(),
    fence: fence
      ? {
          enabled: true,
          center: { latitude: fence.center.latitude, longitude: fence.center.longitude },
          radiusM: fence.radiusM,
        }
      : { enabled: false },
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
  const moduleCheck = await requireModule("staff_attendance");
  if (!moduleCheck.ok) return moduleCheck.response;

  let input: z.infer<typeof scanSchema>;
  try {
    input = scanSchema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: "Invalid scan payload." }, { status: 400 });
  }

  try {
    let result:
      | Awaited<ReturnType<typeof recordStaffScan>>
      | Awaited<ReturnType<typeof recordStudentDailyQrClock>>;
    let dailyTicket = false;
    const ticket = isDailyAttendanceQr(input.badgeCode)
      ? verifyDailyAttendanceQr(input.badgeCode)
      : null;

    if (isDailyAttendanceQr(input.badgeCode)) {
      if (!ticket || ticket.schoolId !== user.schoolId || ticket.workDate !== workDateKey()) {
        return NextResponse.json(
          {
            error:
              "This daily attendance QR is invalid, belongs to another school, or has expired.",
          },
          { status: 410 },
        );
      }
      dailyTicket = true;
      if (ticket.audience === "STAFF") {
        const profile = await prisma.teacherProfile.findFirst({
          where: { id: ticket.profileId, schoolId: user.schoolId, isActive: true },
          select: { id: true, badgeCode: true },
        });
        if (!profile)
          return NextResponse.json({ error: "Staff profile not found." }, { status: 404 });
        const badge = profile.badgeCode ? profile : await ensureTeacherBadge(profile.id);
        if (!badge?.badgeCode)
          return NextResponse.json({ error: "Staff badge is not available." }, { status: 404 });
        const last = await prisma.staffAttendanceEvent.findFirst({
          where: {
            schoolId: user.schoolId,
            teacherProfileId: profile.id,
            workDate: new Date(`${ticket.workDate}T12:00:00.000Z`),
          },
          orderBy: { scannedAt: "desc" },
        });
        const eventType =
          input.eventType === "AUTO"
            ? last?.eventType === StaffAttendanceEventType.CHECK_IN
              ? StaffAttendanceEventType.CHECK_OUT
              : StaffAttendanceEventType.CHECK_IN
            : input.eventType === "CHECK_OUT"
              ? StaffAttendanceEventType.CHECK_OUT
              : StaffAttendanceEventType.CHECK_IN;
        result = await recordStaffScan({
          schoolId: user.schoolId,
          badgeCode: badge.badgeCode,
          eventType,
          scannerUserId: user.id,
          source: "DAILY_QR",
          note: input.note || null,
        });
      } else {
        const workDate = new Date(`${ticket.workDate}T12:00:00.000Z`);
        const last = await prisma.studentClockEvent.findFirst({
          where: {
            schoolId: user.schoolId,
            studentProfileId: ticket.profileId,
            workDate,
          },
          orderBy: { clockedAt: "desc" },
        });
        const eventType =
          input.eventType === "AUTO"
            ? last?.eventType === StudentClockEventType.CHECK_IN
              ? StudentClockEventType.CHECK_OUT
              : StudentClockEventType.CHECK_IN
            : input.eventType === "CHECK_OUT"
              ? StudentClockEventType.CHECK_OUT
              : StudentClockEventType.CHECK_IN;
        result = await recordStudentDailyQrClock({
          schoolId: user.schoolId,
          studentProfileId: ticket.profileId,
          eventType,
          scannerUserId: user.id,
        });
      }
    } else {
      // Legacy printed staff badges remain supported during the transition;
      // new account screens issue date-bound daily tickets for staff/students.
      let eventType: StaffAttendanceEventType = StaffAttendanceEventType.CHECK_IN;
      if (input.eventType === "CHECK_OUT") eventType = StaffAttendanceEventType.CHECK_OUT;
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
      result = await recordStaffScan({
        schoolId: user.schoolId,
        badgeCode: input.badgeCode,
        eventType,
        scannerUserId: user.id,
        source: "ADMIN_QR",
        note: input.note || null,
      });
    }

    // Scanner-device GPS is an audit signal only; event geo* columns capture
    // the staff/student member's own GPS reading, never the operator's phone.
    let scannerFlag: "OUTSIDE_FENCE" | "WEAK_FIX" | null = null;
    if (input.scannerGps) {
      const fence = await getSchoolGeofence(user.schoolId);
      if (fence) {
        const c = checkGeofence(
          {
            latitude: input.scannerGps.latitude,
            longitude: input.scannerGps.longitude,
            accuracyM: input.scannerGps.accuracyM,
          },
          fence,
        );
        if (!c.withinFence) scannerFlag = "OUTSIDE_FENCE";
      }
      if (input.scannerGps.accuracyM && input.scannerGps.accuracyM > 65) scannerFlag = "WEAK_FIX";
    }

    const personName = "staff" in result ? result.staff.displayName : result.student.displayName;
    const entityType = "staff" in result ? "StaffAttendanceEvent" : "StudentClockEvent";
    await prisma.auditLog
      .create({
        data: {
          schoolId: user.schoolId,
          actorUserId: user.id,
          action: dailyTicket ? "DAILY_ATTENDANCE_QR_SCAN" : "STAFF_QR_SCAN",
          entityType,
          entityId: result.event.id,
          ipAddress: getClientIp(request),
          metadata: {
            eventType: result.event.eventType,
            personName,
            audience: "staff" in result ? "STAFF" : "STUDENT",
            scannerFlag,
            scannerGps: input.scannerGps || null,
          },
        },
      })
      .catch(() => undefined);

    return NextResponse.json({ ...result, scannerFlag }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Scan failed." },
      { status: 409 },
    );
  }
}
