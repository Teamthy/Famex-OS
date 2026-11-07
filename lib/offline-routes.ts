/**
 * Which portal pages must survive a lost connection.
 *
 * The exam runner is the one page in the product where a lost connection is
 * not an inconvenience but the end of a child's paper. A student who presses
 * "Save to device" the night before must be able to open that paper in the
 * morning with no signal at all — and Next.js route chunks are otherwise
 * cached only after a page has been visited in this exact build, so the runner
 * usually has never been.
 *
 * The set is deliberately small. Caching a dashboard that shows yesterday's
 * fees is worse than showing nothing, because a parent trusts what is on the
 * screen. Only screens that are either static or work entirely from device
 * state belong here.
 *
 * `public/sw.js` duplicates this list — a service worker cannot import from the
 * app bundle, and a build step for four strings would be more machinery than it
 * is worth. `tests/lib/offline-routes.test.ts` fails if the two drift apart.
 */

/** Pages worth holding on the device, exact paths. */
export const OFFLINE_PAGE_PATHS: readonly string[] = ["/offline", "/student/exams"];

/**
 * Path prefixes whose pages are held on the device. The exam runner is under
 * `/student/exams/<id>`, one page per paper, so it cannot be listed by name.
 *
 * A prefix match here means "a runner", not "anything below exams" — the
 * comparison is made against the canonicalised runner path, so a deeper screen
 * such as `/student/exams/<id>/review` stays out of the cache.
 */
export const OFFLINE_PAGE_PREFIXES: readonly string[] = ["/student/exams/"];

/**
 * A paper's runner page is exactly `/student/exams/<id>` — not the list, and
 * not a deeper path. Returns the page's pathname when `pathname` is a runner.
 */
export function examRunnerPath(pathname: string): string | null {
  const match = /^\/student\/exams\/([A-Za-z0-9_-]+)\/?$/.exec(pathname);
  return match ? `/student/exams/${match[1]}` : null;
}

/**
 * Should this page be kept for offline use?
 *
 * A query string is ignored: the same page is the same page, and caching
 * `?utm_source=…` variants separately would fill the cache with duplicates.
 */
export function isOfflinePage(pathname: string): boolean {
  // A runner page, however the URL happened to be spelled.
  if (examRunnerPath(pathname) !== null) return true;

  // Otherwise only an exact page. Prefix matching is deliberately NOT applied
  // to the raw path: `/student/exams/<id>/review` starts with a prefix but is a
  // different screen reading different data, and caching it would serve it
  // stale long after the sitting ended.
  const path = pathname.replace(/\/+$/, "") || "/";
  return OFFLINE_PAGE_PATHS.includes(path);
}
