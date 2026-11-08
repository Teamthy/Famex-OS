import { jwtVerify } from "jose";

/**
 * The "change your password first" gate, as its own module.
 *
 * Accounts are created with a temporary password in several places — admission
 * creates the parent's, staff onboarding a teacher's, admin-created students
 * and student login provisioning the child's — and every one sets
 * `mustChangePassword`. The flag was written into the session token from the
 * day it was introduced and **nothing ever read it**. A password a clerk had
 * seen signed a family straight into the portal and stayed valid until someone
 * happened to change it.
 *
 * ── Why this is not in lib/session.ts
 *
 * It runs in middleware, which executes on every request before any route. That
 * code path must stay small; `lib/session.ts` imports Prisma and `next/headers`,
 * neither of which belongs in the edge bundle. Everything here is pure or uses
 * `jose`, which middleware already depends on.
 */

/** Paths that stay open while a password change is pending. */
const ALLOWED_PREFIXES = [
  "/change-password",
  "/api/auth/change-password",
  "/api/auth/logout",
  "/api/auth/me",
  "/api/auth/login",
  "/login",
  "/_next",
  "/favicon.ico",
];

/** Where a user with a pending password change is sent. */
export const PASSWORD_CHANGE_PATH = "/change-password";

/**
 * Must this request be refused because the password has not been changed?
 *
 * Deliberately minimal: everything needed to COMPLETE the change stays open,
 * plus sign-out and the session probe the page uses. Every other page and API
 * is refused until it happens.
 */
export function mustCompletePasswordChange(pathname: string): boolean {
  return !ALLOWED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

/** The only claim this gate needs from a session token. */
export type PasswordChangeClaim = { pending: boolean };

/**
 * Read the pending-change claim out of a session token, without a database.
 *
 * Uses the same secret and the same HS256 as `verifySession`; it does not check
 * that the account still exists, because middleware must not query the
 * database and every real route still does that check. A forged token cannot
 * get past signature verification, which is the part that matters here.
 */
export async function readPendingPasswordChange(params: {
  token: string;
  secret: Uint8Array;
}): Promise<PasswordChangeClaim> {
  try {
    const { payload } = await jwtVerify(params.token, params.secret, { algorithms: ["HS256"] });
    return { pending: payload.mustChangePassword === true };
  } catch {
    // An unreadable token is the auth layer's problem, not this gate's. Not
    // claiming "pending" here avoids turning every expired session into a
    // redirect to a page the visitor cannot use.
    return { pending: false };
  }
}

/** A refusal the caller can act on, for an API request. */
export const PASSWORD_CHANGE_REQUIRED = {
  error: "Set a new password before continuing.",
  code: "PASSWORD_CHANGE_REQUIRED",
} as const;
