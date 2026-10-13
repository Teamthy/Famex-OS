import { describe, it, expect } from "vitest";
import { resolveAllowedOrigin } from "@/lib/cors";

/**
 * Which browser origins may call the API.
 *
 * The middleware answered CORS preflights with a single value:
 *
 *     "Access-Control-Allow-Origin": process.env.NEXT_PUBLIC_SITE_URL || "*"
 *
 * In production that is `https://ykaycollege.edu.ng`. Correct, and also the
 * reason a developer running the mobile app as a web build on localhost gets
 * "Failed to fetch" — the browser blocks the response before any application
 * code sees it, so the error names nothing useful and looks like the login is
 * broken.
 *
 * `CORS_EXTRA_ORIGINS` adds opt-in origins without touching the default. The
 * tests below pin the two behaviours that matter: the reflection is exact, and
 * an unknown origin never gets in.
 */

const SITE = "https://ykaycollege.edu.ng";

describe("resolveAllowedOrigin", () => {
  it("allows the configured site origin", () => {
    expect(resolveAllowedOrigin(SITE, { siteUrl: SITE })).toBe(SITE);
  });

  it("falls back to the site origin when the request has none", () => {
    // Server-to-server and native clients send no Origin header at all.
    expect(resolveAllowedOrigin(null, { siteUrl: SITE })).toBe(SITE);
  });

  /**
   * The whole point of the change. Without this, a local web preview cannot
   * talk to a deployed API at all.
   */
  it("allows an origin listed in CORS_EXTRA_ORIGINS", () => {
    const result = resolveAllowedOrigin("http://localhost:8081", {
      siteUrl: SITE,
      extra: "http://localhost:8081,http://localhost:19006",
    });
    expect(result).toBe("http://localhost:8081");
  });

  it("tolerates spaces and a trailing slash in the list", () => {
    const result = resolveAllowedOrigin("http://localhost:8081", {
      siteUrl: SITE,
      extra: " http://localhost:8081/ , http://localhost:19006 ",
    });
    expect(result).toBe("http://localhost:8081");
  });

  /**
   * The security boundary. An attacker's page must not be handed a
   * matching Access-Control-Allow-Origin just because it asked.
   */
  it("REFUSES an origin that is not listed", () => {
    const result = resolveAllowedOrigin("https://evil.example.com", {
      siteUrl: SITE,
      extra: "http://localhost:8081",
    });
    // Falls back to the site origin, which will not match the caller, so the
    // browser blocks it — the correct outcome.
    expect(result).toBe(SITE);
  });

  it("does not allow a prefix or suffix impersonation", () => {
    for (const origin of [
      "https://ykaycollege.edu.ng.evil.com",
      "https://evilykaycollege.edu.ng",
      "http://localhost:8081.evil.com",
    ]) {
      expect(resolveAllowedOrigin(origin, { siteUrl: SITE, extra: "http://localhost:8081" })).toBe(
        SITE,
      );
    }
  });

  it("never returns a wildcard when a site origin is configured", () => {
    // "*" with credentials is rejected by browsers anyway, and it would be a
    // real hole if it ever shipped alongside cookie auth.
    for (const origin of [null, SITE, "https://evil.example.com"]) {
      expect(resolveAllowedOrigin(origin, { siteUrl: SITE })).not.toBe("*");
    }
  });

  it("falls back to * only when nothing is configured at all", () => {
    // Local dev with no env set. Production always has NEXT_PUBLIC_SITE_URL.
    expect(resolveAllowedOrigin("http://localhost:3000", { siteUrl: "" })).toBe("*");
  });

  it("ignores empty entries in the list", () => {
    expect(
      resolveAllowedOrigin("http://localhost:8081", {
        siteUrl: SITE,
        extra: ",,  ,http://localhost:8081,",
      }),
    ).toBe("http://localhost:8081");
  });

  it("is case-insensitive on the host, as browsers are", () => {
    expect(
      resolveAllowedOrigin("http://LOCALHOST:8081", {
        siteUrl: SITE,
        extra: "http://localhost:8081",
      }),
    ).toBe("http://LOCALHOST:8081");
  });
});
