import { jwtVerify } from "jose";
import { NextRequest, NextResponse } from "next/server";
import { resolveAllowedOrigin } from "@/lib/cors";
import { buildContentSecurityPolicy, storageUploadOrigin } from "@/lib/csp";

const protectedPrefixes = [
  "/admin",
  "/admin-admissions",
  "/teacher",
  "/student",
  "/parent",
  "/it-portal",
  "/super-admin",
  "/change-password",
  "/staff",
];
/**
 * Pages inside a protected prefix that must stay reachable while signed OUT.
 *
 * /staff/activate is the one an invited teacher opens from their email. Their
 * account does not exist yet — it is CREATED by activation — so bouncing them
 * to /login was an unescapable loop: no account to log in with, and the only
 * page that would create one sat behind the login. Staff onboarding could
 * never complete.
 *
 * /it-portal/auth is the IT-student sign-in/registration page, same reasoning.
 */
const publicPaths = ["/it-portal/auth", "/staff/activate"];
const encoder = new TextEncoder();

function destinationFor(role: string) {
  if (role === "SUPER_ADMIN") return "/super-admin";
  if (["ADMIN", "DIRECTOR", "COORDINATOR", "BURSAR"].includes(role)) return "/admin";
  if (["TEACHER", "HOD"].includes(role)) return "/teacher/dashboard";
  if (role === "PARENT") return "/parent/dashboard";
  if (role === "IT_STUDENT") return "/it-portal/dashboard";
  return "/student/dashboard";
}

/**
 * Logs an auth denial to the security forensics endpoint (fire-and-forget).
 * This gives super-admins visibility into who is being denied and why.
 */
function logDenial(
  eventType: string,
  pathname: string,
  email: string | undefined,
  reason: string,
  ip: string,
) {
  // Fire-and-forget POST to our forensics API.
  // We don't await because middleware must return quickly.
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
  fetch(`${baseUrl}/api/internal/security-event`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-internal-secret": process.env.AUTH_SECRET || "",
    },
    body: JSON.stringify({
      eventType,
      targetPath: pathname,
      userEmail: email,
      reason,
      ipAddress: ip,
    }),
  }).catch(() => {
    /* swallow — middleware must not block on logging */
  });
}

/**
 * Stamp the resolved CORS headers onto a response.
 *
 * This MUST be applied to the real response, not only to the preflight.
 * A browser re-checks Access-Control-Allow-Origin on every single response;
 * passing the preflight buys nothing if the actual POST comes back carrying a
 * different origin. That mismatch was the "Failed to fetch" login bug — the
 * preflight said `http://localhost:8081` while a static header block in
 * next.config.ts stamped `https://ykaycollege.edu.ng` onto the POST.
 */
function applyCors(response: NextResponse, request: NextRequest): NextResponse {
  const origin = resolveAllowedOrigin(request.headers.get("origin"));
  response.headers.set("Access-Control-Allow-Origin", origin);
  if (origin !== "*") {
    response.headers.set("Access-Control-Allow-Credentials", "true");
  }
  // Responses vary by Origin, so caches (and Vercel's CDN) must not serve one
  // caller's allow-origin to another.
  response.headers.append("Vary", "Origin");
  return response;
}

async function routeRequest(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const method = request.method;
  const isApi = pathname.startsWith("/api/");

  // ── CORS preflight for API routes ──
  // Native mobile ignores CORS; this serves browser cross-origin callers
  // (e.g. the Expo web build, or a future custom-domain web app).
  if (isApi && method === "OPTIONS") {
    const preflight = new NextResponse(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
        "Access-Control-Allow-Headers":
          "Content-Type,Authorization,x-idempotency-key,idempotency-key",
        "Access-Control-Max-Age": "86400",
      },
    });
    return applyCors(preflight, request);
  }

  // ── Read-only super-admin impersonation ──
  // Block every mutating API request while impersonating (except the endpoints
  // that manage the impersonation/session themselves). This is the single,
  // global enforcement point — no route needs to remember to check.
  if (
    pathname.startsWith("/api/") &&
    method !== "GET" &&
    method !== "HEAD" &&
    method !== "OPTIONS" &&
    pathname !== "/api/super-admin/impersonate" &&
    pathname !== "/api/auth/logout"
  ) {
    // Read the session from EITHER transport. getRawSession() in lib/session.ts
    // accepts a signed cookie (web) or `Authorization: Bearer <same JWT>`
    // (mobile / API clients), so an impersonation guard that only inspects the
    // cookie leaves the Bearer path open: a super-admin who lifts the
    // impersonation JWT out of the response and replays it as a Bearer token
    // reaches every route except the handful that also call
    // assertNotImpersonating(). Checking both closes that.
    const authHeader = request.headers.get("authorization") || "";
    const bearer = authHeader.toLowerCase().startsWith("bearer ") ? authHeader.slice(7).trim() : "";
    const impToken = request.cookies.get("ykay_session")?.value || bearer;
    const impSecret = process.env.AUTH_SECRET;
    if (impToken && impSecret && impSecret.length >= 32) {
      try {
        const { payload } = await jwtVerify(impToken, encoder.encode(impSecret));
        if (payload.impersonatedBy) {
          // CORS headers on the error too — otherwise the browser blocks the
          // 403 and the caller sees an opaque "Failed to fetch" instead of the
          // actual reason.
          return applyCors(
            NextResponse.json(
              { error: "Writes are not permitted while impersonating. End impersonation first." },
              { status: 403 },
            ),
            request,
          );
        }
      } catch {
        // invalid/expired token — let the route's own auth reject it
      }
    }
  }

  // Every /api/* response that passes through here needs the CORS headers,
  // because next.config.ts no longer supplies them. `/api/auth/login` lands on
  // this line — it is not a protected prefix — so this is the branch the
  // mobile login actually returns through.
  if (publicPaths.some((path) => pathname.startsWith(path))) {
    return isApi ? applyCors(NextResponse.next(), request) : NextResponse.next();
  }
  if (!protectedPrefixes.some((prefix) => pathname.startsWith(prefix))) {
    return isApi ? applyCors(NextResponse.next(), request) : NextResponse.next();
  }

  const token = request.cookies.get("ykay_session")?.value;
  const secret = process.env.AUTH_SECRET;
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown";

  if (!token || !secret || secret.length < 32) {
    logDenial("AUTH_DENIED_SESSION_INVALID", pathname, undefined, "No valid session cookie.", ip);
    return redirectToLogin(request);
  }

  try {
    const { payload } = await jwtVerify(token, encoder.encode(secret));
    const role = typeof payload.role === "string" ? payload.role : "";
    const email = typeof payload.email === "string" ? payload.email : undefined;

    if (payload.mustChangePassword === true && pathname !== "/change-password") {
      return NextResponse.redirect(new URL("/change-password", request.url));
    }

    const changePasswordPath = pathname.startsWith("/change-password");
    const adminPath = pathname.startsWith("/admin") || pathname.startsWith("/admin-admissions");
    const teacherPath = pathname.startsWith("/teacher");
    const parentPath = pathname.startsWith("/parent");
    const studentPath = pathname.startsWith("/student");
    const itPath = pathname.startsWith("/it-portal");
    const staffPath = pathname.startsWith("/staff");
    const superPath = pathname.startsWith("/super-admin");

    const allowed =
      changePasswordPath ||
      (superPath && role === "SUPER_ADMIN") ||
      (adminPath && ["ADMIN", "DIRECTOR", "COORDINATOR", "BURSAR", "SUPER_ADMIN"].includes(role)) ||
      (teacherPath && ["TEACHER", "HOD", "ADMIN", "DIRECTOR"].includes(role)) ||
      (parentPath && role === "PARENT") ||
      (studentPath && role === "STUDENT") ||
      (itPath && ["IT_STUDENT", "STUDENT", "ADMIN", "DIRECTOR"].includes(role)) ||
      (staffPath &&
        ["TEACHER", "HOD", "ADMIN", "DIRECTOR", "COORDINATOR", "BURSAR"].includes(role));

    if (!allowed) {
      logDenial(
        "AUTH_DENIED_INSUFFICIENT_ROLE",
        pathname,
        email,
        `Role ${role} cannot access ${pathname}.`,
        ip,
      );
      return NextResponse.redirect(new URL(destinationFor(role), request.url));
    }
    return NextResponse.next();
  } catch {
    logDenial("AUTH_DENIED_SESSION_EXPIRED", pathname, undefined, "JWT verification failed.", ip);
    return redirectToLogin(request);
  }
}

function redirectToLogin(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const url = new URL(
    pathname.startsWith("/it-portal") ? "/it-portal/auth" : "/login",
    request.url,
  );
  if (!pathname.startsWith("/it-portal")) url.searchParams.set("next", pathname);
  return NextResponse.redirect(url);
}

/**
 * Every response carries the Content-Security-Policy. It is built here, per request,
 * because the admissions upload origin comes from runtime settings.
 */
export async function middleware(request: NextRequest) {
  const response = await routeRequest(request);
  response.headers.set(
    "Content-Security-Policy",
    buildContentSecurityPolicy({
      isProduction: process.env.NODE_ENV === "production",
      plausible: Boolean(process.env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN),
      storageOrigin: storageUploadOrigin(process.env),
    }),
  );
  return response;
}

export const config = {
  matcher: [
    // Every page and API route. Only build assets and image optimisation are skipped.
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
