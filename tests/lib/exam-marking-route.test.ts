import { ExamAttemptStatus, ExamQuestionType } from "@prisma/client";
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { mockPrisma } from "../setup";

const teacherContext = {
  user: { id: "teacher_1", schoolId: "school_1", role: "TEACHER" },
  teacherProfile: { id: "teacher_profile_1" },
};

vi.mock("@/lib/exams", () => ({
  requireExamTeacherContext: vi.fn(async () => ({ ok: true, context: teacherContext })),
}));

function request(body: unknown) {
  return new NextRequest("http://localhost/api/teacher/exams/exam_1/marking", {
    method: "PATCH",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });
}

describe("PATCH /api/teacher/exams/[id]/marking", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.exam.findFirst.mockResolvedValue({
      id: "exam_1",
      resultsReleased: false,
      classroom: { displayName: "SS 2" },
    });
    mockPrisma.examAnswer.findMany.mockResolvedValue([
      {
        id: "answer_1",
        attemptId: "attempt_1",
        question: { type: ExamQuestionType.ESSAY, marks: 10 },
        attempt: {
          examId: "exam_1",
          status: ExamAttemptStatus.SUBMITTED,
          resultAdoptedAt: null,
          exam: { resultsReleased: false },
        },
      },
    ]);
    mockPrisma.examAnswer.update.mockResolvedValue({});
    mockPrisma.auditLog.create.mockResolvedValue({ id: "audit_1" });
  });

  it("refuses marks while the student's attempt is still in progress", async () => {
    mockPrisma.examAnswer.findMany.mockResolvedValue([
      {
        id: "answer_1",
        attemptId: "attempt_1",
        question: { type: ExamQuestionType.ESSAY, marks: 10 },
        attempt: {
          examId: "exam_1",
          status: ExamAttemptStatus.IN_PROGRESS,
          resultAdoptedAt: null,
          exam: { resultsReleased: false },
        },
      },
    ]);
    const { PATCH } = await import("@/app/api/teacher/exams/[id]/marking/route");

    const response = await PATCH(request({ marks: [{ answerId: "answer_1", awardedMarks: 5 }] }), {
      params: Promise.resolve({ id: "exam_1" }),
    });

    expect(response.status).toBe(409);
    expect(mockPrisma.examAnswer.update).not.toHaveBeenCalled();
    expect(mockPrisma.auditLog.create).not.toHaveBeenCalled();
  });

  it("refuses changes to an already compiled result", async () => {
    mockPrisma.examAnswer.findMany.mockResolvedValue([
      {
        id: "answer_1",
        attemptId: "attempt_1",
        question: { type: ExamQuestionType.ESSAY, marks: 10 },
        attempt: {
          examId: "exam_1",
          status: ExamAttemptStatus.SUBMITTED,
          resultAdoptedAt: new Date(),
          exam: { resultsReleased: false },
        },
      },
    ]);
    const { PATCH } = await import("@/app/api/teacher/exams/[id]/marking/route");

    const response = await PATCH(request({ marks: [{ answerId: "answer_1", awardedMarks: 5 }] }), {
      params: Promise.resolve({ id: "exam_1" }),
    });

    expect(response.status).toBe(409);
    expect(mockPrisma.examAnswer.update).not.toHaveBeenCalled();
  });

  it("refuses changes after exam results have been released", async () => {
    mockPrisma.exam.findFirst.mockResolvedValue({
      id: "exam_1",
      resultsReleased: true,
      classroom: { displayName: "SS 2" },
    });
    const { PATCH } = await import("@/app/api/teacher/exams/[id]/marking/route");

    const response = await PATCH(request({ marks: [{ answerId: "answer_1", awardedMarks: 5 }] }), {
      params: Promise.resolve({ id: "exam_1" }),
    });

    expect(response.status).toBe(409);
    expect(mockPrisma.examAnswer.findMany).not.toHaveBeenCalled();
    expect(mockPrisma.examAnswer.update).not.toHaveBeenCalled();
  });

  it("refuses to mark a changed-paper offline attempt", async () => {
    mockPrisma.examAnswer.findMany.mockResolvedValue([
      {
        id: "answer_1",
        attemptId: "attempt_1",
        question: { type: ExamQuestionType.ESSAY, marks: 10 },
        attempt: {
          examId: "exam_1",
          status: ExamAttemptStatus.SUBMITTED,
          resultAdoptedAt: null,
          metadata: { requiresManualReview: true },
          exam: { resultsReleased: false },
        },
      },
    ]);
    const { PATCH } = await import("@/app/api/teacher/exams/[id]/marking/route");

    const response = await PATCH(request({ marks: [{ answerId: "answer_1", awardedMarks: 5 }] }), {
      params: Promise.resolve({ id: "exam_1" }),
    });
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body.code).toBe("PACKET_REVIEW_REQUIRED");
    expect(mockPrisma.examAnswer.update).not.toHaveBeenCalled();
  });

  it("keeps the submitted fill-in-the-blank manual-marking path available", async () => {
    mockPrisma.examAnswer.findMany.mockResolvedValue([
      {
        id: "answer_1",
        attemptId: "attempt_1",
        question: { type: ExamQuestionType.FILL_BLANK, marks: 10 },
        attempt: {
          examId: "exam_1",
          status: ExamAttemptStatus.SUBMITTED,
          resultAdoptedAt: null,
          exam: { resultsReleased: false },
        },
      },
    ]);
    const { PATCH } = await import("@/app/api/teacher/exams/[id]/marking/route");

    const response = await PATCH(request({ marks: [{ answerId: "answer_1", awardedMarks: 5 }] }), {
      params: Promise.resolve({ id: "exam_1" }),
    });

    expect(response.status).toBe(200);
    expect(mockPrisma.examAnswer.update).toHaveBeenCalledWith({
      where: { id: "answer_1" },
      data: { awardedMarks: 5, isCorrect: false },
    });
    expect(mockPrisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ action: "EXAM_ANSWERS_MARKED" }),
      }),
    );
  });
});
