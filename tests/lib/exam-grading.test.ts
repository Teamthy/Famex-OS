import { describe, it, expect, vi, beforeEach } from "vitest";
import { mockPrisma } from "../setup";

/**
 * CBT auto-grading.
 *
 * `gradeObjectiveAnswer` decides marks for every objective question, and
 * `finalizeAttempt` turns a submitted attempt into a score a student sees.
 * Essays must never be auto-scored to zero — they have to stay pending for a
 * human, or students silently lose marks.
 */

describe("gradeObjectiveAnswer — MCQ", () => {
  it("awards full marks for the correct option", async () => {
    const { gradeObjectiveAnswer } = await import("@/lib/exams");
    const { ExamQuestionType } = await import("@prisma/client");

    expect(
      gradeObjectiveAnswer({
        type: ExamQuestionType.MCQ,
        correctKey: "B",
        correctText: null,
        marks: 5,
        response: "B",
      }),
    ).toEqual({ isCorrect: true, awardedMarks: 5 });
  });

  it("awards zero for a wrong option", async () => {
    const { gradeObjectiveAnswer } = await import("@/lib/exams");
    const { ExamQuestionType } = await import("@prisma/client");

    expect(
      gradeObjectiveAnswer({
        type: ExamQuestionType.MCQ,
        correctKey: "B",
        correctText: null,
        marks: 5,
        response: "C",
      }),
    ).toEqual({ isCorrect: false, awardedMarks: 0 });
  });

  it("is case-insensitive and tolerates whitespace", async () => {
    const { gradeObjectiveAnswer } = await import("@/lib/exams");
    const { ExamQuestionType } = await import("@prisma/client");

    for (const response of ["b", " B ", "b\n"]) {
      expect(
        gradeObjectiveAnswer({
          type: ExamQuestionType.MCQ,
          correctKey: "B",
          correctText: null,
          marks: 3,
          response,
        }),
      ).toEqual({ isCorrect: true, awardedMarks: 3 });
    }
  });

  it("scores an unanswered question as zero, not null", async () => {
    const { gradeObjectiveAnswer } = await import("@/lib/exams");
    const { ExamQuestionType } = await import("@prisma/client");

    expect(
      gradeObjectiveAnswer({
        type: ExamQuestionType.MCQ,
        correctKey: "A",
        correctText: null,
        marks: 5,
        response: null,
      }),
    ).toEqual({ isCorrect: false, awardedMarks: 0 });
  });
});

describe("gradeObjectiveAnswer — TRUE/FALSE", () => {
  it("marks a matching boolean answer correct", async () => {
    const { gradeObjectiveAnswer } = await import("@/lib/exams");
    const { ExamQuestionType } = await import("@prisma/client");

    expect(
      gradeObjectiveAnswer({
        type: ExamQuestionType.TRUE_FALSE,
        correctKey: "TRUE",
        correctText: null,
        marks: 2,
        response: "true",
      }),
    ).toEqual({ isCorrect: true, awardedMarks: 2 });
  });

  it("marks the opposite boolean wrong", async () => {
    const { gradeObjectiveAnswer } = await import("@/lib/exams");
    const { ExamQuestionType } = await import("@prisma/client");

    expect(
      gradeObjectiveAnswer({
        type: ExamQuestionType.TRUE_FALSE,
        correctKey: "TRUE",
        correctText: null,
        marks: 2,
        response: "FALSE",
      }),
    ).toEqual({ isCorrect: false, awardedMarks: 0 });
  });
});

describe("gradeObjectiveAnswer — FILL_BLANK", () => {
  it("accepts an exact answer ignoring case and padding", async () => {
    const { gradeObjectiveAnswer } = await import("@/lib/exams");
    const { ExamQuestionType } = await import("@prisma/client");

    expect(
      gradeObjectiveAnswer({
        type: ExamQuestionType.FILL_BLANK,
        correctKey: null,
        correctText: "Photosynthesis",
        marks: 4,
        response: "  photosynthesis ",
      }),
    ).toEqual({ isCorrect: true, awardedMarks: 4 });
  });

  it("rejects a near-miss spelling", async () => {
    const { gradeObjectiveAnswer } = await import("@/lib/exams");
    const { ExamQuestionType } = await import("@prisma/client");

    expect(
      gradeObjectiveAnswer({
        type: ExamQuestionType.FILL_BLANK,
        correctKey: null,
        correctText: "Photosynthesis",
        marks: 4,
        response: "Photosynthesus",
      }),
    ).toEqual({ isCorrect: false, awardedMarks: 0 });
  });

  it("never marks correct when the expected answer is blank", async () => {
    const { gradeObjectiveAnswer } = await import("@/lib/exams");
    const { ExamQuestionType } = await import("@prisma/client");

    // A misconfigured question must not award marks to an empty response.
    expect(
      gradeObjectiveAnswer({
        type: ExamQuestionType.FILL_BLANK,
        correctKey: null,
        correctText: "",
        marks: 4,
        response: "   ",
      }),
    ).toEqual({ isCorrect: false, awardedMarks: 0 });
  });
});

describe("gradeObjectiveAnswer — ESSAY", () => {
  it("leaves essays ungraded for a human marker", async () => {
    const { gradeObjectiveAnswer } = await import("@/lib/exams");
    const { ExamQuestionType } = await import("@prisma/client");

    // null (not 0) is what keeps the attempt in SUBMITTED rather than GRADED.
    expect(
      gradeObjectiveAnswer({
        type: ExamQuestionType.ESSAY,
        correctKey: null,
        correctText: null,
        marks: 10,
        response: "A long considered answer...",
      }),
    ).toEqual({ isCorrect: null, awardedMarks: null });
  });

  it("leaves an unanswered essay ungraded too", async () => {
    const { gradeObjectiveAnswer } = await import("@/lib/exams");
    const { ExamQuestionType } = await import("@prisma/client");

    expect(
      gradeObjectiveAnswer({
        type: ExamQuestionType.ESSAY,
        correctKey: null,
        correctText: null,
        marks: 10,
        response: null,
      }),
    ).toEqual({ isCorrect: null, awardedMarks: null });
  });
});

describe("finalizeAttempt", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.examAnswer.update.mockResolvedValue({});
    mockPrisma.examAttempt.update.mockImplementation(({ data }: any) =>
      Promise.resolve({ id: "att_1", ...data }),
    );
  });

  function attempt(answers: any[], essayScore = 0) {
    return {
      id: "att_1",
      essayScore,
      answers,
      exam: { id: "exam_1" },
    };
  }

  it("returns null for an unknown attempt", async () => {
    mockPrisma.examAttempt.findUnique.mockResolvedValue(null);
    const { finalizeAttempt } = await import("@/lib/exams");

    expect(await finalizeAttempt("missing")).toBeNull();
  });

  it("sums objective marks and marks the attempt GRADED", async () => {
    mockPrisma.examAttempt.findUnique.mockResolvedValue(
      attempt([
        {
          id: "a1",
          response: "A",
          question: { type: "MCQ", correctKey: "A", correctText: null, marks: 5 },
        },
        {
          id: "a2",
          response: "B",
          question: { type: "MCQ", correctKey: "C", correctText: null, marks: 5 },
        },
        {
          id: "a3",
          response: "TRUE",
          question: { type: "TRUE_FALSE", correctKey: "TRUE", correctText: null, marks: 2 },
        },
      ]),
    );

    const { finalizeAttempt } = await import("@/lib/exams");
    await finalizeAttempt("att_1");

    const data = mockPrisma.examAttempt.update.mock.calls[0][0].data;
    expect(data.autoScore).toBe(7); // 5 + 0 + 2
    expect(data.totalScore).toBe(7);
    expect(data.status).toBe("GRADED");
    expect(data.submittedAt).toBeInstanceOf(Date);
  });

  it("holds the attempt at SUBMITTED when an essay needs marking", async () => {
    mockPrisma.examAttempt.findUnique.mockResolvedValue(
      attempt([
        {
          id: "a1",
          response: "A",
          question: { type: "MCQ", correctKey: "A", correctText: null, marks: 5 },
        },
        {
          id: "a2",
          response: "Essay text",
          question: { type: "ESSAY", correctKey: null, correctText: null, marks: 10 },
        },
      ]),
    );

    const { finalizeAttempt } = await import("@/lib/exams");
    await finalizeAttempt("att_1");

    const data = mockPrisma.examAttempt.update.mock.calls[0][0].data;
    expect(data.status).toBe("SUBMITTED");
    expect(data.autoScore).toBe(5); // essay excluded from auto score
  });

  it("adds an existing essayScore into the total", async () => {
    mockPrisma.examAttempt.findUnique.mockResolvedValue(
      attempt(
        [
          {
            id: "a1",
            response: "A",
            question: { type: "MCQ", correctKey: "A", correctText: null, marks: 5 },
          },
        ],
        8, // teacher already awarded 8 for the essay
      ),
    );

    const { finalizeAttempt } = await import("@/lib/exams");
    await finalizeAttempt("att_1");

    const data = mockPrisma.examAttempt.update.mock.calls[0][0].data;
    expect(data.autoScore).toBe(5);
    expect(data.totalScore).toBe(13);
  });

  it("does not write per-answer marks for essay questions", async () => {
    mockPrisma.examAttempt.findUnique.mockResolvedValue(
      attempt([
        {
          id: "a1",
          response: "Essay",
          question: { type: "ESSAY", correctKey: null, correctText: null, marks: 10 },
        },
      ]),
    );

    const { finalizeAttempt } = await import("@/lib/exams");
    await finalizeAttempt("att_1");

    // Both write paths, because drop 28 moved grading from per-answer
    // `update` to bucketed `updateMany` — asserting only the old one would
    // pass vacuously and stop protecting essays from being auto-zeroed.
    expect(mockPrisma.examAnswer.update).not.toHaveBeenCalled();
    expect(mockPrisma.examAnswer.updateMany).not.toHaveBeenCalled();
  });

  it("scores an all-blank attempt as zero", async () => {
    mockPrisma.examAttempt.findUnique.mockResolvedValue(
      attempt([
        {
          id: "a1",
          response: null,
          question: { type: "MCQ", correctKey: "A", correctText: null, marks: 5 },
        },
        {
          id: "a2",
          response: null,
          question: { type: "MCQ", correctKey: "B", correctText: null, marks: 5 },
        },
      ]),
    );

    const { finalizeAttempt } = await import("@/lib/exams");
    await finalizeAttempt("att_1");

    const data = mockPrisma.examAttempt.update.mock.calls[0][0].data;
    expect(data.autoScore).toBe(0);
    expect(data.status).toBe("GRADED");
  });
});
