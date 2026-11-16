import { NotificationKind, StaffAttendanceEventType, UserRole } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { mockPrisma } from "../setup";

const { createInAppNotification } = vi.hoisted(() => ({ createInAppNotification: vi.fn() }));
vi.mock("@/lib/notifications", () => ({ createInAppNotification }));

beforeEach(() => {
  vi.clearAllMocks();
  createInAppNotification.mockResolvedValue({ id: "notification-1" });
});

describe("director clock and event notifications", () => {
  it("targets active directors in the same school with a minimal late-arrival alert", async () => {
    mockPrisma.user.findMany.mockResolvedValue([{ id: "director-1" }, { id: "director-2" }]);
    const { notifyDirectorsOfStaffClockEvent } = await import("@/lib/director-notifications");

    await expect(
      notifyDirectorsOfStaffClockEvent({
        schoolId: "school-1",
        staffName: "Staff Member",
        eventType: "CHECK_IN",
        isLate: true,
        lateMinutes: 12,
        scannedAt: new Date("2026-11-14T07:12:00.000Z"),
      }),
    ).resolves.toBe(2);

    expect(mockPrisma.user.findMany).toHaveBeenCalledWith({
      where: { schoolId: "school-1", role: UserRole.DIRECTOR, isActive: true },
      select: { id: true },
      orderBy: { id: "asc" },
      take: 25,
    });
    expect(createInAppNotification).toHaveBeenCalledWith({
      schoolId: "school-1",
      userId: "director-1",
      kind: NotificationKind.CLOCK_IN_LATE,
      title: "Late staff arrival",
      body: expect.stringMatching(/^Staff Member checked in at .*?, 12 minutes late\.$/),
      link: "/admin/staff-attendance",
    });
  });

  it("does not notify the publishing director about their own event notice", async () => {
    mockPrisma.user.findMany.mockResolvedValue([{ id: "other-director" }]);
    const { notifyDirectorsOfPublishedSchoolEvent } = await import("@/lib/director-notifications");

    await expect(
      notifyDirectorsOfPublishedSchoolEvent({
        schoolId: "school-1",
        title: "Founders Day",
        actorUserId: "publishing-director",
      }),
    ).resolves.toBe(1);

    expect(mockPrisma.user.findMany).toHaveBeenCalledWith({
      where: {
        schoolId: "school-1",
        role: UserRole.DIRECTOR,
        isActive: true,
        id: { not: "publishing-director" },
      },
      select: { id: true },
      orderBy: { id: "asc" },
      take: 25,
    });
    expect(createInAppNotification).toHaveBeenCalledWith({
      schoolId: "school-1",
      userId: "other-director",
      kind: NotificationKind.BROADCAST,
      title: "School event published",
      body: "A school event notice, “Founders Day”, was published.",
      link: "/admin/news",
    });
  });

  it("does not turn a notification outage into a failed school action", async () => {
    mockPrisma.user.findMany.mockRejectedValue(new Error("temporary database issue"));
    const { notifyDirectorsOfPublishedSchoolEvent } = await import("@/lib/director-notifications");

    await expect(
      notifyDirectorsOfPublishedSchoolEvent({
        schoolId: "school-1",
        title: "Founders Day",
        actorUserId: "admin-1",
      }),
    ).resolves.toBe(0);
    expect(createInAppNotification).not.toHaveBeenCalled();
  });
});

describe("staff attendance write integration", () => {
  it("sends a director notification after a staff scan event is recorded", async () => {
    const scannedAt = new Date("2026-11-14T07:12:00.000Z");
    mockPrisma.teacherProfile.findFirst.mockResolvedValue({
      id: "teacher-1",
      displayName: "Staff Member",
      badgeCode: "YKST-ABCDE12345",
      user: { email: "staff@example.test", role: UserRole.TEACHER },
    });
    mockPrisma.dailyAttendanceSession.findUnique.mockResolvedValue({ status: "OPEN" });
    mockPrisma.staffAttendanceEvent.findMany.mockResolvedValue([]);
    mockPrisma.staffAttendanceEvent.create.mockResolvedValue({
      id: "staff-event-1",
      eventType: StaffAttendanceEventType.CHECK_IN,
      scannedAt,
      isLate: true,
      lateMinutes: 12,
      source: "ADMIN_QR",
    });
    mockPrisma.auditLog.create.mockResolvedValue({});
    mockPrisma.user.findMany.mockResolvedValue([{ id: "director-1" }]);
    const { recordStaffScan } = await import("@/lib/staff-attendance");

    await recordStaffScan({
      schoolId: "school-1",
      badgeCode: "YKST-ABCDE12345",
      eventType: StaffAttendanceEventType.CHECK_IN,
      scannerUserId: "admin-1",
      source: "ADMIN_QR",
    });

    expect(createInAppNotification).toHaveBeenCalledWith({
      schoolId: "school-1",
      userId: "director-1",
      kind: NotificationKind.CLOCK_IN_LATE,
      title: "Late staff arrival",
      body: expect.stringMatching(/^Staff Member checked in at .*?, 12 minutes late\.$/),
      link: "/admin/staff-attendance",
    });
  });
});
