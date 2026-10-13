import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

/**
 * Accessibility smoke gate (axe) on the public marketing pages.
 *
 * Runs inside the existing Browser E2E job — no extra server needed. Fails
 * the build on CRITICAL WCAG violations (the "invisible text / light on
 * light" class of bug); serious violations are logged for triage so a
 * pre-existing minor issue cannot blindside a deploy.
 */
const PAGES = [
  { path: "/", name: "home" },
  { path: "/admissions", name: "admissions" },
  { path: "/virtual", name: "virtual gateway" },
  { path: "/download", name: "download" },
  { path: "/it-education", name: "it education" },
  { path: "/faq", name: "faq" },
];

for (const { path, name } of PAGES) {
  test(`${name} (${path}) has no critical accessibility violations`, async ({ page }) => {
    await page.goto(path, { waitUntil: "load" });
    // Give fonts + hydration a beat so axe measures the real DOM.
    await page.waitForTimeout(800);

    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();

    const critical = results.violations.filter((v) => v.impact === "critical");
    const serious = results.violations.filter((v) => v.impact === "serious");

    if (serious.length > 0) {
      console.log(
        `[${path}] serious (non-blocking): ${serious
          .map((v) => `${v.id}×${v.nodes.length}`)
          .join(", ")}`,
      );
    }

    expect(
      critical,
      `[${path}] critical violations: ${JSON.stringify(
        critical.map((v) => ({ id: v.id, help: v.help, nodes: v.nodes.length })),
        null,
        2,
      )}`,
    ).toEqual([]);
  });
}
