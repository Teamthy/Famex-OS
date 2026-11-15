import { NotificationKind, UserRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";

const DIRECTOR_RECIPIENT_LIMIT = 25;
const SCHOOL_TZ = process.env.SCHOOL_TIMEZONE || "Africa/Lagos";

async function notifyDirectors(input: {
  schoolId: string;
  kind: NotificationKind;
  title: string;
  body: string;
  link: string;
  excludeUserId?: string | null;
}): Promise<number> {
  try {
    const directors = await prisma.user.findMany({
      where: {
        schoolId: input.schoolId,
        role: UserRole.DIRECTOR,
        isActive: true,
        ...(input.excludeUserId ? { id: { not: input.excludeUserId } } : {}),
      },
      select: { id: true },
      orderBy: { id: "asc" },
      take: DIRECTOR_RECIPIENT_LIMIT,
    });
    if (directors.length === 0) return 0;

    const { createInAppNotification } = await import("@/lib/notifications");
    const results = await Promise.allSettled(
      directors.map((director) =>
        createInAppNotification({
          schoolId: input.schoolId,
          userId: director.id,
          kind: input.kind,
          title: input.title,
          body: input.body,
          link: input.link,
        }),
      ),
    );
    return results.filter((result) => result.status === "fulfilled").length;
  } catch {
    // Attendance and publication writes are authoritative; a notification
    // outage must not turn a committed school action into an API failure.
    return 0;
  }
}

export async function notifyDirectorsOfStaffClockEvent(input: {
  schoolId: string;
  staffName: string;
  eventType: "CHECK_IN" | "CHECK_OUT";
  isLate: boolean;
  lateMinutes: number;
  scannedAt: Date;
}): Promise<number> {
  const kind =
    input.eventType === "CHECK_OUT"
      ? NotificationKind.CLOCK_OUT
      : input.isLate
        ? NotificationKind.CLOCK_IN_LATE
        : NotificationKind.CLOCK_IN;
  const time = input.scannedAt.toLocaleTimeString("en-NG", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: SCHOOL_TZ,
  });
  const lateSuffix =
    input.eventType === "CHECK_IN" && input.isLate ? `, ${input.lateMinutes} minutes late` : "";
  const action = input.eventType === "CHECK_IN" ? "checked in" : "checked out";

  return notifyDirectors({
    schoolId: input.schoolId,
    kind,
    title:
      input.eventType === "CHECK_OUT"
        ? "Staff check-out"
        : input.isLate
          ? "Late staff arrival"
          : "Staff check-in",
    body: `${input.staffName} ${action} at ${time}${lateSuffix}.`,
    link: "/admin/staff-attendance",
  });
}

/**
 * Existing school events are published as NewsPost records in the Events
 * category. Notify leadership when one is published; this is not a scheduled
 * reminder because NewsPost has no structured event date/time.
 */
export async function notifyDirectorsOfPublishedSchoolEvent(input: {
  schoolId: string;
  title: string;
  actorUserId: string;
}): Promise<number> {
  return notifyDirectors({
    schoolId: input.schoolId,
    kind: NotificationKind.BROADCAST,
    title: "School event published",
    body: `A school event notice, “${input.title}”, was published.`,
    link: "/admin/news",
    excludeUserId: input.actorUserId,
  });
}
