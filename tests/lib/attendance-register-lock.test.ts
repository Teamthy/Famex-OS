import { beforeEach, describe, expect, it, vi } from "vitest";
import { mockPrisma } from "../setup";

const mocks = vi.hoisted(() => ({
  getTeacherAttendanceContext: vi.fn(),
  order: [] as string[],
}));

vi.mock("@/lib/teacher-attendance", () => ({
  getTeacherAttendanceContext: mocks.getTeacherAttendanceContext,
  normalizeAttendanceDate: vi.fn(() => new Date("2026-10-13T00:00:00.000Z")),
  attendanceDateKey: vi.fn(() => "2026-10-13"),
  summarizeStatuses: vi.fn(() => ({ present: 1, absent: 0, late: 0, total: 1 })),
}));

import { POST } from "@/app/api/teacher/attendance/register/route";

const assignment = {
  id: "assignment_1",
  role: "FORM_TEACHER",
  subjectName: null,
  classroom: {
    id: "class_1",
    displayName: "JSS 1A",
    level: "JSS1",
    arm: "A",
  },
};

const teacherContext = {
  user: { id: "teacher_user_1", schoolId: "school_1" },
  teacherProfile: {
    id: "teacher_1",
    displayName: "Teacher One",
    classAssignments: [assignment],
  },
};

describe("POST /api/teacher/attendance/register write locking", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.order.length = 0;
    mocks.getTeacherAttendanceContext.mockResolvedValue(teacherContext);
    mockPrisma.studentProfile.findMany.mockResolvedValue([{ id: "student_1" }]);
    mockPrisma.attendanceSession.findUnique.mockImplementation(async () => {
      mocks.order.push("read-session");
      return null;
    });
    mockPrisma.attendanceSession.create.mockResolvedValue({
      id: "attendance_session_1",
      isLocked: false,
      submittedAt: null,
      periodKey: "DAILY_REGISTER",
      sessionDate: new Date("2026-10-13T00:00:00.000Z"),
    });
    mockPrisma.attendanceEntry.deleteMany.mockResolvedValue({ count: 0 });
    mockPrisma.attendanceEntry.createMany.mockResolvedValue({ count: 1 });
    mockPrisma.auditLog.create.mockResolvedValue({ id: "audit_1" });
    mockPrisma.$executeRaw.mockImplementation(async () => {
      mocks.order.push("lock-register");
      return 0;
    });
  });

  it("acquires the logical-session lock before reading or mutating attendance", async () => {
    const response = await POST(
      new Request("https://example.test/api/teacher/attendance/register", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          classId: "class_1",
          sessionDate: "2026-10-13",
          entries: [{ studentProfileId: "student_1", status: "PRESENT" }],
        }),
      }) as never,
    );

    expect(response.status).toBe(200);
    expect(mocks.order).toEqual(["lock-register", "read-session"]);
    expect(mockPrisma.attendanceEntry.deleteMany).toHaveBeenCalledWith({
      where: { sessionId: "attendance_session_1" },
    });
    expect(mockPrisma.auditLog.create).toHaveBeenCalledTimes(1);
  });
});
