import { NextResponse } from "next/server";
import { UserRole } from "@prisma/client";
import { checkRole, explainDenial, getRawSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * GET /api/auth/whoami — why am I (not) authorised?
 *
 * Every protected route answers a bare `401 Unauthorized`, and there are six
 * distinct reasons it can do that. Three of them — a revoked tokenVersion, an
 * inactive account, a suspended account — are checked ONLY on the API and not
 * in middleware, which produces the confusing case: the admin page loads
 * perfectly and every button on it returns 401.
 *
 * A bare 401 cannot be diagnosed from the outside. This endpoint says exactly
 * which check failed, for the caller's own session, without exposing anything
 * they could not already learn about themselves.
 *
 * Deliberately returns 200 even when the session is invalid: the answer to
 * "why was I refused?" is the payload, not the status code. Returning 401 here
 * would make the diagnostic undiagnosable.
 */
export async function GET() {
  const session = await getRawSession();

  if (!session) {
    return NextResponse.json({
      authenticated: false,
      reason: "NO_SESSION",
      message: explainDenial("NO_SESSION"),
      hint: "If you are signed in and still see this, the cookie is not reaching the server — check that you are on the same domain you signed in on, and that AUTH_SECRET has not changed since the cookie was issued.",
    });
  }

  // What the database currently thinks of this account, which is what the API
  // enforces against and the page navigation does not.
  let dbState: {
    exists: boolean;
    isActive?: boolean;
    isSuspended?: boolean;
    tokenVersion?: number;
  } = { exists: false };

  try {
    const dbUser = await prisma.user.findUnique({
      where: { id: session.id },
      select: { isActive: true, isSuspended: true, tokenVersion: true },
    });
    dbState = dbUser
      ? {
          exists: true,
          isActive: dbUser.isActive,
          isSuspended: dbUser.isSuspended,
          tokenVersion: dbUser.tokenVersion,
        }
      : { exists: false };
  } catch (dbError) {
    return NextResponse.json({
      authenticated: true,
      reason: "DB_UNREACHABLE",
      message:
        "Your session is valid but the database could not be reached to confirm it. Identity checks fail CLOSED, so protected requests will be refused with 503 until the database recovers. This is deliberate: the lookup is the only thing that sees suspensions and revocations.",
      detail: dbError instanceof Error ? dbError.message.split("\n")[0] : String(dbError),
      session: { id: session.id, role: session.role, email: session.email },
    });
  }

  // Probe the role sets that matter, using the SAME function the routes use,
  // so this can never disagree with the real check.
  const [asAdmin, asSubjectAdmin] = await Promise.all([
    checkRole([UserRole.ADMIN, UserRole.DIRECTOR, UserRole.SUPER_ADMIN]),
    checkRole([UserRole.ADMIN, UserRole.DIRECTOR, UserRole.COORDINATOR, UserRole.SUPER_ADMIN]),
  ]);

  return NextResponse.json({
    authenticated: true,
    session: {
      id: session.id,
      email: session.email,
      role: session.role,
      schoolId: session.schoolId,
      tokenVersion: session.tokenVersion ?? 0,
      impersonatedBy: session.impersonatedBy ?? null,
      mustChangePassword: Boolean(session.mustChangePassword),
    },
    database: dbState,
    // The mismatch that silently kills every API call while pages keep working.
    sessionRevoked: dbState.exists && (dbState.tokenVersion ?? 0) > (session.tokenVersion ?? 0),
    checks: {
      admin: asAdmin.ok ? "OK" : asAdmin.reason,
      subjectAdmin: asSubjectAdmin.ok ? "OK" : asSubjectAdmin.reason,
    },
    // Impersonated sessions are blocked from every write by middleware — but
    // that returns 403, not 401, so it is ruled in or out here explicitly.
    writesBlockedByImpersonation: Boolean(session.impersonatedBy),
    message: asSubjectAdmin.ok
      ? "This session can use /api/admin/subjects. A 401 from it means the cookie is not reaching that request."
      : explainDenial(asSubjectAdmin.reason),
  });
}
