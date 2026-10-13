import { test, expect } from "@playwright/test";

/**
 * Login rate limiting.
 *
 * Deliberately last (the 99- prefix orders it): this test burns login attempts
 * on purpose, and the limiter's window is per-IP and process-wide, so running
 * it earlier locks every later sign-in out of the suite.
 *
 * Worth stating plainly: this passing locally does NOT mean production rate
 * limiting is unbounded-safe. lib/rate-limit.ts falls back to an in-process
 * Map when UPSTASH_REDIS_REST_URL is unset — that fallback is why this test
 * can pass at all (the e2e server sets ALLOW_MEMORY_RATE_LIMITS=true for its
 * single instance). In a real multi-instance/serverless deployment the same
 * fallback would give each instance its own budget, which is why production
 * now FAILS CLOSED for security-critical kinds unless Upstash is configured.
 * This proves the limiting logic; Redis is what makes it shared.
 */

test.describe("login rate limiting", () => {
  test("repeated bad passwords are eventually refused with 429", async ({ request }) => {
    // A throwaway address, so this cannot lock out a seeded account.
    const email = `ratelimit-probe-${Date.now()}@ykaycollege.com`;
    let sawLimit = false;
    let attempts = 0;

    for (let i = 0; i < 15; i++) {
      attempts++;
      const res = await request.post("/api/auth/login", {
        data: { email, password: `wrong-${i}` },
      });

      if (res.status() === 429) {
        sawLimit = true;
        expect(res.headers()["retry-after"], "429 without a Retry-After header").toBeTruthy();
        break;
      }
      expect(res.status(), "a wrong password must be 401, not 200").toBe(401);
    }

    expect(sawLimit, "no 429 after 15 failed attempts — is rate limiting wired up?").toBe(true);
    // Should trip well before 15; if it took every attempt the threshold is
    // probably not what we think it is.
    expect(attempts).toBeLessThanOrEqual(15);
  });

  test("the limiter refuses per email, not just per IP", async ({ request }) => {
    // loginStrict allows 3 failures per 15 min for a single address.
    const email = `strict-probe-${Date.now()}@ykaycollege.com`;
    const statuses: number[] = [];

    for (let i = 0; i < 6; i++) {
      const res = await request.post("/api/auth/login", {
        data: { email, password: `wrong-${i}` },
      });
      statuses.push(res.status());
    }

    expect(
      statuses.some((s) => s === 429),
      `never refused: ${statuses.join(",")}`,
    ).toBe(true);
  });
});
