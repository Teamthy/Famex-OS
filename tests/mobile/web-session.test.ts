import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * The three defects that sat BEHIND the CORS bug on the Expo web build.
 *
 * Fixing CORS alone would have moved the failure, not removed it: login would
 * have succeeded and the app would then have hung on the splash screen, which
 * looks like a completely different bug.
 *
 *   1. `Set-Cookie` is a forbidden response header. Browsers are required by
 *      the Fetch spec to filter it out of `res.headers`, so
 *      `res.headers.get("set-cookie")` is ALWAYS null on web. login() scraped
 *      the token from it, got "", never called setToken(), and getMe() then
 *      returned null at `if (!token)` — bouncing the user back to login.
 *
 *   2. expo-secure-store has no web implementation. `ExpoSecureStore.web.js`
 *      is `export default {}`, so getItemAsync throws
 *      "getValueWithKeyAsync is not a function" on the first call.
 *
 *   3. The web/relative-URL switch keyed off `EXPO_PUBLIC_API_URL === ""`,
 *      supplied by a GITIGNORED, untracked `mobile/.env.local`. On any clean
 *      clone the var is undefined, so the app fell back to the absolute Vercel
 *      URL and went cross-origin again.
 */

const mobile = join(__dirname, "..", "..", "mobile");
const http = readFileSync(join(mobile, "lib", "http.ts"), "utf8");
const api = readFileSync(join(mobile, "lib", "api.ts"), "utf8");
const cache = readFileSync(join(mobile, "lib", "offline", "cache.ts"), "utf8");

function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
}

describe("mobile web build — session handling", () => {
  /**
   * The regression that matters most: this must not depend on an untracked
   * file. Platform is always knowable; a gitignored .env.local is not.
   */
  it("web uses relative URLs based on Platform, not on an env var", () => {
    const code = stripComments(http);
    expect(code).toMatch(/Platform\.OS === "web"/);
    // API_BASE must branch on IS_WEB before consulting the env var.
    const base = code.slice(code.indexOf("export const API_BASE"));
    const envIdx = base.indexOf("CONFIGURED_API_URL");
    const webIdx = base.indexOf("IS_WEB");
    expect(webIdx).toBeGreaterThanOrEqual(0);
    expect(webIdx).toBeLessThan(envIdx === -1 ? Number.MAX_SAFE_INTEGER : envIdx);
  });

  it("token storage does not call SecureStore on web", () => {
    const code = stripComments(http);
    for (const fn of ["getToken", "setToken", "clearToken"]) {
      const start = code.indexOf(`export async function ${fn}`);
      expect(start, `${fn} should exist`).toBeGreaterThan(-1);
      const body = code.slice(start, code.indexOf("\n}", start));
      expect(body, `${fn} must guard web before SecureStore`).toMatch(/IS_WEB/);
      // The web branch must return before any SecureStore call.
      const webIdx = body.indexOf("IS_WEB");
      const secureIdx = body.indexOf("SecureStore");
      if (secureIdx > -1) expect(webIdx).toBeLessThan(secureIdx);
    }
  });

  it("login does not rely on reading Set-Cookie when on web", () => {
    const code = stripComments(api);
    const start = code.indexOf("export async function login");
    const body = code.slice(start, code.indexOf("\n}", start));
    expect(body).toMatch(/IS_WEB/);
    // The Set-Cookie scrape must be inside the non-web branch.
    const setCookieIdx = body.indexOf("set-cookie");
    const webIdx = body.indexOf("IS_WEB");
    expect(setCookieIdx).toBeGreaterThan(webIdx);
  });

  /**
   * httpOnly cookies are only sent when the request opts in. Without this the
   * login succeeds and every subsequent request is anonymous.
   */
  it("every fetch sends credentials on web", () => {
    expect(stripComments(http)).toMatch(/credentials: "include"/);
    const apiCode = stripComments(api);
    const cacheCode = stripComments(cache);
    // Count fetch calls and fetchOptions spreads — every fetch must have one.
    for (const [name, code] of [
      ["api.ts", apiCode],
      ["cache.ts", cacheCode],
    ] as const) {
      const fetches = (code.match(/await fetch\(/g) ?? []).length;
      const opts = (code.match(/\.\.\.fetchOptions/g) ?? []).length;
      expect(opts, `${name}: every fetch needs ...fetchOptions`).toBe(fetches);
    }
  });

  /**
   * The web marker token is not a JWT. Sending it as a Bearer would make the
   * backend attempt to verify garbage on every request.
   */
  it("does not send the web marker token as a Bearer header", () => {
    const code = stripComments(api);
    expect(code).toMatch(/IS_WEB \? null : await getToken\(\)/);
  });

  it("authHeaders does not set a forbidden Cookie header on web", () => {
    const code = stripComments(http);
    const start = code.indexOf("export async function authHeaders");
    const body = code.slice(start, code.indexOf("\n}", start));
    const webIdx = body.indexOf("IS_WEB");
    const cookieIdx = body.indexOf('h["Cookie"]');
    expect(webIdx).toBeGreaterThan(-1);
    expect(cookieIdx).toBeGreaterThan(webIdx);
  });
});
