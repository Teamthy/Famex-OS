import { describe, it, expect, vi, beforeEach } from "vitest";
import { NotificationKind } from "@prisma/client";

/**
 * Notification preferences.
 *
 * The four toggles in mobile Settings were written to expo-secure-store — on
 * the handset. The server decides whether to push, and could not read them, so
 * every toggle was decorative.
 *
 * Two rules these tests pin down:
 *   1. A "no" suppresses the PUSH only. The in-app row is still written.
 *   2. An unmapped kind is ALWAYS delivered. Adding a NotificationKind must not
 *      silently mute it because nobody added a toggle.
 */

const { prisma } = await import("@/lib/prisma");
const mockPrisma = prisma as unknown as {
  notificationPreference: {
    findUnique: ReturnType<typeof vi.fn>;
    findMany: ReturnType<typeof vi.fn>;
    upsert: ReturnType<typeof vi.fn>;
  };
  userNotification: { create: ReturnType<typeof vi.fn> };
  deviceToken: { findMany: ReturnType<typeof vi.fn> };
};

/**
 * Wait until `check()` is true, or give up.
 *
 * `createInAppNotification` fires the push with `void deliverPush(...)`, and
 * that path resolves three dynamic imports before it reaches fetch. A fixed
 * sleep is a bet on how long module resolution takes — it passed on a warm
 * cache and failed on Windows with a cold one. That is a flaky test, not a bug
 * in the code under test. Polling makes the assertion wait for the thing it is
 * actually about.
 */
async function waitFor(check: () => boolean, timeoutMs = 2000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (check()) return;
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
}

/** Give a floated promise a real chance to run before asserting it did NOT. */
async function settle(): Promise<void> {
  for (let index = 0; index < 20; index += 1) {
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
}

function row(over: Partial<Record<string, unknown>> = {}) {
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

beforeEach(() => {
  vi.clearAllMocks();
  vi.resetModules();
});

describe("categoryForKind", () => {
  it("maps the four user-facing kinds onto the four toggles", async () => {
    const { categoryForKind } = await import("@/lib/notification-prefs");
    expect(categoryForKind(NotificationKind.BROADCAST)).toBe("announcements");
    expect(categoryForKind(NotificationKind.ATTENDANCE_ALERT)).toBe("attendance");
    expect(categoryForKind(NotificationKind.FEE_REMINDER)).toBe("fees");
    expect(categoryForKind(NotificationKind.REPORT_RELEASED)).toBe("results");
  });

  it("leaves SYSTEM and ADMISSION_UPDATE unmapped — no toggle may mute them", async () => {
    const { categoryForKind } = await import("@/lib/notification-prefs");
    expect(categoryForKind(NotificationKind.SYSTEM)).toBeNull();
    expect(categoryForKind(NotificationKind.ADMISSION_UPDATE)).toBeNull();
  });

  it("covers every kind in the enum, mapped or deliberately not", async () => {
    // Guard against a new kind being added and nobody deciding either way.
    const { categoryForKind } = await import("@/lib/notification-prefs");
    for (const kind of Object.values(NotificationKind)) {
      expect(() => categoryForKind(kind)).not.toThrow();
    }
  });
});

describe("allowsPush", () => {
  it("blocks a kind whose category is off", async () => {
    const { allowsPush, NOTIFICATION_PREF_DEFAULTS } = await import("@/lib/notification-prefs");
    const prefs = { ...NOTIFICATION_PREF_DEFAULTS, fees: false };
    expect(allowsPush(prefs, NotificationKind.FEE_REMINDER)).toBe(false);
  });

  it("does not block unrelated categories", async () => {
    const { allowsPush, NOTIFICATION_PREF_DEFAULTS } = await import("@/lib/notification-prefs");
    const prefs = { ...NOTIFICATION_PREF_DEFAULTS, fees: false };
    expect(allowsPush(prefs, NotificationKind.REPORT_RELEASED)).toBe(true);
    expect(allowsPush(prefs, NotificationKind.ATTENDANCE_ALERT)).toBe(true);
    expect(allowsPush(prefs, NotificationKind.BROADCAST)).toBe(true);
  });

  it("delivers unmapped kinds even when every toggle is off", async () => {
    const { allowsPush } = await import("@/lib/notification-prefs");
    const allOff = { announcements: false, attendance: false, fees: false, results: false };
    expect(allowsPush(allOff, NotificationKind.SYSTEM)).toBe(true);
    expect(allowsPush(allOff, NotificationKind.ADMISSION_UPDATE)).toBe(true);
  });
});

describe("getNotificationPrefs", () => {
  it("returns all-on defaults when the user has no row", async () => {
    const { getNotificationPrefs } = await import("@/lib/notification-prefs");
    mockPrisma.notificationPreference.findUnique.mockResolvedValue(null);

    // Critical: a user who never opened Settings must keep receiving things.
    await expect(getNotificationPrefs("user-1")).resolves.toEqual({
      announcements: true,
      attendance: true,
      fees: true,
      results: true,
    });
  });

  it("returns the stored row when one exists", async () => {
    const { getNotificationPrefs } = await import("@/lib/notification-prefs");
    mockPrisma.notificationPreference.findUnique.mockResolvedValue(
      row({ fees: false, results: false }),
    );

    await expect(getNotificationPrefs("user-1")).resolves.toEqual({
      announcements: true,
      attendance: true,
      fees: false,
      results: false,
    });
  });
});

describe("getNotificationPrefsFor — the bulk path", () => {
  it("reads every user in ONE query, not one per user", async () => {
    const { getNotificationPrefsFor } = await import("@/lib/notification-prefs");
    mockPrisma.notificationPreference.findMany.mockResolvedValue([]);

    await getNotificationPrefsFor(["a", "b", "c", "d"]);
    // A broadcast to 800 parents must not be 800 round-trips.
    expect(mockPrisma.notificationPreference.findMany).toHaveBeenCalledTimes(1);
  });

  it("fills in defaults for users with no row", async () => {
    const { getNotificationPrefsFor } = await import("@/lib/notification-prefs");
    mockPrisma.notificationPreference.findMany.mockResolvedValue([
      row({ userId: "b", announcements: false }),
    ]);

    const map = await getNotificationPrefsFor(["a", "b"]);
    expect(map.get("a")).toEqual({
      announcements: true,
      attendance: true,
      fees: true,
      results: true,
    });
    expect(map.get("b")?.announcements).toBe(false);
  });

  it("short-circuits on an empty list without querying", async () => {
    const { getNotificationPrefsFor } = await import("@/lib/notification-prefs");
    const map = await getNotificationPrefsFor([]);
    expect(map.size).toBe(0);
    expect(mockPrisma.notificationPreference.findMany).not.toHaveBeenCalled();
  });
});

describe("setNotificationPrefs", () => {
  it("ignores unknown keys rather than writing them", async () => {
    const { setNotificationPrefs } = await import("@/lib/notification-prefs");
    mockPrisma.notificationPreference.upsert.mockResolvedValue(row({ fees: false }));

    await setNotificationPrefs("school-1", "user-1", {
      fees: false,
      // @ts-expect-error — deliberately invalid, must be dropped
      sms: true,
    });

    const args = mockPrisma.notificationPreference.upsert.mock.calls[0][0];
    expect(args.update).toEqual({ fees: false });
    expect(args.update).not.toHaveProperty("sms");
  });

  it("ignores non-boolean values", async () => {
    const { setNotificationPrefs } = await import("@/lib/notification-prefs");
    mockPrisma.notificationPreference.upsert.mockResolvedValue(row());

    await setNotificationPrefs("school-1", "user-1", {
      // @ts-expect-error — a string must not become a truthy write
      fees: "false",
    });
    expect(mockPrisma.notificationPreference.upsert.mock.calls[0][0].update).toEqual({});
  });

  it("creates with defaults plus the patch, so unspecified categories stay on", async () => {
    const { setNotificationPrefs } = await import("@/lib/notification-prefs");
    mockPrisma.notificationPreference.upsert.mockResolvedValue(row({ fees: false }));

    await setNotificationPrefs("school-1", "user-1", { fees: false });
    const create = mockPrisma.notificationPreference.upsert.mock.calls[0][0].create;
    expect(create).toMatchObject({
      schoolId: "school-1",
      userId: "user-1",
      announcements: true,
      attendance: true,
      results: true,
      fees: false,
    });
  });
});

describe("userAllowsPush", () => {
  it("does not hit the database for a kind nobody can mute", async () => {
    const { userAllowsPush } = await import("@/lib/notification-prefs");
    await expect(userAllowsPush("user-1", NotificationKind.SYSTEM)).resolves.toBe(true);
    expect(mockPrisma.notificationPreference.findUnique).not.toHaveBeenCalled();
  });

  it("consults the row for a muteable kind", async () => {
    const { userAllowsPush } = await import("@/lib/notification-prefs");
    mockPrisma.notificationPreference.findUnique.mockResolvedValue(row({ attendance: false }));
    await expect(userAllowsPush("user-1", NotificationKind.ATTENDANCE_ALERT)).resolves.toBe(false);
  });
});

describe("createInAppNotification honours preferences", () => {
  it("still writes the in-app row when push is muted", async () => {
    // The whole point: muting is about interruption, not about hiding the
    // user's own invoice from them.
    mockPrisma.userNotification.create.mockResolvedValue({ id: "n-1" });
    mockPrisma.notificationPreference.findUnique.mockResolvedValue(row({ fees: false }));
    mockPrisma.deviceToken.findMany.mockResolvedValue([{ token: "ExponentPushToken[x]" }]);

    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("{}"));

    const { createInAppNotification } = await import("@/lib/notifications");
    await createInAppNotification({
      schoolId: "school-1",
      userId: "user-1",
      kind: NotificationKind.FEE_REMINDER,
      title: "Fee reminder",
      body: "Outstanding balance",
    });

    expect(mockPrisma.userNotification.create).toHaveBeenCalledTimes(1);

    // Push is fire-and-forget. Give it a real chance to run before asserting
    // it did not — otherwise this passes for the wrong reason.
    await settle();
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it("pushes when the category is on", async () => {
    mockPrisma.userNotification.create.mockResolvedValue({ id: "n-2" });
    mockPrisma.notificationPreference.findUnique.mockResolvedValue(row());
    mockPrisma.deviceToken.findMany.mockResolvedValue([{ token: "ExponentPushToken[x]" }]);

    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("{}"));

    const { createInAppNotification } = await import("@/lib/notifications");
    await createInAppNotification({
      schoolId: "school-1",
      userId: "user-1",
      kind: NotificationKind.FEE_REMINDER,
      title: "Fee reminder",
      body: "Outstanding balance",
    });

    await waitFor(() => fetchSpy.mock.calls.length > 0);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    fetchSpy.mockRestore();
  });

  it("pushes a SYSTEM notice even with every category off", async () => {
    mockPrisma.userNotification.create.mockResolvedValue({ id: "n-3" });
    mockPrisma.notificationPreference.findUnique.mockResolvedValue(
      row({ announcements: false, attendance: false, fees: false, results: false }),
    );
    mockPrisma.deviceToken.findMany.mockResolvedValue([{ token: "ExponentPushToken[x]" }]);

    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("{}"));

    const { createInAppNotification } = await import("@/lib/notifications");
    await createInAppNotification({
      schoolId: "school-1",
      userId: "user-1",
      kind: NotificationKind.SYSTEM,
      title: "Password changed",
      body: "Your password was changed.",
    });

    await waitFor(() => fetchSpy.mock.calls.length > 0);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    fetchSpy.mockRestore();
  });

  it("respects push:false regardless of preferences", async () => {
    mockPrisma.userNotification.create.mockResolvedValue({ id: "n-4" });
    mockPrisma.notificationPreference.findUnique.mockResolvedValue(row());
    mockPrisma.deviceToken.findMany.mockResolvedValue([{ token: "ExponentPushToken[x]" }]);

    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("{}"));

    const { createInAppNotification } = await import("@/lib/notifications");
    await createInAppNotification({
      schoolId: "school-1",
      userId: "user-1",
      kind: NotificationKind.BROADCAST,
      title: "Quiet",
      body: "No push",
      push: false,
    });

    await settle();
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });
});
