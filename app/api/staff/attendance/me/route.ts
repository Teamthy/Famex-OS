import { StaffAttendanceEventType, UserRole } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  badgePayload,
  ensureTeacherBadge,
  lateCutoffHm,
  recordStaffScan,
  STAFF_SELF_ROLES,
  workDateKey,
} from "@/lib/staff-attendance";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const actionSchema = z.object({
  action: z.enum(["CHECK_IN", "CHECK_OUT"]),
  note: z.string().trim().max(300).optional(),
});

async function myTeacherProfile(userId: string, schoolId: string) {
  return prisma.teacherProfile.findFirst({
    where: { userId, schoolId, isActive: true },
  });
}

export async function GET() {
  const user = await requireRole(STAFF_SELF_ROLES);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Non-teacher admin roles may not have TeacherProfile — return empty state
  let profile = await myTeacherProfile(user.id, user.schoolId);
  if (!profile && (user.role === UserRole.TEACHER || user.role === UserRole.HOD)) {
    return NextResponse.json(
      { error: "No teacher profile is linked to this account. Contact admin." },
      { status: 404 },
    );
  }

  if (!profile) {
    return NextResponse.json({
      supported: false,
      message: "Staff QR attendance is available for teaching staff profiles.",
    });
  }

  const ensured = await ensureTeacherBadge(profile.id);
  const dayKey = workDateKey();
  const workDate = new Date(`${dayKey}T12:00:00.000Z`);
  const events = await prisma.staffAttendanceEvent.findMany({
    where: { teacherProfileId: profile.id, workDate },
    orderBy: { scannedAt: "asc" },
  });
  const last = events[events.length - 1] || null;

  return NextResponse.json({
    supported: true,
    date: dayKey,
    lateCutoff: lateCutoffHm(),
    staff: {
      id: profile.id,
      displayName: profile.displayName,
      badgeCode: ensured?.badgeCode || null,
      qrPayload: ensured?.badgeCode ? badgePayload(ensured.badgeCode, user.schoolId) : null,
    },
    today: {
      status: !last
        ? "ABSENT"
        : last.eventType === StaffAttendanceEventType.CHECK_IN
          ? "IN"
          : "OUT",
      checkInAt: events.find((e) => e.eventType === "CHECK_IN")?.scannedAt.toISOString() || null,
      checkOutAt:
        [...events]
          .reverse()
          .find((e) => e.eventType === "CHECK_OUT")
          ?.scannedAt.toISOString() || null,
      isLate: events.some((e) => e.eventType === "CHECK_IN" && e.isLate),
      lateMinutes: events.find((e) => e.eventType === "CHECK_IN")?.lateMinutes || 0,
      events: events.map((e) => ({
        id: e.id,
        eventType: e.eventType,
        scannedAt: e.scannedAt.toISOString(),
        isLate: e.isLate,
        lateMinutes: e.lateMinutes,
        source: e.source,
      })),
    },
  });
}

export async function POST(request: NextRequest) {
  const user = await requireRole(STAFF_SELF_ROLES);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const profile = await myTeacherProfile(user.id, user.schoolId);
  if (!profile) {
    return NextResponse.json(
      { error: "No teacher profile linked for self check-in." },
      { status: 404 },
    );
  }

  const ensured = await ensureTeacherBadge(profile.id);
  if (!ensured?.badgeCode) {
    return NextResponse.json({ error: "Could not issue staff badge." }, { status: 500 });
  }

  let input: z.infer<typeof actionSchema>;
  try {
    input = actionSchema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: "Invalid action." }, { status: 400 });
  }

  try {
    const result = await recordStaffScan({
      schoolId: user.schoolId,
      badgeCode: ensured.badgeCode,
      eventType:
        input.action === "CHECK_IN"
          ? StaffAttendanceEventType.CHECK_IN
          : StaffAttendanceEventType.CHECK_OUT,
      scannerUserId: user.id,
      source: "SELF_SERVICE",
      note: input.note || null,
    });
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to record attendance." },
      { status: 409 },
    );
  }
}
