import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

/**
 * C-005: security-critical rate limits must not silently downgrade to a
 * per-process Map in production. In serverless/multi-instance deployments a
 * process-local limiter is not a control at all, so without a distributed
 * store these kinds fail closed (routes translate configurationError into
 * 503) unless the deployment explicitly accepts the risk via
 * ALLOW_MEMORY_RATE_LIMITS=true.
 */

const ORIGINAL_ENV = { ...process.env };

async function freshLimiter() {
  vi.resetModules();
  return import("@/lib/rate-limit");
}

describe("enforceRateLimit — production fail-closed policy (C-005)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;
    delete process.env.ALLOW_MEMORY_RATE_LIMITS;
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  it("fails closed for login when production has no distributed store", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const { enforceRateLimit } = await freshLimiter();

    const result = await enforceRateLimit("login", "203.0.113.9");
    expect(result.success).toBe(false);
    expect(result.configurationError).toBe(true);
    expect(result.retryAfterSeconds).toBeGreaterThan(0);
  });

  it("fails closed for payment and admissions kinds, not just login", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const { enforceRateLimit } = await freshLimiter();

    for (const kind of ["payment", "draft", "signup", "staffActivate"] as const) {
      const result = await enforceRateLimit(kind, "203.0.113.9");
      expect(result.configurationError, kind).toBe(true);
      expect(result.success, kind).toBe(false);
    }
  });

  it("allows non-critical kinds to use the memory fallback in production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const { enforceRateLimit } = await freshLimiter();

    const result = await enforceRateLimit("message", "user_1");
    expect(result.success).toBe(true);
    expect(result.configurationError).toBe(false);
  });

  it("honours an explicit ALLOW_MEMORY_RATE_LIMITS acceptance", async () => {
    vi.stubEnv("NODE_ENV", "production");
    process.env.ALLOW_MEMORY_RATE_LIMITS = "true";
    const { enforceRateLimit } = await freshLimiter();

    const result = await enforceRateLimit("login", "203.0.113.10");
    expect(result.success).toBe(true);
    expect(result.configurationError).toBe(false);
  });

  it("keeps the memory fallback outside production (dev/test)", async () => {
    vi.stubEnv("NODE_ENV", "test");
    const { enforceRateLimit } = await freshLimiter();

    const result = await enforceRateLimit("login", "192.168.1.77");
    expect(result.success).toBe(true);
    expect(result.configurationError).toBe(false);
  });
});
