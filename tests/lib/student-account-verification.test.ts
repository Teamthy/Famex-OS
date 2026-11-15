import {
  StudentActivationChannel,
  StudentActivationDeliveryStatus,
  UserRole,
} from "@prisma/client";
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { mockPrisma } from "../setup";

vi.mock("@/lib/rate-limit", () => ({
  enforceRateLimit: vi.fn(async () => ({
    success: true,
    retryAfterSeconds: 0,
    configurationError: false,
  })),
}));

vi.mock("@/lib/student-accounts", () => ({
  hashStudentActivationToken: vi.fn((token: string) => `hash:${token}`),
  hashGuardianContact: vi.fn((channel: string, contact: string) => `contact:${channel}:${contact}`),
  normalizeGuardianContact: vi.fn(
    ({ email, phone }: { email?: string | null; phone?: string | null }) => ({
      email: email?.trim().toLowerCase() || null,
      phone: phone?.trim() || null,
    }),
  ),
  issueStudentActivationInTransaction: vi.fn(async (_tx: unknown, _input: unknown) => ({
    tokenId: "activation_1",
    token: "separate-student-activation-secret",
    schoolId: "school_1",
    studentProfileId: "student_1",
    userId: "user_1",
    studentName: "Ada Student",
    studentLogin: "student-1@example.test",
    guardianEmail: "guardian@example.test",
    guardianPhone: null,
    channel: StudentActivationChannel.EMAIL,
  })),
  deliverStudentActivation: vi.fn(async () => ({
    acceptedByProvider: true,
    channel: StudentActivationChannel.EMAIL,
  })),
}));

function request(path: string, body: unknown) {
  return new NextRequest(`https://school.example.test${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("guardian proof and student activation are separate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.$transaction.mockImplementation(async (callback: unknown) => {
      if (typeof callback === "function")
        return (callback as (_tx: typeof mockPrisma) => Promise<unknown>)(mockPrisma);
      return Promise.resolve(callback);
    });
    mockPrisma.auditLog.create.mockResolvedValue({ id: "audit_1" } as never);
  });

  it("does not redeem an activation token whose delivery was not provider-accepted", async () => {
    mockPrisma.studentActivationToken.findUnique.mockResolvedValue({
      id: "activation_1",
      schoolId: "school_1",
      studentProfileId: "student_1",
      userId: "user_1",
      expiresAt: new Date(Date.now() + 60_000),
      deliveryStatus: StudentActivationDeliveryStatus.PENDING,
      usedAt: null,
      revokedAt: null,
    } as never);

    const { POST } = await import("@/app/api/student/activate/route");
    const response = await POST(
      request("/api/student/activate", {
        token: "student-activation-token",
        password: "StrongPassword123",
      }),
    );

    expect(response.status).toBe(410);
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
  });

  it("only creates a student activation link after an accepted guardian token proves the current contact", async () => {
    mockPrisma.guardianContactVerificationToken.findUnique.mockResolvedValue({
      id: "guardian_verification_1",
      schoolId: "school_1",
      studentProfileId: "student_1",
      userId: "user_1",
      contactHash: `contact:${StudentActivationChannel.EMAIL}:guardian@example.test`,
      channel: StudentActivationChannel.EMAIL,
      deliveryStatus: StudentActivationDeliveryStatus.ACCEPTED,
      expiresAt: new Date(Date.now() + 60_000),
      usedAt: null,
      revokedAt: null,
    } as never);
    mockPrisma.guardianContactVerificationToken.updateMany.mockResolvedValue({ count: 1 } as never);
    mockPrisma.studentProfile.findFirst.mockResolvedValue({
      id: "student_1",
      studentId: "STU-1",
      displayName: "Ada Student",
      isActive: true,
      guardianEmail: "Guardian@example.test",
      guardianPhone: "08012345678",
      user: {
        id: "user_1",
        email: "student-1@example.test",
        role: UserRole.STUDENT,
        isActive: false,
        isSuspended: false,
      },
    } as never);

    const { POST } = await import("@/app/api/student/verify-guardian/route");
    const response = await POST(
      request("/api/student/verify-guardian", { token: "guardian-token" }),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      ok: true,
      contactVerified: true,
      activationLinkAcceptedByProvider: true,
    });
    expect(mockPrisma.guardianContactVerificationToken.updateMany).toHaveBeenCalledWith({
      where: expect.objectContaining({
        id: "guardian_verification_1",
        deliveryStatus: StudentActivationDeliveryStatus.ACCEPTED,
        usedAt: null,
        revokedAt: null,
      }),
      data: expect.objectContaining({ usedAt: expect.any(Date), verifiedAt: expect.any(Date) }),
    });
    const studentAccounts = await import("@/lib/student-accounts");
    expect(studentAccounts.issueStudentActivationInTransaction).toHaveBeenCalledWith(
      mockPrisma,
      expect.objectContaining({
        schoolId: "school_1",
        studentProfileId: "student_1",
        guardianEmail: "guardian@example.test",
        guardianPhone: null,
      }),
    );
    expect(studentAccounts.deliverStudentActivation).toHaveBeenCalledTimes(1);
  });

  it("refuses guardian verification if the stored contact changed after the link was issued", async () => {
    mockPrisma.guardianContactVerificationToken.findUnique.mockResolvedValue({
      id: "guardian_verification_1",
      schoolId: "school_1",
      studentProfileId: "student_1",
      userId: "user_1",
      contactHash: `contact:${StudentActivationChannel.EMAIL}:old-guardian@example.test`,
      channel: StudentActivationChannel.EMAIL,
      deliveryStatus: StudentActivationDeliveryStatus.ACCEPTED,
      expiresAt: new Date(Date.now() + 60_000),
      usedAt: null,
      revokedAt: null,
    } as never);
    mockPrisma.guardianContactVerificationToken.updateMany.mockResolvedValue({ count: 1 } as never);
    mockPrisma.studentProfile.findFirst.mockResolvedValue({
      id: "student_1",
      studentId: "STU-1",
      displayName: "Ada Student",
      isActive: true,
      guardianEmail: "new-guardian@example.test",
      guardianPhone: null,
      user: {
        id: "user_1",
        email: "student-1@example.test",
        role: UserRole.STUDENT,
        isActive: false,
        isSuspended: false,
      },
    } as never);

    const { POST } = await import("@/app/api/student/verify-guardian/route");
    const response = await POST(
      request("/api/student/verify-guardian", { token: "guardian-token" }),
    );

    expect(response.status).toBe(410);
    const studentAccounts = await import("@/lib/student-accounts");
    expect(studentAccounts.issueStudentActivationInTransaction).not.toHaveBeenCalled();
    expect(studentAccounts.deliverStudentActivation).not.toHaveBeenCalled();
  });
});
