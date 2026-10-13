import { describe, it, expect, vi, beforeEach } from "vitest";
import { mockPrisma } from "../setup";

/**
 * Student exam-practice endpoints.
 *
 * Practice deliberately relaxes two rules that protect graded CBT — no fee
 * lock, and unlimited attempts. That makes the examType filter the security
 * boundary for this whole route group: if a student could point these
 * endpoints at a real CA or end-of-term exam, they would get unlimited
 * attempts on assessed work with the fee gate bypassed.
 *
 * These tests pin that boundary, plus the scoring/summary maths the page shows.
 */

const studentContext = {
  user: { id: "usr_1", schoolId: "school_1", role: "STUDENT" },
  studentProfile: {
    id: "stu_1",
    displayName: "Stu One",
    studentId: "YKC-1",
    currentClassId: "cls_1",
  },
};

vi.mock("@/lib/exams", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/exams")>();
  return {
    ...actual,
    getStudentExamContext: vi.fn(async () => studentContext),
    finalizeAttempt: vi.fn(async () => ({ id: "att_1", totalScore: 1 })),
  };
});

function practiceExam(overrides: Record<string, unknown> = {}) {
  return {
    id: "exam_prac",
    title: "WAEC Maths Practice",
    subjectName: "Mathematics",
    durationMinutes: 30,
    passMark: 50,
    instructions: null,
    status: "PUBLISHED",
    shuffleQuestions: false,
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
      {
        id: "q2",
        type: "MCQ",
        questionText: "3+3?",
        marks: 1,
        options: null,
        correctKey: "A",
        correctText: null,
        sortOrder: 2,
      },
    ],
    attempts: [],
    ...overrides,
  };
}

describe("GET /api/student/practice — catalogue", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("queries only PRACTICE exams, scoped to the student's class and school", async () => {
    mockPrisma.exam.findMany.mockResolvedValue([]);
    const { GET } = await import("@/app/api/student/practice/route");
    await GET();

    const where = mockPrisma.exam.findMany.mock.calls[0][0].where;
    expect(where.examType).toBe("PRACTICE");
    expect(where.schoolId).toBe("school_1");
    expect(where.classId).toBe("cls_1");
  });

  it("bounds the query so a big catalogue cannot blow up the request", async () => {
    mockPrisma.exam.findMany.mockResolvedValue([]);
    const { GET } = await import("@/app/api/student/practice/route");
    await GET();

    expect(mockPrisma.exam.findMany.mock.calls[0][0].take).toBe(200);
  });

  it("returns an empty catalogue cleanly when nothing is published", async () => {
    mockPrisma.exam.findMany.mockResolvedValue([]);
    const { GET } = await import("@/app/api/student/practice/route");
    const body = await (await GET()).json();

    expect(body.exams).toEqual([]);
    expect(body.subjects).toEqual([]);
    expect(body.summary.testsTaken).toBe(0);
    expect(body.summary.bestPercent).toBeNull();
  });

  it("reports best and last score from finished attempts", async () => {
    mockPrisma.exam.findMany.mockResolvedValue([
      practiceExam({
        attempts: [
          { id: "a2", status: "GRADED", totalScore: 1, attemptNumber: 2, submittedAt: new Date() },
          { id: "a1", status: "GRADED", totalScore: 2, attemptNumber: 1, submittedAt: new Date() },
        ],
      }),
    ]);
    const { GET } = await import("@/app/api/student/practice/route");
    const body = await (await GET()).json();

    // totalMarks = 2 → attempt scores of 1 and 2 are 50% and 100%.
    expect(body.exams[0].bestPercent).toBe(100);
    expect(body.exams[0].lastPercent).toBe(50); // most recent first
    expect(body.exams[0].attemptCount).toBe(2);
  });

  it("excludes an in-progress attempt from the score history", async () => {
    mockPrisma.exam.findMany.mockResolvedValue([
      practiceExam({
        attempts: [
          { id: "a2", status: "IN_PROGRESS", totalScore: 0, attemptNumber: 2, submittedAt: null },
          { id: "a1", status: "GRADED", totalScore: 2, attemptNumber: 1, submittedAt: new Date() },
        ],
      }),
    ]);
    const { GET } = await import("@/app/api/student/practice/route");
    const body = await (await GET()).json();

    expect(body.exams[0].attemptCount).toBe(1);
    expect(body.exams[0].bestPercent).toBe(100);
    expect(body.exams[0].canResume).toBe(true);
    expect(body.exams[0].resumeAttemptId).toBe("a2");
  });

  it("cannot be started when the set has no questions", async () => {
    mockPrisma.exam.findMany.mockResolvedValue([practiceExam({ questions: [] })]);
    const { GET } = await import("@/app/api/student/practice/route");
    const body = await (await GET()).json();

    expect(body.exams[0].canStart).toBe(false);
  });

  it("groups exams by subject", async () => {
    mockPrisma.exam.findMany.mockResolvedValue([
      practiceExam(),
      practiceExam({ id: "exam_2", subjectName: "Physics", title: "Physics Practice" }),
    ]);
    const { GET } = await import("@/app/api/student/practice/route");
    const body = await (await GET()).json();

    expect(body.subjects.map((s: { name: string }) => s.name)).toEqual(["Mathematics", "Physics"]);
  });
});

describe("POST /api/student/practice/[id]/attempt — starting", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const params = { params: Promise.resolve({ id: "exam_prac" }) };

  it("refuses an exam that is not examType PRACTICE", async () => {
    // findFirst carries the examType filter — a graded exam simply won't match.
    mockPrisma.exam.findFirst.mockResolvedValue(null);
    const { POST } = await import("@/app/api/student/practice/[id]/attempt/route");
    const response = await POST({} as never, params);

    expect(response.status).toBe(404);
    expect(mockPrisma.exam.findFirst.mock.calls[0][0].where.examType).toBe("PRACTICE");
  });

  it("scopes the lookup to the student's own school and class", async () => {
    mockPrisma.exam.findFirst.mockResolvedValue(null);
    const { POST } = await import("@/app/api/student/practice/[id]/attempt/route");
    await POST({} as never, params);

    const where = mockPrisma.exam.findFirst.mock.calls[0][0].where;
    expect(where.schoolId).toBe("school_1");
    expect(where.classId).toBe("cls_1");
  });

  it("rejects a practice set with no questions", async () => {
    mockPrisma.exam.findFirst.mockResolvedValue(practiceExam({ questions: [] }));
    const { POST } = await import("@/app/api/student/practice/[id]/attempt/route");
    const response = await POST({} as never, params);

    expect(response.status).toBe(409);
  });

  it("allows an immediate retake — no ExamRetake grant required", async () => {
    mockPrisma.exam.findFirst.mockResolvedValue(practiceExam());
    // A previous, completed attempt exists.
    mockPrisma.examAttempt.findFirst.mockResolvedValue({
      id: "att_old",
      status: "GRADED",
      attemptNumber: 1,
      deadlineAt: new Date(Date.now() - 1000),
    });
    mockPrisma.examAttempt.create.mockResolvedValue({
      id: "att_new",
      attemptNumber: 2,
      deadlineAt: new Date(Date.now() + 60_000),
    });
    mockPrisma.examAnswer.findMany.mockResolvedValue([]);

    const { POST } = await import("@/app/api/student/practice/[id]/attempt/route");
    const response = await POST({} as never, params);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.attempt.attemptNumber).toBe(2);
    // The graded runner would have looked for a retake grant. Practice must not.
    expect(mockPrisma.examRetake?.findUnique).not.toHaveBeenCalled();
  });

  it("never applies a fee lock to practice", async () => {
    mockPrisma.exam.findFirst.mockResolvedValue(practiceExam());
    mockPrisma.examAttempt.findFirst.mockResolvedValue(null);
    mockPrisma.examAttempt.create.mockResolvedValue({
      id: "att_1",
      attemptNumber: 1,
      deadlineAt: new Date(Date.now() + 60_000),
    });
    mockPrisma.examAnswer.findMany.mockResolvedValue([]);

    const { POST } = await import("@/app/api/student/practice/[id]/attempt/route");
    const response = await POST({} as never, params);

    // 402 is the fee-lock status used by the graded runner.
    expect(response.status).toBe(200);
    expect(mockPrisma.feeInvoice.findMany).not.toHaveBeenCalled();
  });

  it("refuses to start a DRAFT set", async () => {
    mockPrisma.exam.findFirst.mockResolvedValue(practiceExam({ status: "DRAFT" }));
    mockPrisma.examAttempt.findFirst.mockResolvedValue(null);

    const { POST } = await import("@/app/api/student/practice/[id]/attempt/route");
    const response = await POST({} as never, params);

    expect(response.status).toBe(409);
  });

  it("does not leak correct answers when serving questions", async () => {
    mockPrisma.exam.findFirst.mockResolvedValue(practiceExam());
    mockPrisma.examAttempt.findFirst.mockResolvedValue(null);
    mockPrisma.examAttempt.create.mockResolvedValue({
      id: "att_1",
      attemptNumber: 1,
      deadlineAt: new Date(Date.now() + 60_000),
    });
    mockPrisma.examAnswer.findMany.mockResolvedValue([]);

    const { POST } = await import("@/app/api/student/practice/[id]/attempt/route");
    const body = await (await POST({} as never, params)).json();

    const serialized = JSON.stringify(body.questions);
    expect(serialized).not.toContain("correctKey");
    expect(serialized).not.toContain("correctText");
  });
});
