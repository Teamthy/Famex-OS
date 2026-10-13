/**
 * Next.js instrumentation hook — runs once, before the server handles any
 * request.
 *
 * Two jobs: validate the environment, and start error tracking.
 *
 * ── Why everything here is wrapped in try/catch ────────────────────────────
 * Next.js treats a throw from register() as fatal: the server does not start
 * and EVERY route returns 500. That is the right response to a genuinely
 * unservable config (no database, no signing secret) and a catastrophic
 * over-reaction to anything else.
 *
 * This was not hypothetical. An earlier version of lib/env.ts listed
 * RESEND_API_KEY as production-required, so the first production start
 * without an email key took the whole site down — caught only because an
 * end-to-end run booted a real production server.
 *
 * assertEnv() now throws only for genuinely fatal settings, and the catch is
 * the second layer: a mistake in the validation rules, or in the monitoring
 * SDK, must surface as a very loud log rather than an outage. Monitoring that
 * can take the site down is worse than no monitoring.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    try {
      const { assertEnv } = await import("@/lib/env");
      assertEnv();
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      console.error(
        "\n" +
          "==============================================================\n" +
          "  FATAL ENVIRONMENT VALIDATION FAILED\n" +
          "==============================================================\n" +
          detail +
          "\n--------------------------------------------------------------\n" +
          "  Production cannot safely serve traffic with this configuration.\n" +
          "==============================================================\n",
      );
      if (process.env.NODE_ENV === "production") throw error;
    }

    try {
      await import("./sentry.server.config");
    } catch (error) {
      console.error("[sentry] server init failed (continuing without it):", error);
    }
  }

  if (process.env.NEXT_RUNTIME === "edge") {
    try {
      await import("./sentry.edge.config");
    } catch (error) {
      console.error("[sentry] edge init failed (continuing without it):", error);
    }
  }
}

/**
 * Reports errors thrown by nested React Server Components, which Next.js
 * cannot attach to a request automatically.
 */
export async function onRequestError(
  ...args: Parameters<NonNullable<typeof import("@sentry/nextjs").captureRequestError>>
) {
  try {
    const Sentry = await import("@sentry/nextjs");
    Sentry.captureRequestError(...args);
  } catch {
    // Never let the reporter break the request it is reporting on.
  }
}
