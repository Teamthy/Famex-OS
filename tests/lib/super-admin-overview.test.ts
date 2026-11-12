import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { mockPrisma } from "../setup";

const { requireRole } = vi.hoisted(() => ({ requireRole: vi.fn() }));
vi.mock("@/lib/session", () => ({ requireRole }));

beforeEach(() => {
  vi.clearAllMocks();
  mockPrisma.school.findUnique.mockResolvedValue({ name: "Famex Academy", status: "ACTIVE" });
  mockPrisma.user.count.mockResolvedValue(42);
  mockPrisma.notificationJob.count.mockResolvedValueOnce(3).mockResolvedValueOnce(2);
  mockPrisma.notificationJob.findMany.mockResolvedValue([]);
});

describe("GET /api/super-admin/overview", () => {
  it("requires the platform role and returns metrics scoped to the configured school", async () => {
    requireRole.mockResolvedValue({
      id: "platform-operator",
      role: "SUPER_ADMIN",
      schoolId: "school_1",
    });
    const { GET } = await import("@/app/api/super-admin/overview/route");

    const response = await GET();
    expect(response.status).toBe(200);
    expect(requireRole).toHaveBeenCalledWith(["SUPER_ADMIN"]);
    expect(mockPrisma.school.findUnique).toHaveBeenCalledWith({
      where: { id: "school_1" },
      select: { name: true, status: true },
    });
    expect(mockPrisma.user.count).toHaveBeenCalledWith({
      where: { schoolId: "school_1", isActive: true, isSuspended: false },
    });
    expect(mockPrisma.notificationJob.count).toHaveBeenNthCalledWith(1, {
      where: { schoolId: "school_1", status: "FAILED" },
    });
    expect(mockPrisma.notificationJob.count).toHaveBeenNthCalledWith(2, {
      where: {
        schoolId: "school_1",
        status: "PENDING",
        nextAttemptAt: { lte: expect.any(Date) },
      },
    });
    expect(await response.json()).toMatchObject({
      school: { name: "Famex Academy", status: "ACTIVE" },
      overview: {
        activeUsers: 42,
        failedNotifications: 3,
        dueNotifications: 2,
      },
    });
  });

  it("does not query school operations for a non-Super-Admin account", async () => {
    requireRole.mockResolvedValue(null);
    const { GET } = await import("@/app/api/super-admin/overview/route");

    const response = await GET();
    expect(response.status).toBe(401);
    expect(mockPrisma.school.findUnique).not.toHaveBeenCalled();
    expect(mockPrisma.user.count).not.toHaveBeenCalled();
  });

  it("does not expose notification operations to other roles", async () => {
    requireRole.mockResolvedValue(null);
    const { POST } = await import("@/app/api/super-admin/notifications/[id]/retry/route");
    const request = new NextRequest(
      "https://famex.test/api/super-admin/notifications/job_1/retry",
      {
        method: "POST",
        body: JSON.stringify({ reason: "MANUAL_REVIEW" }),
        headers: { "content-type": "application/json" },
      },
    );
    const response = await POST(request, { params: Promise.resolve({ id: "job_1" }) });
    expect(response.status).toBe(401);
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
  });

  it("requeues a failed job exactly once and writes the audit in the same transaction", async () => {
    requireRole.mockResolvedValue({
      id: "platform-operator",
      role: "SUPER_ADMIN",
      schoolId: "school_1",
    });
    mockPrisma.notificationJob.findFirst.mockResolvedValue({
      id: "job_1",
      status: "FAILED",
      attempts: 3,
      maxAttempts: 3,
      updatedAt: new Date("2026-11-12T00:00:00.000Z"),
    });
    mockPrisma.notificationJob.updateMany.mockResolvedValue({ count: 1 });
    const { POST } = await import("@/app/api/super-admin/notifications/[id]/retry/route");
    const request = new NextRequest(
      "https://famex.test/api/super-admin/notifications/job_1/retry",
      {
        method: "POST",
        body: JSON.stringify({ reason: "CONFIGURATION_FIXED" }),
        headers: { "content-type": "application/json", "x-forwarded-for": "192.0.2.1" },
      },
    );

    const response = await POST(request, { params: Promise.resolve({ id: "job_1" }) });
    expect(response.status).toBe(200);
    expect(mockPrisma.notificationJob.updateMany).toHaveBeenCalledWith({
      where: {
        id: "job_1",
        schoolId: "school_1",
        status: "FAILED",
        updatedAt: new Date("2026-11-12T00:00:00.000Z"),
      },
      data: expect.objectContaining({ status: "PENDING", maxAttempts: 4, lastError: null }),
    });
    expect(mockPrisma.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        schoolId: "school_1",
        actorUserId: "platform-operator",
        action: "SUPER_ADMIN_NOTIFICATION_RETRY_REQUESTED",
        entityId: "job_1",
        metadata: expect.objectContaining({ reason: "CONFIGURATION_FIXED", previousAttempts: 3 }),
      }),
    });
  });

  it("rejects repeat retry requests after the state transition", async () => {
    requireRole.mockResolvedValue({ id: "platform-operator", schoolId: "school_1" });
    mockPrisma.notificationJob.findFirst.mockResolvedValue({
      id: "job_1",
      status: "PENDING",
      attempts: 3,
      maxAttempts: 4,
      updatedAt: new Date(),
    });
    const { POST } = await import("@/app/api/super-admin/notifications/[id]/retry/route");
    const request = new NextRequest(
      "https://famex.test/api/super-admin/notifications/job_1/retry",
      {
        method: "POST",
        body: JSON.stringify({ reason: "MANUAL_REVIEW" }),
        headers: { "content-type": "application/json" },
      },
    );
    const response = await POST(request, { params: Promise.resolve({ id: "job_1" }) });
    expect(response.status).toBe(409);
    expect(mockPrisma.notificationJob.updateMany).not.toHaveBeenCalled();
  });
});
