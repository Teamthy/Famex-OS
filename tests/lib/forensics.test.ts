import { describe, it, expect, vi, beforeEach } from "vitest";
import { mockPrisma } from "../setup";

// We test the forensics module by importing it after mocks are set up
describe("recordSecurityEvent", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates a security event in the database", async () => {
    mockPrisma.securityEvent.create.mockResolvedValue({ id: "evt_1" });

    const { recordSecurityEvent } = await import("@/lib/forensics");

    await recordSecurityEvent({
      eventType: "LOGIN_FAILED_BAD_PASSWORD",
      userEmail: "test@example.com",
      ipAddress: "192.168.1.1",
      reason: "Incorrect password.",
    });

    expect(mockPrisma.securityEvent.create).toHaveBeenCalledWith({
      data: {
        eventType: "LOGIN_FAILED_BAD_PASSWORD",
        schoolId: null,
        userEmail: "test@example.com",
        userId: null,
        ipAddress: "192.168.1.1",
        userAgent: null,
        targetPath: null,
        reason: "Incorrect password.",
      },
    });
  });

  it("does not throw when database write fails", async () => {
    mockPrisma.securityEvent.create.mockRejectedValue(new Error("DB down"));

    const { recordSecurityEvent } = await import("@/lib/forensics");

    // Should not throw
    await expect(
      recordSecurityEvent({
        eventType: "LOGIN_FAILED_ACCOUNT_NOT_FOUND",
        userEmail: "nobody@example.com",
      }),
    ).resolves.toBeUndefined();
  });

  it("passes all optional fields through", async () => {
    mockPrisma.securityEvent.create.mockResolvedValue({ id: "evt_2" });

    const { recordSecurityEvent } = await import("@/lib/forensics");

    await recordSecurityEvent({
      eventType: "IMPERSONATION_STARTED",
      schoolId: "school_1",
      userEmail: "target@school.com",
      userId: "user_123",
      ipAddress: "10.0.0.1",
      userAgent: "Mozilla/5.0",
      targetPath: "/teacher/dashboard",
      reason: "Super-admin started impersonation.",
      metadata: { superAdminId: "sa_1" },
    });

    expect(mockPrisma.securityEvent.create).toHaveBeenCalledWith({
      data: {
        eventType: "IMPERSONATION_STARTED",
        schoolId: "school_1",
        userEmail: "target@school.com",
        userId: "user_123",
        ipAddress: "10.0.0.1",
        userAgent: "Mozilla/5.0",
        targetPath: "/teacher/dashboard",
        reason: "Super-admin started impersonation.",
        metadata: { superAdminId: "sa_1" },
      },
    });
  });
});

describe("getUserAgent", () => {
  it("extracts user-agent header", async () => {
    const { getUserAgent } = await import("@/lib/forensics");

    const mockRequest = {
      headers: { get: (name: string) => (name === "user-agent" ? "TestBot/1.0" : null) },
    };

    expect(getUserAgent(mockRequest)).toBe("TestBot/1.0");
  });

  it("returns undefined when header is missing", async () => {
    const { getUserAgent } = await import("@/lib/forensics");

    const mockRequest = {
      headers: { get: () => null },
    };

    expect(getUserAgent(mockRequest)).toBeUndefined();
  });
});
