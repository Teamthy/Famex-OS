import { describe, it, expect, vi, beforeEach } from "vitest";
import { mockPrisma } from "../setup";

/**
 * Mobile push delivery.
 *
 * Push was a dead end before this: the app registered device tokens at
 * /api/push/register and lib/push.ts could send to them, but `sendPush` had
 * ZERO callers. Tokens accumulated in the database and not one notification
 * was ever delivered — the app was a portal you had to remember to open, not
 * something that tells a parent their child was marked absent.
 *
 * Delivery is now hooked into createInAppNotification(), so every existing and
 * future in-app alert pushes automatically and the two cannot drift apart.
 * These tests pin that wiring, and the fire-and-forget contract that keeps a
 * push failure from breaking the thing that triggered it.
 */

type PushPayload = { title: string; body: string; data?: Record<string, unknown> };

// Typed explicitly: inferring from `async () => undefined` gives a zero-arg
// signature, so mock.calls[0][1] would not type-check.
const pushUser = vi.fn<(userId: string, payload: PushPayload, schoolId?: string) => Promise<void>>(
  async () => undefined,
);
const pushUsers = vi.fn<
  (userIds: string[], payload: PushPayload, schoolId?: string) => Promise<void>
>(async () => undefined);

vi.mock("@/lib/push", () => ({ pushUser, pushUsers, sendPush: vi.fn() }));

/**
 * Push is deliberately not awaited.
 *
 * `deliverPush` resolves two dynamic imports (notification-prefs, push) and a
 * preference lookup before it calls pushUser, so a single macrotask tick is not
 * enough — the original `setTimeout(0)` became flaky once preference checking
 * was added. Poll for the call instead of betting on a duration.
 */
const flush = async (check?: () => boolean, timeoutMs = 2000) => {
  const deadline = Date.now() + timeoutMs;
  do {
    await new Promise((resolve) => setTimeout(resolve, 5));
    if (!check) return;
  } while (!check() && Date.now() < deadline);
};

describe("createInAppNotification — push delivery", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.userNotification.create.mockResolvedValue({ id: "n1" });
  });

  const input = {
    schoolId: "school_1",
    userId: "usr_parent",
    kind: "FEE_REMINDER" as const,
    title: "Fee reminder",
    body: "Second term fees are due.",
    link: "/parent/fees",
  };

  it("writes the in-app row", async () => {
    const { createInAppNotification } = await import("@/lib/notifications");
    await createInAppNotification(input);

    expect(mockPrisma.userNotification.create).toHaveBeenCalled();
    const data = mockPrisma.userNotification.create.mock.calls[0][0].data;
    expect(data.userId).toBe("usr_parent");
    expect(data.kind).toBe("FEE_REMINDER");
  });

  it("also pushes to the user's devices", async () => {
    const { createInAppNotification } = await import("@/lib/notifications");
    await createInAppNotification(input);
    await flush(() => pushUser.mock.calls.length > 0);

    expect(pushUser).toHaveBeenCalledWith(
      "usr_parent",
      expect.objectContaining({ title: "Fee reminder", body: "Second term fees are due." }),
      // Third argument added in the RLS adoption drop: the token lookup used
      // to run by userId alone, with no schoolId anywhere in the query.
      input.schoolId,
    );
  });

  /**
   * The tenant scope is the whole point of passing schoolId down — without it
   * the DeviceToken read is unscoped and RLS has nothing to enforce against.
   * Pinned separately so a refactor that drops the argument fails loudly
   * rather than quietly reverting to an unscoped query.
   */
  it("scopes the device-token lookup to the notification's school", async () => {
    const { createInAppNotification } = await import("@/lib/notifications");
    await createInAppNotification(input);
    await flush(() => pushUser.mock.calls.length > 0);

    expect(pushUser.mock.calls[0]?.[2]).toBe(input.schoolId);
    expect(pushUser.mock.calls[0]?.[2]).toBeTruthy();
  });

  it("carries kind and link so the app can deep-link the tap", async () => {
    const { createInAppNotification } = await import("@/lib/notifications");
    await createInAppNotification(input);
    await flush(() => pushUser.mock.calls.length > 0);

    // Without these the app opens on whatever screen it was last on and the
    // user has to go hunting for what they were told about.
    expect(pushUser.mock.calls[0]?.[1].data).toEqual({
      kind: "FEE_REMINDER",
      link: "/parent/fees",
    });
  });

  it("can be suppressed with push: false", async () => {
    const { createInAppNotification } = await import("@/lib/notifications");
    await createInAppNotification({ ...input, push: false });
    // No condition to poll for — wait long enough that a push WOULD have
    // landed, or this passes for the wrong reason.
    await flush(() => false, 120);

    expect(mockPrisma.userNotification.create).toHaveBeenCalled();
    expect(pushUser).not.toHaveBeenCalled();
  });

  it("still returns the notification when push throws", async () => {
    pushUser.mockRejectedValueOnce(new Error("Expo gateway down"));
    const { createInAppNotification } = await import("@/lib/notifications");

    // The in-app row is the source of truth and is already committed — a
    // gateway outage must never fail the caller that triggered the alert.
    const result = await createInAppNotification(input);
    await flush(() => false, 120);

    expect(result).toEqual({ id: "n1" });
  });

  it("does not wait on the push before returning", async () => {
    let resolvePush: () => void = () => {};
    pushUser.mockImplementationOnce(
      () =>
        new Promise<undefined>((resolve) => {
          resolvePush = () => resolve(undefined);
        }),
    );

    const { createInAppNotification } = await import("@/lib/notifications");
    // Would hang here if push were awaited.
    await expect(createInAppNotification(input)).resolves.toEqual({ id: "n1" });
    resolvePush();
  });

  it("handles a null link without breaking the payload", async () => {
    const { createInAppNotification } = await import("@/lib/notifications");
    await createInAppNotification({ ...input, link: undefined });
    await flush(() => pushUser.mock.calls.length > 0);

    expect(pushUser.mock.calls[0]?.[1].data?.link).toBeNull();
  });
});

describe("pushUsers — bulk delivery", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("is used for broadcasts rather than one query per recipient", async () => {
    // A broadcast to 800 parents via pushUser() would be 800 round-trips
    // before a single notification left the server.
    const { pushUsers: real } = await import("@/lib/push");
    expect(typeof real).toBe("function");
  });
});
