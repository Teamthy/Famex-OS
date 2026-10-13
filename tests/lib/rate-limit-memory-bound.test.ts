import { describe, expect, it } from "vitest";
import { enforceRateLimit } from "@/lib/rate-limit";

/**
 * The in-memory fallback store is keyed by attacker-influenced values (client
 * IP, submitted email) and used to be inserted-into forever: the only expiry
 * was a timestamp check on read, so a key never requested again lived for the
 * lifetime of the process. These tests pin the bound.
 *
 * They deliberately use a NON-critical kind ("message"). Critical kinds are in
 * DISTRIBUTED_REQUIRED and fail closed in production rather than reaching the
 * fallback, so they cannot exercise this path.
 */
describe("rate-limit in-memory fallback", () => {
  it("limits a single identifier within its window", async () => {
    const id = `bounded-${Date.now()}-single`;
    // "message" is configured at 60 requests per hour.
    for (let i = 0; i < 60; i += 1) {
      const res = await enforceRateLimit("message", id);
      expect(res.success).toBe(true);
    }
    const blocked = await enforceRateLimit("message", id);
    expect(blocked.success).toBe(false);
    expect(blocked.retryAfterSeconds).toBeGreaterThan(0);
  });

  it("evicts rather than growing without bound across many identifiers", async () => {
    // MEMORY_STORE_MAX_ENTRIES is 10_000. Fill past it with distinct
    // identifiers, each of which creates a new Map entry.
    const run = `bounded-${Date.now()}-many`;
    const first = `${run}-0`;

    // Claim the very first key and exhaust its budget, so we can later prove
    // the entry was dropped: an evicted key starts a fresh window and succeeds
    // again, whereas a retained one would still be blocked.
    for (let i = 0; i < 60; i += 1) {
      await enforceRateLimit("message", first);
    }
    expect((await enforceRateLimit("message", first)).success).toBe(false);

    for (let i = 1; i <= 10_500; i += 1) {
      await enforceRateLimit("message", `${run}-${i}`);
    }

    // If nothing was evicted, `first` is still inside its hour window and still
    // over budget → blocked. A successful response proves its entry is gone.
    const afterEviction = await enforceRateLimit("message", first);
    expect(afterEviction.success).toBe(true);
  }, 120_000);
});
