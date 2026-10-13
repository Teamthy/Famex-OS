import { describe, it, expect, vi, beforeEach } from "vitest";

describe("Rate Limiting — Auth Endpoints", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("enforceRateLimit supports login kind", async () => {
    const { enforceRateLimit } = await import("@/lib/rate-limit");

    // First request should succeed (in-memory fallback)
    const result = await enforceRateLimit("login", "192.168.1.1");
    expect(result.success).toBe(true);
    expect(result.configurationError).toBe(false);
  });

  it("enforceRateLimit supports loginStrict kind", async () => {
    const { enforceRateLimit } = await import("@/lib/rate-limit");

    const result = await enforceRateLimit("loginStrict", "user@test.com");
    expect(result.success).toBe(true);
  });

  it("enforceRateLimit supports passwordReset kind", async () => {
    const { enforceRateLimit } = await import("@/lib/rate-limit");

    const result = await enforceRateLimit("passwordReset", "192.168.1.1");
    expect(result.success).toBe(true);
  });

  it("enforceRateLimit supports changePassword kind", async () => {
    const { enforceRateLimit } = await import("@/lib/rate-limit");

    const result = await enforceRateLimit("changePassword", "user@test.com");
    expect(result.success).toBe(true);
  });

  it("loginStrict rate limit triggers after 3 failures", async () => {
    const { enforceRateLimit } = await import("@/lib/rate-limit");
    const email = `brute-force-test-${Date.now()}@test.com`;

    // 3 requests should succeed
    for (let i = 0; i < 3; i++) {
      const r = await enforceRateLimit("loginStrict", email);
      expect(r.success).toBe(true);
    }

    // 4th should be blocked
    const blocked = await enforceRateLimit("loginStrict", email);
    expect(blocked.success).toBe(false);
    expect(blocked.retryAfterSeconds).toBeGreaterThan(0);
  });

  it("different IPs have separate rate limit counters", async () => {
    const { enforceRateLimit } = await import("@/lib/rate-limit");
    const ts = Date.now();

    // Exhaust limit for IP A
    for (let i = 0; i < 3; i++) {
      await enforceRateLimit("loginStrict", `ip-a-${ts}`);
    }
    const blockedA = await enforceRateLimit("loginStrict", `ip-a-${ts}`);
    expect(blockedA.success).toBe(false);

    // IP B should still be allowed
    const allowedB = await enforceRateLimit("loginStrict", `ip-b-${ts}`);
    expect(allowedB.success).toBe(true);
  });
});
