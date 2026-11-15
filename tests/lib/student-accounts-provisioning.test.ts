import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mockPrisma } from "../setup";

const { provisionStudentAccountInTransaction } = await import("@/lib/student-accounts");

describe("student account provisioning", () => {
  const oldSecret = process.env.AUTH_SECRET;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.AUTH_SECRET = "student-account-test-secret-that-is-at-least-32-bytes";
    mockPrisma.user.findFirst.mockResolvedValue(null);
    mockPrisma.user.create.mockResolvedValue({ id: "student-user-1" } as never);
    mockPrisma.studentProfile.updateMany.mockResolvedValue({ count: 1 } as never);
  });

  afterEach(() => {
    if (oldSecret === undefined) delete process.env.AUTH_SECRET;
    else process.env.AUTH_SECRET = oldSecret;
  });

  it("creates a distinct active student login with a one-time password", async () => {
    const issued = await provisionStudentAccountInTransaction(mockPrisma as never, {
      schoolId: "school-1",
      studentProfileId: "student-profile-1",
      studentId: "STU-101",
      studentName: "Ada Student",
    });

    expect(mockPrisma.user.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        email: expect.stringContaining("stu-101@"),
        role: "STUDENT",
        isActive: true,
        mustChangePassword: true,
      }),
      select: { id: true },
    });
    expect(mockPrisma.studentProfile.updateMany).toHaveBeenCalledWith({
      where: { id: "student-profile-1", schoolId: "school-1", userId: null },
      data: { userId: "student-user-1" },
    });
    expect(issued.temporaryPassword).toHaveLength(24);
    expect(issued.email).toContain("stu-101@");
    expect(mockPrisma.guardianContactVerificationToken.create).not.toHaveBeenCalled();
    expect(mockPrisma.studentActivationToken.create).not.toHaveBeenCalled();
  });
});
