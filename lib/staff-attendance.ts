import { createHash, randomBytes } from "crypto";
import { Prisma, StaffAttendanceEventType, UserRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/session";
import {
  checkGeofence,
  clampRadiusM,
  decimalToNumber,
  DEFAULT_RADIUS_M,
  isValidPoint,
  MAX_ACCEPTED_ACCURACY_M,
  type Geofence,
} from "@/lib/geofence";
import { sendSms } from "@/lib/sms";

export const STAFF_ATTENDANCE_ADMIN_ROLES = [
  UserRole.ADMIN,
  UserRole.DIRECTOR,
  UserRole.COORDINATOR,
];

export const STAFF_SELF_ROLES = [
  UserRole.TEACHER,
  UserRole.HOD,
  UserRole.ADMIN,
  UserRole.DIRECTOR,
  UserRole.COORDINATOR,
  UserRole.BURSAR,
];

/** School reporting timezone for "today" and late cut-off. */
export const SCHOOL_TZ = process.env.SCHOOL_TIMEZONE || "Africa/Lagos";

/** HH:mm 24h local school time — arrivals after this are late. */
export function lateCutoffHm() {
  return process.env.STAFF_LATE_CUTOFF || "08:00";
}

export function workDateKey(date = new Date(), timeZone = SCHOOL_TZ) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date); // YYYY-MM-DD
}

export function localHourMinute(date = new Date(), timeZone = SCHOOL_TZ) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const hour = Number(parts.find((p) => p.type === "hour")?.value || 0);
  const minute = Number(parts.find((p) => p.type === "minute")?.value || 0);
  return { hour, minute, minutes: hour * 60 + minute };
}

export function computeLateness(scannedAt = new Date()) {
  const cutoff = lateCutoffHm();
  const [ch, cm] = cutoff.split(":").map((x) => Number(x));
  const cutoffMinutes = (Number.isFinite(ch) ? ch : 8) * 60 + (Number.isFinite(cm) ? cm : 0);
  const { minutes } = localHourMinute(scannedAt);
  const lateMinutes = Math.max(0, minutes - cutoffMinutes);
  return { isLate: lateMinutes > 0, lateMinutes, cutoff };
}

export function newBadgeCode() {
  return `YKST-${randomBytes(5).toString("hex").toUpperCase()}`;
}

export function badgePayload(badgeCode: string, schoolId: string) {
  return JSON.stringify({
    v: 1,
    kind: "STAFF_BADGE",
    schoolId,
    code: badgeCode,
  });
}

export function parseBadgeInput(raw: string): string | null {
  const text = raw.trim();
  if (!text) return null;
  if (text.startsWith("YKST-")) return text.toUpperCase();
  try {
    const parsed = JSON.parse(text) as { kind?: string; code?: string };
    if (parsed.kind === "STAFF_BADGE" && parsed.code) return String(parsed.code).toUpperCase();
  } catch {
    /* plain code */
  }
  // allow bare codes
  if (/^[A-Z0-9-]{6,40}$/i.test(text)) return text.toUpperCase();
  return null;
}

export async function ensureTeacherBadge(teacherProfileId: string) {
  const existing = await prisma.teacherProfile.findUnique({
    where: { id: teacherProfileId },
    select: { id: true, badgeCode: true, schoolId: true, displayName: true },
  });
  if (!existing) return null;
  if (existing.badgeCode) return existing;

  for (let i = 0; i < 6; i += 1) {
    const code = newBadgeCode();
    try {
      return await prisma.teacherProfile.update({
        where: { id: teacherProfileId },
        data: { badgeCode: code },
        select: { id: true, badgeCode: true, schoolId: true, displayName: true },
      });
    } catch {
      /* unique collision retry */
    }
  }
  throw new Error("Could not allocate a staff badge code.");
}

export async function getStaffAttendanceAdmin() {
  return requireRole(STAFF_ATTENDANCE_ADMIN_ROLES);
}

export async function recordStaffScan(input: {
  schoolId: string;
  badgeCode: string;
  eventType: StaffAttendanceEventType;
  scannerUserId?: string | null;
  source?: string;
  note?: string | null;
  force?: boolean;
}) {
  const code = parseBadgeInput(input.badgeCode);
  if (!code) throw new Error("Invalid staff badge / QR payload.");

  const teacher = await prisma.teacherProfile.findFirst({
    where: { schoolId: input.schoolId, badgeCode: code, isActive: true },
    select: {
      id: true,
      displayName: true,
      badgeCode: true,
      user: { select: { email: true, role: true } },
    },
  });
  if (!teacher) throw new Error("Staff badge not recognized for this school.");

  const now = new Date();
  const workDate = new Date(`${workDateKey(now)}T12:00:00.000Z`);
  const todayKey = workDateKey(now);

  const todays = await prisma.staffAttendanceEvent.findMany({
    where: {
      schoolId: input.schoolId,
      teacherProfileId: teacher.id,
      workDate,
    },
    orderBy: { scannedAt: "asc" },
  });

  const last = todays[todays.length - 1] || null;

  if (input.eventType === StaffAttendanceEventType.CHECK_IN) {
    if (last?.eventType === StaffAttendanceEventType.CHECK_IN && !input.force) {
      throw new Error(`${teacher.displayName} is already checked in today. Check out first.`);
    }
  } else {
    if (!last || last.eventType === StaffAttendanceEventType.CHECK_OUT) {
      throw new Error(`${teacher.displayName} has no open check-in to close today.`);
    }
  }

  const late =
    input.eventType === StaffAttendanceEventType.CHECK_IN
      ? computeLateness(now)
      : { isLate: false, lateMinutes: 0, cutoff: lateCutoffHm() };

  const event = await prisma.staffAttendanceEvent.create({
    data: {
      schoolId: input.schoolId,
      teacherProfileId: teacher.id,
      eventType: input.eventType,
      scannedAt: now,
      isLate: late.isLate,
      lateMinutes: late.lateMinutes,
      source: input.source || "QR",
      scannerUserId: input.scannerUserId || null,
      note: input.note || null,
      workDate,
    },
  });

  await prisma.auditLog.create({
    data: {
      schoolId: input.schoolId,
      actorUserId: input.scannerUserId || null,
      action: input.eventType === "CHECK_IN" ? "STAFF_CHECK_IN" : "STAFF_CHECK_OUT",
      entityType: "StaffAttendanceEvent",
      entityId: event.id,
      metadata: {
        teacherProfileId: teacher.id,
        displayName: teacher.displayName,
        isLate: event.isLate,
        lateMinutes: event.lateMinutes,
        workDate: todayKey,
        source: event.source,
      },
    },
  });

  return {
    event: {
      id: event.id,
      eventType: event.eventType,
      scannedAt: event.scannedAt.toISOString(),
      isLate: event.isLate,
      lateMinutes: event.lateMinutes,
      workDate: todayKey,
      source: event.source,
    },
    staff: {
      id: teacher.id,
      displayName: teacher.displayName,
      email: teacher.user.email,
      role: teacher.user.role,
      badgeCode: teacher.badgeCode,
    },
    cutoff: late.cutoff,
  };
}

export async function getSchoolGeofence(schoolId: string): Promise<Geofence | null> {
  const school = await prisma.school.findUnique({
    where: { id: schoolId },
    select: { geoLatitude: true, geoLongitude: true, geoRadiusM: true, geoEnabled: true },
  });
  if (!school?.geoEnabled) return null;
  const lat = decimalToNumber(school.geoLatitude);
  const lng = decimalToNumber(school.geoLongitude);
  if (!isValidPoint({ latitude: lat, longitude: lng })) return null;
  return {
    center: { latitude: lat!, longitude: lng! },
    radiusM: clampRadiusM(school.geoRadiusM ?? DEFAULT_RADIUS_M),
    enabled: true,
  };
}

export interface StaffGpsClockInput {
  schoolId: string;
  teacherProfileId: string;
  eventType: StaffAttendanceEventType;
  latitude: number;
  longitude: number;
  accuracyM?: number | null;
  note?: string | null;
}

export async function recordStaffGpsClock(input: StaffGpsClockInput) {
  const fence = await getSchoolGeofence(input.schoolId);
  if (!fence) throw new Error("GPS clock-in is not configured for this school yet.");

  if (!isValidPoint({ latitude: input.latitude, longitude: input.longitude })) {
    throw new Error("Invalid GPS coordinates. Please enable location services and try again.");
  }
  const accuracyM =
    typeof input.accuracyM === "number" && Number.isFinite(input.accuracyM)
      ? Math.max(0, input.accuracyM)
      : null;
  if (accuracyM !== null && accuracyM > MAX_ACCEPTED_ACCURACY_M) {
    throw new Error(
      `GPS signal is too weak (${Math.round(accuracyM)} m accuracy). Step outside or enable high-accuracy mode.`,
    );
  }

  const check = checkGeofence(
    { latitude: input.latitude, longitude: input.longitude, accuracyM },
    fence,
  );
  if (!check.withinFence) {
    // Still record for audit? No — reject outright so the DB only contains
    // verified clock-ins. Return distance so the UI can show how far away.
    const err = new Error(
      `You are ${check.distanceM} m from school — clock-in is only allowed within ${check.radiusM} m of the school.`,
    );
    (err as Error & { distanceM?: number; radiusM?: number }).distanceM = check.distanceM;
    (err as Error & { distanceM?: number; radiusM?: number }).radiusM = check.radiusM;
    throw err;
  }

  const teacher = await prisma.teacherProfile.findFirst({
    where: { id: input.teacherProfileId, schoolId: input.schoolId, isActive: true },
    select: { id: true, displayName: true, phone: true, user: { select: { email: true, role: true, name: true } } },
  });
  if (!teacher) throw new Error("Staff profile not found.");

  const now = new Date();
  const workDate = new Date(`${workDateKey(now)}T12:00:00.000Z`);

  const todays = await prisma.staffAttendanceEvent.findMany({
    where: { schoolId: input.schoolId, teacherProfileId: teacher.id, workDate },
    orderBy: { scannedAt: "asc" },
  });
  const last = todays[todays.length - 1] || null;
  if (input.eventType === StaffAttendanceEventType.CHECK_IN) {
    if (last?.eventType === StaffAttendanceEventType.CHECK_IN) {
      throw new Error(`${teacher.displayName} is already checked in today. Check out first.`);
    }
  } else if (!last || last.eventType === StaffAttendanceEventType.CHECK_OUT) {
    throw new Error(`${teacher.displayName} has no open check-in to close today.`);
  }

  const late =
    input.eventType === StaffAttendanceEventType.CHECK_IN
      ? computeLateness(now)
      : { isLate: false, lateMinutes: 0, cutoff: lateCutoffHm() };

  const data: Prisma.StaffAttendanceEventCreateInput = {
    school: { connect: { id: input.schoolId } },
    teacherProfile: { connect: { id: teacher.id } },
    eventType: input.eventType,
    scannedAt: now,
    isLate: late.isLate,
    lateMinutes: late.lateMinutes,
    source: "GPS",
    note: input.note || null,
    workDate,
    geoLatitude: new Prisma.Decimal(input.latitude.toFixed(6)),
    geoLongitude: new Prisma.Decimal(input.longitude.toFixed(6)),
    geoAccuracyM: accuracyM !== null ? new Prisma.Decimal(accuracyM.toFixed(2)) : null,
    geoDistanceM: check.distanceM,
    geoWithinFence: true,
  };
  const event = await prisma.staffAttendanceEvent.create({ data });

  await prisma.auditLog.create({
    data: {
      schoolId: input.schoolId,
      actorUserId: null,
      action: input.eventType === "CHECK_IN" ? "STAFF_GPS_CHECK_IN" : "STAFF_GPS_CHECK_OUT",
      entityType: "StaffAttendanceEvent",
      entityId: event.id,
      metadata: {
        teacherProfileId: teacher.id,
        displayName: teacher.displayName,
        isLate: event.isLate,
        lateMinutes: event.lateMinutes,
        distanceM: check.distanceM,
        accuracyM,
        workDate: workDateKey(now),
      },
    },
  });

  return {
    event: {
      id: event.id,
      eventType: event.eventType,
      scannedAt: event.scannedAt.toISOString(),
      isLate: event.isLate,
      lateMinutes: event.lateMinutes,
      workDate: workDateKey(now),
      source: "GPS",
      geo: {
        latitude: input.latitude,
        longitude: input.longitude,
        accuracyM,
        distanceM: check.distanceM,
      },
    },
    staff: {
      id: teacher.id,
      displayName: teacher.displayName,
      email: teacher.user.email,
      role: teacher.user.role,
    },
    cutoff: late.cutoff,
    fence: { radiusM: check.radiusM },
  };

  // Fire-and-forget SMS receipt to the staff member's phone. This gives them
  // proof of clock-in ("it sent at 8:04") they can show a supervisor if a
  // device/sync issue later disputes it.
  if (teacher.phone) {
    const actionLabel = input.eventType === "CHECK_IN" ? "Checked in" : "Checked out";
    const timeStr = event.scannedAt.toLocaleTimeString("en-NG", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
      timeZone: "Africa/Lagos",
    });
    sendSms({
      to: teacher.phone,
      message: `[Famex] ${actionLabel} at ${timeStr}${event.isLate ? ` · LATE +${event.lateMinutes}m` : ""} · ${check.distanceM} m from school. Keep this as proof.`,
    }).catch(() => {});
  }
}

export function hashDedupe(...parts: string[]) {
  return createHash("sha256").update(parts.join("|")).digest("hex").slice(0, 24);
}
