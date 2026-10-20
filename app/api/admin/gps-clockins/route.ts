import { StaffAttendanceEventType, StudentClockEventType } from "@prisma/client";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { jsonNoStore } from "@/lib/requests";
import { STAFF_ATTENDANCE_ADMIN_ROLES, workDateKey } from "@/lib/staff-attendance";
import { requireAnyModule } from "@/lib/module-guard";
import { flagReading, isImpossibleTravel, type GeoReading } from "@/lib/spoof-detection";

export const dynamic = "force-dynamic";

/**
 * Today's GPS clock-in activity across staff & students for the admin dashboard.
 *
 * Returns summary counts plus a combined timeline of events (latest 200) that
 * admins can review to see who clocked in, how far from center they were, and
 * spot suspicious entries (large lateMinutes, high distanceM right at the edge).
 */
export async function GET(request: NextRequest) {
  // Rule 13: auth → role → module. The GPS timeline spans staff and student
  // clock-ins, so either attendance arm entitles the caller.
  const guard = await requireAnyModule(
    ["staff_attendance", "attendance"],
    STAFF_ATTENDANCE_ADMIN_ROLES,
  );
  if (!guard.ok) return guard.response;
  const user = guard.user;

  const url = new URL(request.url);
  const dateParam = url.searchParams.get("date");
  const dateKey = dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam) ? dateParam : workDateKey();
  const workDate = new Date(`${dateKey}T12:00:00.000Z`);

  const [fence, staffEvents, studentEvents, staffTotal, studentTotal] = await Promise.all([
    prisma.school.findUnique({
      where: { id: user.schoolId },
      select: {
        geoEnabled: true,
        geoRadiusM: true,
        geoLatitude: true,
        geoLongitude: true,
        name: true,
      },
    }),
    prisma.staffAttendanceEvent.findMany({
      where: { schoolId: user.schoolId, workDate, source: "GPS" },
      orderBy: { scannedAt: "desc" },
      include: {
        teacherProfile: { select: { displayName: true, id: true } },
      },
    }),
    prisma.studentClockEvent.findMany({
      where: { schoolId: user.schoolId, workDate },
      orderBy: { clockedAt: "desc" },
      include: {
        studentProfile: {
          select: {
            displayName: true,
            studentId: true,
            id: true,
            currentClass: { select: { displayName: true } },
          },
        },
      },
    }),
    prisma.teacherProfile.count({ where: { schoolId: user.schoolId, isActive: true } }),
    prisma.studentProfile.count({ where: { schoolId: user.schoolId, isActive: true } }),
  ]);

  const staffLatestMap = new Map<string, StaffAttendanceEventType>();
  const staffChronological = [...staffEvents].sort(
    (a, b) => a.scannedAt.getTime() - b.scannedAt.getTime(),
  );
  for (const e of staffChronological) staffLatestMap.set(e.teacherProfileId, e.eventType);
  const staffIn = [...staffLatestMap.values()].filter((v) => v === "CHECK_IN").length;
  const staffLate = staffEvents.filter((e) => e.eventType === "CHECK_IN" && e.isLate).length;

  const studentLatest = new Map<string, StudentClockEventType>();
  const sortedStudent = [...studentEvents].sort(
    (a, b) => a.clockedAt.getTime() - b.clockedAt.getTime(),
  );
  for (const e of sortedStudent) studentLatest.set(e.studentProfileId, e.eventType);
  const studentIn = [...studentLatest.values()].filter((v) => v === "CHECK_IN").length;
  const studentLate = studentEvents.filter((e) => e.eventType === "CHECK_IN" && e.isLate).length;

  type Row = {
    id: string;
    kind: "staff" | "student";
    name: string;
    sub: string;
    eventType: "CHECK_IN" | "CHECK_OUT";
    at: string;
    isLate: boolean;
    lateMinutes: number;
    distanceM: number | null;
    accuracyM: number | null;
    latitude: number | null;
    longitude: number | null;
    flagged?: boolean;
  };
  const rows: Row[] = [
    ...staffEvents.map((e) => ({
      id: `s-${e.id}`,
      kind: "staff" as const,
      name: e.teacherProfile.displayName,
      sub: "Staff",
      eventType: e.eventType,
      at: e.scannedAt.toISOString(),
      isLate: e.isLate,
      lateMinutes: e.lateMinutes,
      distanceM: e.geoDistanceM,
      accuracyM: e.geoAccuracyM ? Number(e.geoAccuracyM) : null,
      latitude: e.geoLatitude ? Number(e.geoLatitude) : null,
      longitude: e.geoLongitude ? Number(e.geoLongitude) : null,
    })),
    ...studentEvents.map((e) => ({
      id: `st-${e.id}`,
      kind: "student" as const,
      name: e.studentProfile.displayName,
      sub: `${e.studentProfile.currentClass.displayName} · ${e.studentProfile.studentId}`,
      eventType: e.eventType,
      at: e.clockedAt.toISOString(),
      isLate: e.isLate,
      lateMinutes: e.lateMinutes,
      distanceM: e.geoDistanceM,
      accuracyM: e.geoAccuracyM ? Number(e.geoAccuracyM) : null,
      latitude: e.geoLatitude ? Number(e.geoLatitude) : null,
      longitude: e.geoLongitude ? Number(e.geoLongitude) : null,
    })),
  ].sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());

  // Anti-spoof flagging: per-reading (accuracy / edge-spoof) + cross-reading
  // impossible-travel between consecutive clocks per person.
  const byPerson = new Map<string, GeoReading[]>();
  for (const r of rows) {
    if (r.latitude === null || r.longitude === null) continue;
    const key = `${r.kind}:${r.id.split("-").slice(1).join("-")}`;
    const arr = byPerson.get(key) ?? [];
    arr.push({
      latitude: r.latitude,
      longitude: r.longitude,
      accuracyM: r.accuracyM,
      at: new Date(r.at),
    });
    byPerson.set(key, arr);
  }
  const impossibleIds = new Set<string>();
  for (const readings of byPerson.values()) {
    // Events are in DESC time order; iterate pairwise in chronological order.
    const sorted = [...readings].sort((a, b) => a.at.getTime() - b.at.getTime());
    for (let i = 1; i < sorted.length; i += 1) {
      if (isImpossibleTravel(sorted[i - 1], sorted[i])) {
        // Flag all events involved in the jump.
        impossibleIds.add(`${sorted[i - 1].at.getTime()}`);
        impossibleIds.add(`${sorted[i].at.getTime()}`);
      }
    }
  }

  const fenceRadiusM: number | null =
    typeof fence?.geoRadiusM === "number" ? fence.geoRadiusM : null;
  const rowsWithFlags: Row[] = rows.map((r) => {
    const perEvent = flagReading(
      {
        latitude: r.latitude,
        longitude: r.longitude,
        accuracyM: r.accuracyM,
        distanceM: r.distanceM,
      },
      fenceRadiusM,
    );
    const impossible = impossibleIds.has(String(new Date(r.at).getTime()));
    return {
      ...r,
      flagged: Boolean(perEvent.accuracySuspicious || perEvent.edgeSuspicious || impossible),
    };
  });

  const flaggedCount = rowsWithFlags.filter((r) => r.flagged).length;

  const fenceCenterLat = fence ? Number(fence.geoLatitude) : null;
  const fenceCenterLng = fence ? Number(fence.geoLongitude) : null;

  return jsonNoStore({
    date: dateKey,
    schoolName: fence?.name,
    fence: {
      enabled: fence?.geoEnabled ?? false,
      radiusM: fence?.geoRadiusM ?? null,
      center:
        fenceCenterLat !== null && fenceCenterLng !== null
          ? { latitude: fenceCenterLat, longitude: fenceCenterLng }
          : null,
    },
    summary: {
      staffTotal,
      staffIn,
      staffNotIn: Math.max(0, staffTotal - staffIn),
      staffLate,
      studentTotal,
      studentIn,
      studentNotIn: Math.max(0, studentTotal - studentIn),
      studentLate,
      gpsEvents: rowsWithFlags.length,
      flaggedCount,
    },
    rows: rowsWithFlags.slice(0, 200),
  });
}
