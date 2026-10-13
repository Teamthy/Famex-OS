import * as Sentry from "@sentry/nextjs";

/**
 * Server-side error tracking.
 *
 * Until now a production 500 was invisible unless a parent phoned the school.
 * The structured logger writes JSON to stdout, which is only useful if someone
 * is watching stdout — nobody is, at 9pm on a Sunday.
 *
 * ── No DSN, no problem ─────────────────────────────────────────────────────
 * Sentry.init() with an undefined DSN is a no-op: the SDK loads and quietly
 * discards events. That is deliberate here. Monitoring must never be the
 * reason the site is down — a lesson this project learned the hard way when a
 * missing RESEND_API_KEY refused to boot the server at all.
 */

const dsn = process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN;

Sentry.init({
  dsn,
  environment: process.env.VERCEL_ENV || process.env.NODE_ENV || "development",

  // A school's traffic is small and bursty (everyone opens results at once).
  // Full traces during a burst are affordable and are exactly when you need
  // them; lower this if the quota ever bites.
  tracesSampleRate: process.env.NODE_ENV === "production" ? 0.2 : 0,

  // Do not report the noise of local development.
  enabled: Boolean(dsn),

  /**
   * Nigerian school data: names, phone numbers, home addresses, fee balances,
   * exam scores. None of it belongs in an error tracker.
   */
  sendDefaultPii: false,

  beforeSend(event) {
    // Session cookies and Authorization headers would otherwise travel with
    // the request context and let anyone with Sentry access impersonate a user.
    if (event.request?.cookies) delete event.request.cookies;
    if (event.request?.headers) {
      delete event.request.headers.cookie;
      delete event.request.headers.authorization;
    }

    // Query strings carry password-reset and staff-activation tokens.
    if (event.request?.query_string) delete event.request.query_string;
    if (event.request?.url) {
      event.request.url = event.request.url.split("?")[0];
    }

    return event;
  },

  ignoreErrors: [
    // Expected control flow, not a fault worth paging anyone about.
    "NEXT_REDIRECT",
    "NEXT_NOT_FOUND",
  ],
});
