import { describe, it, expect, vi, beforeEach } from "vitest";
import { mockPrisma } from "../setup";

/**
 * The form teacher's report-card remark.
 *
 * The page's "Save Remark" handler was `toast("Remark added for …")` — no
 * request at all. A form teacher could write a remark for every child, get a
 * success message every time, and none of it reached a report card.
 *
 * Two rules matter here beyond the usual tenancy check: only a FORM teacher
 * may write this field, and a released card must not be edited underneath the
 * parents already reading it.
 */

const formTeacher = {
  user: { id: "usr_t", schoolId: "school_1", role: "TEACHER", name: "T One" },
  profile: { id: "tp_1", displayName: "T One", classAssignments: [] },
  formClassId: "cls_1",
  formClassName: "JSS 1A",
  isFormTeacher: true,
  subjectAssignments: [],
};

const getTeacherContext = vi.fn(async () => formTeacher as never);
vi.mock("@/lib/teacher-context", () => ({ getTeacherContext }));
vi.mock("@/lib/requests", () => ({ getClientIp: vi.fn(() => "127.0.0.1") }));
vi.mock("@/lib/module-guard", () => ({
  requireModule: vi.fn(async () => ({ ok: true, user: formTeacher.user, enabled: new Set() })),
}));

function request(body: unknown) {
  return { json: async () => body } as never;
}

const valid = { reportCardId: "rc_1", remark: "A hardworking term. Well done." };

function card(overrides: Record<string, unknown> = {}) {
  return {
    id: "rc_1",
    status: "DRAFT",
    releasedAt: null,
    studentProfile: { displayName: "Ada" },
    ...overrides,
  };
}

describe("GET /api/teacher/class/report-cards", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getTeacherContext.mockResolvedValue(formTeacher as never);
    mockPrisma.reportCard.findMany.mockResolvedValue([
      {
        id: "rc_1",
        verificationCode: "verify_1",
        sessionLabel: "2025/2026",
        termLabel: "First Term",
        classNameSnapshot: "JSS 1A",
        status: "RELEASED",
        overallAverage: 75,
        overallGrade: "A1",
        classTeacherRemark: "Excellent effort.",
        attendancePresent: 48,
        attendanceTotal: 50,
        studentProfile: { studentId: "STU1", displayName: "Ada" },
      },
    ]);
  });

  it("reads stored report cards only for the form teacher's current class", async () => {
    const { GET } = await import("@/app/api/teacher/class/report-cards/route");
    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.reports[0]).toMatchObject({
      classNameSnapshot: "JSS 1A",
      status: "RELEASED",
      overallAverage: 75,
      studentName: "Ada",
    });
    expect(mockPrisma.reportCard.findMany.mock.calls[0][0].where).toMatchObject({
      schoolId: "school_1",
      studentProfile: { currentClassId: "cls_1" },
    });
  });

  it("refuses a teacher without a form-class assignment", async () => {
    getTeacherContext.mockResolvedValue({
      ...formTeacher,
      formClassId: null,
      formClassName: null,
      isFormTeacher: false,
    } as never);
    const { GET } = await import("@/app/api/teacher/class/report-cards/route");

    expect((await GET()).status).toBe(403);
    expect(mockPrisma.reportCard.findMany).not.toHaveBeenCalled();
  });
});

describe("PATCH /api/teacher/class/report-cards", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getTeacherContext.mockResolvedValue(formTeacher as never);
    mockPrisma.reportCard.updateMany.mockResolvedValue({ count: 1 });
    mockPrisma.auditLog.create.mockResolvedValue({ id: "al" });
  });

  it("saves the remark", async () => {
    mockPrisma.reportCard.findFirst.mockResolvedValue(card());

    const { PATCH } = await import("@/app/api/teacher/class/report-cards/route");
    const response = await PATCH(request(valid));

    expect(response.status).toBe(200);
    expect(mockPrisma.reportCard.updateMany.mock.calls[0][0].data.classTeacherRemark).toBe(
      valid.remark,
    );
  });

  it("scopes the card to the teacher's own form class and school", async () => {
    mockPrisma.reportCard.findFirst.mockResolvedValue(card());

    const { PATCH } = await import("@/app/api/teacher/class/report-cards/route");
    await PATCH(request(valid));

    const where = mockPrisma.reportCard.findFirst.mock.calls[0][0].where;
    expect(where.schoolId).toBe("school_1");
    expect(where.studentProfile.currentClassId).toBe("cls_1");
  });

  it("404s for a card outside the teacher's form class", async () => {
    mockPrisma.reportCard.findFirst.mockResolvedValue(null);

    const { PATCH } = await import("@/app/api/teacher/class/report-cards/route");
    const response = await PATCH(request(valid));

    expect(response.status).toBe(404);
    expect(mockPrisma.reportCard.updateMany).not.toHaveBeenCalled();
  });

  /**
   * A subject teacher comments per subject in the gradebook. The class
   * teacher's remark is a different, single field and belongs to one person.
   */
  it("refuses a teacher who is not a form teacher", async () => {
    getTeacherContext.mockResolvedValue({
      ...formTeacher,
      formClassId: null,
      isFormTeacher: false,
    } as never);

    const { PATCH } = await import("@/app/api/teacher/class/report-cards/route");
    const response = await PATCH(request(valid));

    expect(response.status).toBe(403);
    expect(mockPrisma.reportCard.updateMany).not.toHaveBeenCalled();
  });

  /**
   * Parents may already have read a released card. Silently rewriting it
   * changes a document they have seen, with no indication it moved.
   */
  it("refuses to edit an already-released card", async () => {
    mockPrisma.reportCard.findFirst.mockResolvedValue(card({ releasedAt: new Date() }));

    const { PATCH } = await import("@/app/api/teacher/class/report-cards/route");
    const response = await PATCH(request(valid));
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body.code).toBe("ALREADY_RELEASED");
    expect(mockPrisma.reportCard.updateMany).not.toHaveBeenCalled();
  });

  it("refuses the save if the release wins the compare-and-set race", async () => {
    mockPrisma.reportCard.findFirst.mockResolvedValue(card());
    mockPrisma.reportCard.updateMany.mockResolvedValue({ count: 0 });

    const { PATCH } = await import("@/app/api/teacher/class/report-cards/route");
    const response = await PATCH(request(valid));
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body.code).toBe("ALREADY_RELEASED");
    expect(mockPrisma.auditLog.create).not.toHaveBeenCalled();
  });

  it("rejects an empty remark", async () => {
    const { PATCH } = await import("@/app/api/teacher/class/report-cards/route");
    expect((await PATCH(request({ ...valid, remark: " " }))).status).toBe(400);
  });

  it("rejects an unauthenticated caller", async () => {
    getTeacherContext.mockResolvedValue(null as never);

    const { PATCH } = await import("@/app/api/teacher/class/report-cards/route");
    expect((await PATCH(request(valid))).status).toBe(401);
  });

  it("writes an audit record", async () => {
    mockPrisma.reportCard.findFirst.mockResolvedValue(card());

    const { PATCH } = await import("@/app/api/teacher/class/report-cards/route");
    await PATCH(request(valid));

    expect(mockPrisma.auditLog.create.mock.calls[0][0].data.action).toBe(
      "REPORT_CARD_REMARK_SAVED",
    );
  });
});
