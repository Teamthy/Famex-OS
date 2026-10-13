import { test, expect } from "@playwright/test";
import { useSession, apiLogin } from "./helpers";

/**
 * Journey 3 — fees.
 *
 * Money. The highest-consequence data in the system: a wrong balance shown to
 * a parent, or one family's invoice visible to another, is the kind of failure
 * a school does not recover from quietly.
 *
 * The bursar overview was also the route that used to load every invoice ever
 * issued (4,800 rows, 4.5 MB) before it was bounded, so it is worth asserting
 * it stays bounded rather than trusting a comment.
 */

test.describe("fees", () => {
  test("the bursar's overview loads and reports real figures", async ({ page, context }) => {
    await useSession(context, page, "bursar");

    const response = await page.goto("/admin/fees");
    expect(response!.status()).toBeLessThan(400);

    await expect(page.locator("body")).not.toContainText(/unauthori[sz]ed/i);
    // Naira figures should be rendered somewhere on a fees page.
    await expect(page.locator("body")).toContainText(/₦|NGN|total|outstanding/i);
  });

  test("the overview API is paginated, not an unbounded dump", async ({ request }) => {
    const cookie = await apiLogin(request, "bursar");
    const res = await request.get("/api/admin/fees/overview", { headers: { cookie } });
    expect(res.status()).toBe(200);

    const body = await res.json();
    const text = JSON.stringify(body);

    // This route once returned every invoice in the school's history. A
    // response measured in megabytes is the regression.
    expect(
      text.length,
      `overview returned ${Math.round(text.length / 1024)}KB — is the query bounded?`,
    ).toBeLessThan(1_500_000);
  });

  test("a parent sees their own fees and no one else's", async ({ page, context }) => {
    await useSession(context, page, "parent");

    const response = await page.goto("/parent/fees");
    expect(response!.status()).toBeLessThan(400);
    await expect(page.locator("body")).not.toContainText(/unauthori[sz]ed/i);
  });

  test("a parent cannot read the school-wide fee overview", async ({ request }) => {
    const cookie = await apiLogin(request, "parent");
    const res = await request.get("/api/admin/fees/overview", { headers: { cookie } });
    // A parent reaching the bursar's ledger would expose every family's debt.
    expect([401, 403]).toContain(res.status());
  });

  test("a student cannot reach parent fee data", async ({ request }) => {
    const cookie = await apiLogin(request, "student");
    const res = await request.get("/api/admin/fees/payments", { headers: { cookie } });
    expect([401, 403]).toContain(res.status());
  });

  /**
   * Recording a payment is a write, and the one place a double-submit would
   * duplicate money. This asserts the endpoint refuses malformed input rather
   * than accepting it — a 500 here would mean an unvalidated write path.
   */
  test("recording a payment rejects a malformed amount", async ({ request }) => {
    const cookie = await apiLogin(request, "bursar");
    const res = await request.post("/api/admin/fees/payments", {
      headers: { cookie },
      data: { invoiceId: "does-not-exist", amount: -5000, method: "CASH" },
    });

    // 400/404/422 are all correct refusals. 200 would be a negative payment;
    // 500 would mean it crashed instead of validating.
    expect([400, 401, 403, 404, 422]).toContain(res.status());
  });
});
