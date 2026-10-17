/**
 * Queue parent-facing notifications for a student's GPS clock event.
 *
 * Reuses the generic NotificationJob table (same queue that processes
 * ATTENDANCE_ALERT, FEE_REMINDER, etc.) so no new worker is needed — the
 * existing dispatch job picks them up.
 *
 * Channels: in-app (USER_NOTIFICATION) always; SMS + EMAIL for the student's
 * primary parent when contact details are present. We do not text every
 * linked parent because some schools use two parents on a single student and
 * double-texting leads to opt-outs.
 */
import { AlertChannel, NotificationKind, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

interface ParentLike {
  id: string;
  user: { name: string | null; email: string | null } | null;
  phone: string | null;
}

function dedupeKey(
  studentId: string,
  eventId: string,
  channel: AlertChannel,
) {
  return `clock:${studentId}:${eventId}:${channel}`;
}

function normalisePhone(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D+/g, "");
  if (!digits) return null;
  // Convert leading 0 to +234 for NG. Keep other formats as-is if they start
  // with country code.
  if (digits.startsWith("0") && digits.length === 11) return `234${digits.slice(1)}`;
  return digits;
}

export async function queueStudentClockNotifications(input: {
  schoolId: string;
  studentId: string; // student profile id
  studentName: string;
  className: string | null;
  eventId: string;
  eventType: "CHECK_IN" | "CHECK_OUT";
  isLate: boolean;
  lateMinutes?: number;
  workDate: string;
  clockedAt: Date;
}) {
  // Find all linked parents; pick the first "primary" one (any linked parent
  // works — the schema currently has no "isPrimary" boolean on the link, so
  // we just take the first parent link).
  const links = await prisma.parentStudentLink.findMany({
    where: { studentProfileId: input.studentId },
    include: {
      parent: {
        select: {
          id: true,
          userId: true,
          phone: true,
          user: { select: { name: true, email: true } },
        },
      },
    },
    take: 2,
  });
  const parents: ParentLike[] = links.map((l) => l.parent);

  if (parents.length === 0) return;

  const kind: NotificationKind =
    input.eventType === "CHECK_OUT"
      ? NotificationKind.CLOCK_OUT
      : input.isLate
        ? NotificationKind.CLOCK_IN_LATE
        : NotificationKind.CLOCK_IN;

  const timeStr = input.clockedAt.toLocaleTimeString("en-NG", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });

  let title: string;
  let body: string;
  if (kind === NotificationKind.CLOCK_IN) {
    title = `${input.studentName} is on campus`;
    body = `${input.studentName}${input.className ? ` (${input.className})` : ""} checked in at school at ${timeStr}.`;
  } else if (kind === NotificationKind.CLOCK_IN_LATE) {
    title = `${input.studentName} arrived late`;
    body = `${input.studentName}${input.className ? ` (${input.className})` : ""} checked in at ${timeStr} — ${input.lateMinutes || 0} minutes after the bell.`;
  } else {
    title = `${input.studentName} left school`;
    body = `${input.studentName} checked out at ${timeStr}.`;
  }

  const jobs: Prisma.NotificationJobCreateManyInput[] = [];
  const inApp: Array<{ parentUserId: string; title: string; body: string; link?: string }> = [];

  for (const parent of parents) {
    const recipientName = parent.user?.name || "Parent";
    const email = parent.user?.email || null;
    const phone = normalisePhone(parent.phone);
    const parentUserId = parent.userId;

    if (phone) {
      jobs.push({
        schoolId: input.schoolId,
        kind,
        channel: AlertChannel.SMS,
        recipientName,
        recipientPhone: phone,
        subject: title,
        body: `[Famex] ${body}`,
        dedupeKey: dedupeKey(input.studentId, input.eventId, AlertChannel.SMS),
      });
    }
    if (email) {
      jobs.push({
        schoolId: input.schoolId,
        kind,
        channel: AlertChannel.EMAIL,
        recipientName,
        recipientEmail: email,
        subject: title,
        body,
        dedupeKey: dedupeKey(input.studentId, input.eventId, AlertChannel.EMAIL),
      });
    }
    if (parentUserId) {
      inApp.push({ parentUserId, title, body, link: "/parent/attendance" });
    }
  }

  if (jobs.length > 0) {
    await prisma.notificationJob.createMany({ data: jobs, skipDuplicates: true });
  }
  if (inApp.length > 0) {
    // Fire one-by-one because there's no unique constraint to skipDuplicates on,
    // and a failure on one shouldn't drop the rest.
    for (const n of inApp) {
      await prisma.userNotification
        .create({
          data: {
            schoolId: input.schoolId,
            userId: n.parentUserId,
            kind,
            title: n.title,
            body: n.body,
            link: n.link,
          },
        })
        .catch(() => {});
    }
  }
}
