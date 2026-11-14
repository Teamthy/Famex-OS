import { beforeEach, describe, expect, it, vi } from "vitest";
import { mockPrisma } from "../setup";

const user = {
  id: "admin_1",
  schoolId: "school_1",
  role: "DIRECTOR",
  name: "Director",
};
const queueNotificationJob = vi.fn();
const createInAppNotification = vi.fn();

vi.mock("@/lib/module-guard", () => ({
  requireModule: vi.fn(async () => ({ ok: true, user, enabled: new Set() })),
}));
vi.mock("@/lib/requests", () => ({ getClientIp: vi.fn(() => "127.0.0.1") }));
vi.mock("@/lib/notifications", () => ({ queueNotificationJob, createInAppNotification }));

function request(body: unknown) {
  return { json: async () => body } as never;
}

const payload = { reportCardId: "rc_1", status: "RELEASED" };

describe("PATCH /api/admin/report-cards/overview release transition", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("does not re-release or re-notify a card already released", async () => {
    mockPrisma.reportCard.findFirst.mockResolvedValue({ id: "rc_1", status: "RELEASED" });
    const { PATCH } = await import("@/app/api/admin/report-cards/overview/route");

    const response = await PATCH(request(payload));
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body.code).toBe("REPORT_CARD_ALREADY_IN_STATUS");
    expect(mockPrisma.reportCard.updateMany).not.toHaveBeenCalled();
    expect(mockPrisma.reportCard.update).not.toHaveBeenCalled();
    expect(mockPrisma.auditLog.create).not.toHaveBeenCalled();
    expect(queueNotificationJob).not.toHaveBeenCalled();
    expect(createInAppNotification).not.toHaveBeenCalled();
  });

  it("does not notify if the DRAFT-to-RELEASED compare-and-set loses", async () => {
    mockPrisma.reportCard.findFirst.mockResolvedValue({ id: "rc_1", status: "DRAFT" });
    mockPrisma.reportCard.updateMany.mockResolvedValue({ count: 0 });
    const { PATCH } = await import("@/app/api/admin/report-cards/overview/route");

    const response = await PATCH(request(payload));
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body.code).toBe("REPORT_CARD_STATE_CHANGED");
    expect(mockPrisma.reportCard.update).not.toHaveBeenCalled();
    expect(mockPrisma.auditLog.create).not.toHaveBeenCalled();
    expect(queueNotificationJob).not.toHaveBeenCalled();
    expect(createInAppNotification).not.toHaveBeenCalled();
  });
});
