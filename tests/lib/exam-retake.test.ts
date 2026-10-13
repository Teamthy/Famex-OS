import { describe, it, expect, vi, beforeEach } from "vitest";
import { mockPrisma } from "../setup";

/**
 * Granting retakes.
 *
 * `/api/teacher/exams/[id]/retake` existed for several drops with **zero
 * callers** — the Exam Centre never wired it up, so the retake the student's
 * own error message tells them to ask for could not actually be granted. It is
 * wired now, which makes this the first time the endpoint is reachable in
 * production, and therefore the first time its boundaries matter.
 *
 * A retake is an extra attempt at assessed work. The rules worth pinning:
 *   - the exam must belong to the caller's school
 *   - students must belong to that exam's class
 *   - re-granting is idempotent, and re-arms a used retake
 *   - inactive students are silently skipped, not granted
 */

vi.mock("@/lib/session", () => ({
  requireRole: vi.fn(async () => ({ id: "usr_t", schoolId: "school_1", role: "TEACHER" })),
}));

vi.mock("@/lib/requests", () => ({
  getClientIp: vi.fn(() => "127.0.0.1"),
}));

const params = { params: Promise.resolve({ id: "exam_1" }) };

function request(body: unknown) {
  return { json: async () => body } as never;
}

const exam = {
  id: "exam_1",
  title: "Midterm Test",
  subjectName: "Biology",
  classId: "cls_1",
  teacherProfileId: "tp_1",
  classroom: { displayName: "SS 2" },
};

describe("GET /api/teacher/exams/[id]/retake", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.teacherProfile.findFirst.mockResolvedValue({ id: "tp_1" });
    mockPrisma.exam.findFirst.mockResolvedValue(exam);
  });

  it("scopes the exam lookup to the caller's school", async () => {
    mockPrisma.studentProfile.findMany.mockResolvedValue([]);
    mockPrisma.examRetake.findMany.mockResolvedValue([]);

    const { GET } = await import("@/app/api/teacher/exams/[id]/retake/route");
    await GET({} as never, params);

    // Cross-tenant reads are the thing that must never work.
    expect(mockPrisma.exam.findFirst.mock.calls[0][0].where.schoolId).toBe("school_1");
  });

  it("lists only active students in the exam's own class", async () => {
    mockPrisma.studentProfile.findMany.mockResolvedValue([]);
    mockPrisma.examRetake.findMany.mockResolvedValue([]);

    const { GET } = await import("@/app/api/teacher/exams/[id]/retake/route");
    await GET({} as never, params);

    const where = mockPrisma.studentProfile.findMany.mock.calls[0][0].where;
    expect(where.currentClassId).toBe("cls_1");
    expect(where.isActive).toBe(true);
  });

  it("reports who already has a retake, and whether it was used", async () => {
    mockPrisma.studentProfile.findMany.mockResolvedValue([
      { id: "s1", studentId: "YKC/2026/001", displayName: "Ada" },
      { id: "s2", studentId: "YKC/2026/002", displayName: "Bola" },
      { id: "s3", studentId: "YKC/2026/003", displayName: "Chidi" },
    ]);
    mockPrisma.examRetake.findMany.mockResolvedValue([
      { studentProfileId: "s1", used: false },
      { studentProfileId: "s2", used: true },
    ]);

    const { GET } = await import("@/app/api/teacher/exams/[id]/retake/route");
    const body = await (await GET({} as never, params)).json();

    expect(body.students[0]).toMatchObject({ hasRetake: true, retakeUsed: false });
    expect(body.students[1]).toMatchObject({ hasRetake: true, retakeUsed: true });
    expect(body.students[2]).toMatchObject({ hasRetake: false, retakeUsed: false });
  });

  it("404s for an exam in another school", async () => {
    mockPrisma.exam.findFirst.mockResolvedValue(null);

    const { GET } = await import("@/app/api/teacher/exams/[id]/retake/route");
    const response = await GET({} as never, params);

    expect(response.status).toBe(404);
  });

  it("404s when the caller has no teacher profile", async () => {
    mockPrisma.teacherProfile.findFirst.mockResolvedValue(null);

    const { GET } = await import("@/app/api/teacher/exams/[id]/retake/route");
    const response = await GET({} as never, params);

    expect(response.status).toBe(404);
  });
});

describe("POST /api/teacher/exams/[id]/retake", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.teacherProfile.findFirst.mockResolvedValue({ id: "tp_1" });
    mockPrisma.exam.findFirst.mockResolvedValue(exam);
    mockPrisma.examRetake.upsert.mockResolvedValue({ id: "rt_1" });
    mockPrisma.auditLog.create.mockResolvedValue({ id: "al_1" });
  });

  it("grants a retake to an eligible student", async () => {
    mockPrisma.studentProfile.findMany.mockResolvedValue([{ id: "s1" }]);

    const { POST } = await import("@/app/api/teacher/exams/[id]/retake/route");
    const body = await (await POST(request({ studentProfileIds: ["s1"] }), params)).json();

    expect(body.granted).toBe(1);
    expect(mockPrisma.examRetake.upsert).toHaveBeenCalledTimes(1);
  });

  /**
   * The eligibility filter is the security boundary. A teacher must not be
   * able to hand a retake to a student in a different class by posting their
   * id directly — the roster in the UI is not the control.
   */
  it("silently skips ids that are not in the exam's class", async () => {
    // Only s1 comes back from the eligibility query; s_other does not.
    mockPrisma.studentProfile.findMany.mockResolvedValue([{ id: "s1" }]);

    const { POST } = await import("@/app/api/teacher/exams/[id]/retake/route");
    const body = await (
      await POST(request({ studentProfileIds: ["s1", "s_other_class"] }), params)
    ).json();

    expect(body.granted).toBe(1);
    expect(mockPrisma.examRetake.upsert).toHaveBeenCalledTimes(1);
    expect(mockPrisma.examRetake.upsert.mock.calls[0][0].create.studentProfileId).toBe("s1");
  });

  it("constrains the eligibility query to the class and active students", async () => {
    mockPrisma.studentProfile.findMany.mockResolvedValue([]);

    const { POST } = await import("@/app/api/teacher/exams/[id]/retake/route");
    await POST(request({ studentProfileIds: ["s1"] }), params);

    const where = mockPrisma.studentProfile.findMany.mock.calls[0][0].where;
    expect(where.currentClassId).toBe("cls_1");
    expect(where.isActive).toBe(true);
  });

  it("re-arms a retake that was already used", async () => {
    mockPrisma.studentProfile.findMany.mockResolvedValue([{ id: "s1" }]);

    const { POST } = await import("@/app/api/teacher/exams/[id]/retake/route");
    await POST(request({ studentProfileIds: ["s1"] }), params);

    // `used: false` on update is what makes a second retake possible.
    expect(mockPrisma.examRetake.upsert.mock.calls[0][0].update.used).toBe(false);
  });

  it("is idempotent — upsert, never a duplicate insert", async () => {
    mockPrisma.studentProfile.findMany.mockResolvedValue([{ id: "s1" }]);

    const { POST } = await import("@/app/api/teacher/exams/[id]/retake/route");
    await POST(request({ studentProfileIds: ["s1"] }), params);
    await POST(request({ studentProfileIds: ["s1"] }), params);

    expect(mockPrisma.examRetake.upsert).toHaveBeenCalledTimes(2);
    const where = mockPrisma.examRetake.upsert.mock.calls[0][0].where;
    expect(where.examId_studentProfileId).toEqual({ examId: "exam_1", studentProfileId: "s1" });
  });

  it("grants to a whole class in one call", async () => {
    mockPrisma.studentProfile.findMany.mockResolvedValue([
      { id: "s1" },
      { id: "s2" },
      { id: "s3" },
    ]);

    const { POST } = await import("@/app/api/teacher/exams/[id]/retake/route");
    const body = await (
      await POST(request({ studentProfileIds: ["s1", "s2", "s3"] }), params)
    ).json();

    expect(body.granted).toBe(3);
  });

  it("rejects an empty selection", async () => {
    const { POST } = await import("@/app/api/teacher/exams/[id]/retake/route");
    const response = await POST(request({ studentProfileIds: [] }), params);

    expect(response.status).toBe(400);
    expect(mockPrisma.examRetake.upsert).not.toHaveBeenCalled();
  });

  it("404s for an exam in another school", async () => {
    mockPrisma.exam.findFirst.mockResolvedValue(null);

    const { POST } = await import("@/app/api/teacher/exams/[id]/retake/route");
    const response = await POST(request({ studentProfileIds: ["s1"] }), params);

    expect(response.status).toBe(404);
    expect(mockPrisma.examRetake.upsert).not.toHaveBeenCalled();
  });

  it("writes an audit record naming the exam and the count", async () => {
    mockPrisma.studentProfile.findMany.mockResolvedValue([{ id: "s1" }, { id: "s2" }]);

    const { POST } = await import("@/app/api/teacher/exams/[id]/retake/route");
    await POST(request({ studentProfileIds: ["s1", "s2"] }), params);

    const data = mockPrisma.auditLog.create.mock.calls[0][0].data;
    expect(data.action).toBe("EXAM_RETAKE_GRANTED");
    expect(data.schoolId).toBe("school_1");
    expect(data.actorUserId).toBe("usr_t");
    expect(data.metadata).toMatchObject({ count: 2 });
  });
});
