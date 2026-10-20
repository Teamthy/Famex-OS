import { StudentClockEventType } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import {
  getStudentGeofence,
  getStudentPortalProfile,
  getTodaysStudentEvents,
  recordStudentGpsClock,
  studentLateCutoffHm,
} from "@/lib/student-attendance";
import { workDateKey } from "@/lib/staff-attendance";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const ctx = await getStudentPortalProfile();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const fence = await getStudentGeofence(ctx.user.schoolId);
  const events = await getTodaysStudentEvents(ctx.profile.id, ctx.user.schoolId);
  const last = events[events.length - 1] || null;

  return NextResponse.json({
    supported: true,
    date: workDateKey(),
    lateCutoff: studentLateCutoffHm(),
    gps: fence
      ? {
          enabled: true,
          center: { latitude: fence.center.latitude, longitude: fence.center.longitude },
          radiusM: fence.radiusM,
        }
      : { enabled: false },
    student: {
      id: ctx.profile.id,
      studentId: ctx.profile.studentId,
      displayName: ctx.profile.displayName,
      className: ctx.profile.currentClass.displayName,
    },
    today: {
      status: !last ? "ABSENT" : last.eventType === StudentClockEventType.CHECK_IN ? "IN" : "OUT",
      checkInAt: events.find((e) => e.eventType === "CHECK_IN")?.clockedAt.toISOString() || null,
      checkOutAt:
        [...events]
          .reverse()
          .find((e) => e.eventType === "CHECK_OUT")
          ?.clockedAt.toISOString() || null,
      isLate: events.some((e) => e.eventType === "CHECK_IN" && e.isLate),
      lateMinutes: events.find((e) => e.eventType === "CHECK_IN")?.lateMinutes || 0,
      events: events.map((e) => ({
        id: e.id,
        eventType: e.eventType,
        clockedAt: e.clockedAt.toISOString(),
        isLate: e.isLate,
        lateMinutes: e.lateMinutes,
        source: e.source,
        distanceM: e.geoDistanceM,
      })),
    },
  });
}

const clockSchema = z.object({
  action: z.enum(["CHECK_IN", "CHECK_OUT"]),
  latitude: z.coerce.number().min(-90).max(90),
  longitude: z.coerce.number().min(-180).max(180),
  accuracyM: z.coerce.number().nonnegative().optional().nullable(),
  note: z.string().trim().max(300).optional(),
});

export async function POST(request: Request) {
  const ctx = await getStudentPortalProfile();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = clockSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "GPS coordinates are required to clock in." },
      { status: 400 },
    );
  }

  try {
    const result = await recordStudentGpsClock({
      schoolId: ctx.user.schoolId,
      studentProfileId: ctx.profile.id,
      eventType:
        parsed.data.action === "CHECK_IN"
          ? StudentClockEventType.CHECK_IN
          : StudentClockEventType.CHECK_OUT,
      latitude: parsed.data.latitude,
      longitude: parsed.data.longitude,
      accuracyM: parsed.data.accuracyM ?? null,
      note: parsed.data.note || null,
    });
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    const err = error as Error & { distanceM?: number; radiusM?: number };
    return NextResponse.json(
      {
        error: err.message || "Unable to record clock-in.",
        distanceM: err.distanceM,
        radiusM: err.radiusM,
      },
      { status: 409 },
    );
  }
}
