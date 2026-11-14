import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { mockPrisma } from "../setup";

const { requireModuleMock, requireCurrentLabelsMock } = vi.hoisted(() => ({
  requireModuleMock: vi.fn(),
  requireCurrentLabelsMock: vi.fn(),
}));

vi.mock("@/lib/module-guard", () => ({ requireModule: requireModuleMock }));
vi.mock("@/lib/academic-session", () => ({
  NoCurrentTermError: class NoCurrentTermError extends Error {},
  requireCurrentLabels: requireCurrentLabelsMock,
}));

const adminUser = { id: "admin_1", schoolId: "school_1", role: "ADMIN" };
const termResult = {
  studentProfileId: "student_1",
  status: "INCLUDED",
  totalScore: 78,
  average: 78,
  grade: "A1",
  position: "1st of 1",
  positionNumber: 1,
  classTeacherRemark: "Good work.",
  directorRemark: "Approved.",
  nextResumption: null,
  attendancePresent: 9,
  attendanceTotal: 10,
  feeBalance: 2500,
  subjects: [
    {
      subjectName: "Biology",
      status: "INCLUDED",
      ca1: 18,
      ca2: 17,
      midterm: 15,
      assignment: 14,
      exam: 14,
      total: 78,
      grade: "A1",
      sortOrder: 1,
    },
  ],
};

async function postGenerate() {
  const { POST } = await import("@/app/api/admin/report-cards/generate/route");
  return POST(
    new NextRequest("https://example.test/api/admin/report-cards/generate", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ classId: "class_1" }),
    }),
  );
}

describe("admin report-card generation respects release races", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireModuleMock.mockResolvedValue({ ok: true, user: adminUser });
    requireCurrentLabelsMock.mockResolvedValue({
      sessionLabel: "2026/2027",
      termLabel: "First Term",
      termId: "term_1",
      sessionId: "session_1",
      termIndex: 1,
    });
    mockPrisma.term.findFirst.mockResolvedValue({
      startsOn: new Date("2026-09-01T00:00:00.000Z"),
      endsOn: new Date("2026-12-31T23:59:59.999Z"),
    } as never);
    mockPrisma.schoolClass.findFirst.mockResolvedValue({
      id: "class_1",
      displayName: "JSS1A",
    } as never);
    mockPrisma.termResult.findMany.mockResolvedValue([termResult] as never);
    mockPrisma.classTermResult.findUnique.mockResolvedValue({
      status: "COMPILED",
      compiledAt: new Date("2026-12-01T00:00:00.000Z"),
      releasedAt: null,
    } as never);
    mockPrisma.subjectGradebook.findMany.mockResolvedValue([]);
    mockPrisma.studentProfile.findMany.mockResolvedValue([
      {
        id: "student_1",
        studentId: "FAMEX/001",
        displayName: "Student One",
        parentLinks: [],
      },
    ] as never);
    mockPrisma.attendanceEntry.findMany.mockResolvedValue([]);
    mockPrisma.feeInvoice.groupBy.mockResolvedValue([]);
    mockPrisma.auditLog.create.mockResolvedValue({} as never);
    mockPrisma.reportCardSubject.deleteMany.mockResolvedValue({ count: 1 });
    mockPrisma.reportCard.update.mockResolvedValue({} as never);
    mockPrisma.reportCard.updateMany.mockResolvedValue({ count: 0 });
  });

  it("does not claim or rewrite a card already released before its transaction read", async () => {
    mockPrisma.reportCard.findFirst.mockResolvedValue({
      id: "report_1",
      status: "RELEASED",
      reportNumber: "RC/2026-2027/T1/FAMEX-001",
    } as never);

    const response = await postGenerate();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({ generated: 0, skippedReleased: 1 });
    expect(mockPrisma.reportCard.updateMany).not.toHaveBeenCalled();
    expect(mockPrisma.reportCardSubject.deleteMany).not.toHaveBeenCalled();
    expect(mockPrisma.reportCardSubject.createMany).not.toHaveBeenCalled();
    expect(mockPrisma.reportCard.update).not.toHaveBeenCalled();
  });

  it("uses a conditional draft claim before deleting subjects when release wins concurrently", async () => {
    mockPrisma.reportCard.findFirst.mockResolvedValue({
      id: "report_1",
      status: "DRAFT",
      reportNumber: "RC/2026-2027/T1/FAMEX-001",
    } as never);
    mockPrisma.reportCard.updateMany.mockResolvedValue({ count: 0 });

    const response = await postGenerate();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({ generated: 0, skippedReleased: 1 });
    expect(mockPrisma.reportCard.updateMany).toHaveBeenCalledWith({
      where: { id: "report_1", status: "DRAFT" },
      data: { status: "DRAFT" },
    });
    expect(mockPrisma.reportCardSubject.deleteMany).not.toHaveBeenCalled();
    expect(mockPrisma.reportCardSubject.createMany).not.toHaveBeenCalled();
    expect(mockPrisma.reportCard.update).not.toHaveBeenCalled();
  });

  it("replaces a draft snapshot only after winning the draft claim", async () => {
    mockPrisma.reportCard.findFirst.mockResolvedValue({
      id: "report_1",
      status: "DRAFT",
      reportNumber: "RC/2026-2027/T1/FAMEX-001",
    } as never);
    mockPrisma.reportCard.updateMany.mockResolvedValue({ count: 1 });

    const response = await postGenerate();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({ generated: 1, skippedReleased: 0 });
    expect(mockPrisma.reportCardSubject.deleteMany).toHaveBeenCalledWith({
      where: { reportCardId: "report_1" },
    });
    expect(mockPrisma.reportCard.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "report_1" } }),
    );
  });
});
