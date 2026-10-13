import { describe, it, expect, vi, beforeEach } from "vitest";
import { mockPrisma } from "../setup";

/**
 * Server-side enforcement of the exam sitting window.
 *
 * Drop 24 added `scheduledFor` / `availableUntil`, drop 27 let a teacher set
 * them, and the student list hides the Start button outside the window. None
 * of that is a control: the list is a *view*. `POST .../attempt` is the only
 * thing that actually creates an attempt, and until drop 28 it never looked at
 * the window at all — so a student who kept the tab open, guessed the URL, or
 * used the mobile client could sit an exam a week early or a week late.
 *
 * These tests pin the server as the authority. They deliberately drive the
 * route directly rather than the page, because the page is not the boundary.
 */

const studentContext = {
  user: { id: "usr_1", schoolId: "school_1", role: "STUDENT" },
  studentProfile: {
    id: "stu_1",
    displayName: "Stu One",
    studentId: "YKC/2026/0001",
    currentClassId: "cls_1",
  },
};

vi.mock("@/lib/exams", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/exams")>();
  return {
    ...actual,
    getStudentExamContext: vi.fn(async () => studentContext),
    finalizeAttempt: vi.fn(async () => ({ id: "att_1", status: "GRADED" })),
  };
});

vi.mock("@/lib/fee-lock", () => ({
  getStudentFeeLock: vi.fn(async () => null),
}));

const HOUR = 3_600_000;

function scheduledExam(overrides: Record<string, unknown> = {}) {
  return {
    id: "exam_1",
    schoolId: "school_1",
    classId: "cls_1",
    title: "Midterm Test",
    subjectName: "Biology",
    instructions: null,
    status: "PUBLISHED",
    durationMinutes: 40,
    shuffleQuestions: false,
    scheduledFor: null,
    availableUntil: null,
    questions: [
      {
        id: "q1",
        type: "MCQ",
        questionText: "2+2?",
        marks: 1,
        options: null,
        correctKey: "B",
        correctText: null,
        sortOrder: 1,
      },
    ],
    ...overrides,
  };
}

const params = { params: Promise.resolve({ id: "exam_1" }) };

describe("POST /api/student/exams/[id]/attempt — sitting window", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.examAttempt.findFirst.mockResolvedValue(null);
    mockPrisma.examAnswer.findMany.mockResolvedValue([]);
    mockPrisma.examAttempt.create.mockImplementation(async ({ data }: never) => ({
      id: "att_new",
      ...(data as Record<string, unknown>),
    }));
  });

  it("refuses to start an exam before it opens", async () => {
    mockPrisma.exam.findFirst.mockResolvedValue(
      scheduledExam({ scheduledFor: new Date(Date.now() + 2 * HOUR) }),
    );

    const { POST } = await import("@/app/api/student/exams/[id]/attempt/route");
    const response = await POST({} as never, params);
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body.code).toBe("NOT_OPEN_YET");
    // The critical assertion: no attempt row was created.
    expect(mockPrisma.examAttempt.create).not.toHaveBeenCalled();
  });

  it("refuses to start an exam after the window closes", async () => {
    mockPrisma.exam.findFirst.mockResolvedValue(
      scheduledExam({
        scheduledFor: new Date(Date.now() - 4 * HOUR),
        availableUntil: new Date(Date.now() - HOUR),
      }),
    );

    const { POST } = await import("@/app/api/student/exams/[id]/attempt/route");
    const response = await POST({} as never, params);
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body.code).toBe("WINDOW_CLOSED");
    expect(mockPrisma.examAttempt.create).not.toHaveBeenCalled();
  });

  it("allows a start inside the window", async () => {
    mockPrisma.exam.findFirst.mockResolvedValue(
      scheduledExam({
        scheduledFor: new Date(Date.now() - HOUR),
        availableUntil: new Date(Date.now() + HOUR),
      }),
    );

    const { POST } = await import("@/app/api/student/exams/[id]/attempt/route");
    const response = await POST({} as never, params);

    expect(response.status).toBe(200);
    expect(mockPrisma.examAttempt.create).toHaveBeenCalled();
  });

  it("allows a start when no window is set — legacy exams must keep working", async () => {
    mockPrisma.exam.findFirst.mockResolvedValue(scheduledExam());

    const { POST } = await import("@/app/api/student/exams/[id]/attempt/route");
    const response = await POST({} as never, params);

    expect(response.status).toBe(200);
    expect(mockPrisma.examAttempt.create).toHaveBeenCalled();
  });

  /**
   * The window bounds *starting*, not *finishing*. A student who legitimately
   * began two minutes before the close must be allowed to keep working for
   * their full duration — cutting them off at the window would take time off
   * their clock through no fault of their own.
   */
  it("lets an in-progress attempt resume after the window has closed", async () => {
    mockPrisma.exam.findFirst.mockResolvedValue(
      scheduledExam({ availableUntil: new Date(Date.now() - 60_000) }),
    );
    mockPrisma.examAttempt.findFirst.mockResolvedValue({
      id: "att_live",
      status: "IN_PROGRESS",
      attemptNumber: 1,
      // Deadline still in the future: their own clock is still running.
      deadlineAt: new Date(Date.now() + 10 * 60_000),
    });

    const { POST } = await import("@/app/api/student/exams/[id]/attempt/route");
    const response = await POST({} as never, params);

    expect(response.status).toBe(200);
  });

  /**
   * The deadline must never exceed the close of the window either — otherwise
   * starting one minute before close hands out a full extra 40 minutes and the
   * window means nothing.
   */
  it("clamps the attempt deadline to the close of the window", async () => {
    const closesAt = new Date(Date.now() + 5 * 60_000); // 5 min left, 40 min exam
    mockPrisma.exam.findFirst.mockResolvedValue(scheduledExam({ availableUntil: closesAt }));

    const { POST } = await import("@/app/api/student/exams/[id]/attempt/route");
    await POST({} as never, params);

    const created = mockPrisma.examAttempt.create.mock.calls[0][0].data;
    expect(created.deadlineAt.getTime()).toBe(closesAt.getTime());
  });

  it("does not clamp when the window closes after the full duration would end", async () => {
    const closesAt = new Date(Date.now() + 5 * HOUR);
    mockPrisma.exam.findFirst.mockResolvedValue(scheduledExam({ availableUntil: closesAt }));

    const { POST } = await import("@/app/api/student/exams/[id]/attempt/route");
    await POST({} as never, params);

    const created = mockPrisma.examAttempt.create.mock.calls[0][0].data;
    // 40-minute exam, so the deadline is duration-bound, not window-bound.
    expect(created.deadlineAt.getTime()).toBeLessThan(closesAt.getTime());
  });
});

/**
 * C-004 — official exam start must be concurrency-safe.
 *
 * Double-tapping Start (or a mobile network retry) used to race the retake
 * consumption against the attempt create: the loser got a unique-constraint
 * 500 on exam day, and a crash between "retake used" and "attempt created"
 * burned the retake entirely. The start path now runs retake consumption and
 * attempt creation in one transaction, and a unique-race loser resumes the
 * winner's in-progress attempt instead of erroring.
 */
describe("POST /api/student/exams/[id]/attempt — start race (C-004)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.examAttempt.findFirst.mockResolvedValue(null);
    mockPrisma.examAnswer.findMany.mockResolvedValue([]);
    mockPrisma.examAttempt.create.mockImplementation(async ({ data }: never) => ({
      id: "att_new",
      ...(data as Record<string, unknown>),
    }));
  });

  it("resumes the winner's attempt when a concurrent start loses the unique race", async () => {
    mockPrisma.exam.findFirst.mockResolvedValue(scheduledExam());
    // 1st read: no existing attempt (the racer's view). After losing the
    // insert race, the re-read finds the winner's IN_PROGRESS attempt.
    mockPrisma.examAttempt.findFirst.mockResolvedValueOnce(null).mockResolvedValueOnce({
      id: "att_live",
      status: "IN_PROGRESS",
      attemptNumber: 1,
      deadlineAt: new Date(Date.now() + 10 * 60_000),
    });
    // The transaction loses the (examId, studentProfileId, attemptNumber)
    // unique constraint race against the concurrent winner.
    mockPrisma.$transaction.mockRejectedValueOnce({ code: "P2002" });

    const { POST } = await import("@/app/api/student/exams/[id]/attempt/route");
    const response = await POST({} as never, params);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.attempt.id).toBe("att_live");
  });

  it("consumes the retake and creates the attempt inside one transaction", async () => {
    mockPrisma.exam.findFirst.mockResolvedValue(scheduledExam());
    // A previous SUBMITTED attempt exists → this start needs a retake.
    mockPrisma.examAttempt.findFirst.mockResolvedValue({
      id: "att_1",
      status: "SUBMITTED",
      attemptNumber: 1,
      deadlineAt: new Date(Date.now() - HOUR),
    });
    mockPrisma.examRetake.findUnique.mockResolvedValue({ id: "rt_1", used: false });
    mockPrisma.examRetake.update.mockResolvedValue({ id: "rt_1", used: true });

    const { POST } = await import("@/app/api/student/exams/[id]/attempt/route");
    const response = await POST({} as never, params);

    expect(response.status).toBe(200);
    expect(mockPrisma.examRetake.update).toHaveBeenCalledWith({
      where: { id: "rt_1" },
      data: { used: true },
    });
    expect(mockPrisma.examAttempt.create).toHaveBeenCalledTimes(1);
  });

  it("still refuses a start when the retake is missing or already used", async () => {
    mockPrisma.exam.findFirst.mockResolvedValue(scheduledExam());
    mockPrisma.examAttempt.findFirst.mockResolvedValue({
      id: "att_1",
      status: "SUBMITTED",
      attemptNumber: 1,
      deadlineAt: new Date(Date.now() - HOUR),
    });
    mockPrisma.examRetake.findUnique.mockResolvedValue({ id: "rt_1", used: true });

    const { POST } = await import("@/app/api/student/exams/[id]/attempt/route");
    const response = await POST({} as never, params);
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body.error).toMatch(/already taken this exam/i);
    expect(mockPrisma.examAttempt.create).not.toHaveBeenCalled();
    expect(mockPrisma.examRetake.update).not.toHaveBeenCalled();
  });
});
