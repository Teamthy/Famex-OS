import { beforeEach, describe, expect, it, vi } from "vitest";
import { mockPrisma } from "../setup";

const user = {
  id: "admin_1",
  schoolId: "school_1",
  role: "DIRECTOR",
  name: "Director",
};

vi.mock("@/lib/module-guard", () => ({
  requireModule: vi.fn(async () => ({ ok: true, user, enabled: new Set() })),
}));
vi.mock("@/lib/requests", () => ({ getClientIp: vi.fn(() => "127.0.0.1") }));

function request(body: unknown = {}) {
  return { json: async () => body } as never;
}

function draft(id: string, studentUserId: string) {
  return {
    id,
    reportNumber: `RC/${id}`,
    termLabel: "First Term",
    sessionLabel: "2025/2026",
    overallAverage: 75,
    overallGrade: "B2",
    studentProfile: {
      displayName: `Student ${id}`,
      guardianName: null,
      guardianEmail: null,
      userId: studentUserId,
      parentLinks: [],
    },
  };
}

describe("POST /api/admin/report-cards/release", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.reportCard.findMany.mockResolvedValue([
      draft("rc_lost", "student_lost"),
      draft("rc_won", "student_won"),
    ]);
    mockPrisma.reportCard.updateMany
      .mockResolvedValueOnce({ count: 0 })
      .mockResolvedValueOnce({ count: 1 });
    mockPrisma.userNotification.create.mockResolvedValue({ id: "notification_1" });
    mockPrisma.auditLog.create.mockResolvedValue({ id: "audit_1" });
  });

  it("notifies and audits only cards whose DRAFT-to-RELEASED claim it wins", async () => {
    const { POST } = await import("@/app/api/admin/report-cards/release/route");

    const response = await POST(request());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.released).toBe(1);
    expect(mockPrisma.reportCard.updateMany).toHaveBeenCalledTimes(2);
    expect(mockPrisma.reportCard.updateMany.mock.calls[0][0].where).toMatchObject({
      id: "rc_lost",
      schoolId: "school_1",
      status: "DRAFT",
    });
    expect(mockPrisma.userNotification.create).toHaveBeenCalledTimes(1);
    expect(mockPrisma.userNotification.create.mock.calls[0][0].data.userId).toBe("student_won");
    expect(mockPrisma.auditLog.create.mock.calls[0][0].data.metadata).toMatchObject({ count: 1 });
  });

  it("does not create notifications or a release audit when every claim loses", async () => {
    mockPrisma.reportCard.updateMany.mockReset().mockResolvedValue({ count: 0 });
    const { POST } = await import("@/app/api/admin/report-cards/release/route");

    const response = await POST(request());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.released).toBe(0);
    expect(mockPrisma.userNotification.create).not.toHaveBeenCalled();
    expect(mockPrisma.auditLog.create).not.toHaveBeenCalled();
  });
});
