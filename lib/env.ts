/**
 * Centralised environment validation.
 *
 * Called once from instrumentation.ts, which Next.js runs before any request
 * is served. A misconfigured production deploy fails at boot with a precise
 * message, instead of surfacing hours later as "emails aren't sending" or a
 * 500 on the first payment.
 *
 * ── Why this is not validated at import time ───────────────────────────────
 * The previous version ran `validate()` as a module side effect and required
 * live Paystack keys unconditionally. Nothing imported it — which is just as
 * well, because doing so would have failed every CI build and every local
 * `next build`, where those secrets legitimately do not exist. Requirements
 * are therefore split by environment: strict in production, permissive
 * elsewhere.
 */

import { z } from "zod";
import { resolveSiteUrl } from "@/lib/site-url";

/** Always required — the app cannot function without these anywhere. */
const baseSchema = z.object({
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required."),
  AUTH_SECRET: z.string().min(32, "AUTH_SECRET must be at least 32 characters long."),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
});

/**
 * ── Why there is no "production schema" of required strings any more ───────
 * An earlier version demanded NEXT_PUBLIC_SITE_URL, PAYSTACK_PUBLIC_KEY and
 * PAYSTACK_SECRET_KEY here, and instrumentation.ts turns any failure into a
 * thrown error at boot. Two outages came from that shape:
 *
 *   - a deploy without an email key (when RESEND_API_KEY lived in this list)
 *     did not degrade email — it refused to start the server at all;
 *   - on 2026-11-09 the Vercel staging deployment (NODE_ENV=production, no
 *     NEXT_PUBLIC_SITE_URL, no Paystack keys) would not boot at all: every
 *     route answered with a bare server-error page while the platform was
 *     perfectly capable of supplying its own URL (see lib/site-url.ts).
 *
 * A school whose welcome emails are silently not sending still has a working
 * portal; a school whose portal will not boot has nothing. Anything that only
 * breaks one feature belongs in the warning list below, however loudly.
 *
 * What stays fatal in production is decided in checkEnv():
 *   - the base schema (DATABASE_URL, AUTH_SECRET) everywhere;
 *   - an unresolvable site URL — i.e. NOT running on Vercel AND no
 *     NEXT_PUBLIC_SITE_URL — because then password-reset/staff-activation
 *     links and CORS origins genuinely have no correct value;
 *   - nothing else. Missing Paystack keys disable payments LOUDLY instead:
 *     lib/paystack.ts throws "not configured" on every initiation and every
 *     webhook verification, so an unkeyed deployment can never silently take
 *     or accept money — the feature is off, not broken-unsafe.
 */

export type ValidatedEnv = z.infer<typeof baseSchema>;

export type EnvValidationResult = {
  ok: boolean;
  errors: string[];
  warnings: string[];
};

/**
 * Check the environment. Pure — returns findings rather than throwing, so it
 * can be unit-tested and so the caller decides how loud to be.
 */
export function checkEnv(source: NodeJS.ProcessEnv = process.env): EnvValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  const base = baseSchema.safeParse(source);
  if (!base.success) {
    for (const [key, messages] of Object.entries(base.error.flatten().fieldErrors)) {
      for (const message of messages ?? []) errors.push(`${key}: ${message}`);
    }
  }

  const isProduction = source.NODE_ENV === "production";

  if (isProduction) {
    // The canonical URL must resolve from configuration or from the platform.
    // On Vercel the platform supplies it (lib/site-url.ts); anywhere else
    // NEXT_PUBLIC_SITE_URL is the only source, and without it password-reset
    // links and CORS origins would point nowhere.
    if (!resolveSiteUrl(source)) {
      errors.push(
        "NEXT_PUBLIC_SITE_URL: required in production when the deployment platform does not " +
          "provide a canonical URL (this host is not Vercel).",
      );
    }

    // Missing Paystack keys disable payments loudly instead of fatally:
    // lib/paystack.ts throws "not configured" on every initiation and every
    // webhook verification, so an unkeyed deployment can never silently take
    // or accept money. A dead portal is worse than a closed payment window.
    if (!source.PAYSTACK_PUBLIC_KEY || !source.PAYSTACK_SECRET_KEY) {
      warnings.push(
        "Paystack keys are not set — fee payments are DISABLED on this deployment: payment " +
          "initiation and webhook verification refuse every request. Configure " +
          "PAYSTACK_PUBLIC_KEY and PAYSTACK_SECRET_KEY before collecting money.",
      );
    }

    // Degraded, not fatal. Each of these disables a real feature and deserves
    // a loud warning on every boot — but refusing to serve the site is worse
    // than serving it without email, so none of them throws.
    if (!source.RESEND_API_KEY) {
      warnings.push(
        "RESEND_API_KEY is not set — parent welcome emails, staff invitations and " +
          "password-reset emails will NOT be delivered.",
      );
    }
    if (!source.EMAIL_FROM) {
      warnings.push(
        "EMAIL_FROM is not set — outbound email has no verified sender address and will fail.",
      );
    }
    if (!source.UPSTASH_REDIS_REST_URL || !source.UPSTASH_REDIS_REST_TOKEN) {
      warnings.push(
        "Redis is not configured — rate limiting falls back to per-instance memory, " +
          "which does not throttle across serverless invocations.",
      );
    }
    if (!source.S3_BUCKET) {
      warnings.push("S3_BUCKET is not set — admission document uploads will fail.");
    }
    if (!source.JOBS_SECRET && !source.CRON_SECRET) {
      warnings.push(
        "Neither JOBS_SECRET nor CRON_SECRET is set — the notification dispatch cron " +
          "cannot authenticate and alerts will not be delivered.",
      );
    }
    if (source.PAYSTACK_SECRET_KEY?.startsWith("sk_test_")) {
      warnings.push("PAYSTACK_SECRET_KEY is a TEST key but NODE_ENV is production.");
    }
  }

  return { ok: errors.length === 0, errors, warnings };
}

/**
 * Validate and fail fast. Called from instrumentation.ts at server startup.
 *
 * Throws only in production: a developer with a half-filled .env should get a
 * running app and a clear warning, not a wall.
 */
export function assertEnv(source: NodeJS.ProcessEnv = process.env): EnvValidationResult {
  const result = checkEnv(source);

  for (const warning of result.warnings) {
    console.warn(`[env] WARNING  ${warning}`);
  }

  if (!result.ok) {
    const detail = result.errors.map((error) => `  - ${error}`).join("\n");
    if (source.NODE_ENV === "production") {
      throw new Error(`Environment validation failed:\n${detail}`);
    }
    console.warn(`[env] Environment problems (non-fatal outside production):\n${detail}`);
  }

  return result;
}
