/**
 * Student self-service GPS clock-in.
 *
 * Mirrors the staff flow: server recomputes distance from the reported
 * coordinates to the school geofence (haversine) and rejects anything
 * outside the configured radius.
 */

import { Prisma, StudentClockEventType, UserRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/session";
import { SCHOOL_TZ, workDateKey } from "@/lib/staff-attendance";
import { queueStudentClockNotifications } from "@/lib/clock-notifications";
import {
  checkGeofence,
  clampRadiusM,
  decimalToNumber,
  DEFAULT_RADIUS_M,
  isValidPoint,
  MAX_ACCEPTED_ACCURACY_M,
  type Geofence,
} from "@/lib/geofence";

export const STUDENT_SELF_ROLES = [UserRole.STUDENT];

/** Late cutoff for student arrival (same as staff by default; schools can override via env). */
export function studentLateCutoffHm() {
  return process.env.STUDENT_LATE_CUTOFF || process.env.STAFF_LATE_CUTOFF || "08:00";
}

function localHourMinute(date = new Date(), timeZone = SCHOOL_TZ) {
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

export function computeStudentLateness(scannedAt = new Date()) {
  const cutoff = studentLateCutoffHm();
  const [ch, cm] = cutoff.split(":").map((x) => Number(x));
  const cutoffMinutes = (Number.isFinite(ch) ? ch : 8) * 60 + (Number.isFinite(cm) ? cm : 0);
  const { minutes } = localHourMinute(scannedAt);
  const lateMinutes = Math.max(0, minutes - cutoffMinutes);
  return { isLate: lateMinutes > 0, lateMinutes, cutoff };
}

export async function getStudentGeofence(schoolId: string): Promise<Geofence | null> {
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

export async function getStudentPortalProfile() {
  const user = await requireRole(STUDENT_SELF_ROLES);
  if (!user) return null;
  const profile = await prisma.studentProfile.findFirst({
    where: { userId: user.id, schoolId: user.schoolId, isActive: true },
    select: {
      id: true,
      studentId: true,
      displayName: true,
      currentClass: { select: { id: true, displayName: true } },
    },
  });
  if (!profile) return null;
  return { user, profile };
}

export async function getTodaysStudentEvents(studentProfileId: string, schoolId: string) {
  const now = new Date();
  const workDate = new Date(`${workDateKey(now)}T12:00:00.000Z`);
  const events = await prisma.studentClockEvent.findMany({
    where: { studentProfileId, schoolId, workDate },
    orderBy: { clockedAt: "asc" },
  });
  return events;
}

export interface StudentGpsClockInput {
  schoolId: string;
  studentProfileId: string;
  eventType: StudentClockEventType;
  latitude: number;
  longitude: number;
  accuracyM?: number | null;
  note?: string | null;
}

export async function recordStudentGpsClock(input: StudentGpsClockInput) {
  const fence = await getStudentGeofence(input.schoolId);
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
    const err = new Error(
      `You are ${check.distanceM} m from school — clock-in is only allowed within ${check.radiusM} m of the school.`,
    );
    (err as Error & { distanceM?: number; radiusM?: number }).distanceM = check.distanceM;
    (err as Error & { distanceM?: number; radiusM?: number }).radiusM = check.radiusM;
    throw err;
  }

  const student = await prisma.studentProfile.findFirst({
    where: { id: input.studentProfileId, schoolId: input.schoolId, isActive: true },
    select: {
      id: true,
      displayName: true,
      studentId: true,
      currentClass: { select: { displayName: true } },
    },
  });
  if (!student) throw new Error("Student profile not found.");

  const now = new Date();
  const workDate = new Date(`${workDateKey(now)}T12:00:00.000Z`);

  const todays = await prisma.studentClockEvent.findMany({
    where: { schoolId: input.schoolId, studentProfileId: student.id, workDate },
    orderBy: { clockedAt: "asc" },
  });
  const last = todays[todays.length - 1] || null;
  if (input.eventType === StudentClockEventType.CHECK_IN) {
    if (last?.eventType === StudentClockEventType.CHECK_IN) {
      throw new Error(`${student.displayName} is already checked in today. Check out first.`);
    }
  } else if (!last || last.eventType === StudentClockEventType.CHECK_OUT) {
    throw new Error(`${student.displayName} has no open check-in to close today.`);
  }

  const late =
    input.eventType === StudentClockEventType.CHECK_IN
      ? computeStudentLateness(now)
      : { isLate: false, lateMinutes: 0, cutoff: studentLateCutoffHm() };

  const event = await prisma.studentClockEvent.create({
    data: {
      school: { connect: { id: input.schoolId } },
      studentProfile: { connect: { id: student.id } },
      eventType: input.eventType,
      clockedAt: now,
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
    },
  });

  await prisma.auditLog.create({
    data: {
      schoolId: input.schoolId,
      actorUserId: null,
      action: input.eventType === "CHECK_IN" ? "STUDENT_GPS_CHECK_IN" : "STUDENT_GPS_CHECK_OUT",
      entityType: "StudentClockEvent",
      entityId: event.id,
      metadata: {
        studentProfileId: student.id,
        displayName: student.displayName,
        studentId: student.studentId,
        isLate: event.isLate,
        lateMinutes: event.lateMinutes,
        distanceM: check.distanceM,
        accuracyM,
        workDate: workDateKey(now),
      },
    },
  });

  // Fire-and-forget parent notifications. We don't want a notification-delivery
  // failure to prevent the student from clocking in, so we catch and log to the
  // audit trail only.
  queueStudentClockNotifications({
    schoolId: input.schoolId,
    studentId: student.id,
    studentName: student.displayName,
    className: student.currentClass.displayName,
    eventId: event.id,
    eventType: input.eventType,
    isLate: event.isLate,
    lateMinutes: event.lateMinutes,
    workDate: workDateKey(now),
    clockedAt: now,
  }).catch((err) => {
    // eslint-disable-next-line no-console
    console.warn("Failed to queue student clock notifications:", err);
  });

  return {
    event: {
      id: event.id,
      eventType: event.eventType,
      clockedAt: event.clockedAt.toISOString(),
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
    student: {
      id: student.id,
      displayName: student.displayName,
      studentId: student.studentId,
    },
    cutoff: late.cutoff,
    fence: { radiusM: check.radiusM },
  };
}
