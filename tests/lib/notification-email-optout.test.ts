import { describe, it, expect, vi, beforeEach } from "vitest";
import { AlertChannel, NotificationKind } from "@prisma/client";

/**
 * Email opt-out.
 *
 * Drop 11 gated PUSH on notification preferences but left the queued email
 * path untouched, so a parent who turned "Fees" off stopped getting the push
 * and kept getting the email — arguably the more intrusive of the two.
 *
 * NotificationJob is keyed by email address, not by user, so the dispatcher
 * cannot infer whose preferences apply. Callers that know the recipient pass
 * `recipientUserId`; omitting it means "no preference check", which is correct
 * for a bare guardian address with no account behind it.
 */

const { prisma } = await import("@/lib/prisma");
const mockPrisma = prisma as unknown as {
  notificationPreference: { findUnique: ReturnType<typeof vi.fn> };
  notificationJob: {
    findUnique: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
  };
};

function prefRow(over: Record<string, unknown> = {}) {
  return {
    id: "np-1",
    schoolId: "school-1",
    userId: "user-1",
    announcements: true,
    attendance: true,
    fees: true,
    results: true,
    ...over,
  };
}

const baseJob = {
  schoolId: "school-1",
  channel: AlertChannel.EMAIL,
  subject: "Fee reminder",
  body: "You owe money",
  recipientEmail: "parent@example.com",
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.resetModules();
  mockPrisma.notificationJob.findUnique.mockResolvedValue(null);
  mockPrisma.notificationJob.create.mockResolvedValue({ id: "job-1" });
});

describe("queueNotificationJob — preference gating", () => {
  it("queues the email when the category is on", async () => {
    mockPrisma.notificationPreference.findUnique.mockResolvedValue(prefRow());
    const { queueNotificationJob } = await import("@/lib/notifications");

    const job = await queueNotificationJob({
      ...baseJob,
      kind: NotificationKind.FEE_REMINDER,
      recipientUserId: "user-1",
    });

    expect(job).not.toBeNull();
    expect(mockPrisma.notificationJob.create).toHaveBeenCalledTimes(1);
  });

  it("does NOT queue the email when the recipient muted that category", async () => {
    mockPrisma.notificationPreference.findUnique.mockResolvedValue(prefRow({ fees: false }));
    const { queueNotificationJob } = await import("@/lib/notifications");

    const job = await queueNotificationJob({
      ...baseJob,
      kind: NotificationKind.FEE_REMINDER,
      recipientUserId: "user-1",
    });

    expect(job).toBeNull();
    expect(mockPrisma.notificationJob.create).not.toHaveBeenCalled();
  });

  it("muting fees does not suppress an unrelated category", async () => {
    mockPrisma.notificationPreference.findUnique.mockResolvedValue(prefRow({ fees: false }));
    const { queueNotificationJob } = await import("@/lib/notifications");

    const job = await queueNotificationJob({
      ...baseJob,
      kind: NotificationKind.REPORT_RELEASED,
      recipientUserId: "user-1",
    });

    expect(job).not.toBeNull();
    expect(mockPrisma.notificationJob.create).toHaveBeenCalledTimes(1);
  });

  it("sends when no recipientUserId is supplied — a bare guardian address", async () => {
    // Nobody has expressed a preference, so there is nothing to honour.
    const { queueNotificationJob } = await import("@/lib/notifications");

    const job = await queueNotificationJob({ ...baseJob, kind: NotificationKind.FEE_REMINDER });

    expect(job).not.toBeNull();
    expect(mockPrisma.notificationPreference.findUnique).not.toHaveBeenCalled();
    expect(mockPrisma.notificationJob.create).toHaveBeenCalledTimes(1);
  });

  it("treats an explicit null recipientUserId the same as omitted", async () => {
    const { queueNotificationJob } = await import("@/lib/notifications");

    const job = await queueNotificationJob({
      ...baseJob,
      kind: NotificationKind.FEE_REMINDER,
      recipientUserId: null,
    });

    expect(job).not.toBeNull();
    expect(mockPrisma.notificationJob.create).toHaveBeenCalledTimes(1);
  });

  it("still sends SYSTEM mail with every category muted", async () => {
    mockPrisma.notificationPreference.findUnique.mockResolvedValue(
      prefRow({ announcements: false, attendance: false, fees: false, results: false }),
    );
    const { queueNotificationJob } = await import("@/lib/notifications");

    const job = await queueNotificationJob({
      ...baseJob,
      kind: NotificationKind.SYSTEM,
      recipientUserId: "user-1",
    });

    expect(job).not.toBeNull();
  });

  it("defaults to sending when the user has no preference row", async () => {
    mockPrisma.notificationPreference.findUnique.mockResolvedValue(null);
    const { queueNotificationJob } = await import("@/lib/notifications");

    const job = await queueNotificationJob({
      ...baseJob,
      kind: NotificationKind.FEE_REMINDER,
      recipientUserId: "user-1",
    });

    expect(job).not.toBeNull();
  });

  it("checks the preference BEFORE the dedupe lookup", async () => {
    // A muted job must not consume its dedupeKey — otherwise re-enabling the
    // category would find the key already taken and stay silent forever.
    mockPrisma.notificationPreference.findUnique.mockResolvedValue(prefRow({ fees: false }));
    const { queueNotificationJob } = await import("@/lib/notifications");

    await queueNotificationJob({
      ...baseJob,
      kind: NotificationKind.FEE_REMINDER,
      recipientUserId: "user-1",
      dedupeKey: "fee-rem:1:email",
    });

    expect(mockPrisma.notificationJob.findUnique).not.toHaveBeenCalled();
    expect(mockPrisma.notificationJob.create).not.toHaveBeenCalled();
  });

  it("gates SMS and WhatsApp the same way, not just email", async () => {
    mockPrisma.notificationPreference.findUnique.mockResolvedValue(prefRow({ attendance: false }));
    const { queueNotificationJob } = await import("@/lib/notifications");

    for (const channel of [AlertChannel.SMS, AlertChannel.WHATSAPP]) {
      const job = await queueNotificationJob({
        ...baseJob,
        channel,
        kind: NotificationKind.ATTENDANCE_ALERT,
        recipientUserId: "user-1",
      });
      expect(job).toBeNull();
    }
  });
});

describe("push and email share one definition of 'muted'", () => {
  it("exposes the renamed predicate and keeps the old name working", async () => {
    const mod = await import("@/lib/notification-prefs");
    expect(typeof mod.allowsDelivery).toBe("function");
    expect(typeof mod.userAllowsDelivery).toBe("function");
    // Deprecated aliases — kept so no call site silently changed meaning.
    expect(mod.allowsPush).toBe(mod.allowsDelivery);
    expect(mod.userAllowsPush).toBe(mod.userAllowsDelivery);
  });

  it("agrees between the two channels for the same user and kind", async () => {
    const { allowsDelivery, NOTIFICATION_PREF_DEFAULTS } = await import("@/lib/notification-prefs");
    const muted = { ...NOTIFICATION_PREF_DEFAULTS, results: false };
    // One predicate, so agreement is structural rather than coincidental.
    expect(allowsDelivery(muted, NotificationKind.REPORT_RELEASED)).toBe(false);
    expect(allowsDelivery(muted, NotificationKind.FEE_REMINDER)).toBe(true);
  });
});
