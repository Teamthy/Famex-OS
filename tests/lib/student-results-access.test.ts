import { beforeEach, describe, expect, it, vi } from "vitest";
import { mockPrisma } from "../setup";

vi.mock("@/lib/session", () => ({
  requireRole: vi.fn(async () => ({ id: "user_student", schoolId: "school_1", role: "STUDENT" })),
}));

vi.mock("@/lib/module-guard", () => ({
  requireModule: vi.fn(async () => ({
    ok: true,
    user: { id: "user_student", schoolId: "school_1", role: "STUDENT" },
    enabled: new Set(["report_cards"]),
  })),
}));

vi.mock("@/lib/academic-session", () => ({
  resolveCurrentLabels: vi.fn(async () => {
    throw new Error("No current academic session");
  }),
}));

describe("GET /api/student/results", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.studentProfile.findFirst.mockResolvedValue({
      id: "student_profile_1",
      displayName: "Student One",
      studentId: "FAMEX/001",
      currentClassId: "class_1",
      currentClass: { id: "class_1", displayName: "JSS 1A" },
    });
  });

  it("rebuilds running averages from released terms rather than stored unreleased totals", async () => {
    const compiled = (termIndex: number, totalScore: number, subjectCount: number) => ({
      id: `result_${termIndex}`,
      termIndex,
      termLabel: `Term ${termIndex}`,
      classNameSnapshot: "JSS 1A",
      totalScore,
      subjectCount,
      average: Math.round(totalScore / subjectCount),
      grade: "A1",
      position: 1,
      positionNumber: 1,
      cumulativeAverage: 99,
      cumulativeGrade: "A1",
      termsCounted: 3,
      attendancePresent: 50,
      attendanceTotal: 50,
      feeBalance: 0,
      classTeacherRemark: null,
      directorRemark: null,
      nextResumption: null,
      subjects: [],
      status: "INCLUDED",
      compiledAt: new Date("2026-10-01T00:00:00.000Z"),
    });
    mockPrisma.classTermResult.findMany.mockResolvedValue([
      {
        termIndex: 1,
        status: "RELEASED",
        releasedAt: new Date("2026-10-01T00:00:00.000Z"),
        compiledAt: new Date("2026-10-01T00:00:00.000Z"),
      },
      {
        termIndex: 2,
        status: "COMPILED",
        releasedAt: null,
        compiledAt: new Date("2027-01-01T00:00:00.000Z"),
      },
      {
        termIndex: 3,
        status: "RELEASED",
        releasedAt: new Date("2027-04-01T00:00:00.000Z"),
        compiledAt: new Date("2027-04-01T00:00:00.000Z"),
      },
    ]);
    mockPrisma.termResult.findMany.mockResolvedValue([compiled(1, 560, 8), compiled(3, 720, 9)]);
    mockPrisma.schoolClass.findFirst.mockResolvedValue({ stage: "JUNIOR_SECONDARY" });
    mockPrisma.gradeBand.findMany.mockResolvedValue([]);

    const { GET } = await import("@/app/api/student/results/route");
    const response = await GET(
      new Request("https://example.test/api/student/results?sessionLabel=2026%2F2027") as never,
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.terms.map((term: { termIndex: number }) => term.termIndex)).toEqual([1, 3]);
    expect(body.terms[1]).toMatchObject({
      cumulativeAverage: 75,
      cumulativeGrade: "A1",
      termsCounted: 2,
    });
    expect(body.cumulative).toMatchObject({ yearAverage: 75, yearGrade: "A1" });
    expect(mockPrisma.termResult.findMany.mock.calls[0][0].where.termIndex).toEqual({ in: [1, 3] });
  });

  it("returns a contextual conflict when the school has no current session", async () => {
    const { GET } = await import("@/app/api/student/results/route");
    const response = await GET(new Request("https://example.test/api/student/results") as never);

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({
      code: "NO_CURRENT_SESSION",
      error: "No academic session is currently set for this school.",
    });
  });
});
