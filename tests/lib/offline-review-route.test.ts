import { ExamAttemptStatus, ExamDeliveryMode, ExamQuestionType } from "@prisma/client";
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fingerprintQuestions, signPacket } from "@/lib/offline-packet";
import { mockPrisma } from "../setup";

const teacher = {
  user: { id: "teacher_1", schoolId: "school_1", role: "TEACHER" },
  teacherProfile: { id: "teacher_profile_1" },
};

vi.mock("@/lib/exams", () => ({
  requireExamTeacherContext: vi.fn(async () => ({ ok: true, context: teacher })),
}));
vi.mock("@/lib/requests", () => ({ getClientIp: vi.fn(() => "127.0.0.1") }));

const questions = [
  {
    id: "q1",
    type: ExamQuestionType.MCQ,
    questionText: "Select the answer",
    options: [
      { key: "A", text: "Correct" },
      { key: "B", text: "Wrong" },
    ],
    correctKey: "A",
    correctText: null,
    marks: 2,
    sortOrder: 1,
  },
  {
    id: "q2",
    type: ExamQuestionType.ESSAY,
    questionText: "Explain your answer",
    options: null,
    correctKey: null,
    correctText: "Detailed explanation",
    marks: 4,
    sortOrder: 2,
  },
];

const manifest = {
  examId: "exam_1",
  packetId: "exam_1-packet",
  fingerprint: fingerprintQuestions(questions),
  questionCount: questions.length,
  totalMarks: 6,
  durationMinutes: 45,
  sessionLabel: "2026/2027",
  termIndex: 1,
  downloadedAt: "2026-10-01T08:00:00.000Z",
};

function packetMetadata() {
  const { signature } = signPacket(manifest);
  return {
    requiresManualReview: true,
    packetMismatch: "FINGERPRINT_MISMATCH",
    offlineQuestionSnapshot: { manifest, signature, questions },
    offlineReplayAnswers: [
      { questionId: "q1", response: "A" },
      { questionId: "q2", response: "A detailed answer" },
    ],
  };
}

function request(body: unknown) {
  return new NextRequest("http://localhost/api/teacher/exams/exam_1/offline-review", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });
}

function attempt(overrides: Record<string, unknown> = {}) {
  return {
    id: "attempt_1",
    status: ExamAttemptStatus.SUBMITTED,
    deliveryMode: ExamDeliveryMode.SYNCED,
    resultAdoptedAt: null,
    metadata: packetMetadata(),
    exam: { schoolId: "school_1", resultsReleased: false },
    ...overrides,
  };
}

describe("POST /api/teacher/exams/[id]/offline-review", () => {
  const oldSecret = process.env.AUTH_SECRET;

  beforeEach(() => {
    process.env.AUTH_SECRET = "test-secret-value-that-is-long-enough-to-sign";
    vi.clearAllMocks();
    mockPrisma.examAttempt.findFirst.mockResolvedValue(attempt() as never);
    mockPrisma.examAttempt.updateMany.mockResolvedValue({ count: 1 });
    mockPrisma.auditLog.create.mockResolvedValue({ id: "audit_1" });
  });

  afterEach(() => {
    if (oldSecret === undefined) delete process.env.AUTH_SECRET;
    else process.env.AUTH_SECRET = oldSecret;
  });

  it("requires teacher marks for the whole signed paper and audits the result", async () => {
    const { POST } = await import("@/app/api/teacher/exams/[id]/offline-review/route");
    const response = await POST(
      request({
        attemptId: "attempt_1",
        reason: "Reviewed against the signed question set.",
        marks: [
          { questionId: "q1", awardedMarks: 2 },
          { questionId: "q2", awardedMarks: 3 },
        ],
      }),
      { params: Promise.resolve({ id: "exam_1" }) },
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({ score: 5, totalMarks: 6 });
    expect(mockPrisma.examAttempt.updateMany.mock.calls[0][0].data).toMatchObject({
      status: ExamAttemptStatus.GRADED,
      autoScore: 2,
      essayScore: 3,
      totalScore: 5,
    });
    expect(mockPrisma.auditLog.create.mock.calls[0][0].data).toMatchObject({
      action: "OFFLINE_EXAM_ATTEMPT_REVIEWED",
      entityId: "attempt_1",
    });
  });

  it("refuses marks above a question's signed maximum", async () => {
    const { POST } = await import("@/app/api/teacher/exams/[id]/offline-review/route");
    const response = await POST(
      request({
        attemptId: "attempt_1",
        reason: "Reviewed against the signed question set.",
        marks: [
          { questionId: "q1", awardedMarks: 3 },
          { questionId: "q2", awardedMarks: 3 },
        ],
      }),
      { params: Promise.resolve({ id: "exam_1" }) },
    );

    expect(response.status).toBe(400);
    expect(mockPrisma.examAttempt.updateMany).not.toHaveBeenCalled();
    expect(mockPrisma.auditLog.create).not.toHaveBeenCalled();
  });

  it("refuses a tampered persisted question snapshot", async () => {
    const tamperedMetadata = packetMetadata();
    tamperedMetadata.offlineQuestionSnapshot.signature = "not-the-server-signature";
    mockPrisma.examAttempt.findFirst.mockResolvedValue(
      attempt({ metadata: tamperedMetadata }) as never,
    );
    const { POST } = await import("@/app/api/teacher/exams/[id]/offline-review/route");
    const response = await POST(
      request({
        attemptId: "attempt_1",
        reason: "Reviewed against the signed question set.",
        marks: [
          { questionId: "q1", awardedMarks: 2 },
          { questionId: "q2", awardedMarks: 3 },
        ],
      }),
      { params: Promise.resolve({ id: "exam_1" }) },
    );

    expect(response.status).toBe(409);
    expect(mockPrisma.examAttempt.updateMany).not.toHaveBeenCalled();
    expect(mockPrisma.auditLog.create).not.toHaveBeenCalled();
  });

  it("refuses an attempt after its results are released", async () => {
    mockPrisma.examAttempt.findFirst.mockResolvedValue(
      attempt({ exam: { schoolId: "school_1", resultsReleased: true } }) as never,
    );
    const { POST } = await import("@/app/api/teacher/exams/[id]/offline-review/route");
    const response = await POST(
      request({
        attemptId: "attempt_1",
        reason: "Reviewed against the signed question set.",
        marks: [
          { questionId: "q1", awardedMarks: 2 },
          { questionId: "q2", awardedMarks: 3 },
        ],
      }),
      { params: Promise.resolve({ id: "exam_1" }) },
    );

    expect(response.status).toBe(409);
    expect(mockPrisma.examAttempt.updateMany).not.toHaveBeenCalled();
  });
});
