import { AttendanceStatus } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { mockPrisma } from "../setup";

vi.mock("@/lib/session", () => ({
  requireRole: vi.fn(async () => ({ id: "user_student", schoolId: "school_1", role: "STUDENT" })),
}));

describe("GET /api/student/dashboard progress snapshot", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.studentProfile.findFirst.mockResolvedValue({
      id: "student_profile_1",
      displayName: "Student One",
      studentId: "FAMEX/001",
      currentClass: { displayName: "JSS 1A" },
      attendanceEntries: Array.from({ length: 60 }, (_, index) => ({
        status: index < 45 ? AttendanceStatus.PRESENT : AttendanceStatus.ABSENT,
        markedAt: new Date(`2026-09-${String((index % 28) + 1).padStart(2, "0")}T08:00:00.000Z`),
        session: {
          sessionDate: new Date(
            `2026-09-${String((index % 28) + 1).padStart(2, "0")}T08:00:00.000Z`,
          ),
        },
      })),
      reportCards: [
        {
          reportNumber: "RC-001",
          termLabel: "First Term",
          sessionLabel: "2026/2027",
          overallAverage: 73,
          overallGrade: "B2",
          classPosition: "4th",
          releasedAt: new Date("2026-10-01T00:00:00.000Z"),
        },
      ],
      feeInvoices: [{ balanceDue: 125_050 }],
    });
    mockPrisma.auditLog.findMany.mockResolvedValue([]);
    mockPrisma.school.findUnique.mockResolvedValue({ address: "Lagos", phone: "0800", email: "" });
  });

  it("labels attendance as a recent sample and serves the latest released result and kobo balance", async () => {
    const { GET } = await import("@/app/api/student/dashboard/route");
    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.stats).toMatchObject({
      attendanceRate: 75,
      attendanceSampleSize: 60,
      averageScore: 73,
      overallGrade: "B2",
      feeBalance: 125_050,
    });
    expect(mockPrisma.studentProfile.findFirst.mock.calls[0][0].include.reportCards).toMatchObject({
      where: { status: "RELEASED" },
      take: 1,
    });
  });
});
