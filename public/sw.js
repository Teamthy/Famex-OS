// Ykay College service worker — PWA offline shell.
// Same proven strategy as the YK-Virtual worker:
//   - App shell (/, /offline)        → precached at install
//   - Hashed static assets           → cache-first (immutable, safe)
//   - Navigations                    → network-first, offline fallback
//   - API calls                      → never cached (results/fees/portal data)
//   - Google/Unsplash remote images  → stale-while-revalidate

const CACHE = "ykay-college-v1";
const SHELL = ["/", "/offline", "/admissions", "/about", "/contact", "/login"];
const API_PREFIX = "/api/";

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
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
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
