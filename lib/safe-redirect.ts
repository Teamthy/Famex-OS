/**
 * Accepts a `next` redirect target only when it is a path on the same site.
 *
 * `//example.com` and `/\example.com` both begin with "/", but browsers treat
 * them as protocol-relative URLs and leave the site. So the check resolves the
 * value against the current origin and requires the origin to be unchanged.
 * Anything else returns null and the caller falls back to its own default.
 */
export function safeNextPath(raw: string | null | undefined, origin: string): string | null {
  if (!raw || raw.length > 2048) return null;
  if (!raw.startsWith("/") || raw.startsWith("//") || raw.startsWith("/\\")) return null;
  // Control characters and backslashes have no place in an in-app path; browsers
  // strip or rewrite some of them, which is how filters get bypassed.
  if (/[\u0000-\u001f\u007f\\]/.test(raw)) return null;

  let base: URL;
  let target: URL;
  try {
    base = new URL(origin);
    target = new URL(raw, base);
  } catch {
    return null;
  }
  if (target.origin !== base.origin) return null;
  return `${target.pathname}${target.search}${target.hash}`;
}
