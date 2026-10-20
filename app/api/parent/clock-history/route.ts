import { UserRole } from "@prisma/client";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/session";
import { decimalToNumber } from "@/lib/geofence";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Parent view: GPS clock-in timeline for each linked child, plus the school
 * fence center/radius so the parent portal can render a small map showing
 * where clock-ins happened (for reassurance and for late-day disputes).
 *
 * Returns the last 30 days of events per child.
 */
export async function GET() {
  const user = await requireRole([UserRole.PARENT]);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parent = await prisma.parentProfile.findFirst({
    where: { userId: user.id, schoolId: user.schoolId, isActive: true },
    select: { id: true },
  });
  if (!parent) return NextResponse.json({ error: "Parent profile not found." }, { status: 404 });

  const links = await prisma.parentStudentLink.findMany({
    where: { parentProfileId: parent.id },
    include: {
      studentProfile: {
        select: {
          id: true,
          displayName: true,
          studentId: true,
          currentClass: { select: { displayName: true } },
        },
      },
    },
  });

  const school = await prisma.school.findUnique({
    where: { id: user.schoolId },
    select: {
      name: true,
      geoLatitude: true,
      geoLongitude: true,
      geoRadiusM: true,
      geoEnabled: true,
    },
  });

  const since = new Date();
  since.setDate(since.getDate() - 30);
  const dayCutoff = new Date(`${since.toISOString().slice(0, 10)}T00:00:00.000Z`);

  const children = await Promise.all(
    links.map(async (l) => {
      const events = await prisma.studentClockEvent.findMany({
        where: { studentProfileId: l.studentProfile.id, workDate: { gte: dayCutoff } },
        orderBy: { clockedAt: "desc" },
        take: 200,
      });
      return {
        id: l.studentProfile.id,
        displayName: l.studentProfile.displayName,
        studentId: l.studentProfile.studentId,
        className: l.studentProfile.currentClass.displayName,
        events: events.map((e) => ({
          id: e.id,
          eventType: e.eventType,
          at: e.clockedAt.toISOString(),
          isLate: e.isLate,
          lateMinutes: e.lateMinutes,
          latitude: decimalToNumber(e.geoLatitude),
          longitude: decimalToNumber(e.geoLongitude),
          distanceM: e.geoDistanceM,
          accuracyM: e.geoAccuracyM ? Number(e.geoAccuracyM) : null,
        })),
      };
    }),
  );

  return NextResponse.json({
    schoolName: school?.name,
    fence: school?.geoEnabled
      ? {
          enabled: true,
          center:
            decimalToNumber(school.geoLatitude) !== null &&
            decimalToNumber(school.geoLongitude) !== null
              ? {
                  latitude: decimalToNumber(school.geoLatitude)!,
                  longitude: decimalToNumber(school.geoLongitude)!,
                }
              : null,
          radiusM: school.geoRadiusM ?? 100,
        }
      : { enabled: false },
    children,
  });
}
