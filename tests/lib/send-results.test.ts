import { describe, it, expect, vi, beforeEach } from "vitest";
import { mockPrisma } from "../setup";

/**
 * Sending assessment results to parents.
 *
 * `/teacher/send-results` was a complete four-step wizard with no send: it
 * built a recipient list, let the teacher review it, and contained no POST at
 * all. The button led nowhere.
 *
 * Now that it posts, the eligibility filter is the security boundary. The
 * recipient list rendered in the browser is not a control — a teacher must not
 * be able to publish a result for a child they do not teach by supplying the
 * id directly.
 */

const teacherContext = {
  user: { id: "usr_t", schoolId: "school_1", role: "TEACHER" },
  teacherProfile: {
    id: "tp_1",
    displayName: "T One",
    subjectAssignments: [
      {
        id: "asg_1",
        subjectName: "Biology",
        classroom: { id: "cls_1", displayName: "SS 2", level: "SS2" },
      },
    ],
  },
};

vi.mock("@/lib/exams", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/exams")>();
  return { ...actual, getExamTeacherContext: vi.fn(async () => teacherContext) };
});

vi.mock("@/lib/requests", () => ({ getClientIp: vi.fn(() => "127.0.0.1") }));

const createInAppNotification = vi.fn<
  (input: { userId: string; title: string; body: string }) => Promise<{ id: string }>
>(async () => ({ id: "n1" }));
vi.mock("@/lib/notifications", () => ({ createInAppNotification }));

function request(body: unknown) {
  return { json: async () => body } as never;
}

function student(id: string, overrides: Record<string, unknown> = {}) {
  return {
    id,
    displayName: `Student ${id}`,
    userId: `usr_${id}`,
    parentLinks: [{ parentProfile: { userId: `parent_${id}` } }],
    ...overrides,
  };
}

const validBody = {
  assessmentLabel: "Midterm Test",
  subjectName: "Biology",
  results: [{ studentProfileId: "stu_1", score: 38, total: 50 }],
};

describe("POST /api/teacher/send-results", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.auditLog.create.mockResolvedValue({ id: "al" });
  });

  it("notifies the parent AND the student", async () => {
    mockPrisma.studentProfile.findMany.mockResolvedValue([student("stu_1")]);

    const { POST } = await import("@/app/api/teacher/send-results/route");
    const body = await (await POST(request(validBody))).json();

    expect(body.sent).toBe(1);
    expect(body.notifications).toBe(2);
    const recipients = createInAppNotification.mock.calls.map((c) => c[0].userId);
    expect(recipients).toContain("parent_stu_1");
    expect(recipients).toContain("usr_stu_1");
  });

  it("includes the score, total and percentage in the message", async () => {
    mockPrisma.studentProfile.findMany.mockResolvedValue([student("stu_1")]);

    const { POST } = await import("@/app/api/teacher/send-results/route");
    await POST(request(validBody));

    const first = createInAppNotification.mock.calls[0][0];
    expect(first.title).toContain("Biology");
    expect(first.title).toContain("Midterm Test");
    expect(first.body).toContain("38/50");
    expect(first.body).toContain("76%");
  });

  /**
   * The boundary. A student id posted directly must be filtered out by the
   * class query, not trusted because it appeared in the request.
   */
  it("silently skips a student the teacher does not teach", async () => {
    // Only stu_1 comes back from the eligibility query.
    mockPrisma.studentProfile.findMany.mockResolvedValue([student("stu_1")]);

    const { POST } = await import("@/app/api/teacher/send-results/route");
    const body = await (
      await POST(
        request({
          ...validBody,
          results: [
            { studentProfileId: "stu_1", score: 40, total: 50 },
            { studentProfileId: "stu_other_class", score: 10, total: 50 },
          ],
        }),
      )
    ).json();

    expect(body.sent).toBe(1);
    expect(body.skipped).toBe(1);
    const recipients = createInAppNotification.mock.calls.map((c) => c[0].userId);
    expect(recipients).not.toContain("parent_stu_other_class");
  });

  it("constrains the eligibility query to the teacher's classes and school", async () => {
    mockPrisma.studentProfile.findMany.mockResolvedValue([]);

    const { POST } = await import("@/app/api/teacher/send-results/route");
    await POST(request(validBody));

    const where = mockPrisma.studentProfile.findMany.mock.calls[0][0].where;
    expect(where.currentClassId).toEqual({ in: ["cls_1"] });
    expect(where.schoolId).toBe("school_1");
    expect(where.isActive).toBe(true);
  });

  /**
   * A silent drop here means a parent never learns their child's result and
   * nobody finds out for a term.
   */
  it("reports students with no parent and no login rather than dropping them", async () => {
    mockPrisma.studentProfile.findMany.mockResolvedValue([
      student("stu_1", { parentLinks: [], userId: null }),
    ]);

    const { POST } = await import("@/app/api/teacher/send-results/route");
    const body = await (await POST(request(validBody))).json();

    expect(body.withoutParent).toBe(1);
    expect(body.notifications).toBe(0);
    expect(body.message).toMatch(/no linked parent/i);
  });

  it("still notifies the student when no parent is linked", async () => {
    mockPrisma.studentProfile.findMany.mockResolvedValue([student("stu_1", { parentLinks: [] })]);

    const { POST } = await import("@/app/api/teacher/send-results/route");
    const body = await (await POST(request(validBody))).json();

    expect(body.notifications).toBe(1);
    expect(body.withoutParent).toBe(0);
  });

  it("deduplicates when two guardians share one login", async () => {
    mockPrisma.studentProfile.findMany.mockResolvedValue([
      student("stu_1", {
        userId: null,
        parentLinks: [
          { parentProfile: { userId: "shared" } },
          { parentProfile: { userId: "shared" } },
        ],
      }),
    ]);

    const { POST } = await import("@/app/api/teacher/send-results/route");
    const body = await (await POST(request(validBody))).json();

    expect(body.notifications).toBe(1);
  });

  it("rejects a teacher with no class assignments", async () => {
    const { getExamTeacherContext } = await import("@/lib/exams");
    vi.mocked(getExamTeacherContext).mockResolvedValueOnce({
      ...teacherContext,
      teacherProfile: { ...teacherContext.teacherProfile, subjectAssignments: [] },
    } as never);

    const { POST } = await import("@/app/api/teacher/send-results/route");
    const response = await POST(request(validBody));

    expect(response.status).toBe(403);
    expect(createInAppNotification).not.toHaveBeenCalled();
  });

  it("rejects an empty result set", async () => {
    const { POST } = await import("@/app/api/teacher/send-results/route");
    const response = await POST(request({ ...validBody, results: [] }));

    expect(response.status).toBe(400);
  });

  it("writes an audit record", async () => {
    mockPrisma.studentProfile.findMany.mockResolvedValue([student("stu_1")]);

    const { POST } = await import("@/app/api/teacher/send-results/route");
    await POST(request(validBody));

    const data = mockPrisma.auditLog.create.mock.calls[0][0].data;
    expect(data.action).toBe("RESULTS_SENT_TO_PARENTS");
    expect(data.actorUserId).toBe("usr_t");
  });
});
