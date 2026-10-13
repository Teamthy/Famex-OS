import { createHash, timingSafeEqual } from "crypto";
import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { verifySession } from "@/lib/session";
import { getClientIp, jsonNoStore } from "@/lib/requests";
import { enforceRateLimit } from "@/lib/rate-limit";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/auth/verify-session — federated session verification.
 *
 * YKAY College and YK Virtual are two separate products with two separate
 * identity stores (this one: `User` + a single role enum + an HS256 JWT;
 * YK Virtual: `users` + `user_roles` M2M + hashed opaque session tokens).
 * Rather than duplicating College credentials into YK Virtual and keeping two
 * passwords in sync, YK Virtual asks THIS endpoint whether a presented College
 * session is still valid, and mints its own local session from the answer.
 *
 * This makes the College portal the single source of truth: a suspension, a
 * password change, or a sign-out-everywhere on the College side takes effect on
 * YK Virtual at the next login, with no synchronisation job.
 *
 * ── Threat model ─────────────────────────────────────────────────────────
 * The caller is a trusted sibling SERVICE, not a browser, so it is
 * authenticated with a dedicated shared secret. This deliberately does NOT
 * reuse AUTH_SECRET: that value is already the JWT signing key and is handed to
 * the browser-adjacent middleware path, so reusing it here would widen the
 * blast radius of a leak. Set COLLEGE_SSO_SECRET to a distinct 32+ char value
 * on both sides.
 *
 * The endpoint returns identity CLAIMS ONLY. It never returns a token, a
 * password, or anything that would let the caller mint a College session.
 */

const requestSchema = z.object({
  /** The College session JWT, as carried in the ykay_session cookie or Bearer header. */
  token: z.string().trim().min(20),
});

/** Constant-time service-secret comparison. */
function serviceSecretIsValid(presented: string | null): boolean {
  const expected = process.env.COLLEGE_SSO_SECRET;
  if (!expected || expected.length < 32 || !presented) return false;
  const a = Buffer.from(presented);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export async function POST(request: NextRequest) {
  // Fail closed when the endpoint has not been configured at all, rather than
  // silently accepting traffic on an unconfigured integration.
  const expected = process.env.COLLEGE_SSO_SECRET;
  if (!expected || expected.length < 32) {
    logger.error("verify-session called but COLLEGE_SSO_SECRET is unset or under 32 characters");
    return jsonNoStore(
      { error: "Federated login is not configured on this server." },
      { status: 503 },
    );
  }

  if (!serviceSecretIsValid(request.headers.get("x-college-sso-secret"))) {
    return jsonNoStore({ error: "Forbidden" }, { status: 403 });
  }

  // Brute-force protection on an endpoint whose only input is a secret-bearing
  // POST. Keyed by caller IP; the shared secret is the real gate, this limits
  // how fast a leaked-but-wrong secret can be guessed.
  const limit = await enforceRateLimit("status", getClientIp(request));
  if (!limit.success) {
    return jsonNoStore(
      { error: limit.configurationError ? "Temporarily unavailable." : "Too many requests." },
      {
        status: limit.configurationError ? 503 : 429,
        headers: { "Retry-After": String(limit.retryAfterSeconds) },
      },
    );
  }

  let payload: z.infer<typeof requestSchema>;
  try {
    payload = requestSchema.parse(await request.json());
  } catch {
    return jsonNoStore({ error: "A session token is required." }, { status: 400 });
  }

  // 1) Signature + expiry. verifySession returns null for a bad signature,
  //    a wrong AUTH_SECRET, or an expired token.
  const claims = await verifySession(payload.token);
  if (!claims) {
    return jsonNoStore({ valid: false, reason: "INVALID_TOKEN" }, { status: 401 });
  }

  // 2) An impersonation session must never federate. A super-admin browsing a
  //    teacher's account on the College portal should not thereby acquire a
  //    live, writable YK Virtual session as that teacher.
  if (claims.impersonatedBy) {
    return jsonNoStore({ valid: false, reason: "IMPERSONATION_NOT_FEDERABLE" }, { status: 403 });
  }

  // 3) Live account state. This is the check that makes the College portal
  //    authoritative: a JWT stays cryptographically valid for its full 30-day
  //    lifetime, so suspension and revocation can ONLY be caught here.
  let dbUser: {
    isActive: boolean;
    isSuspended: boolean;
    tokenVersion: number;
    name: string;
    email: string;
    role: string;
    schoolId: string;
  } | null;
  try {
    dbUser = await prisma.user.findUnique({
      where: { id: claims.id },
      select: {
        isActive: true,
        isSuspended: true,
        tokenVersion: true,
        name: true,
        email: true,
        role: true,
        schoolId: true,
      },
    });
  } catch (error) {
    // Fail closed, and say so distinctly: 503 means "we could not check", not
    // "you are not allowed". YK Virtual must not treat this as a bad login.
    logger.error("verify-session: identity lookup failed", {
      userId: claims.id,
      error: String(error),
    });
    return jsonNoStore(
      { valid: false, reason: "IDENTITY_UNVERIFIABLE" },
      { status: 503, headers: { "Retry-After": "5" } },
    );
  }

  if (!dbUser) return jsonNoStore({ valid: false, reason: "USER_NOT_FOUND" }, { status: 401 });
  if (dbUser.isSuspended)
    return jsonNoStore({ valid: false, reason: "USER_SUSPENDED" }, { status: 403 });
  if (!dbUser.isActive)
    return jsonNoStore({ valid: false, reason: "USER_INACTIVE" }, { status: 403 });
  if (dbUser.tokenVersion > (claims.tokenVersion ?? 0)) {
    return jsonNoStore({ valid: false, reason: "SESSION_REVOKED" }, { status: 401 });
  }

  // 4) Claims. Deliberately the DB values, not the JWT values, so a role or
  //    email change since the token was issued is reflected immediately.
  return jsonNoStore({
    valid: true,
    user: {
      id: claims.id,
      schoolId: dbUser.schoolId,
      role: dbUser.role,
      name: dbUser.name,
      email: dbUser.email,
      tokenVersion: dbUser.tokenVersion,
    },
    // Lets the caller cache briefly without outliving a revocation for long.
    revalidateAfterSeconds: 60,
    // Fingerprint so the caller can detect that it is talking to the College
    // instance it expects rather than something in front of it.
    issuer: "ykay-college-eduportal",
    issuedAt: new Date().toISOString(),
    nonce: createHash("sha256").update(`${claims.id}:${Date.now()}`).digest("hex").slice(0, 16),
  });
}
