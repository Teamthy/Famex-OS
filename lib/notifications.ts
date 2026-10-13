import { AlertChannel, AlertDeliveryStatus, NotificationKind, Prisma } from "@prisma/client";
import { Resend } from "resend";
import { prisma } from "@/lib/prisma";

/* ------------------------------------------------------------------
   Provider adapters
   Email is live via Resend. SMS / WhatsApp share an adapter interface
   so a provider (e.g. Termii, Twilio) can be plugged in later without
   touching the dispatcher.
   ------------------------------------------------------------------ */

export type DeliveryResult =
  { ok: true; providerId?: string } | { ok: false; error: string; permanent?: boolean };

export interface ChannelAdapter {
  channel: AlertChannel;
  configured: boolean;
  send(_job: {
    recipientName: string | null;
    recipientEmail: string | null;
    recipientPhone: string | null;
    subject: string;
    body: string;
  }): Promise<DeliveryResult>;
}

function siteUrl() {
  return (process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000").replace(/\/$/, "");
}

const emailAdapter: ChannelAdapter = {
  channel: AlertChannel.EMAIL,
  get configured() {
    return Boolean(process.env.RESEND_API_KEY);
  },
  async send(job) {
    if (!process.env.RESEND_API_KEY) {
      return { ok: false, error: "RESEND_API_KEY is not configured.", permanent: false };
    }
    if (!job.recipientEmail) {
      return { ok: false, error: "No recipient email on job.", permanent: true };
    }
    try {
      const resend = new Resend(process.env.RESEND_API_KEY);
      const from = process.env.EMAIL_FROM || "Ykay College <onboarding@resend.dev>";
      const { error } = await resend.emails.send({
        from,
        to: job.recipientEmail,
        subject: job.subject,
        html: `<div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:0 auto;padding:24px;border:1px solid #E5E7EB;border-radius:12px">
<h2 style="color:#0C1824;margin:0 0 4px">Ykay College &amp; Leadership Academy</h2>
<p style="color:#4EC54D;font-size:12px;font-weight:bold;text-transform:uppercase;letter-spacing:2px;margin:0 0 20px">${escapeHtml(kindLabelFromSubject(job.subject))}</p>
<p style="color:#334155;line-height:1.7">${job.recipientName ? `Hello ${escapeHtml(job.recipientName)},<br/><br/>` : ""}${escapeHtml(job.body).replace(/\n/g, "<br/>")}</p>
<p style="margin:24px 0"><a href="${siteUrl()}/portal" style="background:#4EC54D;color:#fff;padding:12px 24px;border-radius:999px;text-decoration:none;font-weight:bold;font-size:13px">Open EduPortal</a></p>
<p style="color:#94A3B8;font-size:11px">This is an automated message from Ykay College EduPortal. Please do not reply directly to this email.</p>
</div>`,
      });
      if (error) return { ok: false, error: error.message || "Email provider error." };
      return { ok: true };
    } catch (sendError) {
      return {
        ok: false,
        error: sendError instanceof Error ? sendError.message : "Email send failed.",
      };
    }
  },
};

/**
 * SMS adapter — Termii (Nigerian SMS provider, https://termii.com).
 * Configure with TERMII_API_KEY and TERMII_SENDER_ID. Unconfigured = the
 * dispatcher marks the channel skipped (C-009), never silently "sent".
 */
const smsAdapter: ChannelAdapter = {
  channel: AlertChannel.SMS,
  get configured() {
    return Boolean(process.env.TERMII_API_KEY && process.env.TERMII_SENDER_ID);
  },
  async send(job) {
    const apiKey = process.env.TERMII_API_KEY;
    const senderId = process.env.TERMII_SENDER_ID;
    if (!apiKey || !senderId || !job.recipientPhone) {
      return { ok: false, error: "SMS provider is not configured.", permanent: false };
    }
    try {
      const response = await fetch("https://api.ng.termii.com/api/sms/send", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          to: job.recipientPhone,
          from: senderId,
          sms: job.body,
          type: "plain",
          channel: "generic",
          api_key: apiKey,
        }),
        signal: AbortSignal.timeout(15_000),
      });
      // Termii answers 200 with a body even for some failures; treat both.
      const payload = (await response.json().catch(() => null)) as {
        message?: string;
        smsStatus?: string;
      } | null;
      const ok =
        response.ok &&
        (payload?.smsStatus === "Message Sent" || payload?.message === "Successfully Sent");
      if (ok) return { ok: true as const };
      return {
        ok: false as const,
        error: `Termii error: ${response.status} ${payload?.message ?? response.statusText}`,
        // 4xx apart from 429 means the request itself is wrong — do not retry.
        permanent: response.status >= 400 && response.status < 500 && response.status !== 429,
      };
    } catch (error) {
      return {
        ok: false as const,
        error: error instanceof Error ? error.message : "Termii request failed.",
      };
    }
  },
};

/** WhatsApp adapter stub — wire the WhatsApp Cloud API or Termii when needed. */
function stubAdapter(channel: AlertChannel): ChannelAdapter {
  return {
    channel,
    configured: false,
    async send() {
      return { ok: false, error: `${channel} provider is not configured yet.`, permanent: false };
    },
  };
}

const adapters: Record<AlertChannel, ChannelAdapter> = {
  [AlertChannel.EMAIL]: emailAdapter,
  [AlertChannel.SMS]: smsAdapter,
  [AlertChannel.WHATSAPP]: stubAdapter(AlertChannel.WHATSAPP),
};

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function kindLabelFromSubject(subject: string) {
  return subject.length > 60 ? "Notification" : subject;
}

/* ------------------------------------------------------------------
   Queueing helpers
   ------------------------------------------------------------------ */

export type QueueJobInput = {
  schoolId: string;
  kind: NotificationKind;
  channel: AlertChannel;
  subject: string;
  body: string;
  recipientName?: string | null;
  recipientEmail?: string | null;
  recipientPhone?: string | null;
  dedupeKey?: string | null;
  metadata?: Prisma.InputJsonValue;
  /**
   * The user this job is addressed to, when known.
   *
   * NotificationJob is keyed by email address, not by user, so the dispatcher
   * cannot work out whose preferences to honour on its own. Callers that DO
   * know the recipient pass it here and the job is skipped when that user has
   * muted the category. Omitting it means "no preference check" — which is the
   * old behaviour, and correct for jobs addressed to a bare guardian email
   * with no account behind it.
   */
  recipientUserId?: string | null;
};

/**
 * Queue an outbound notification (email/SMS/WhatsApp).
 *
 * Returns null when the recipient has muted this category. Drop 11 gated PUSH
 * on notification preferences but left this path untouched, so a parent who
 * turned "Fees" off stopped getting the push and kept getting the email.
 *
 * Same rules as push, deliberately: the category map is shared, and an
 * unmapped kind (SYSTEM, ADMISSION_UPDATE) is always sent. Two different
 * answers to "is this muted?" would be a bug waiting to happen.
 */
export async function queueNotificationJob(input: QueueJobInput) {
  if (input.recipientUserId) {
    const { userAllowsDelivery } = await import("@/lib/notification-prefs");
    // Same predicate as push — one definition of "muted", not two.
    if (!(await userAllowsDelivery(input.recipientUserId, input.kind))) return null;
  }

  if (input.dedupeKey) {
    const existing = await prisma.notificationJob.findUnique({
      where: { dedupeKey: input.dedupeKey },
    });
    if (existing) return existing;
  }
  return prisma.notificationJob.create({
    data: {
      schoolId: input.schoolId,
      kind: input.kind,
      channel: input.channel,
      subject: input.subject,
      body: input.body,
      recipientName: input.recipientName || null,
      recipientEmail: input.recipientEmail || null,
      recipientPhone: input.recipientPhone || null,
      dedupeKey: input.dedupeKey || null,
      metadata: input.metadata,
    },
  });
}

export type InAppNotificationInput = {
  schoolId: string;
  userId: string;
  kind: NotificationKind;
  title: string;
  body: string;
  link?: string | null;
  /** Set false to suppress mobile push (in-app row is still written). */
  push?: boolean;
};

/**
 * Create an in-app notification AND deliver it to the user's mobile devices.
 *
 * Push was previously a dead end: the mobile app registered device tokens at
 * /api/push/register and lib/push.ts could send to them, but nothing ever
 * called it — sendPush() had zero callers. Tokens accumulated and no push was
 * ever delivered, so the app was a portal you had to remember to open rather
 * than something that tells you your child was marked absent.
 *
 * Hooking it here rather than at each call site means every existing and
 * future in-app notification (fee reminders, report-card releases, attendance
 * alerts, broadcasts) gains push delivery with no extra work, and the two can
 * never drift apart.
 *
 * Push is fire-and-forget: the in-app row is the source of truth and is
 * already committed, so a failure at Expo's gateway must not fail the caller.
 */
export async function createInAppNotification(input: InAppNotificationInput) {
  const notification = await prisma.userNotification.create({
    data: {
      schoolId: input.schoolId,
      userId: input.userId,
      kind: input.kind,
      title: input.title,
      body: input.body,
      link: input.link || null,
    },
  });

  if (input.push !== false) {
    void deliverPush(input).catch(() => {
      /* never surface a push failure to the caller */
    });
  }

  return notification;
}

async function deliverPush(input: InAppNotificationInput) {
  // Honour the user's notification preferences. This suppresses the PUSH only —
  // the in-app row above is already written and stays in their notification
  // list. "Stop buzzing my phone about fees" is not "hide my invoice from me".
  const { userAllowsDelivery } = await import("@/lib/notification-prefs");
  if (!(await userAllowsDelivery(input.userId, input.kind))) return;

  const { pushUser } = await import("@/lib/push");
  await pushUser(
    input.userId,
    {
      title: input.title,
      body: input.body,
      data: {
        kind: input.kind,
        // Deep-link target so tapping the notification opens the right screen
        // instead of dumping the user on the dashboard.
        link: input.link || null,
      },
    },
    // Scope the token lookup to the tenant. Every in-app notification already
    // carries a schoolId; it simply was not being passed down, so the token
    // read ran unscoped by userId alone.
    input.schoolId,
  );
}

/* ------------------------------------------------------------------
   Dispatcher — processes due PENDING jobs with retry/backoff.
   Called from the protected /api/jobs/dispatch-notifications route
   (cron) and from the admin console's "Dispatch now" button.
   ------------------------------------------------------------------ */

const BACKOFF_MINUTES = [5, 30, 120];
const PROCESSING_LEASE_MS = 2 * 60_000;

export async function dispatchDueNotifications(limit = 25) {
  const now = new Date();
  const due = await prisma.notificationJob.findMany({
    where: { status: AlertDeliveryStatus.PENDING, nextAttemptAt: { lte: now } },
    orderBy: { nextAttemptAt: "asc" },
    take: Math.min(Math.max(limit, 1), 100),
  });

  let sent = 0;
  let failed = 0;
  let skipped = 0;
  let retried = 0;

  for (const job of due) {
    const leaseUntil = new Date(Date.now() + PROCESSING_LEASE_MS);
    const claim = await prisma.notificationJob.updateMany({
      where: { id: job.id, status: AlertDeliveryStatus.PENDING, nextAttemptAt: { lte: now } },
      data: { nextAttemptAt: leaseUntil, lastError: "PROCESSING lease claimed" },
    });
    if (claim.count !== 1) continue;

    const adapter = adapters[job.channel];

    // Channels without a configured provider are skipped (not failed) so
    // they can be re-activated later without losing history.
    if (!adapter.configured) {
      await prisma.notificationJob.update({
        where: { id: job.id },
        data: {
          status: AlertDeliveryStatus.SKIPPED,
          lastError: `${job.channel} provider not configured.`,
          attempts: { increment: 1 },
        },
      });
      skipped += 1;
      continue;
    }

    const result = await adapter.send({
      recipientName: job.recipientName,
      recipientEmail: job.recipientEmail,
      recipientPhone: job.recipientPhone,
      subject: job.subject,
      body: job.body,
    });

    if (result.ok) {
      await prisma.notificationJob.update({
        where: { id: job.id },
        data: {
          status: AlertDeliveryStatus.SENT,
          sentAt: new Date(),
          attempts: { increment: 1 },
          lastError: null,
        },
      });
      sent += 1;
      continue;
    }

    const attempts = job.attempts + 1;
    const exhausted = result.permanent || attempts >= job.maxAttempts;
    if (exhausted) {
      await prisma.notificationJob.update({
        where: { id: job.id },
        data: { status: AlertDeliveryStatus.FAILED, attempts, lastError: result.error },
      });
      failed += 1;
    } else {
      const backoff = BACKOFF_MINUTES[Math.min(attempts - 1, BACKOFF_MINUTES.length - 1)];
      await prisma.notificationJob.update({
        where: { id: job.id },
        data: {
          attempts,
          lastError: result.error,
          nextAttemptAt: new Date(Date.now() + backoff * 60_000),
        },
      });
      retried += 1;
    }
  }

  return { processed: due.length, sent, failed, retried, skipped };
}

/* ------------------------------------------------------------------
   Bridge: convert queued AttendanceAlertJob rows (created by the
   attendance register) into NotificationJob deliveries + in-app
   notifications for linked parents.
   ------------------------------------------------------------------ */

export async function bridgeAttendanceAlerts(limit = 50) {
  const pending = await prisma.attendanceAlertJob.findMany({
    where: { status: AlertDeliveryStatus.PENDING },
    orderBy: { createdAt: "asc" },
    take: Math.min(Math.max(limit, 1), 200),
    include: {
      parentProfile: { select: { userId: true } },
    },
  });

  let bridged = 0;
  for (const alert of pending) {
    await queueNotificationJob({
      schoolId: alert.schoolId,
      kind: NotificationKind.ATTENDANCE_ALERT,
      channel: alert.channel,
      subject: "Attendance alert from Ykay College",
      body: alert.messagePreview,
      recipientName: alert.recipientName,
      recipientEmail: alert.recipientEmail,
      recipientPhone: alert.recipientPhone,
      // Honour the parent's "Attendance" preference here too. Null when the
      // alert is addressed to a guardian with no account.
      recipientUserId: alert.parentProfile?.userId ?? null,
      dedupeKey: `att:${alert.id}`,
      metadata: { attendanceAlertJobId: alert.id },
    });

    if (alert.channel === AlertChannel.EMAIL && alert.parentProfile?.userId) {
      await createInAppNotification({
        schoolId: alert.schoolId,
        userId: alert.parentProfile.userId,
        kind: NotificationKind.ATTENDANCE_ALERT,
        title: "Attendance Alert",
        body: alert.messagePreview,
        link: "/parent/attendance",
      });
    }

    await prisma.attendanceAlertJob.update({
      where: { id: alert.id },
      data: { status: AlertDeliveryStatus.SENT, processedAt: new Date() },
    });
    bridged += 1;
  }

  return { bridged };
}
