import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect } from "vitest";

/**
 * The E2E suite must stay inside the real login rate limit.
 *
 * `/api/auth/login` allows 10 attempts per 15 min per IP (lib/rate-limit.ts)
 * and the limiter lives in the SERVER process — it is not weakened for tests,
 * deliberately (see tests/e2e/helpers.ts header). Two failure modes have
 * already happened once and must not regress silently:
 *
 * 1. A worker restart lost the in-memory session cache while the server's
 *    count stood (one chromium crash in CI, 2026-11-08), so every later spec
 *    signed in afresh and the suite drowned in misleading 429s. The cache is
 *    now persisted under test-results/ and restored at module load.
 * 2. The limiter-burning spec sorted BEFORE axe-smoke ("99-" < "axe"), so
 *    "deliberately last" was only true by luck. It is now "zz-", and these
 *    tests enforce that nothing sorts after it.
 *
 * These are source-level guards because both regressions pass every other
 * test while making the whole E2E gate flaky-red — the exact failure shape
 * that wastes a release cycle.
 */

const ROOT = process.cwd();

function text(path: string): string {
  return readFileSync(join(ROOT, path), "utf8");
}

describe("E2E login budget", () => {
  it("persists the session cache so a worker restart costs zero logins", () => {
    const helpers = text("tests/e2e/helpers.ts");
    expect(helpers, "helpers must write the session cache to disk").toMatch(/persistSessions/);
    expect(helpers, "the cache file must live under test-results/ (wiped per run)").toMatch(
      /test-results/,
    );
    expect(helpers, "the cache must be restored at module load").toMatch(
      /readFileSync\(SESSIONS_FILE/,
    );
    // Both login paths must persist: the form login and the API login.
    const persistCalls = helpers.match(/persistSessions\(\);/g) ?? [];
    expect(
      persistCalls.length,
      "persistSessions() must run after the budget bump and after BOTH login paths cache a session",
    ).toBeGreaterThanOrEqual(3);
  });

  it("keeps the form-login budget below the server limit", () => {
    const helpers = text("tests/e2e/helpers.ts");
    const budget = /const LOGIN_BUDGET = (\d+)/.exec(helpers);
    expect(budget, "LOGIN_BUDGET must stay an explicit constant").toBeTruthy();

    const limits = text("lib/rate-limit.ts");
    const loginMax = /login: \{ maxRequests: (\d+)/.exec(limits);
    expect(loginMax, "login limiter must stay declared in lib/rate-limit.ts").toBeTruthy();

    // Spare attempts must remain for the negative-path tests (wrong password,
    // the rate-limit spec itself) — the budget may never equal the full limit.
    expect(Number(budget![1])).toBeLessThan(Number(loginMax![1]));
  });

  it("runs the limiter-burning spec strictly last", () => {
    const specs = readdirSync(join(ROOT, "tests/e2e"))
      .filter((f) => f.endsWith(".spec.ts"))
      .sort();
    expect(specs.length, "the E2E suite should still have specs").toBeGreaterThan(0);
    expect(
      specs[specs.length - 1],
      "zz-rate-limit.spec.ts burns the per-IP login budget on purpose; nothing may sort after it",
    ).toBe("zz-rate-limit.spec.ts");
  });
});
