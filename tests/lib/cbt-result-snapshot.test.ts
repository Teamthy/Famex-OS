import { beforeEach, describe, expect, it, vi } from "vitest";
import { cbtContributionsForClass } from "@/lib/results";
import { mockPrisma } from "../setup";

describe("cbtContributionsForClass packet denominators", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("uses each offline attempt's signed snapshot max and compares retakes by percentage", async () => {
    mockPrisma.exam.findMany.mockResolvedValue([
      {
        subjectName: "Biology",
        questions: [{ marks: 10 }, { marks: 10 }],
        attempts: [
          {
            id: "offline_best",
            studentProfileId: "student_1",
            totalScore: 6,
            metadata: {
              offlineQuestionSnapshot: {
                manifest: {
                  examId: "exam_1",
                  packetId: "packet_1",
                  fingerprint: "fingerprint",
                  questionCount: 2,
                  totalMarks: 10,
                  durationMinutes: 40,
                  sessionLabel: "2026/2027",
                  termIndex: 1,
                  downloadedAt: "2026-10-01T08:00:00.000Z",
                },
                signature: "signed",
                questions: [
                  {
                    id: "q1",
                    type: "MCQ",
                    questionText: "Q1",
                    options: null,
                    correctKey: "A",
                    correctText: null,
                    marks: 4,
                    sortOrder: 1,
                  },
                  {
                    id: "q2",
                    type: "ESSAY",
                    questionText: "Q2",
                    options: null,
                    correctKey: null,
                    correctText: "Answer",
                    marks: 6,
                    sortOrder: 2,
                  },
                ],
              },
            },
          },
          {
            id: "larger-raw-score",
            studentProfileId: "student_1",
            totalScore: 7,
            metadata: null,
          },
        ],
      },
    ] as never);

    const contributions = await cbtContributionsForClass({
      schoolId: "school_1",
      classId: "class_1",
      sessionLabel: "2026/2027",
      termIndex: 1,
    });

    expect(contributions.get("student_1::Biology")).toEqual({
      score: 6,
      maxMarks: 10,
      attempts: 1,
      attemptId: "offline_best",
    });
  });
});
