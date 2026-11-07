// Famex International Schools service worker — PWA offline shell.
// Same proven strategy as the YK-Virtual worker:
//   - App shell (/, /offline)        → precached at install
//   - Hashed static assets           → cache-first (immutable, safe)
//   - Navigations                    → network-first, offline fallback
//   - API calls                      → never cached (results/fees/portal data)
//   - Google/Unsplash remote images  → stale-while-revalidate
//   - Exam pages                     → always kept, so a saved paper opens offline
//
// The last one is why this worker grew a cache-warming step. Next.js only
// caches the chunks of a route after that route has been visited, so the exam
// runner — a page most students have never opened until the morning of the
// paper — had no cached chunks at all. "Save to device" downloaded the
// questions and left the screen that renders them unreachable without a
// network. Warming happens on a successful save, and again at install for
// anyone who already has papers.

/**
 * Two caches on purpose.
 *
 * SHELL_CACHE is versioned and dropped on activate: shell pages, static chunks
 * and images can be re-fetched whenever, so replacing them wholesale on deploy
 * is correct and keeps a bad build from lingering.
 *
 * EXAM_CACHE is NOT versioned, and survives deploys. A paper sits on a device
 * for days — downloaded, sat, submitted, waiting to sync — and its chunks are
 * the only copies of a page the student may open in a room with no signal.
 * Deleting them because we shipped a build would turn "your answers are safe"
 * into a blank screen. `cachePage` re-fetches and replaces entries, so a
 * re-warm after a deploy refreshes the copy without ever emptying it first.
 */
const SHELL_CACHE = "famex-international-schools-v1";
const EXAM_CACHE = "famex-exams-v1";
const CACHE = SHELL_CACHE;
const SHELL = ["/", "/offline", "/admissions", "/about", "/contact", "/login"];
const API_PREFIX = "/api/";

// Kept in step with lib/offline-routes.ts by tests/lib/offline-routes.test.ts.
const OFFLINE_PAGES = ["/offline", "/student/exams"];
// Exam runners live under this prefix, one page per paper. The rule that they
// qualify is the regex in isExamRunner(), not a plain startsWith() — see there.
const OFFLINE_PREFIXES = ["/student/exams/"];

/**
 * Is this page one we hold on the device?
 *
 * Mirrors isOfflinePage() in lib/offline-routes.ts, including the rule that a
 * prefix means "an exam runner" and not "anything under exams": a deeper screen
 * like /student/exams/<id>/review reads different data and must not be served
 * from a cache.
 */
function isExamRunner(pathname) {
  // Only bother with the regex for paths actually under an offline prefix;
  // this runs on every navigation.
  if (!OFFLINE_PREFIXES.some((prefix) => pathname.startsWith(prefix))) return null;
  const match = /^\/student\/exams\/([A-Za-z0-9_-]+)\/?$/.exec(pathname);
  return match ? "/student/exams/" + match[1] : null;
}

function isOfflinePage(pathname) {
  if (isExamRunner(pathname) !== null) return true;
  const path = pathname.replace(/\/+$/, "") || "/";
  return OFFLINE_PAGES.indexOf(path) !== -1;
}

/**
 * Cache one page and everything it needs to boot without a network.
 *
 * The HTML comes with `<script src>` and `<link rel=stylesheet>` tags pointing
 * at the exact chunks for that route, which is the only reliable way for a
 * worker to learn which hashed filenames belong to it — chunk names change on
 * every build, and guessing them is how offline exams break after a deploy.
 */
async function cachePage(requestedPath, followRedirects) {
  // Store under the canonical key. The navigation handler looks a runner up by
  // /student/exams/<id>, so a page warmed as /student/exams/<id>/ would be
  // stored and then never found — cached, and useless.
  const key = isExamRunner(requestedPath) || requestedPath;
  const response = await fetch(key, { credentials: "same-origin", redirect: followRedirects ? "follow" : "manual" });
  if (!response || !response.ok) return false;

  const cache = await caches.open(EXAM_CACHE);
  // A redirect to /login means the session is gone; caching that would serve a
  // login screen as an exam paper.
  if (response.redirected && /\/(login|unauthorized)/.test(new URL(response.url).pathname)) {
    return false;
  }

  const html = await response.clone().text();
  await cache.put(new Request(key, { credentials: "same-origin" }), response);

  const assets = new Set();
  const pattern = /(?:src|href)="(\/_next\/[^"]+)"/g;
  let match;
  while ((match = pattern.exec(html)) !== null) assets.add(match[1]);
  // The route's own RSC payload, used by client-side navigation and prefetch.
  assets.add(`${key}.txt`);

  await Promise.all(
    [...assets].map(async (asset) => {
      try {
        const hit = await caches.match(asset);
        if (hit) return;
        const res = await fetch(asset, { credentials: "same-origin" });
        // A missing RSC payload is normal for some routes; it is not fatal.
        if (res && (res.ok || res.status === 404)) await cache.put(asset, res);
      } catch {
        // One asset failing must not abandon the rest of the page's chunks.
      }
    }),
  );
  return true;
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(SHELL))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        // EXAM_CACHE is exempt: see its comment above.
        Promise.all(
          keys
            .filter((k) => k !== SHELL_CACHE && k !== EXAM_CACHE)
            .map((k) => caches.delete(k)),
        ),
      )
      .then(() => self.clients.claim())
      // Re-warm the exam list after every deploy. A student who saved a paper
      // yesterday must not lose access to it because we shipped a build: the
      // list is what links to the runner, so without it a cached paper is
      // reachable only by typing its URL.
      .then(() => cachePage("/student/exams", true).catch(() => false)),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);

  // Never intercept API traffic — school data must always be live.
  if (url.pathname.startsWith(API_PREFIX)) return;

  // Static assets from our own origin (/_next/...): cache-first.
  if (url.origin === self.location.origin && url.pathname.startsWith("/_next/")) {
    event.respondWith(
      caches.match(req).then(
        (hit) =>
          hit ||
          fetch(req).then((res) => {
            const copy = res.clone();
            caches.open(CACHE).then((cache) => cache.put(req, copy));
            return res;
          }),
      ),
    );
    return;
  }

  // Exam pages: network-first, but the cached copy is the one that matters.
  //
  // Falling back to /offline (as every other page does) would tell a student
  // holding a downloaded paper that they are offline, which is precisely the
  // situation the download exists to survive. Matching with ignoreSearch
  // means a prefetched or query-string variant still resolves.
  if (req.mode === "navigate" && url.origin === self.location.origin && isOfflinePage(url.pathname)) {
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res && res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then((cache) => cache.put(req, copy));
          }
          return res;
        })
        .catch(async () => {
          const exam = await caches.open(EXAM_CACHE);
          return (
            (await exam.match(req, { ignoreSearch: true })) ||
            (await exam.match(url.pathname, { ignoreSearch: true })) ||
            caches.match("/offline")
          );
        }),
    );
    return;
  }

  // Page navigations: network-first, fall back to cache, then /offline.
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((cache) => cache.put(req, copy));
          return res;
        })
        .catch(() => caches.match(req).then((hit) => hit || caches.match("/offline"))),
    );
    return;
  }

  // Remote images (maps imagery, Unsplash photos): stale-while-revalidate.
  if (
    ["google.com", "googleapis.com", "gstatic.com", "unsplash.com", "images.unsplash.com"].some(
      (h) => url.hostname.endsWith(h),
    )
  ) {
    event.respondWith(
      caches.match(req).then((hit) => {
        const refresh = fetch(req)
          .then((res) => {
            const copy = res.clone();
            caches.open(CACHE).then((cache) => cache.put(req, copy));
            return res;
          })
          .catch(() => hit);
        return hit || refresh;
      }),
    );
  }
});

/**
 * Cache warming, asked for by the page.
 *
 * `app/student/exams/page.tsx` posts FAMEX_WARM_EXAM after a successful "Save
 * to device", with the runner's path. The download itself is IndexedDB work the
 * worker cannot see, so the page tells it. A failure here is logged and
 * swallowed: the paper is already saved, and the student can still open it if
 * they visit the runner once while online.
 */
self.addEventListener("message", (event) => {
  const data = event.data || {};
  if (!data || data.type !== "FAMEX_WARM_EXAM" || typeof data.path !== "string") return;

  const path = data.path;
  if (!isOfflinePage(path)) return;

  event.waitUntil(
    cachePage(path, true)
      .then((ok) => {
        const ports = event.ports || [];
        ports.forEach((port) => port.postMessage({ ok }));
      })
      .catch(() => {
        const ports = event.ports || [];
        ports.forEach((port) => port.postMessage({ ok: false }));
      }),
  );
});
