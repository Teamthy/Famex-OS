import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * REGRESSION: "Failed to fetch" when logging in from the Expo web build.
 *
 * The bug was NOT in lib/cors.ts, and it was NOT in the middleware — both were
 * correct, which is exactly why drops 42 and 43 failed to fix it. It was a
 * SECOND, static CORS header block in next.config.ts:
 *
 *     source: "/api/:path*",
 *     headers: [{ key: "Access-Control-Allow-Origin",
 *                 value: process.env.NEXT_PUBLIC_SITE_URL || "*" }, ...]
 *
 * `headers()` is evaluated at BUILD time and never sees the request, so it
 * cannot echo the caller's origin. The result, verified live against the
 * deployment:
 *
 *     OPTIONS /api/auth/login  Origin: http://localhost:8081
 *       -> access-control-allow-origin: http://localhost:8081     (middleware)
 *     POST    /api/auth/login  Origin: http://localhost:8081
 *       -> access-control-allow-origin: https://ykaycollege.edu.ng (next.config)
 *
 * The preflight passes, the real response is rejected, and the browser reports
 * a bare "TypeError: Failed to fetch" with no line number.
 *
 * These tests pin the invariant that fixes it: CORS is resolved per-request in
 * exactly ONE place. A static Access-Control-Allow-Origin in next.config.ts
 * silently wins over the middleware, so its mere presence is the failure.
 */

const root = join(__dirname, "..", "..");
const nextConfig = readFileSync(join(root, "next.config.ts"), "utf8");
const middleware = readFileSync(join(root, "middleware.ts"), "utf8");

/** Strip comments so prose ABOUT the header never counts as the header. */
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
}

describe("CORS headers are owned in exactly one place", () => {
  it("next.config.ts declares NO Access-Control-* headers", () => {
    const code = stripComments(nextConfig);
    expect(code).not.toMatch(/Access-Control-Allow-Origin/i);
    expect(code).not.toMatch(/Access-Control-Allow-Credentials/i);
  });

  /**
   * The subtle half. Even with next.config.ts cleaned up, answering only the
   * preflight leaves the real response with no CORS headers at all — which the
   * browser rejects just as hard.
   */
  it("middleware applies CORS to real API responses, not just preflight", () => {
    const code = stripComments(middleware);
    expect(code).toMatch(/function applyCors/);
    // Used for the preflight AND for at least two non-OPTIONS return paths.
    const uses = code.match(/applyCors\(/g) ?? [];
    expect(uses.length).toBeGreaterThanOrEqual(3);
  });

  it("middleware still runs on /api/*", () => {
    // The matcher skips only build assets and image optimisation, so every API route is covered.
    const found = middleware.match(/"\/\(\(\?!([^)]+)\)\.\*\)"/);
    expect(found, "matcher pattern not found in middleware.ts").not.toBeNull();
    const matcher = new RegExp(`^/((?!${found?.[1]}).*)$`);
    expect(matcher.test("/api/contact")).toBe(true);
    expect(matcher.test("/api/admissions/upload-url")).toBe(true);
    expect(matcher.test("/_next/static/chunk.js")).toBe(false);
  });

  /**
   * Without `Vary: Origin`, a CDN can cache the response for one allowed
   * origin and serve it to a different one — which either leaks the wrong
   * allow-origin or breaks a legitimate caller at random.
   */
  it("middleware sets Vary: Origin so caches do not cross origins", () => {
    expect(stripComments(middleware)).toMatch(/Vary/);
  });

  /**
   * Credentials are non-negotiable here: auth is an httpOnly cookie, so a
   * response without this header has its cookie dropped by the browser.
   */
  it("middleware sets Access-Control-Allow-Credentials", () => {
    expect(stripComments(middleware)).toMatch(/Access-Control-Allow-Credentials/);
  });
});
