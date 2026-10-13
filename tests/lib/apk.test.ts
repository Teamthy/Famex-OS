import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { apkDownloadPath, apkFallbackUrl, apkQrDataUrl, apkSizeLabel, apkUrl } from "@/lib/apk";

/**
 * APK download URL resolution.
 *
 * The Android app is distributed as a direct download, so this URL appears on
 * the homepage CTA, the hero, /download and the mobile version-gate API. It
 * was previously read straight from `process.env` in four places under TWO
 * different names (`NEXT_PUBLIC_APK_URL` and `MOBILE_APK_URL`), so configuring
 * one left the others silently pointing at nothing — and the hero fell back to
 * an anchor link that goes nowhere.
 */

const KEYS = [
  "NEXT_PUBLIC_APK_URL",
  "MOBILE_APK_URL",
  "NEXT_PUBLIC_APK_FALLBACK_URL",
  "NEXT_PUBLIC_APK_SIZE",
] as const;

let saved: Record<string, string | undefined> = {};

beforeEach(() => {
  saved = Object.fromEntries(KEYS.map((key) => [key, process.env[key]]));
  for (const key of KEYS) delete process.env[key];
});

afterEach(() => {
  for (const key of KEYS) {
    if (saved[key] === undefined) delete process.env[key];
    else process.env[key] = saved[key];
  }
});

describe("apkUrl", () => {
  it("returns null when nothing is configured", () => {
    // Null, not "" — callers branch on it to show a configuration notice
    // rather than rendering a button that goes nowhere.
    expect(apkUrl()).toBeNull();
  });

  it("prefers the NEXT_PUBLIC_ name", () => {
    process.env.NEXT_PUBLIC_APK_URL = "https://example.com/a.apk";
    process.env.MOBILE_APK_URL = "https://example.com/b.apk";
    expect(apkUrl()).toBe("https://example.com/a.apk");
  });

  it("still accepts the server-only name, so an existing deploy keeps working", () => {
    process.env.MOBILE_APK_URL = "https://example.com/b.apk";
    expect(apkUrl()).toBe("https://example.com/b.apk");
  });

  it("treats whitespace as unset", () => {
    // A env var pasted with a stray newline would otherwise render a button
    // linking to a blank URL.
    process.env.NEXT_PUBLIC_APK_URL = "   ";
    expect(apkUrl()).toBeNull();
  });

  it("trims a value with surrounding whitespace rather than breaking the link", () => {
    process.env.NEXT_PUBLIC_APK_URL = "  https://example.com/a.apk\n";
    expect(apkUrl()).toBe("https://example.com/a.apk");
  });
});

describe("apkFallbackUrl and apkSizeLabel", () => {
  it("are null when unset, so the UI omits them entirely", () => {
    expect(apkFallbackUrl()).toBeNull();
    expect(apkSizeLabel()).toBeNull();
  });

  it("return their configured values", () => {
    process.env.NEXT_PUBLIC_APK_FALLBACK_URL = "https://github.com/x/releases/latest";
    process.env.NEXT_PUBLIC_APK_SIZE = "89 MB";
    expect(apkFallbackUrl()).toBe("https://github.com/x/releases/latest");
    expect(apkSizeLabel()).toBe("89 MB");
  });
});

describe("apkQrDataUrl", () => {
  it("renders the download link as a local PNG, not through a third-party service", async () => {
    const qr = await apkQrDataUrl("https://example.com/a.apk?v=1&x=2");
    expect(qr.startsWith("data:image/png;base64,")).toBe(true);
    expect(qr).not.toContain("qrserver");
  });
});

describe("apkDownloadPath", () => {
  it("is a stable path that does not depend on where the file is hosted", () => {
    // The repo goes private after launch, which kills GitHub Release assets
    // (a private asset 404s on its public URL), so the APK WILL move hosts.
    // Printed letters, noticeboard QR codes and forwarded WhatsApp messages
    // cannot be edited afterwards — so the published link must never contain
    // the storage URL.
    process.env.NEXT_PUBLIC_APK_URL = "https://github.com/x/releases/download/v1/a.apk";
    const first = apkDownloadPath();

    process.env.NEXT_PUBLIC_APK_URL = "https://pub-abc.r2.dev/a.apk";
    expect(apkDownloadPath()).toBe(first);
  });

  it("stays valid even when no storage URL is configured", () => {
    // The route redirects to an explanatory page rather than 500ing at a link
    // that is already in circulation.
    expect(apkDownloadPath()).toBe("/download/apk");
  });

  it("is relative, so it works on any host the site is served from", () => {
    expect(apkDownloadPath().startsWith("/")).toBe(true);
    expect(apkDownloadPath()).not.toMatch(/^https?:/);
  });
});
