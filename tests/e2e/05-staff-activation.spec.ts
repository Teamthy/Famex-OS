import { test, expect } from "@playwright/test";
import { useSession, apiLogin } from "./helpers";

/**
 * Journey 5 — staff activation and the public-path boundary.
 *
 * This page was completely broken once: /staff/activate sat inside the
 * protected "/staff" prefix, so middleware redirected the invited teacher to
 * /login — where they could not sign in, because activating is how they get a
 * password. An unescapable loop, and the only way in for new staff.
 *
 * The fix was to check publicPaths BEFORE the protected-prefix redirect. That
 * ordering is a single line and nothing else guards it, which is exactly the
 * kind of thing that gets reverted during a refactor.
 */

test.describe("staff activation", () => {
  test("the activation page is reachable WITHOUT a session", async ({ page }) => {
    // No login, deliberately — an invited teacher has no account yet.
    const response = await page.goto("/staff/activate?token=probe-token");

    expect(response!.status()).toBeLessThan(400);
    expect(
      page.url(),
      "activation redirected to /login — invited staff cannot get in (the old loop)",
    ).not.toContain("/login");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  });

  test("it presents a password form, not a sign-in wall", async ({ page }) => {
    await page.goto("/staff/activate?token=probe-token");

    const passwordFields = page.locator('input[type="password"]');
    await expect(passwordFields.first()).toBeVisible();
    // Set-password and confirm.
    expect(await passwordFields.count()).toBeGreaterThanOrEqual(1);
    await expect(page.getByRole("button", { name: /activate/i })).toBeVisible();
  });

  test("an invalid token is refused, not accepted", async ({ page }) => {
    await page.goto("/staff/activate?token=definitely-not-a-real-token");

    const passwordFields = page.locator('input[type="password"]');
    await passwordFields.first().fill("SomeStrongPassword123!");
    if ((await passwordFields.count()) > 1) {
      await passwordFields.nth(1).fill("SomeStrongPassword123!");
    }

    const [response] = await Promise.all([
      page.waitForResponse((r) => r.url().includes("/api/") && r.request().method() === "POST", {
        timeout: 20_000,
      }),
      page.getByRole("button", { name: /activate/i }).click(),
    ]);

    // Must refuse a forged token — and must not 500 doing it.
    expect(response.status()).toBeGreaterThanOrEqual(400);
    expect(response.status()).toBeLessThan(500);
  });

  test("protected staff pages still require a session", async ({ page }) => {
    // The fix must not have opened the whole /staff prefix.
    await page.goto("/staff/attendance");
    await page.waitForURL(/\/login/, { timeout: 15_000 });
    expect(page.url()).toContain("/login");
  });

  test("an admin can reach the staff invitation area", async ({ page, context }) => {
    await useSession(context, page, "admin");

    const response = await page.goto("/admin/staff-attendance");
    expect(response!.status()).toBeLessThan(400);
    await expect(page.locator("body")).not.toContainText(/unauthori[sz]ed/i);
  });

  test("a teacher cannot issue staff invitations", async ({ request }) => {
    const cookie = await apiLogin(request, "teacher");
    const res = await request.post("/api/admin/staff/invites", {
      headers: { cookie },
      data: { email: "should-not-work@example.com", role: "ADMIN" },
    });
    // A teacher minting an ADMIN invite is a privilege-escalation path.
    expect([401, 403, 404]).toContain(res.status());
  });
});
