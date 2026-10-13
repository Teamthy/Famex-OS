import { AttendanceStatus, UserRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/session";

export type CalendarStatus = "Present" | "Absent" | "Late";

export type CalendarDay = {
  date: string;
  status: CalendarStatus;
  note?: string;
};

export function parseMonth(input?: string | null) {
  if (input && /^\d{4}-\d{2}$/.test(input)) {
    const [year, month] = input.split("-").map(Number);
    const from = new Date(Date.UTC(year, month - 1, 1, 12, 0, 0));
    const to = new Date(Date.UTC(year, month, 1, 12, 0, 0));
    return {
      key: input,
      monthLabel: from.toLocaleString("en-US", { month: "long" }),
      year,
      from,
      to,
    };
  }

  const now = new Date();
  const from = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 12, 0, 0));
  const to = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1, 12, 0, 0));
  return {
    key: from.toISOString().slice(0, 7),
    monthLabel: from.toLocaleString("en-US", { month: "long" }),
    year: from.getUTCFullYear(),
    from,
    to,
  };
}

function statusPriority(status: AttendanceStatus) {
  if (status === AttendanceStatus.ABSENT) return 3;
  if (status === AttendanceStatus.LATE) return 2;
  return 1;
}

function toCalendarStatus(status: AttendanceStatus): CalendarStatus {
  if (status === AttendanceStatus.ABSENT) return "Absent";
  if (status === AttendanceStatus.LATE) return "Late";
  return "Present";
}

export function summarizeCalendar(days: CalendarDay[]) {
  const present = days.filter((day) => day.status === "Present").length;
  const absent = days.filter((day) => day.status === "Absent").length;
  const late = days.filter((day) => day.status === "Late").length;
  const total = days.length;
  return {
    present,
    absent,
    late,
    total,
    attendanceRate: total ? Math.round((present / total) * 100) : 0,
  };
}

export function aggregateCalendarDays(
  entries: Array<{ status: AttendanceStatus; note: string | null; sessionDate: Date }>,
): CalendarDay[] {
  const byDate = new Map<string, { status: AttendanceStatus; note?: string }>();

  for (const entry of entries) {
    const key = entry.sessionDate.toISOString().slice(0, 10);
    const existing = byDate.get(key);

    if (!existing || statusPriority(entry.status) > statusPriority(existing.status)) {
      byDate.set(key, {
        status: entry.status,
        note: entry.note || undefined,
      });
    } else if (!existing.note && entry.note) {
      byDate.set(key, {
        status: existing.status,
        note: entry.note,
      });
    }
  }

  return [...byDate.entries()]
    .sort((left, right) => left[0].localeCompare(right[0]))
    .map(([date, value]) => ({
      date,
      status: toCalendarStatus(value.status),
      note: value.note,
    }));
}

export async function getStudentPortalProfile() {
  const user = await requireRole([UserRole.STUDENT]);
  if (!user) return null;

  const profile = await prisma.studentProfile.findFirst({
    where: {
      schoolId: user.schoolId,
      userId: user.id,
      isActive: true,
    },
    select: {
      id: true,
      studentId: true,
      displayName: true,
      currentClass: {
        select: {
          id: true,
          displayName: true,
          level: true,
          arm: true,
        },
      },
    },
  });

  if (!profile) return null;
  return { user, profile };
}

export async function getParentPortalProfile() {
  const user = await requireRole([UserRole.PARENT]);
  if (!user) return null;

  const profile = await prisma.parentProfile.findFirst({
    where: {
      schoolId: user.schoolId,
      userId: user.id,
      isActive: true,
    },
    select: {
      id: true,
      displayName: true,
      studentLinks: {
        orderBy: [{ isPrimary: "desc" }, { studentProfile: { displayName: "asc" } }],
        select: {
          relationship: true,
          isPrimary: true,
          studentProfile: {
            select: {
              id: true,
              studentId: true,
              displayName: true,
              currentClass: {
                select: {
                  id: true,
                  displayName: true,
                },
              },
            },
          },
        },
      },
    },
  });

  if (!profile) return null;
  return { user, profile };
}

export async function getStudentAttendanceMonth(
  studentProfileId: string,
  monthKey?: string | null,
) {
  const range = parseMonth(monthKey);
  const entries = await prisma.attendanceEntry.findMany({
    where: {
      studentProfileId,
      session: {
        sessionDate: {
          gte: range.from,
          lt: range.to,
        },
      },
    },
    orderBy: [{ session: { sessionDate: "asc" } }, { markedAt: "asc" }],
    select: {
      status: true,
      note: true,
      session: {
        select: {
          sessionDate: true,
        },
      },
    },
  });

  const days = aggregateCalendarDays(
    entries.map((entry) => ({
      status: entry.status,
      note: entry.note,
      sessionDate: entry.session.sessionDate,
    })),
  );

  return {
    month: range.key,
    monthLabel: range.monthLabel,
    year: range.year,
    days,
    summary: summarizeCalendar(days),
  };
}
