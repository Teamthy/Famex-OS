/**
 * Which browser origin may call this API.
 *
 * The middleware previously answered every CORS preflight with a single
 * value — `NEXT_PUBLIC_SITE_URL`, or `*` if unset. In production that is
 * `https://ykaycollege.edu.ng`, which is correct and also the reason a
 * developer running the mobile app as a web build on `localhost:8081` gets:
 *
 *     TypeError: Failed to fetch
 *
 * The browser blocks the response before any application code runs, so the
 * error names nothing, points at no line, and looks for all the world like
 * the login endpoint is broken. It is not — the API answers a clean 401.
 *
 * `CORS_EXTRA_ORIGINS` is an opt-in, comma-separated allowlist for exactly
 * that case. Unset, behaviour is byte-for-byte what it was.
 *
 * ── Why reflect rather than list ───────────────────────────────────────────
 * `Access-Control-Allow-Origin` takes ONE origin, not a list, and a wildcard
 * is rejected by browsers whenever credentials are involved — which is always
 * here, because auth is a cookie. So the only workable approach is to echo the
 * caller's origin back when, and only when, it is on the allowlist.
 *
 * That makes exact matching the security boundary. `startsWith` or `includes`
 * would let `https://ykaycollege.edu.ng.evil.com` through; there are tests for
 * precisely those shapes.
 */

/** Strip a trailing slash and lowercase, so list entries compare reliably. */
function normalise(origin: string): string {
  return origin.trim().replace(/\/+$/, "").toLowerCase();
}

export function resolveAllowedOrigin(
  requestOrigin: string | null | undefined,
  env: { siteUrl?: string; extra?: string } = {},
): string {
  const siteUrl = (env.siteUrl ?? process.env.NEXT_PUBLIC_SITE_URL ?? "").trim();
  const extraRaw = env.extra ?? process.env.CORS_EXTRA_ORIGINS ?? "";

  // Nothing configured at all: local development with a bare .env. Production
  // validation requires NEXT_PUBLIC_SITE_URL and instrumentation rethrows fatal
  // errors, so never return a credentialed wildcard in production.
  if (!siteUrl) return process.env.NODE_ENV === "production" ? "null" : "*";

  if (!requestOrigin) return siteUrl;

  const allowed = new Set<string>([normalise(siteUrl)]);
  for (const entry of extraRaw.split(",")) {
    const value = normalise(entry);
    if (value) allowed.add(value);
  }

  // Exact match only. Echo back the caller's ORIGINAL casing — browsers
  // compare the header against what they sent, character for character.
  return allowed.has(normalise(requestOrigin)) ? requestOrigin : siteUrl;
}
