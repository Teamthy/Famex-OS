import { SignJWT, jwtVerify } from "jose";
import { cookies, headers } from "next/headers";
import type { UserRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { NextResponse } from "next/server";

export const SESSION_COOKIE = "ykay_session";

/**
 * Session lifetime.
 *
 * The JWT and the cookie both expire after this, and there is deliberately no
 * refresh-token rotation. That is safe here because authorisation is NOT
 * delegated to the token's expiry: every protected route calls `requireRole` /
 * `checkRole`, which look the user up in the database on every request and
 * reject them if `isActive` is false, `isSuspended` is true, or `tokenVersion`
 * is newer than the one in the JWT (see revokeAllSessions). So a suspended or
 * revoked account is locked out within one request no matter how long the JWT
 * lives.
 *
 * The only thing the 8-hour expiry used to buy us was forcing a re-login every
 * day — which is exactly the friction this app should not have: parents and
 * teachers open the mobile app and web portal daily, and the audit flagged the
 * daily re-login as the top UX papercut. With DB-backed revocation in place,
 * a longer lifetime is a pure UX win with no revocation gap, so sessions now
 * last 30 days for an active user.
 */
export const SESSION_TTL_JOSE = "30d";
export const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30;

const encoder = new TextEncoder();

function secret() {
  const value = process.env.AUTH_SECRET;
  if (!value || value.length < 32) throw new Error("AUTH_SECRET must be at least 32 characters.");
  return encoder.encode(value);
}

export type SessionUser = {
  id: string;
  schoolId: string;
  role: UserRole;
  name: string;
  email: string;
  mustChangePassword?: boolean;
  tokenVersion?: number;
  impersonatedBy?: string;
};

export async function signSession(
  user: SessionUser & { impersonatedBy?: string; tokenVersion?: number },
) {
  const claims: Record<string, unknown> = {
    schoolId: user.schoolId,
    role: user.role,
    name: user.name,
    email: user.email,
    mustChangePassword: Boolean(user.mustChangePassword),
    tokenVersion: user.tokenVersion ?? 0,
  };
  if (user.impersonatedBy) {
    claims.impersonatedBy = user.impersonatedBy;
  }

  return new SignJWT(claims)
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(user.id)
    .setIssuedAt()
    .setExpirationTime(SESSION_TTL_JOSE)
    .sign(secret());
}

export async function verifySession(token: string): Promise<SessionUser | null> {
  try {
    const { payload } = await jwtVerify(token, secret());
    if (
      !payload.sub ||
      typeof payload.schoolId !== "string" ||
      typeof payload.role !== "string" ||
      typeof payload.name !== "string" ||
      typeof payload.email !== "string"
    )
      return null;
    return {
      id: payload.sub,
      schoolId: payload.schoolId,
      role: payload.role as UserRole,
      name: payload.name,
      email: payload.email,
      mustChangePassword: payload.mustChangePassword === true,
      tokenVersion: typeof payload.tokenVersion === "number" ? payload.tokenVersion : 0,
      impersonatedBy:
        typeof payload.impersonatedBy === "string" ? payload.impersonatedBy : undefined,
    };
  } catch {
    return null;
  }
}

export async function getRawSession() {
  // 1) Web browser sessions — signed cookie
  const cookieToken = (await cookies()).get(SESSION_COOKIE)?.value;
  if (cookieToken) {
    const session = await verifySession(cookieToken);
    if (session) return session;
  }
  // 2) Mobile / API clients — Authorization: Bearer (same JWT, different transport)
  const authHeader = (await headers()).get("authorization") || "";
  if (authHeader.toLowerCase().startsWith("bearer ")) {
    const bearer = authHeader.slice(7).trim();
    if (bearer) {
      const session = await verifySession(bearer);
      if (session) return session;
    }
  }
  return null;
}

async function verifyCurrentSession(user: SessionUser): Promise<SessionUser | null> {
  let dbUser: { tokenVersion: number; isActive: boolean; isSuspended: boolean } | null;
  try {
    dbUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { tokenVersion: true, isActive: true, isSuspended: true },
    });
  } catch (error) {
    logger.error("Identity state lookup failed — denying request", {
      userId: user.id,
      error: String(error),
    });
    throw new IdentityCheckUnavailableError();
  }
  if (!dbUser) return null;
  if (!dbUser.isActive || dbUser.isSuspended) return null;
  if (dbUser.tokenVersion > (user.tokenVersion ?? 0)) return null;
  return user;
}

/**
 * Default session helper: signature/expiry PLUS current DB account state.
 * Raw JWT reads are intentionally kept behind getRawSession() for diagnostics
 * only, so revoked/suspended accounts are not honoured until JWT expiry.
 */
export async function getSession() {
  const session = await getRawSession();
  if (!session) return null;
  return verifyCurrentSession(session);
}

export function sessionCookie(token: string) {
  return {
    name: SESSION_COOKIE,
    value: token,
    options: {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax" as const,
      path: "/",
      maxAge: SESSION_TTL_SECONDS,
    },
  };
}

/**
 * Validates the session and checks tokenVersion against the database.
 * If the user's tokenVersion in the DB is higher than the one in the JWT,
 * the session has been revoked (e.g. user was suspended or password was reset).
 *
 * This check is lightweight — a single indexed lookup by primary key.
 */
/**
 * Why a session was refused.
 *
 * `requireRole` returns null for six different reasons and the caller answers
 * a bare 401 for all of them, so "the page loads but every button says
 * Unauthorized" is unactionable — you cannot tell an expired cookie from a
 * revoked token from a suspended account without reading the source.
 *
 * `sessionDenialReason()` returns the specific cause. `/api/auth/whoami`
 * surfaces it, and it is written to the response header on a denial so it
 * shows up in the network tab without needing a second request.
 */
export type SessionDenial =
  | "NO_SESSION"
  | "BAD_SIGNATURE_OR_EXPIRED"
  | "WRONG_ROLE"
  | "USER_NOT_FOUND"
  | "USER_INACTIVE"
  | "USER_SUSPENDED"
  | "SESSION_REVOKED"
  // Not a refusal on the merits: the database could not be reached to confirm
  // identity state. Callers must answer 503, not 401 — see isUnavailable().
  | "IDENTITY_UNVERIFIABLE";

export type SessionCheck =
  { ok: true; user: SessionUser } | { ok: false; reason: SessionDenial; role?: UserRole };

/**
 * The same logic as `requireRole`, but it reports WHY it said no.
 *
 * Kept as one implementation so the diagnostic can never drift from the
 * enforcement — a diagnostic that disagrees with the real check is worse than
 * none, because it sends you looking in the wrong place.
 */
export async function checkRole(allowed: UserRole[]): Promise<SessionCheck> {
  const cookieToken = (await cookies()).get(SESSION_COOKIE)?.value;
  const authHeader = (await headers()).get("authorization") || "";
  const bearer = authHeader.toLowerCase().startsWith("bearer ") ? authHeader.slice(7).trim() : "";

  if (!cookieToken && !bearer) return { ok: false, reason: "NO_SESSION" };

  const user = await getRawSession();
  // A token was presented but did not verify: wrong AUTH_SECRET, tampered, or
  // past its token expiry (or an invalid/revoked signature).
  if (!user) return { ok: false, reason: "BAD_SIGNATURE_OR_EXPIRED" };

  if (!allowed.includes(user.role)) return { ok: false, reason: "WRONG_ROLE", role: user.role };

  try {
    const dbUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { tokenVersion: true, isActive: true, isSuspended: true },
    });
    if (!dbUser) return { ok: false, reason: "USER_NOT_FOUND", role: user.role };
    if (dbUser.isSuspended) return { ok: false, reason: "USER_SUSPENDED", role: user.role };
    if (!dbUser.isActive) return { ok: false, reason: "USER_INACTIVE", role: user.role };
    if (dbUser.tokenVersion > (user.tokenVersion ?? 0)) {
      return { ok: false, reason: "SESSION_REVOKED", role: user.role };
    }
  } catch (error) {
    // Matches requireRole: fail CLOSED. This lookup is the ONLY thing that
    // sees suspensions and revocations, so allowing the request through on a
    // database error left a suspended user authorised for the remaining
    // lifetime of their session token. Reported as its own reason so the
    // caller can answer 503 rather than 401.
    logger.error("Identity state lookup failed — denying request", {
      userId: user.id,
      error: String(error),
    });
    return { ok: false, reason: "IDENTITY_UNVERIFIABLE", role: user.role };
  }

  return { ok: true, user };
}

/**
 * True when a denial means "we could not check", not "you may not".
 *
 * Lets a route answer 503 for an infrastructure problem while still answering
 * 401 for a genuine authorisation failure, without inspecting the reason
 * string at every call site.
 */
export function isUnavailable(reason: SessionDenial): boolean {
  return reason === "IDENTITY_UNVERIFIABLE";
}

/** Plain-English explanation, safe to show a signed-in staff member. */
export function explainDenial(reason: SessionDenial): string {
  switch (reason) {
    case "NO_SESSION":
      return "No session cookie was sent. Sign in again.";
    case "BAD_SIGNATURE_OR_EXPIRED":
      return "Your session has expired or is no longer valid. Sign in again.";
    case "WRONG_ROLE":
      return "Your role does not have access to this action.";
    case "USER_NOT_FOUND":
      return "Your account no longer exists.";
    case "USER_INACTIVE":
      return "Your account is not active. Ask an administrator to re-enable it.";
    case "USER_SUSPENDED":
      return "Your account is suspended.";
    case "SESSION_REVOKED":
      return "Your session was ended elsewhere — after a password change, role change, or sign-out-everywhere. Sign in again.";
    case "IDENTITY_UNVERIFIABLE":
      return "We could not confirm your account status just now. This is a temporary problem on our side — please try again in a moment.";
  }
}

/**
 * Thrown when the database cannot confirm a user's current identity state.
 *
 * Distinct from "not authorised" on purpose: the caller should answer 503
 * ("we cannot verify you right now"), not 401 ("you are not allowed"). A 401
 * would tell a legitimate signed-in user their credentials are wrong during a
 * database blip.
 */
export class IdentityCheckUnavailableError extends Error {
  constructor() {
    super("Unable to verify session state.");
    this.name = "IdentityCheckUnavailableError";
  }
}

/**
 * ── Fail CLOSED ────────────────────────────────────────────────────────────
 * This used to swallow database errors and allow the request through, on the
 * reasoning that the JWT signature was still valid. That was wrong: the whole
 * point of the lookup is to catch state the JWT cannot know about — a
 * suspended account, a revoked session, a password reset. Swallowing the error
 * meant a suspended user stayed authorised for up to the remaining session-token lifetime
 * on every route, for as long as the database was unhappy.
 *
 * It now throws IdentityCheckUnavailableError. Routes using requireRoleOr503
 * turn that into a 503; anything else propagates as a 500. Both are correct —
 * neither grants access.
 */
export async function requireRole(allowed: UserRole[]) {
  const user = await getSession();
  if (!user || !allowed.includes(user.role)) return null;
  return user;
}

/**
 * requireRole() wrapped for route handlers: returns either the user, or the
 * NextResponse the handler should return immediately.
 *
 *   const auth = await requireRoleOr503([UserRole.ADMIN]);
 *   if (auth instanceof NextResponse) return auth;
 *   // ...auth is a SessionUser
 *
 * Keeps the 401-vs-503 distinction correct without every handler needing a
 * try/catch around its auth call.
 */
export async function requireRoleOr503(allowed: UserRole[]) {
  try {
    const user = await requireRole(allowed);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    return user;
  } catch (error) {
    if (error instanceof IdentityCheckUnavailableError) {
      return NextResponse.json(
        { error: "Service temporarily unavailable. Please try again." },
        { status: 503, headers: { "Retry-After": "5" } },
      );
    }
    throw error;
  }
}

/**
 * Increment a user's tokenVersion, invalidating all their existing sessions.
 * Call this on: suspend, password reset, role change, manual "sign out everywhere".
 */
export async function revokeAllSessions(userId: string): Promise<void> {
  await prisma.user.update({
    where: { id: userId },
    data: { tokenVersion: { increment: 1 } },
  });
}

/**
 * Impersonation write-guard. Super-admin impersonation is READ-ONLY by design.
 * Call this at the top of any mutating (POST/PUT/PATCH/DELETE) handler to block
 * writes performed while impersonating another user. Returns a 403 response when
 * the session is impersonating, otherwise null.
 */
export function assertNotImpersonating(user: { impersonatedBy?: string }) {
  if (user.impersonatedBy) {
    return NextResponse.json(
      { error: "Writes are not permitted while impersonating. End impersonation first." },
      { status: 403 },
    );
  }
  return null;
}
