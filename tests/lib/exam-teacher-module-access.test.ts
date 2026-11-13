import { readFileSync } from "node:fs";
import { join } from "node:path";
import { NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { mockPrisma } from "../setup";

vi.mock("@/lib/module-guard", () => ({
  requireModule: vi.fn(),
}));

describe("teacher exam API entitlement guard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("the project auth audit recognizes the authenticated exam context wrappers", () => {
    const root = process.cwd();
    const audit = readFileSync(join(root, "scripts/audit-project.ts"), "utf8");
    const examGuards = readFileSync(join(root, "lib/exams.ts"), "utf8");
    expect(audit).toMatch(/requireExamTeacherContext/);
    expect(audit).toMatch(/requireStudentExamContext/);
    expect(examGuards).toMatch(/requireExamTeacherContext\(\)[\s\S]*?requireModule\("exams"/);
    expect(examGuards).toMatch(/requireStudentExamContext\(\)[\s\S]*?requireModule\("exams"/);
  });

  it("returns the module denial before querying teacher scope", async () => {
    const response = NextResponse.json({ code: "MODULE_DISABLED" }, { status: 403 });
    const { requireModule } = await import("@/lib/module-guard");
    vi.mocked(requireModule).mockResolvedValue({ ok: false, response });

    const { requireExamTeacherContext } = await import("@/lib/exams");
    const result = await requireExamTeacherContext();

    expect(result).toEqual({ ok: false, response });
    expect(mockPrisma.teacherProfile.findFirst).not.toHaveBeenCalled();
  });

  it("applies the exam entitlement to student exam access before loading the profile", async () => {
    const response = NextResponse.json({ code: "MODULE_DISABLED" }, { status: 403 });
    const { requireModule } = await import("@/lib/module-guard");
    vi.mocked(requireModule).mockResolvedValue({ ok: false, response });

    const { requireStudentExamContext } = await import("@/lib/exams");
    const result = await requireStudentExamContext();

    expect(result).toEqual({ ok: false, response });
    expect(requireModule).toHaveBeenCalledWith("exams", ["STUDENT"]);
    expect(mockPrisma.studentProfile.findFirst).not.toHaveBeenCalled();
  });

  it("loads teacher scope only after the exam entitlement is confirmed", async () => {
    const user = { id: "teacher_user", schoolId: "school_1", role: "TEACHER" as const };
    const { requireModule } = await import("@/lib/module-guard");
    vi.mocked(requireModule).mockResolvedValue({
      ok: true,
      user,
      enabled: new Set(["exams"]),
    } as never);
    mockPrisma.teacherProfile.findFirst.mockResolvedValue({
      id: "teacher_profile",
      displayName: "Teacher One",
      classAssignments: [
        {
          id: "assignment_1",
          subjectName: "Biology",
          classroom: { id: "class_1", displayName: "SS 1A", level: "SS1" },
        },
      ],
    });

    const { requireExamTeacherContext } = await import("@/lib/exams");
    const result = await requireExamTeacherContext();

    expect(requireModule).toHaveBeenCalledWith("exams", expect.any(Array));
    expect(result).toMatchObject({
      ok: true,
      context: {
        user,
        teacherProfile: { id: "teacher_profile", displayName: "Teacher One" },
      },
    });
  });

  it("gates both teacher retake reads and grants before querying exam or student scope", async () => {
    const response = NextResponse.json({ code: "MODULE_DISABLED" }, { status: 403 });
    const { requireModule } = await import("@/lib/module-guard");
    vi.mocked(requireModule).mockResolvedValue({ ok: false, response });
    const { GET, POST } = await import("@/app/api/teacher/exams/[id]/retake/route");
    const context = { params: Promise.resolve({ id: "exam_1" }) };
    const postRequest = {
      json: async () => ({ studentProfileIds: ["student_1"] }),
    } as never;

    expect((await GET({} as never, context)).status).toBe(403);
    expect((await POST(postRequest, context)).status).toBe(403);
    expect(requireModule).toHaveBeenNthCalledWith(1, "exams", expect.any(Array));
    expect(requireModule).toHaveBeenNthCalledWith(2, "exams", expect.any(Array));
    expect(mockPrisma.exam.findFirst).not.toHaveBeenCalled();
    expect(mockPrisma.studentProfile.findMany).not.toHaveBeenCalled();
    expect(mockPrisma.examRetake.upsert).not.toHaveBeenCalled();
  });
});
