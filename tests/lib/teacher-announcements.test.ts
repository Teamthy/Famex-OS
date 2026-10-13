import { describe, it, expect, vi, beforeEach } from "vitest";
import { mockPrisma } from "../setup";

/**
 * A teacher posting an announcement to their class.
 *
 * `/api/teacher/announcements` was GET-only, and `/teacher/announcements`
 * rendered a composer with a Send button that had nowhere to send. That was
 * the pattern across six teacher pages: the read half built, the write half
 * missing entirely, so every screen looked finished and none of them worked.
 *
 * The boundary here is which students receive it. A teacher must only be able
 * to address classes they are actually assigned to — the class dropdown in the
 * browser is not a control.
 */

const teacherContext = {
  user: { id: "usr_t", schoolId: "school_1", role: "TEACHER", name: "T One" },
  profile: {
    id: "tp_1",
    displayName: "T One",
    classAssignments: [
      { classId: "cls_1", classroom: { id: "cls_1", displayName: "JSS 1A" } },
      { classId: "cls_2", classroom: { id: "cls_2", displayName: "JSS 1B" } },
    ],
  },
};

vi.mock("@/lib/teacher-context", () => ({
  getTeacherContext: vi.fn(async () => teacherContext),
}));

vi.mock("@/lib/requests", () => ({ getClientIp: vi.fn(() => "127.0.0.1") }));

const createInAppNotification = vi.fn<
  (input: { userId: string; title: string; body: string }) => Promise<{ id: string }>
>(async () => ({ id: "n1" }));
vi.mock("@/lib/notifications", () => ({ createInAppNotification }));

function request(body: unknown) {
  return { json: async () => body } as never;
}

const valid = {
  classId: "cls_1",
  title: "Excursion on Friday",
  body: "Please return the signed slip by Thursday.",
  audience: "BOTH",
};

describe("POST /api/teacher/announcements", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.auditLog.create.mockResolvedValue({ id: "al" });
  });

  it("sends to students and their parents", async () => {
    mockPrisma.studentProfile.findMany.mockResolvedValue([
      {
        id: "stu_1",
        userId: "usr_stu1",
        parentLinks: [{ parentProfile: { userId: "usr_par1" } }],
      },
    ]);

    const { POST } = await import("@/app/api/teacher/announcements/route");
    const body = await (await POST(request(valid))).json();

    const recipients = createInAppNotification.mock.calls.map((c) => c[0].userId);
    expect(recipients).toContain("usr_stu1");
    expect(recipients).toContain("usr_par1");
    expect(body.sent).toBe(2);
  });

  it("can target students only", async () => {
    mockPrisma.studentProfile.findMany.mockResolvedValue([
      {
        id: "stu_1",
        userId: "usr_stu1",
        parentLinks: [{ parentProfile: { userId: "usr_par1" } }],
      },
    ]);

    const { POST } = await import("@/app/api/teacher/announcements/route");
    await POST(request({ ...valid, audience: "STUDENTS" }));

    const recipients = createInAppNotification.mock.calls.map((c) => c[0].userId);
    expect(recipients).toEqual(["usr_stu1"]);
  });

  it("can target parents only", async () => {
    mockPrisma.studentProfile.findMany.mockResolvedValue([
      {
        id: "stu_1",
        userId: "usr_stu1",
        parentLinks: [{ parentProfile: { userId: "usr_par1" } }],
      },
    ]);

    const { POST } = await import("@/app/api/teacher/announcements/route");
    await POST(request({ ...valid, audience: "PARENTS" }));

    const recipients = createInAppNotification.mock.calls.map((c) => c[0].userId);
    expect(recipients).toEqual(["usr_par1"]);
  });

  /**
   * The boundary. Posting a classId the teacher does not teach must be
   * refused outright rather than quietly delivering to that class.
   */
  it("REFUSES a class the teacher is not assigned to", async () => {
    const { POST } = await import("@/app/api/teacher/announcements/route");
    const response = await POST(request({ ...valid, classId: "cls_someone_else" }));

    expect(response.status).toBe(403);
    expect(createInAppNotification).not.toHaveBeenCalled();
  });

  it("scopes the recipient query to the class and to active students", async () => {
    mockPrisma.studentProfile.findMany.mockResolvedValue([]);

    const { POST } = await import("@/app/api/teacher/announcements/route");
    await POST(request(valid));

    const where = mockPrisma.studentProfile.findMany.mock.calls[0][0].where;
    expect(where.currentClassId).toBe("cls_1");
    expect(where.schoolId).toBe("school_1");
    expect(where.isActive).toBe(true);
  });

  it("deduplicates a parent with two children in the class", async () => {
    mockPrisma.studentProfile.findMany.mockResolvedValue([
      { id: "stu_1", userId: null, parentLinks: [{ parentProfile: { userId: "shared" } }] },
      { id: "stu_2", userId: null, parentLinks: [{ parentProfile: { userId: "shared" } }] },
    ]);

    const { POST } = await import("@/app/api/teacher/announcements/route");
    const body = await (await POST(request({ ...valid, audience: "PARENTS" }))).json();

    // One message, not two — siblings must not double-notify a parent.
    expect(body.sent).toBe(1);
  });

  it("reports an empty class rather than claiming success", async () => {
    mockPrisma.studentProfile.findMany.mockResolvedValue([]);

    const { POST } = await import("@/app/api/teacher/announcements/route");
    const body = await (await POST(request(valid))).json();

    expect(body.sent).toBe(0);
    expect(body.message).toMatch(/nobody|no one|0/i);
  });

  it("rejects an empty title or body", async () => {
    const { POST } = await import("@/app/api/teacher/announcements/route");
    expect((await POST(request({ ...valid, title: "" }))).status).toBe(400);
    expect((await POST(request({ ...valid, body: "  " }))).status).toBe(400);
  });

  it("names the teacher in the announcement body", async () => {
    mockPrisma.studentProfile.findMany.mockResolvedValue([
      { id: "stu_1", userId: "usr_stu1", parentLinks: [] },
    ]);

    const { POST } = await import("@/app/api/teacher/announcements/route");
    await POST(request(valid));

    // A notice with no sender is unactionable — a parent cannot tell who to
    // reply to.
    expect(createInAppNotification.mock.calls[0][0].body).toContain("T One");
  });

  it("writes an audit record", async () => {
    mockPrisma.studentProfile.findMany.mockResolvedValue([
      { id: "stu_1", userId: "usr_stu1", parentLinks: [] },
    ]);

    const { POST } = await import("@/app/api/teacher/announcements/route");
    await POST(request(valid));

    const data = mockPrisma.auditLog.create.mock.calls[0][0].data;
    expect(data.action).toBe("TEACHER_ANNOUNCEMENT_SENT");
    expect(data.actorUserId).toBe("usr_t");
  });
});
