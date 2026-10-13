import { describe, it, expect, vi, beforeEach } from "vitest";
import { mockPrisma } from "../setup";

/**
 * Drop 28 — the two hot paths in CBT.
 *
 * Grading and autosave both used to be `for (…) { await … }` loops: one round
 * trip per answer. That is invisible with 6 students and 5 questions, and it
 * is the whole ballgame when 40 students sit a 60-question paper and the timer
 * expires for all of them in the same second.
 *
 * Speed changes are only worth anything if the marks stay identical, so these
 * tests assert BOTH: fewer queries, and the same values written to the same
 * rows. A batching bug here silently misgrades a whole class, which is exactly
 * the class of mistake that must not be shipped on assertion alone.
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

// Only the session lookup is stubbed. `finalizeAttempt` is the subject of half
// this file, so it must stay real — stubbing it here would make every grading
// assertion below test the stub.
vi.mock("@/lib/exams", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/exams")>();
  return {
    ...actual,
    getStudentExamContext: vi.fn(async () => studentContext),
  };
});

vi.mock("@/lib/fee-lock", () => ({
  getStudentFeeLock: vi.fn(async () => null),
}));

/* ================================================================
   Grading — bucketed updateMany
   ================================================================ */

describe("finalizeAttempt — batched grading", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.examAnswer.updateMany.mockResolvedValue({ count: 0 });
    mockPrisma.examAttempt.update.mockResolvedValue({ id: "att_1", status: "GRADED" });
  });

  /** 60 MCQs, all 1 mark, alternating right and wrong. */
  function bigAttempt(count = 60) {
    return {
      id: "att_1",
      essayScore: 0,
      exam: { id: "exam_1" },
      answers: Array.from({ length: count }, (_, index) => ({
        id: `a${index}`,
        response: index % 2 === 0 ? "A" : "D",
        question: { type: "MCQ", correctKey: "A", correctText: null, marks: 1 },
      })),
    };
  }

  it("grades a 60-question paper in a handful of queries, not 60", async () => {
    mockPrisma.examAttempt.findUnique.mockResolvedValue(bigAttempt(60));

    const { finalizeAttempt } = await import("@/lib/exams");
    await finalizeAttempt("att_1");

    // Two outcomes exist (right/1 mark, wrong/0 marks) → two updateMany calls.
    expect(mockPrisma.examAnswer.updateMany).toHaveBeenCalledTimes(2);
    // And never the old per-row path.
    expect(mockPrisma.examAnswer.update).not.toHaveBeenCalled();
  });

  it("still awards exactly the right total", async () => {
    mockPrisma.examAttempt.findUnique.mockResolvedValue(bigAttempt(60));

    const { finalizeAttempt } = await import("@/lib/exams");
    await finalizeAttempt("att_1");

    const data = mockPrisma.examAttempt.update.mock.calls[0][0].data;
    expect(data.autoScore).toBe(30); // 30 correct × 1 mark
  });

  it("puts every answer in exactly one bucket, with the right marks", async () => {
    mockPrisma.examAttempt.findUnique.mockResolvedValue(bigAttempt(10));

    const { finalizeAttempt } = await import("@/lib/exams");
    await finalizeAttempt("att_1");

    const seen = new Map<string, { isCorrect: boolean; awardedMarks: number }>();
    for (const call of mockPrisma.examAnswer.updateMany.mock.calls) {
      for (const id of call[0].where.id.in) {
        // No answer may be written twice — a double-write means double marks.
        expect(seen.has(id)).toBe(false);
        seen.set(id, call[0].data);
      }
    }

    expect(seen.size).toBe(10);
    // Even indices answered "A" (correct), odd answered "D" (wrong).
    expect(seen.get("a0")).toEqual({ isCorrect: true, awardedMarks: 1 });
    expect(seen.get("a1")).toEqual({ isCorrect: false, awardedMarks: 0 });
  });

  it("keeps questions of different mark values in separate buckets", async () => {
    mockPrisma.examAttempt.findUnique.mockResolvedValue({
      id: "att_1",
      essayScore: 0,
      exam: { id: "exam_1" },
      answers: [
        {
          id: "a1",
          response: "A",
          question: { type: "MCQ", correctKey: "A", correctText: null, marks: 1 },
        },
        {
          id: "a2",
          response: "A",
          question: { type: "MCQ", correctKey: "A", correctText: null, marks: 5 },
        },
      ],
    });

    const { finalizeAttempt } = await import("@/lib/exams");
    await finalizeAttempt("att_1");

    const byId = new Map<string, number>();
    for (const call of mockPrisma.examAnswer.updateMany.mock.calls) {
      for (const id of call[0].where.id.in) byId.set(id, call[0].data.awardedMarks);
    }
    // The bug this guards: one bucket for "correct" would pay both 1 mark.
    expect(byId.get("a1")).toBe(1);
    expect(byId.get("a2")).toBe(5);
  });

  it("writes the marks and the attempt total in a single transaction", async () => {
    mockPrisma.examAttempt.findUnique.mockResolvedValue(bigAttempt(4));

    const { finalizeAttempt } = await import("@/lib/exams");
    await finalizeAttempt("att_1");

    // A half-graded attempt is worse than a slow one: the score a student sees
    // must never be missing marks that were awarded.
    expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
  });

  it("returns the updated attempt, not the updateMany results", async () => {
    mockPrisma.examAttempt.findUnique.mockResolvedValue(bigAttempt(4));
    mockPrisma.examAttempt.update.mockResolvedValue({ id: "att_1", status: "GRADED" });

    const { finalizeAttempt } = await import("@/lib/exams");
    const result = await finalizeAttempt("att_1");

    // Callers read `.status` off this — returning the wrong array element
    // would hand them `{ count: n }`.
    expect(result).toEqual({ id: "att_1", status: "GRADED" });
  });

  /**
   * Found while mutation-testing the autosave diff: a mutant that treated
   * stored `null` and incoming `""` as equal survived. It survives because
   * the two really are equivalent *for marks* — this pins that, so the
   * equivalence is a stated rule rather than an accident.
   */
  it("scores a blank and a cleared answer identically", async () => {
    const { gradeObjectiveAnswer } = await import("@/lib/exams");
    const { ExamQuestionType } = await import("@prisma/client");

    const base = {
      type: ExamQuestionType.MCQ,
      correctKey: "A",
      correctText: null,
      marks: 5,
    };
    expect(gradeObjectiveAnswer({ ...base, response: null })).toEqual({
      isCorrect: false,
      awardedMarks: 0,
    });
    expect(gradeObjectiveAnswer({ ...base, response: "" })).toEqual({
      isCorrect: false,
      awardedMarks: 0,
    });
  });

  it("handles an attempt with no answers at all", async () => {
    mockPrisma.examAttempt.findUnique.mockResolvedValue({
      id: "att_1",
      essayScore: 0,
      exam: { id: "exam_1" },
      answers: [],
    });

    const { finalizeAttempt } = await import("@/lib/exams");
    const result = await finalizeAttempt("att_1");

    expect(mockPrisma.examAnswer.updateMany).not.toHaveBeenCalled();
    expect(result).toEqual({ id: "att_1", status: "GRADED" });
  });
});

/* ================================================================
   Autosave — skip unchanged answers
   ================================================================ */

describe("PATCH .../attempt — autosave writes only what changed", () => {
  const params = { params: Promise.resolve({ id: "exam_1" }) };

  function request(body: unknown) {
    return { json: async () => body } as never;
  }

  function liveAttempt(questionIds: string[]) {
    return {
      id: "att_1",
      status: "IN_PROGRESS",
      deadlineAt: new Date(Date.now() + 30 * 60_000),
      exam: { questions: questionIds.map((id) => ({ id })) },
    };
  }

  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.examAttempt.findFirst.mockResolvedValue(liveAttempt(["q1", "q2", "q3"]));
  });

  it("writes nothing when the client re-sends identical answers", async () => {
    mockPrisma.examAnswer.findMany.mockResolvedValue([
      { questionId: "q1", response: "A" },
      { questionId: "q2", response: "B" },
    ]);

    const { PATCH } = await import("@/app/api/student/exams/[id]/attempt/route");
    const response = await PATCH(
      request({
        attemptId: "att_1",
        action: "SAVE",
        answers: [
          { questionId: "q1", response: "A" },
          { questionId: "q2", response: "B" },
        ],
      }),
      params,
    );

    expect(response.status).toBe(200);
    // The steady state of a 15-second autosave loop: nothing has changed.
    expect(mockPrisma.examAnswer.upsert).not.toHaveBeenCalled();
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
  });

  it("writes only the answer the student actually changed", async () => {
    mockPrisma.examAnswer.findMany.mockResolvedValue([
      { questionId: "q1", response: "A" },
      { questionId: "q2", response: "B" },
    ]);

    const { PATCH } = await import("@/app/api/student/exams/[id]/attempt/route");
    await PATCH(
      request({
        attemptId: "att_1",
        action: "SAVE",
        answers: [
          { questionId: "q1", response: "A" }, // unchanged
          { questionId: "q2", response: "C" }, // changed
        ],
      }),
      params,
    );

    expect(mockPrisma.examAnswer.upsert).toHaveBeenCalledTimes(1);
    expect(
      mockPrisma.examAnswer.upsert.mock.calls[0][0].where.attemptId_questionId.questionId,
    ).toBe("q2");
  });

  it("writes a brand-new answer that has never been saved", async () => {
    mockPrisma.examAnswer.findMany.mockResolvedValue([]);

    const { PATCH } = await import("@/app/api/student/exams/[id]/attempt/route");
    await PATCH(
      request({
        attemptId: "att_1",
        action: "SAVE",
        answers: [{ questionId: "q3", response: "D" }],
      }),
      params,
    );

    expect(mockPrisma.examAnswer.upsert).toHaveBeenCalledTimes(1);
  });

  /**
   * Clearing an answer is a real edit. If "unchanged" were computed loosely —
   * say with a falsy check — deselecting an option would never persist and the
   * student would be marked on an answer they removed.
   */
  it("persists an answer the student cleared", async () => {
    mockPrisma.examAnswer.findMany.mockResolvedValue([{ questionId: "q1", response: "A" }]);

    const { PATCH } = await import("@/app/api/student/exams/[id]/attempt/route");
    await PATCH(
      request({
        attemptId: "att_1",
        action: "SAVE",
        answers: [{ questionId: "q1", response: null }],
      }),
      params,
    );

    expect(mockPrisma.examAnswer.upsert).toHaveBeenCalledTimes(1);
    expect(mockPrisma.examAnswer.upsert.mock.calls[0][0].update.response).toBeNull();
  });

  it("still ignores answers for questions outside this exam", async () => {
    mockPrisma.examAnswer.findMany.mockResolvedValue([]);

    const { PATCH } = await import("@/app/api/student/exams/[id]/attempt/route");
    await PATCH(
      request({
        attemptId: "att_1",
        action: "SAVE",
        answers: [{ questionId: "q_from_another_exam", response: "A" }],
      }),
      params,
    );

    expect(mockPrisma.examAnswer.upsert).not.toHaveBeenCalled();
  });

  it("does not read stored answers at all for a TAB_SWITCH ping", async () => {
    const { PATCH } = await import("@/app/api/student/exams/[id]/attempt/route");
    await PATCH(request({ attemptId: "att_1", action: "TAB_SWITCH" }), params);

    // This fires on every window blur; it must stay a single increment.
    expect(mockPrisma.examAnswer.findMany).not.toHaveBeenCalled();
    expect(mockPrisma.examAttempt.update).toHaveBeenCalledTimes(1);
  });
});
