import { FeeInvoiceStatus } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { mockPrisma } from "../setup";

const studentContext = {
  user: { id: "usr_student_1", schoolId: "school_1", role: "STUDENT" },
  studentProfile: {
    id: "student_1",
    displayName: "Student One",
    studentId: "FAMEX/001",
    currentClassId: "class_1",
  },
};

vi.mock("@/lib/exams", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/exams")>();
  return {
    ...actual,
    requireStudentExamContext: vi.fn(async () => ({ ok: true, context: studentContext })),
  };
});

vi.mock("@/lib/fee-lock", () => ({
  getStudentFeeLock: vi.fn(),
}));

vi.mock("@/lib/subjects", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/subjects")>();
  return {
    ...actual,
    studentSubjectIds: vi.fn(),
  };
});

const examForPackage = {
  id: "exam_1",
  schoolId: "school_1",
  classId: "class_1",
  title: "Biology Test",
  subjectName: "Biology",
  subjectId: null,
  status: "PUBLISHED",
  durationMinutes: 40,
  theoryMinutes: 0,
  passMark: 40,
  instructions: null,
  scheduledFor: null,
  availableUntil: null,
  sessionLabel: "2026/2027",
  termIndex: 1,
  createdAt: new Date("2026-09-01T00:00:00.000Z"),
  questions: [
    {
      id: "question_1",
      type: "MCQ",
      questionText: "Which is a mammal?",
      options: [{ key: "A", text: "Whale" }],
      correctKey: "A",
      correctText: null,
      marks: 1,
      sortOrder: 1,
    },
  ],
  attempts: [],
  retakes: [],
};

const routeContext = { params: Promise.resolve({ id: "exam_1" }) };

describe("student exam access is assignment- and fee-lock-aware", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    mockPrisma.exam.findMany.mockResolvedValue([]);
    mockPrisma.exam.findFirst.mockResolvedValue(examForPackage);
    mockPrisma.examAttempt.create.mockResolvedValue({ id: "attempt_1" });
    mockPrisma.examAnswer.findMany.mockResolvedValue([]);
    const { getStudentFeeLock } = await import("@/lib/fee-lock");
    const { studentSubjectIds } = await import("@/lib/subjects");
    vi.mocked(getStudentFeeLock).mockResolvedValue(null);
    vi.mocked(studentSubjectIds).mockResolvedValue([]);
  });

  it("shows only legacy free-text exams when a student has no subject enrolments", async () => {
    const { GET } = await import("@/app/api/student/exams/route");
    const response = await GET();

    expect(response.status).toBe(200);
    const where = mockPrisma.exam.findMany.mock.calls[0][0].where;
    expect(where.subjectId).toBeNull();
    expect(where.OR).toBeUndefined();
  });

  it("limits subject-linked exams to the student's enrolled subjects", async () => {
    const { studentSubjectIds } = await import("@/lib/subjects");
    vi.mocked(studentSubjectIds).mockResolvedValue(["subject_biology"]);

    const { GET } = await import("@/app/api/student/exams/route");
    await GET();

    const where = mockPrisma.exam.findMany.mock.calls[0][0].where;
    expect(where.OR).toEqual([{ subjectId: null }, { subjectId: { in: ["subject_biology"] } }]);
  });

  it("rejects a direct online start for a subject the student is not enrolled in", async () => {
    mockPrisma.exam.findFirst.mockResolvedValue({
      ...examForPackage,
      subjectId: "subject_chemistry",
    });
    mockPrisma.examAttempt.findFirst.mockResolvedValue(null);

    const { POST } = await import("@/app/api/student/exams/[id]/attempt/route");
    const response = await POST({} as never, routeContext);
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body).toMatchObject({ code: "NOT_ENROLLED" });
    expect(mockPrisma.exam.findFirst.mock.calls[0][0].where).toMatchObject({
      schoolId: "school_1",
      classId: "class_1",
    });
    expect(mockPrisma.examAttempt.create).not.toHaveBeenCalled();
  });

  it("rejects a first-time offline replay for a subject the student is not enrolled in", async () => {
    mockPrisma.exam.findFirst.mockResolvedValue({
      ...examForPackage,
      subjectId: "subject_chemistry",
    });
    mockPrisma.examAttempt.findFirst.mockResolvedValue(null);
    mockPrisma.examAttempt.findMany.mockResolvedValue([]);
    const payload = {
      clientAttemptId: "client_attempt_123",
      startedAt: new Date().toISOString(),
      durationMinutes: 40,
      answers: [],
      finalize: false,
    };

    const { POST } = await import("@/app/api/student/exams/[id]/attempt/offline-replay/route");
    const response = await POST(
      new Request("https://example.test/api/student/exams/exam_1/attempt/offline-replay", {
        method: "POST",
        body: JSON.stringify(payload),
        headers: { "content-type": "application/json" },
      }) as never,
      routeContext,
    );
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body).toMatchObject({ code: "NOT_ENROLLED" });
    expect(mockPrisma.examAttempt.create).not.toHaveBeenCalled();
  });

  it("does not let an unsigned finalize flag bypass a closed-exam gate", async () => {
    mockPrisma.exam.findFirst.mockResolvedValue({
      ...examForPackage,
      status: "DRAFT",
    });
    mockPrisma.examAttempt.findFirst.mockResolvedValue(null);
    mockPrisma.examAttempt.findMany.mockResolvedValue([]);
    const now = new Date().toISOString();
    const payload = {
      clientAttemptId: "client_attempt_123",
      startedAt: now,
      submittedAt: now,
      durationMinutes: 40,
      answers: [],
      finalize: true,
      manifest: {
        examId: "exam_1",
        packetId: "exam_1-fingerprint",
        fingerprint: "fingerprint",
        questionCount: 1,
        totalMarks: 1,
        durationMinutes: 40,
        sessionLabel: "2026/2027",
        termIndex: 1,
        downloadedAt: now,
      },
      signature: "forged",
    };

    const { POST } = await import("@/app/api/student/exams/[id]/attempt/offline-replay/route");
    const response = await POST(
      new Request("https://example.test/api/student/exams/exam_1/attempt/offline-replay", {
        method: "POST",
        body: JSON.stringify(payload),
        headers: { "content-type": "application/json" },
      }) as never,
      routeContext,
    );
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body).toMatchObject({ code: "NOT_OPEN" });
    expect(mockPrisma.examAttempt.create).not.toHaveBeenCalled();
  });

  it("shows released offline scores against the signed packet maximum after the paper changes", async () => {
    mockPrisma.exam.findMany.mockResolvedValue([
      {
        ...examForPackage,
        teacherProfile: { displayName: "Teacher One" },
        questions: [{ marks: 20, type: "MCQ" }],
        resultsReleased: true,
        attempts: [
          {
            id: "attempt_1",
            status: "GRADED",
            attemptNumber: 1,
            totalScore: 6,
            submittedAt: new Date("2026-10-01T09:00:00.000Z"),
            deliveryMode: "OFFLINE",
            offlineStartedAt: new Date("2026-10-01T08:00:00.000Z"),
            metadata: {
              offlineQuestionSnapshot: {
                manifest: {
                  examId: "exam_1",
                  packetId: "packet_1",
                  fingerprint: "fingerprint",
                  questionCount: 1,
                  totalMarks: 10,
                  durationMinutes: 40,
                  sessionLabel: "2026/2027",
                  termIndex: 1,
                  downloadedAt: "2026-10-01T08:00:00.000Z",
                },
                signature: "signed",
                questions: [
                  {
                    id: "question_1",
                    type: "MCQ",
                    questionText: "Original question",
                    options: null,
                    correctKey: "A",
                    correctText: null,
                    marks: 10,
                    sortOrder: 1,
                  },
                ],
              },
            },
          },
        ],
        retakes: [],
      },
    ]);

    const { GET } = await import("@/app/api/student/exams/route");
    const response = await GET();
    const body = await response.json();

    expect(body.exams[0].attempt).toMatchObject({
      totalScore: 6,
      maxMarks: 10,
      percent: 60,
      scoreVisible: true,
    });
  });

  it("keeps an in-progress online sitting resumable when a fee lock appears", async () => {
    const { getStudentFeeLock } = await import("@/lib/fee-lock");
    vi.mocked(getStudentFeeLock).mockResolvedValue({
      blocked: true,
      totalOutstanding: 12_500,
      invoiceCount: 1,
      invoices: [
        {
          id: "invoice_1",
          invoiceNumber: "INV-001",
          title: "Term fees",
          termLabel: "First Term",
          balanceDue: 12_500,
          status: FeeInvoiceStatus.UNPAID,
          dueDate: null,
        },
      ],
      message: "School fees outstanding.",
    });
    mockPrisma.exam.findMany.mockResolvedValue([
      {
        ...examForPackage,
        teacherProfile: { displayName: "Teacher One" },
        attempts: [
          {
            id: "attempt_1",
            status: "IN_PROGRESS",
            attemptNumber: 1,
            totalScore: 0,
            submittedAt: null,
            deliveryMode: "ONLINE",
            offlineStartedAt: null,
          },
        ],
        retakes: [],
      },
    ]);

    const { GET } = await import("@/app/api/student/exams/route");
    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.exams[0]).toMatchObject({ canStart: false, canResume: true, feeLocked: true });
  });

  it("persists the signed question snapshot on the server attempt before returning the packet", async () => {
    const previousSecret = process.env.AUTH_SECRET;
    process.env.AUTH_SECRET = "test-secret-value-that-is-long-enough-to-sign";
    mockPrisma.examAttempt.findUnique.mockResolvedValue({ metadata: null });
    mockPrisma.examAttempt.update.mockResolvedValue({ id: "attempt_1" });
    try {
      const { GET } = await import("@/app/api/student/exams/[id]/offline-package/route");
      const response = await GET({} as never, routeContext);
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.questions[0]).not.toHaveProperty("correctKey");
      const write = mockPrisma.examAttempt.update.mock.calls[0][0];
      expect(write.where.id).toBe("attempt_1");
      expect(write.data.metadata.offlineQuestionSnapshot).toMatchObject({
        manifest: body.manifest,
        signature: body.signature,
        questions: [
          expect.objectContaining({
            id: "question_1",
            correctKey: "A",
            questionText: "Which is a mammal?",
          }),
        ],
      });
    } finally {
      if (previousSecret === undefined) delete process.env.AUTH_SECRET;
      else process.env.AUTH_SECRET = previousSecret;
    }
  });

  it("gives an offline retake started after the window close the full exam duration", async () => {
    const previousSecret = process.env.AUTH_SECRET;
    process.env.AUTH_SECRET = "test-secret-value-that-is-long-enough-to-sign";
    const closesAt = new Date(Date.now() - 60 * 60_000);
    mockPrisma.exam.findFirst.mockResolvedValue({
      ...examForPackage,
      availableUntil: closesAt,
      attempts: [{ id: "attempt_previous", status: "GRADED", attemptNumber: 1 }],
      retakes: [{ used: false }],
    });
    mockPrisma.examRetake.findUnique.mockResolvedValue({ id: "retake_1", used: false });
    mockPrisma.examAttempt.findUnique.mockResolvedValue({ metadata: null });
    mockPrisma.examAttempt.update.mockResolvedValue({ id: "attempt_2" });
    try {
      const { GET } = await import("@/app/api/student/exams/[id]/offline-package/route");
      const response = await GET({} as never, routeContext);

      expect(response.status).toBe(200);
      const created = mockPrisma.examAttempt.create.mock.calls[0][0].data;
      expect(created.deadlineAt.getTime()).toBeGreaterThan(Date.now() + 39 * 60_000);
      expect(created.deadlineAt.getTime()).toBeLessThan(Date.now() + 41 * 60_000);
    } finally {
      if (previousSecret === undefined) delete process.env.AUTH_SECRET;
      else process.env.AUTH_SECRET = previousSecret;
    }
  });

  it("refuses an offline package for a new attempt under a fee lock before creating an attempt", async () => {
    const feeLock = {
      blocked: true as const,
      totalOutstanding: 12_500,
      invoiceCount: 1,
      invoices: [
        {
          id: "invoice_1",
          invoiceNumber: "INV-001",
          title: "Term fees",
          termLabel: "First Term",
          balanceDue: 12_500,
          status: FeeInvoiceStatus.UNPAID,
          dueDate: null,
        },
      ],
      message: "School fees outstanding. Settle with the bursary before starting CBT exams.",
    };
    const { getStudentFeeLock } = await import("@/lib/fee-lock");
    vi.mocked(getStudentFeeLock).mockResolvedValue(feeLock);

    const { GET } = await import("@/app/api/student/exams/[id]/offline-package/route");
    const response = await GET({} as never, routeContext);
    const body = await response.json();

    expect(response.status).toBe(402);
    expect(body).toMatchObject({ code: "FEE_LOCK", error: feeLock.message });
    expect(getStudentFeeLock).toHaveBeenCalledWith("school_1", "student_1");
    expect(mockPrisma.examAttempt.create).not.toHaveBeenCalled();
  });
});
