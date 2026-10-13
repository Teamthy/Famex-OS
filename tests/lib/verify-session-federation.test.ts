import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";
import { SignJWT } from "jose";
import { mockPrisma } from "../setup";

/**
 * POST /api/auth/verify-session — the federated-login trust boundary.
 *
 * YK Virtual calls this to decide whether to sign a person in. Everything the
 * other product believes about a YKAY College account comes from this response,
 * so each refusal path is pinned: a bug here either locks families out of
 * YK Virtual or, worse, signs in someone the College portal has suspended.
 */

const AUTH_SECRET = "test-auth-secret-that-is-at-least-32-characters";
const SSO_SECRET = "test-college-sso-secret-at-least-32-characters";

async function signCollegeToken(claims: Record<string, unknown>, subject: string) {
  return new SignJWT(claims)
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(subject)
    .setIssuedAt()
    .setExpirationTime("1h")
    .sign(new TextEncoder().encode(AUTH_SECRET));
}

const ACTIVE_DB_USER = {
  isActive: true,
  isSuspended: false,
  tokenVersion: 2,
  name: "Ada Obi",
  email: "parent@ykaycollege.com",
  role: "PARENT",
  schoolId: "school_ykay",
};

async function callRoute(opts: { body?: unknown; ssoHeader?: string | null; ip?: string }) {
  const { POST } = await import("@/app/api/auth/verify-session/route");
  const request = new NextRequest("http://localhost:3000/api/auth/verify-session", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      // Distinct IP per test keeps the "status" rate limit (30/10min) from
      // leaking between cases.
      "x-forwarded-for": opts.ip ?? "203.0.113.7",
      ...(opts.ssoHeader === null ? {} : { "x-college-sso-secret": opts.ssoHeader ?? SSO_SECRET }),
    },
    body: JSON.stringify(opts.body ?? {}),
  });
  const response = await POST(request);
  return { status: response.status, json: await response.json() };
}

beforeEach(() => {
  vi.stubEnv("AUTH_SECRET", AUTH_SECRET);
  vi.stubEnv("COLLEGE_SSO_SECRET", SSO_SECRET);
  mockPrisma.user.findUnique.mockReset();
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("POST /api/auth/verify-session", () => {
  it("returns 503 when the integration is not configured", async () => {
    vi.stubEnv("COLLEGE_SSO_SECRET", "");
    const { status, json } = await callRoute({ body: { token: "anything" }, ip: "203.0.113.20" });
    expect(status).toBe(503);
    expect(json.error).toMatch(/not configured/i);
  });

  it("rejects a short configured secret rather than running weak", async () => {
    vi.stubEnv("COLLEGE_SSO_SECRET", "too-short");
    const { status } = await callRoute({ body: { token: "anything" }, ip: "203.0.113.21" });
    expect(status).toBe(503);
  });

  it("rejects a wrong service secret with 403 and never touches the database", async () => {
    const { status } = await callRoute({
      body: { token: "anything" },
      ssoHeader: "wrong-secret-that-is-long-enough-to-compare",
      ip: "203.0.113.22",
    });
    expect(status).toBe(403);
    expect(mockPrisma.user.findUnique).not.toHaveBeenCalled();
  });

  it("rejects a missing service secret header", async () => {
    const { status } = await callRoute({
      body: { token: "anything" },
      ssoHeader: null,
      ip: "203.0.113.23",
    });
    expect(status).toBe(403);
  });

  it("rejects a token signed with the wrong AUTH_SECRET", async () => {
    const forged = await new SignJWT({ role: "PARENT" })
      .setProtectedHeader({ alg: "HS256" })
      .setSubject("user_1")
      .setExpirationTime("1h")
      .sign(new TextEncoder().encode("a-completely-different-secret-value"));

    const { status, json } = await callRoute({ body: { token: forged }, ip: "203.0.113.24" });
    expect(status).toBe(401);
    expect(json.reason).toBe("INVALID_TOKEN");
    expect(mockPrisma.user.findUnique).not.toHaveBeenCalled();
  });

  it("refuses to federate an impersonation session", async () => {
    const token = await signCollegeToken(
      {
        schoolId: "school_ykay",
        role: "ADMIN",
        name: "T",
        email: "a@b.c",
        impersonatedBy: "super_1",
      },
      "user_1",
    );
    const { status, json } = await callRoute({ body: { token }, ip: "203.0.113.25" });
    expect(status).toBe(403);
    expect(json.reason).toBe("IMPERSONATION_NOT_FEDERABLE");
  });

  it("returns 503, not 401, when the identity lookup fails", async () => {
    const token = await signCollegeToken(
      { schoolId: "school_ykay", role: "PARENT", name: "Ada", email: "a@b.c", tokenVersion: 2 },
      "user_1",
    );
    mockPrisma.user.findUnique.mockRejectedValue(new Error("connection reset"));

    const { status, json } = await callRoute({ body: { token }, ip: "203.0.113.26" });
    expect(status).toBe(503);
    expect(json.reason).toBe("IDENTITY_UNVERIFIABLE");
  });

  it.each([
    ["USER_NOT_FOUND", 401, null, 31],
    ["USER_SUSPENDED", 403, { ...ACTIVE_DB_USER, isSuspended: true }, 32],
    ["USER_INACTIVE", 403, { ...ACTIVE_DB_USER, isActive: false }, 33],
    ["SESSION_REVOKED", 401, { ...ACTIVE_DB_USER, tokenVersion: 9 }, 34],
  ])("refuses with %s", async (reason, expectedStatus, dbUser, ipSuffix) => {
    const token = await signCollegeToken(
      { schoolId: "school_ykay", role: "PARENT", name: "Ada", email: "a@b.c", tokenVersion: 2 },
      "user_1",
    );
    mockPrisma.user.findUnique.mockResolvedValue(dbUser);

    const { status, json } = await callRoute({ body: { token }, ip: `203.0.113.${ipSuffix}` });
    expect(status).toBe(expectedStatus);
    expect(json.valid).toBe(false);
    expect(json.reason).toBe(reason);
  });

  it("returns DB-sourced claims on success, not the JWT claims", async () => {
    const token = await signCollegeToken(
      // Stale JWT claims: role and email have since changed in the database.
      {
        schoolId: "school_ykay",
        role: "STUDENT",
        name: "Old Name",
        email: "old@example.com",
        tokenVersion: 2,
      },
      "user_1",
    );
    mockPrisma.user.findUnique.mockResolvedValue(ACTIVE_DB_USER);

    const { status, json } = await callRoute({ body: { token }, ip: "203.0.113.50" });
    expect(status).toBe(200);
    expect(json.valid).toBe(true);
    expect(json.user.role).toBe("PARENT");
    expect(json.user.email).toBe("parent@ykaycollege.com");
    expect(json.user.name).toBe("Ada Obi");
    expect(json.issuer).toBe("ykay-college-eduportal");
    // Never leaks anything that could mint a College session.
    expect(JSON.stringify(json)).not.toContain("password");
    expect(json.token).toBeUndefined();
  });

  it("rejects a malformed body", async () => {
    const { status } = await callRoute({ body: { nope: true }, ip: "203.0.113.60" });
    expect(status).toBe(400);
  });
});
