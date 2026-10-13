import { NextResponse } from "next/server";
import { SESSION_COOKIE, getSession, revokeAllSessions } from "@/lib/session";
import { logger } from "@/lib/logger";

export async function POST() {
  // AUD-F2: logout used to only clear the cookie, so a pre-logout JWT stayed
  // valid for up to 30 days — replaying it against /api/auth/me still
  // returned 200. EduPortal sessions are stateless JWTs keyed by
  // (userId, tokenVersion); bumping the version revokes every outstanding
  // token for the account. Trade-off (no server-side session list exists):
  // logout is necessarily "sign out everywhere" for the account — the safe
  // direction for a school portal, and consistent with what suspend /
  // password-change already do via the same helper.
  const user = await getSession();
  if (user) {
    try {
      await revokeAllSessions(user.id);
    } catch (error) {
      // The cookie is still cleared below so THIS device signs out; a failed
      // revoke must not keep the user signed in locally, but log it loudly.
      logger.error("logout: failed to revoke sessions", {
        userId: user.id,
        error: String(error),
      });
    }
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set(SESSION_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  return response;
}
