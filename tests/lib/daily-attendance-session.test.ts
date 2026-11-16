import type { Prisma } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";
import { attendanceWorkDate, requireDailyAttendanceOpen } from "@/lib/daily-attendance-session";

describe("admin-controlled daily attendance session", () => {
  it("maps the work date to a stable UTC date value", () => {
    expect(attendanceWorkDate("2026-10-13").toISOString()).toBe("2026-10-13T12:00:00.000Z");
  });

  it("allows attendance writes only while today's school session is open", async () => {
    const findUnique = vi.fn().mockResolvedValue({ status: "OPEN" });
    const tx = { dailyAttendanceSession: { findUnique } } as unknown as Prisma.TransactionClient;

    await expect(requireDailyAttendanceOpen(tx, "school-1", "2026-10-13")).resolves.toBeUndefined();
    expect(findUnique).toHaveBeenCalledWith({
      where: {
        schoolId_workDate: {
          schoolId: "school-1",
          workDate: new Date("2026-10-13T12:00:00.000Z"),
        },
      },
      select: { status: true },
    });
  });

  it.each([null, { status: "CLOSED" }])(
    "refuses attendance writes when the daily session is absent or closed",
    async (session) => {
      const tx = {
        dailyAttendanceSession: { findUnique: vi.fn().mockResolvedValue(session) },
      } as unknown as Prisma.TransactionClient;

      await expect(requireDailyAttendanceOpen(tx, "school-1", "2026-10-13")).rejects.toThrow(
        "Daily attendance is closed",
      );
    },
  );
});
