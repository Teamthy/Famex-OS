import { test, expect } from "@playwright/test";

/**
 * Public marketing home — no auth, no seed. Proves the FAMEX SCHOOLS landing
 * (not the platform shell) is what a visitor sees.
 */
test.describe("college home", () => {
  test("renders the FAMEX SCHOOLS hero, not the platform shell", async ({ page }) => {
    const response = await page.goto("/");
    expect(response?.status()).toBeLessThan(400);
    await expect(page.locator("body")).not.toContainText(/EDUos platform/i);
    await expect(page.getByText("FAMEX SCHOOLS", { exact: true }).first()).toBeVisible();
    await expect(
      page.getByRole("heading", { name: /A bright start\. A bold future\./i }),
    ).toBeVisible();
    await expect(page.getByRole("link", { name: /Apply Now/i }).first()).toBeVisible();
    await expect(page.getByRole("link", { name: /Student Portal/i }).first()).toBeVisible();
    await expect(page.getByRole("button", { name: "Toggle theme" })).toHaveCount(0);

    const navBottom = await page
      .locator("header")
      .first()
      .evaluate((node) => {
        return node.getBoundingClientRect().bottom;
      });
    const heroTop = await page.locator("#top").evaluate((node) => {
      return node.getBoundingClientRect().top;
    });
    expect(navBottom).toBeLessThanOrEqual(heroTop);
  });

  test("mobile navigation opens in its own row without horizontal overflow", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto("/");
    await page.getByRole("button", { name: "Open navigation menu" }).click();
    await expect(page.getByRole("navigation", { name: "Mobile home sections" })).toBeVisible();
    const navBottom = await page
      .locator("header")
      .first()
      .evaluate((node) => {
        return node.getBoundingClientRect().bottom;
      });
    const heroTop = await page.locator("#top").evaluate((node) => {
      return node.getBoundingClientRect().top;
    });
    expect(navBottom).toBeLessThanOrEqual(heroTop);
    const pageWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(pageWidth).toBeLessThanOrEqual(375);
  });

  test("the redesigned hero fits a narrow mobile viewport", async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 800 });
    await page.goto("/");
    await expect(
      page.getByRole("heading", { name: /A bright start\. A bold future\./i }),
    ).toBeVisible();
    await expect(page.getByRole("link", { name: /Explore admissions/i })).toBeVisible();
    const pageWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(pageWidth).toBeLessThanOrEqual(360);
  });

  test("hero uses a real campus photograph, not a remote placeholder", async ({ page }) => {
    await page.goto("/");
    // Served through the next/image optimizer, so match on the file name.
    const heroImg = page.locator("section img[src*='hero-campus']");
    await expect(heroImg.first()).toBeAttached();
  });
});
