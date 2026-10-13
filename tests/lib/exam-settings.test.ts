import { describe, it, expect, vi, beforeEach } from "vitest";
import { mockPrisma } from "../setup";

/**
 * Editing an exam after it has been created.
 *
 * `PATCH /api/teacher/exams` accepted six actions — PUBLISH, CLOSE,
 * RELEASE_RESULTS, UNRELEASE_RESULTS, ADD_QUESTIONS, GRANT_RETAKE — and not
 * one of them could change the exam's own settings. Once created, the date,
 * duration, pass mark and theory allowance were frozen. The "Edit Test
 * Courses" screen existed to change exactly those fields and had nowhere to
 * send them, so it kept its values in local React state and lost them on
 * refresh.
 *
 * UPDATE_SETTINGS closes that. The rules worth pinning are the ones that
 * silently corrupt an exam rather than failing loudly.
 */

const teacherContext = {
  user: { id: "usr_t", schoolId: "school_1", role: "TEACHER" },
  teacherProfile: {
    id: "tp_1",
    displayName: "T One",
    subjectAssignments: [
      {
        id: "asg_1",
        subjectName: "Biology",
        classroom: { id: "cls_1", displayName: "SS 2", level: "SS2" },
      },
    ],
  },
};

vi.mock("@/lib/exams", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/exams")>();
  return { ...actual, getExamTeacherContext: vi.fn(async () => teacherContext) };
});

vi.mock("@/lib/requests", () => ({ getClientIp: vi.fn(() => "127.0.0.1") }));

function request(body: unknown) {
  return { json: async () => body } as never;
}

const HOUR = 3_600_000;

function exam(overrides: Record<string, unknown> = {}) {
  return {
    id: "exam_1",
    schoolId: "school_1",
    classId: "cls_1",
    teacherProfileId: "tp_1",
    title: "Midterm",
    status: "DRAFT",
    durationMinutes: 40,
    theoryMinutes: 0,
    passMark: 40,
    scheduledFor: null,
    availableUntil: null,
    questions: [{ id: "q1", marks: 1, sortOrder: 1 }],
    ...overrides,
  };
}

describe("PATCH /api/teacher/exams — UPDATE_SETTINGS", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.exam.findFirst.mockResolvedValue(exam());
    mockPrisma.exam.update.mockResolvedValue({ id: "exam_1" });
    mockPrisma.auditLog.create.mockResolvedValue({ id: "al" });
  });

  it("updates duration, marks and the sitting window", async () => {
    const { PATCH } = await import("@/app/api/teacher/exams/route");
    const response = await PATCH(
      request({
        examId: "exam_1",
        action: "UPDATE_SETTINGS",
        durationMinutes: 60,
        theoryMinutes: 30,
        passMark: 50,
        scheduledFor: new Date(Date.now() + HOUR).toISOString(),
        availableUntil: new Date(Date.now() + 3 * HOUR).toISOString(),
      }),
    );

    expect(response.status).toBe(200);
    const data = mockPrisma.exam.update.mock.calls[0][0].data;
    expect(data.durationMinutes).toBe(60);
    expect(data.theoryMinutes).toBe(30);
    expect(data.passMark).toBe(50);
    expect(data.scheduledFor).toBeInstanceOf(Date);
  });

  /**
   * The same guard the create endpoint has. A window that closes before it
   * opens makes an exam unsittable, and the student list would just show it
   * as permanently "missed".
   */
  it("refuses a window that closes before it opens", async () => {
    const { PATCH } = await import("@/app/api/teacher/exams/route");
    const response = await PATCH(
      request({
        examId: "exam_1",
        action: "UPDATE_SETTINGS",
        scheduledFor: new Date(Date.now() + 3 * HOUR).toISOString(),
        availableUntil: new Date(Date.now() + HOUR).toISOString(),
      }),
    );

    expect(response.status).toBe(400);
    expect(mockPrisma.exam.update).not.toHaveBeenCalled();
  });

  it("only changes the fields that were sent", async () => {
    const { PATCH } = await import("@/app/api/teacher/exams/route");
    await PATCH(request({ examId: "exam_1", action: "UPDATE_SETTINGS", passMark: 55 }));

    const data = mockPrisma.exam.update.mock.calls[0][0].data;
    expect(data.passMark).toBe(55);
    // Omitting a field must not blank it — a partial save that wipes the
    // exam date is worse than refusing the edit.
    expect(data).not.toHaveProperty("durationMinutes");
    expect(data).not.toHaveProperty("scheduledFor");
  });

  /**
   * Found by mutation testing: the test above sends `passMark`, so it cannot
   * detect `passMark` itself being written as undefined. Every optional field
   * needs a case where it is the one NOT sent — otherwise a save that blanks
   * the pass mark to null looks perfectly healthy.
   */
  it("does not write a field that was omitted, for any field", async () => {
    const { PATCH } = await import("@/app/api/teacher/exams/route");
    await PATCH(request({ examId: "exam_1", action: "UPDATE_SETTINGS", durationMinutes: 50 }));

    const data = mockPrisma.exam.update.mock.calls[0][0].data;
    expect(data.durationMinutes).toBe(50);
    for (const omitted of [
      "passMark",
      "theoryMinutes",
      "totalMarks",
      "scheduledFor",
      "availableUntil",
    ]) {
      expect(data, `${omitted} was omitted and must not be written`).not.toHaveProperty(omitted);
    }
  });

  it("allows clearing the window explicitly with null", async () => {
    const { PATCH } = await import("@/app/api/teacher/exams/route");
    await PATCH(
      request({
        examId: "exam_1",
        action: "UPDATE_SETTINGS",
        scheduledFor: null,
        availableUntil: null,
      }),
    );

    const data = mockPrisma.exam.update.mock.calls[0][0].data;
    expect(data.scheduledFor).toBeNull();
    expect(data.availableUntil).toBeNull();
  });

  /**
   * Duration is the student's clock. Changing it while people are sitting the
   * paper would move their deadline mid-attempt — the attempt's deadlineAt was
   * computed at start time and is not recalculated.
   */
  it("refuses to change duration while an attempt is in progress", async () => {
    mockPrisma.exam.findFirst.mockResolvedValue(exam({ status: "PUBLISHED" }));
    mockPrisma.examAttempt.count.mockResolvedValue(2);

    const { PATCH } = await import("@/app/api/teacher/exams/route");
    const response = await PATCH(
      request({ examId: "exam_1", action: "UPDATE_SETTINGS", durationMinutes: 90 }),
    );

    expect(response.status).toBe(409);
    expect(mockPrisma.exam.update).not.toHaveBeenCalled();
  });

  it("still allows a pass-mark change while attempts are running", async () => {
    mockPrisma.exam.findFirst.mockResolvedValue(exam({ status: "PUBLISHED" }));
    mockPrisma.examAttempt.count.mockResolvedValue(2);

    const { PATCH } = await import("@/app/api/teacher/exams/route");
    const response = await PATCH(
      request({ examId: "exam_1", action: "UPDATE_SETTINGS", passMark: 45 }),
    );

    // Pass mark is applied at grading, not during the sitting.
    expect(response.status).toBe(200);
  });

  it("cannot touch an exam belonging to another teacher", async () => {
    mockPrisma.exam.findFirst.mockResolvedValue(null);

    const { PATCH } = await import("@/app/api/teacher/exams/route");
    const response = await PATCH(
      request({ examId: "exam_other", action: "UPDATE_SETTINGS", passMark: 10 }),
    );

    expect(response.status).toBe(404);
    expect(mockPrisma.exam.update).not.toHaveBeenCalled();
  });

  it("scopes the lookup to the calling teacher", async () => {
    const { PATCH } = await import("@/app/api/teacher/exams/route");
    await PATCH(request({ examId: "exam_1", action: "UPDATE_SETTINGS", passMark: 42 }));

    expect(mockPrisma.exam.findFirst.mock.calls[0][0].where.teacherProfileId).toBe("tp_1");
  });

  it("rejects an out-of-range duration", async () => {
    const { PATCH } = await import("@/app/api/teacher/exams/route");
    const response = await PATCH(
      request({ examId: "exam_1", action: "UPDATE_SETTINGS", durationMinutes: 9999 }),
    );

    expect(response.status).toBe(400);
  });

  it("writes an audit record", async () => {
    const { PATCH } = await import("@/app/api/teacher/exams/route");
    await PATCH(request({ examId: "exam_1", action: "UPDATE_SETTINGS", passMark: 44 }));

    const data = mockPrisma.auditLog.create.mock.calls[0][0].data;
    expect(data.action).toBe("EXAM_SETTINGS_UPDATED");
    expect(data.entityId).toBe("exam_1");
  });
});
