import { beforeEach, describe, expect, it, vi } from "vitest";
import { mockPrisma } from "../setup";

const mocks = vi.hoisted(() => ({
  requireModule: vi.fn(),
  order: [] as string[],
}));

vi.mock("@/lib/module-guard", () => ({ requireModule: mocks.requireModule }));
vi.mock("@/lib/requests", () => ({ getClientIp: vi.fn(() => "127.0.0.1") }));

import { PATCH } from "@/app/api/admin/attendance/corrections/route";

describe("PATCH /api/admin/attendance/corrections write locking", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.order.length = 0;
    mocks.requireModule.mockResolvedValue({
      ok: true,
      user: { id: "admin_1", schoolId: "school_1" },
    });
    mockPrisma.attendanceCorrectionRequest.findFirst.mockResolvedValue({
      id: "correction_1",
      status: "PENDING",
      attendanceSessionId: "session_1",
      attendanceSession: {
        schoolId: "school_1",
        classId: "class_1",
        sessionDate: new Date("2026-10-13T00:00:00.000Z"),
        periodKey: "DAILY_REGISTER",
      },
    });
    mockPrisma.attendanceCorrectionRequest.update.mockImplementation(async ({ data }) => {
      mocks.order.push("update-correction");
      return { id: "correction_1", ...data, attendanceSessionId: "session_1" };
    });
    mockPrisma.attendanceSession.update.mockImplementation(async () => {
      mocks.order.push("unlock-session");
      return {};
    });
    mockPrisma.auditLog.create.mockResolvedValue({ id: "audit_1" });
    mockPrisma.$executeRaw.mockImplementation(async () => {
      mocks.order.push("lock-register");
      return 0;
    });
  });

  it("takes the register lock before approving and unlocking a correction", async () => {
    const response = await PATCH(
      new Request("https://example.test/api/admin/attendance/corrections", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ requestId: "correction_1", decision: "APPROVED" }),
      }) as never,
    );

    expect(response.status).toBe(200);
    expect(mocks.order).toEqual(["lock-register", "update-correction", "unlock-session"]);
    expect(mockPrisma.attendanceSession.update).toHaveBeenCalledWith({
      where: { id: "session_1" },
      data: { isLocked: false, submittedAt: null },
    });
  });
});
