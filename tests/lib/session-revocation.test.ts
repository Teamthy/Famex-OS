import { describe, it, expect, vi, beforeEach } from "vitest";
import { mockPrisma } from "../setup";

// Set AUTH_SECRET before importing session module
process.env.AUTH_SECRET = "test-secret-that-is-at-least-32-characters-long-for-testing";

describe("Session Revocation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("revokeAllSessions increments tokenVersion", async () => {
    mockPrisma.user.update.mockResolvedValue({ tokenVersion: 1 });

    const { revokeAllSessions } = await import("@/lib/session");
    await revokeAllSessions("user_123");

    expect(mockPrisma.user.update).toHaveBeenCalledWith({
      where: { id: "user_123" },
      data: { tokenVersion: { increment: 1 } },
    });
  });

  it("signSession includes tokenVersion in claims", async () => {
    const { signSession } = await import("@/lib/session");
    const { jwtVerify } = await import("jose");

    const token = await signSession({
      id: "user_1",
      schoolId: "school_1",
      role: "ADMIN" as any,
      name: "Test",
      email: "test@test.com",
      tokenVersion: 5,
    });

    const encoder = new TextEncoder();
    const { payload } = await jwtVerify(token, encoder.encode(process.env.AUTH_SECRET!));

    expect(payload.tokenVersion).toBe(5);
  });

  it("verifySession extracts tokenVersion from token", async () => {
    const { signSession, verifySession } = await import("@/lib/session");

    const token = await signSession({
      id: "user_1",
      schoolId: "school_1",
      role: "TEACHER" as any,
      name: "Test",
      email: "test@test.com",
      tokenVersion: 3,
    });

    const session = await verifySession(token);
    expect(session).not.toBeNull();
    expect(session!.tokenVersion).toBe(3);
  });

  it("defaults tokenVersion to 0 when not provided", async () => {
    const { signSession, verifySession } = await import("@/lib/session");

    const token = await signSession({
      id: "user_1",
      schoolId: "school_1",
      role: "STUDENT" as any,
      name: "Test",
      email: "test@test.com",
    });

    const session = await verifySession(token);
    expect(session!.tokenVersion).toBe(0);
  });
});
