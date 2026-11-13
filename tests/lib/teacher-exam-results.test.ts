import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fingerprintQuestions, signPacket } from "@/lib/offline-packet";
import { mockPrisma } from "../setup";

const teacherContext = {
  user: { id: "teacher_user_1", schoolId: "school_1", role: "TEACHER" },
  teacherProfile: { id: "teacher_profile_1" },
};

vi.mock("@/lib/exams", () => ({
  requireExamTeacherContext: vi.fn(async () => ({ ok: true, context: teacherContext })),
}));

const originalQuestions = [
  {
    id: "q1",
    type: "MCQ",
    questionText: "Original question",
    options: [
      { key: "A", text: "A" },
      { key: "B", text: "B" },
    ],
    correctKey: "A",
    correctText: null,
    marks: 10,
    sortOrder: 1,
  },
];

function makeExam() {
  const manifest = {
    examId: "exam_1",
    packetId: "exam_1-packet",
    fingerprint: fingerprintQuestions(originalQuestions),
    questionCount: 1,
    totalMarks: 10,
    durationMinutes: 40,
    sessionLabel: "2026/2027",
    termIndex: 1,
    downloadedAt: "2026-10-01T08:00:00.000Z",
  };
  const { signature } = signPacket(manifest);
  return {
    id: "exam_1",
    teacherProfileId: "teacher_profile_1",
    title: "Biology test",
    subjectName: "Biology",
    passMark: 50,
    resultsReleased: true,
    classroom: { displayName: "SS1A" },
    questions: [{ id: "current_q", marks: 20, sortOrder: 1 }],
    attempts: [
      {
        id: "offline_attempt",
        attemptNumber: 1,
        status: "GRADED",
        metadata: {
          offlineQuestionSnapshot: {
            manifest,
            signature,
            questions: originalQuestions,
          },
        },
        startedAt: new Date("2026-10-01T08:00:00.000Z"),
        submittedAt: new Date("2026-10-01T09:00:00.000Z"),
        autoScore: 6,
        essayScore: 0,
        totalScore: 6,
        tabSwitches: 0,
        studentProfile: { id: "student_1", studentId: "FAMEX/001", displayName: "Student One" },
        answers: [],
      },
    ],
  };
}

describe("GET /api/teacher/exams/[id]/results score provenance", () => {
  const previousSecret = process.env.AUTH_SECRET;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.AUTH_SECRET = "teacher-results-test-secret-long-enough";
    mockPrisma.exam.findFirst.mockResolvedValue(makeExam() as never);
  });

  it("reports passed state and maximum from the issued signed packet, not the edited current paper", async () => {
    const { GET } = await import("@/app/api/teacher/exams/[id]/results/route");
    const response = await GET({} as never, { params: Promise.resolve({ id: "exam_1" }) });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.exam.totalMarks).toBe(20);
    expect(body.attempts[0]).toMatchObject({
      totalScore: 6,
      maxMarks: 10,
      passed: true,
    });
  });

  afterEach(() => {
    if (previousSecret === undefined) delete process.env.AUTH_SECRET;
    else process.env.AUTH_SECRET = previousSecret;
  });
});
