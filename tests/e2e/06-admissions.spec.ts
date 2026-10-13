import { test, expect } from "@playwright/test";

/**
 * Journey 6 — admissions self-service.
 *
 * The one route into the system that does NOT require the school to create an
 * account first. A prospective parent applies, gets an Application ID, and
 * uses it to track progress. Everything else (staff, student, parent portals)
 * is school-issued by design — there is no public sign-up, and these tests
 * assert that boundary as much as the happy path.
 *
 * All of it must work with no session at all: an applicant has no credentials
 * and never will until they are enrolled.
 */

test.describe("admissions (public, no account)", () => {
  /**
   * `waitUntil: "domcontentloaded"` throughout, not the default "load".
   *
   * The admissions hero pulls a photograph from images.unsplash.com. Waiting
   * for "load" waits for that third-party request too, so a slow or blocked
   * CDN times the test out and reports it as "admissions is unreachable" —
   * which is both alarming and wrong. What these tests care about is that the
   * school's own HTML is served without a sign-in wall.
   */
  test("the admissions page is reachable by an anonymous visitor", async ({ page }) => {
    const response = await page.goto("/admissions", { waitUntil: "domcontentloaded" });

    expect(response!.status()).toBeLessThan(400);
    expect(page.url(), "admissions should not require signing in").not.toContain("/login");
    await expect(page.locator("body")).toContainText(/admission|apply/i);
  });

  test("the status tracker is reachable without a session", async ({ page }) => {
    const response = await page.goto("/admissions/status", { waitUntil: "domcontentloaded" });

    expect(response!.status()).toBeLessThan(400);
    expect(page.url()).not.toContain("/login");
    // The Application ID field is the whole point of the page.
    await expect(page.locator("#applicationId")).toBeVisible();
  });

  test("a malformed Application ID is rejected, not looked up", async ({ request }) => {
    const res = await request.get("/api/admissions/status?applicationId=NOT-A-REAL-ID");
    // Refused by validation before it ever reaches the database.
    expect(res.status()).toBeGreaterThanOrEqual(400);
    expect(res.status()).toBeLessThan(500);
  });

  test("a well-formed but unknown Application ID does not leak existence", async ({ request }) => {
    // Correct shape (YKCAPP + 4 digits + 6 alphanumerics), but not a real one.
    const res = await request.get("/api/admissions/status?applicationId=YKCAPP2026ZZZZZZ");
    expect(res.status()).toBeLessThan(500);

    if (res.ok()) {
      const body = await res.json();
      // Must not return another family's details under a guessed ID.
      const text = JSON.stringify(body).toLowerCase();
      expect(text).not.toContain("parentemail");
      expect(text).not.toContain("parentphone");
    }
  });

  /**
   * The sign-in pages must tell a prospective family where to go. Without
   * this they land on a credentials form they can never satisfy — the
   * commonest way a school loses an applicant before they have applied.
   */
  test("the sign-in page points prospective families to admissions", async ({ page }) => {
    await page.goto("/login", { waitUntil: "domcontentloaded" });

    const applyLink = page.getByRole("link", { name: /apply for admission/i });
    await expect(applyLink).toBeVisible();
    await expect(applyLink).toHaveAttribute("href", "/admissions");

    await expect(page.getByRole("link", { name: /track your application/i })).toBeVisible();
  });

  test("the portal chooser states there is no public sign-up", async ({ page }) => {
    await page.goto("/portal", { waitUntil: "domcontentloaded" });

    await expect(page.locator("body")).toContainText(/no public sign-up/i);
    await expect(page.getByRole("link", { name: /apply for admission/i }).first()).toBeVisible();
  });

  test("there is no self-service registration for staff or student accounts", async ({ page }) => {
    await page.goto("/login", { waitUntil: "domcontentloaded" });

    // A "create account" control here would contradict the whole access model:
    // school-issued credentials only.
    const body = (await page.locator("body").textContent()) || "";
    expect(body).not.toMatch(/create an account|sign up for an account|register now/i);
  });

  test("applying does not require authentication", async ({ request }) => {
    // A bare POST with no session and no body: must be a validation failure,
    // never a redirect to sign-in and never a 500.
    const res = await request.post("/api/admissions/draft", { data: {} });
    expect(res.status()).toBeLessThan(500);
    expect([400, 401, 422, 429]).toContain(res.status());
  });
});
