import * as Sentry from "@sentry/nextjs";

/**
 * Edge runtime (middleware) error tracking.
 *
 * middleware.ts runs on every request and makes the authentication decision,
 * so an unhandled error here is either an outage or an authorisation bypass.
 * It is the single most important place to have visibility.
 *
 * Same rule as the server config: no DSN means a silent no-op, never a crash.
 */

const dsn = process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN;

Sentry.init({
  dsn,
  environment: process.env.VERCEL_ENV || process.env.NODE_ENV || "development",
  tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 0,
  enabled: Boolean(dsn),
  sendDefaultPii: false,

  beforeSend(event) {
    if (event.request?.cookies) delete event.request.cookies;
    if (event.request?.headers) {
      delete event.request.headers.cookie;
      delete event.request.headers.authorization;
    }
    if (event.request?.query_string) delete event.request.query_string;
    if (event.request?.url) event.request.url = event.request.url.split("?")[0];
    return event;
  },
});
