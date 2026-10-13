import { test, expect } from "@playwright/test";
import { useSession } from "./helpers";

/**
 * Journey 2 — staff attendance, including the QR camera.
 *
 * This is the journey that was silently broken in production. next.config.ts
 * sent `Permissions-Policy: camera=()` on every response. An EMPTY allowlist
 * denies every origin including 'self', so html5-qrcode could never call
 * getUserMedia and QR check-in simply did nothing.
 *
 * No unit test could see it: the bug lived in a response header, and the only
 * symptom was a button that did not work. A browser is the only place this is
 * observable, which is precisely the argument for these tests existing.
 */

test.describe("staff attendance + QR camera", () => {
  test("the page sends a Permissions-Policy that ALLOWS the camera", async ({ page, context }) => {
    await useSession(context, page, "admin");

    const response = await page.goto("/admin/staff-attendance");
    expect(response, "no response for /admin/staff-attendance").toBeTruthy();

    const policy = response!.headers()["permissions-policy"] || "";
    expect(policy, "no Permissions-Policy header at all").toBeTruthy();

    // The regression, stated precisely: `camera=()` denies everyone.
    expect(
      policy,
      `camera is denied on the QR page — the scanner cannot work. Header: ${policy}`,
    ).not.toMatch(/camera=\(\)/);
    expect(policy).toMatch(/camera=\(self\)/);
  });

  test("microphone and geolocation stay denied on that page", async ({ page, context }) => {
    await useSession(context, page, "admin");
    const response = await page.goto("/admin/staff-attendance");
    const policy = response!.headers()["permissions-policy"] || "";

    // Granting the camera must not quietly widen anything else.
    expect(policy).toMatch(/microphone=\(\)/);
    expect(policy).toMatch(/geolocation=\(\)/);
  });

  test("every other page still denies the camera", async ({ page, context }) => {
    await useSession(context, page, "admin");
    const response = await page.goto("/admin");
    const policy = response!.headers()["permissions-policy"] || "";
    expect(policy).toMatch(/camera=\(\)/);
    expect(policy).not.toMatch(/camera=\(self\)/);
  });

  /**
   * The header is necessary but not sufficient — the browser has to actually
   * hand over a stream. This calls getUserMedia in the page, which is the exact
   * API html5-qrcode uses. With `camera=()` it rejects with a
   * NotAllowedError / SecurityError no matter what the user clicks.
   */
  test("the browser really grants a camera stream on that page", async ({ page, context }) => {
    await useSession(context, page, "admin");
    await page.goto("/admin/staff-attendance");

    const result = await page.evaluate(async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        const tracks = stream.getVideoTracks().length;
        stream.getTracks().forEach((t) => t.stop());
        return { ok: true, tracks };
      } catch (err) {
        return { ok: false, error: String(err) };
      }
    });

    expect(
      result.ok,
      `getUserMedia was refused — Permissions-Policy is still blocking it: ${JSON.stringify(result)}`,
    ).toBe(true);
    expect(result.tracks).toBeGreaterThan(0);
  });

  test("the Use camera control is present and toggles", async ({ page, context }) => {
    await useSession(context, page, "admin");
    await page.goto("/admin/staff-attendance");

    const toggle = page.getByRole("button", { name: /use camera/i });
    await expect(toggle).toBeVisible();

    await toggle.click();
    await expect(page.getByRole("button", { name: /hide camera/i })).toBeVisible();
  });

  test("a badge code can be submitted manually (the non-camera path)", async ({
    page,
    context,
  }) => {
    await useSession(context, page, "admin");
    await page.goto("/admin/staff-attendance");

    // The manual field must keep working — it is the fallback when a device
    // has no camera, and it is how attendance got taken while QR was broken.
    // Matched by placeholder: the input carries no type attribute.
    const field = page.getByPlaceholder(/badge code/i);
    await expect(field).toBeVisible();
    await field.fill("STAFF-DOES-NOT-EXIST");

    // An unknown badge should be reported, not swallowed, and must not 500.
    const [response] = await Promise.all([
      page.waitForResponse((r) => r.url().includes("/api/") && r.request().method() === "POST", {
        timeout: 15_000,
      }),
      field.press("Enter"),
    ]);
    expect(response.status()).toBeLessThan(500);
  });
});
