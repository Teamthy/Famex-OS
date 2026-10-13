import * as Sentry from "@sentry/nextjs";

/**
 * Browser error tracking.
 *
 * Catches the failures a server never sees: a component that throws during
 * hydration, a fetch that fails on a parent's phone, the QR scanner refusing
 * to open the camera. That last one shipped to production and was invisible
 * for weeks precisely because nothing watched the browser.
 */

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

Sentry.init({
  dsn,
  environment: process.env.NEXT_PUBLIC_VERCEL_ENV || process.env.NODE_ENV || "development",
  enabled: Boolean(dsn),

  // Most Nigerian users are on metered mobile data. Session replay ships a lot
  // of bytes from the user's bundle, so it is off by default and sampled only
  // on error if you ever turn it on.
  tracesSampleRate: 0.1,
  replaysSessionSampleRate: 0,
  replaysOnErrorSampleRate: 0,

  sendDefaultPii: false,

  ignoreErrors: [
    // Browser extensions and third-party injections, not our bugs.
    "top.GLOBALS",
    "ResizeObserver loop limit exceeded",
    "ResizeObserver loop completed with undelivered notifications",
    // A user navigating away mid-request is not an incident.
    "AbortError",
    "NetworkError when attempting to fetch resource",
    "Failed to fetch",
  ],

  beforeSend(event) {
    // Password-reset and staff-activation tokens live in query strings.
    if (event.request?.url) event.request.url = event.request.url.split("?")[0];
    return event;
  },
});
