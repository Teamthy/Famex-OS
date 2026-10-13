import { test, expect } from "@playwright/test";

/**
 * Public marketing home — no auth, no seed. Proves the Ykay College landing
 * (not the platform shell) is what a visitor sees.
 */
test.describe("college home", () => {
  test("renders the Ykay College hero, not the platform shell", async ({ page }) => {
    const response = await page.goto("/");
    expect(response?.status()).toBeLessThan(400);
    await expect(page.locator("body")).not.toContainText(/EDUos platform/i);
    await expect(page.getByRole("heading", { name: /Excellence in Education/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /Apply Now/i }).first()).toBeVisible();
    await expect(page.getByRole("link", { name: /Student Portal/i }).first()).toBeVisible();
  });

  test("hero uses a real campus photograph, not a remote placeholder", async ({ page }) => {
    await page.goto("/");
    // Served through the next/image optimizer, so match on the file name.
    const heroImg = page.locator("section img[src*='hero-campus']");
    await expect(heroImg.first()).toBeAttached();
  });
});
