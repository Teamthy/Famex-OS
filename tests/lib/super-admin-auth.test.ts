import bcrypt from "bcryptjs";
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { mockPrisma } from "../setup";

const { resolveSchoolForRequest, enforceRateLimit, checkRateLimit, recordSecurityEvent } =
  vi.hoisted(() => ({
    resolveSchoolForRequest: vi.fn(),
    enforceRateLimit: vi.fn(),
    checkRateLimit: vi.fn(),
    recordSecurityEvent: vi.fn(),
  }));

vi.mock("@/lib/school-resolution", () => ({ resolveSchoolForRequest }));
vi.mock("@/lib/rate-limit", () => ({ enforceRateLimit, checkRateLimit }));
vi.mock("@/lib/forensics", () => ({
  recordSecurityEvent,
  getUserAgent: () => "test-agent",
}));
vi.mock("@/lib/requests", () => ({ getClientIp: () => "192.0.2.10" }));

const password = "Correct-horse-battery-staple-123!";
let passwordHash = "";

function loginRequest() {
  return new NextRequest("https://famex.test/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email: "operator@famex.test", password }),
    headers: { "content-type": "application/json" },
  });
}

beforeEach(async () => {
  vi.clearAllMocks();
  process.env.AUTH_SECRET = "test-secret-that-is-at-least-32-characters-long";
  passwordHash = await bcrypt.hash(password, 4);
  resolveSchoolForRequest.mockResolvedValue({ school: { id: "school_1" }, configured: true });
  enforceRateLimit.mockResolvedValue({ success: true, retryAfterSeconds: 0 });
  checkRateLimit.mockResolvedValue({ success: true, retryAfterSeconds: 0 });
  mockPrisma.user.findFirst.mockResolvedValue({
    id: "super_admin_1",
    schoolId: "school_1",
    email: "operator@famex.test",
    name: "Famex Operator",
    role: "SUPER_ADMIN",
    passwordHash,
    isActive: true,
    isSuspended: false,
    mfaEnabled: false,
    mfaSecretEncrypted: null,
    mustChangePassword: true,
    tokenVersion: 0,
  });
  mockPrisma.auditLog.create.mockResolvedValue({});
});

describe("Super Admin authentication", () => {
  it("refuses a password-only full session when Super Admin MFA is absent", async () => {
    const { POST } = await import("@/app/api/auth/login/route");
    const response = await POST(loginRequest());
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body).toMatchObject({ error: expect.stringMatching(/MFA-ready/) });
    expect(response.headers.get("set-cookie")).toBeNull();
    expect(mockPrisma.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: "SUPER_ADMIN_LOGIN_BLOCKED_MFA_MISSING",
        actorUserId: "super_admin_1",
      }),
    });
  });

  it("rejects a stale Super Admin session if MFA is absent in the database", async () => {
    const { signSession, requireRole } = await import("@/lib/session");
    const nextHeaders = await import("next/headers");
    const token = await signSession({
      id: "super_admin_1",
      schoolId: "school_1",
      role: "SUPER_ADMIN" as never,
      name: "Famex Operator",
      email: "operator@famex.test",
      tokenVersion: 0,
    });
    vi.mocked(nextHeaders.cookies).mockResolvedValue({
      get: () => ({ value: token }),
    } as never);
    vi.mocked(nextHeaders.headers).mockResolvedValue({ get: () => "" } as never);
    mockPrisma.user.findUnique.mockResolvedValue({
      tokenVersion: 0,
      isActive: true,
      isSuspended: false,
      mfaEnabled: false,
      mfaSecretEncrypted: null,
    });

    expect(await requireRole(["SUPER_ADMIN"] as never)).toBeNull();
  });

  it("issues only a short MFA challenge to a correctly provisioned Super Admin", async () => {
    mockPrisma.user.findFirst.mockResolvedValue({
      id: "super_admin_1",
      schoolId: "school_1",
      email: "operator@famex.test",
      name: "Famex Operator",
      role: "SUPER_ADMIN",
      passwordHash,
      isActive: true,
      isSuspended: false,
      mfaEnabled: true,
      mfaSecretEncrypted: "encrypted-totp-secret",
      mustChangePassword: true,
      tokenVersion: 0,
    });
    const { POST } = await import("@/app/api/auth/login/route");
    const response = await POST(loginRequest());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({ mfaRequired: true, challenge: expect.any(String) });
    expect(response.headers.get("set-cookie")).toBeNull();
  });
});
