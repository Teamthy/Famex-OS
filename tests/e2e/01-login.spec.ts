import { test, expect } from "@playwright/test";
import { loginViaForm, apiLogin, ACCOUNTS, PASSWORD, HOME_FOR } from "./helpers";

/**
 * Journey 1 — sign in and land on the right dashboard.
 *
 * Everything else depends on this. It also covers the failure that unit tests
 * structurally cannot see: a route that 401s because a module lost an export,
 * or middleware redirecting a legitimate user into a loop.
 *
 * ── A real constraint this suite has to respect ────────────────────────────
 * /api/auth/login allows 10 attempts per 15 minutes PER IP, and the in-memory
 * limiter is a process-level Map, so the window survives between test runs
 * until the server restarts. The whole suite shares one IP. Sign-ins are
 * therefore rationed: form logins happen only where the form itself is the
 * thing under test, and everything else reuses the issued cookie.
 *
 * This is not a workaround — it is the same budget a real browser gets, and
 * discovering it cost a full debugging cycle, so it is written down here.
 */

test.describe.serial("login", () => {
  test("an admin signs in through the form and reaches the admin console", async ({ page }) => {
    const session = await loginViaForm(page, "admin");

    expect(page.url()).toMatch(HOME_FOR.admin);
    // A shell that renders while every API call 401s is the exact symptom we
    // shipped before, so assert real content, not just the URL.
    await expect(page.locator("body")).not.toContainText(/unauthori[sz]ed/i);

    // Cookie flags are part of the login contract; a non-httpOnly session
    // cookie would be readable by any injected script.
    expect(session.httpOnly, "session cookie must be httpOnly").toBe(true);
    expect(String(session.sameSite).toLowerCase()).toBe("lax");
  });

  test("a teacher reaches the teacher dashboard, not the admin console", async ({ page }) => {
    await loginViaForm(page, "teacher");
    expect(page.url()).toMatch(HOME_FOR.teacher);
    expect(page.url()).not.toContain("/admin");
  });

  test("a student reaches the student dashboard", async ({ page }) => {
    await loginViaForm(page, "student");
    expect(page.url()).toMatch(HOME_FOR.student);
  });

  test("a parent reaches the parent dashboard", async ({ page }) => {
    await loginViaForm(page, "parent");
    expect(page.url()).toMatch(HOME_FOR.parent);
  });

  test("an anonymous visitor is redirected away from /admin", async ({ page }) => {
    await page.goto("/admin");
    await page.waitForURL(/\/login/, { timeout: 15_000 });
    expect(page.url()).toContain("/login");
  });

  test("a wrong password is refused and the user stays on /login", async ({ page }) => {
    await page.goto("/login");
    await page.locator('input[type="email"]').fill(ACCOUNTS.director);
    await page.locator('input[type="password"]').fill("definitely-not-the-password");

    const [response] = await Promise.all([
      page.waitForResponse((r) => r.url().includes("/api/auth/login"), { timeout: 20_000 }),
      page.getByRole("button", { name: /sign in/i }).click(),
    ]);

    expect(response.status()).toBe(401);
    // Next.js renders its own role="alert" route announcer, so match the
    // message rather than the role alone.
    await expect(page.getByText(/invalid email or password/i)).toBeVisible({ timeout: 10_000 });
    expect(page.url()).toContain("/login");

    const cookies = await page.context().cookies();
    expect(cookies.find((c) => c.name === "ykay_session")).toBeFalsy();
  });

  test("a teacher cannot reach an admin API route", async ({ request }) => {
    const cookie = await apiLogin(request, "teacher");
    const res = await request.get("/api/admin/fees/overview", { headers: { cookie } });
    // 401/403 are both correct refusals. 200 is a privilege-escalation bug.
    expect([401, 403]).toContain(res.status());
  });

  /**
   * Regression guard for the build break. /api/auth/whoami imports checkRole
   * and explainDenial from lib/session — when those exports vanished the unit
   * suite stayed green and only the build failed. A real request catches it.
   */
  test("whoami answers coherently, proving lib/session's exports resolve", async ({ request }) => {
    const cookie = await apiLogin(request, "admin");
    const res = await request.get("/api/auth/whoami", { headers: { cookie } });
    expect(res.status()).toBe(200);

    const body = await res.json();
    expect(body.authenticated).toBe(true);
    expect(body.session.email).toBe(ACCOUNTS.admin);
    expect(body.checks.admin).toBe("OK");
    expect(body.sessionRevoked).toBe(false);
  });

  /**
   * /api/admin/subjects is the other importer of checkRole/explainDenial, and
   * the one whose denial path now distinguishes 401 from 503.
   */
  test("the subjects route authorises an admin and refuses a student", async ({ request }) => {
    const adminCookie = await apiLogin(request, "admin");
    const ok = await request.get("/api/admin/subjects", { headers: { cookie: adminCookie } });
    expect(ok.status()).toBe(200);

    const studentCookie = await apiLogin(request, "student");
    const denied = await request.get("/api/admin/subjects", { headers: { cookie: studentCookie } });
    expect(denied.status()).toBe(401);
    // The denial says why, in a header, so a 401 is diagnosable from outside.
    expect(denied.headers()["x-auth-denied"]).toBeTruthy();
  });

  test("the old hardcoded password no longer works", async ({ request }) => {
    const res = await request.post("/api/auth/login", {
      data: { email: ACCOUNTS.bursar, password: "Ykay@2026" + "!Secure" },
    });
    expect(
      res.ok(),
      "the old hardcoded password still works — this database was seeded before the fix",
    ).toBeFalsy();
    expect(PASSWORD).not.toBe("Ykay@2026" + "!Secure");
  });
});
