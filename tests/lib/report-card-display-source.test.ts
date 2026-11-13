import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { mockPrisma } from "../setup";

const { requireModuleMock } = vi.hoisted(() => ({ requireModuleMock: vi.fn() }));

vi.mock("@/lib/module-guard", () => ({ requireModule: requireModuleMock }));

const studentUser = { id: "student_user_1", schoolId: "school_1", role: "STUDENT" };
const parentUser = { id: "parent_user_1", schoolId: "school_1", role: "PARENT" };
const storedReport = {
  id: "report_1",
  reportNumber: "RC-2026-T1-001",
  verificationCode: "verify_opaque_1",
  sessionLabel: "2026/2027",
  termLabel: "First Term",
  status: "RELEASED",
  overallAverage: 76.5,
  overallGrade: "A",
  generatedAt: new Date("2026-10-01T09:00:00.000Z"),
  releasedAt: new Date("2026-10-02T09:00:00.000Z"),
  classNameSnapshot: "JSS 2A",
  overallTotal: 612,
  classPosition: 3,
  attendancePresent: 48,
  attendanceTotal: 50,
  classTeacherRemark: "Consistent effort.",
  directorRemark: "Keep progressing.",
  nextResumption: new Date("2027-01-10T00:00:00.000Z"),
  feeBalance: 2500,
  subjects: [
    {
      id: "line_1",
      subjectName: "Mathematics",
      ca1: 18,
      ca2: 17,
      midterm: 18,
      assignment: 19,
      exam: 80,
      total: 152,
      grade: "A",
      position: 2,
      teacherComment: "Excellent.",
      sortOrder: 1,
    },
  ],
};

describe("student and parent report cards read released stored snapshots", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireModuleMock.mockImplementation(async (_module: string, roles: string[]) => ({
      ok: true,
      user: roles.includes("PARENT") ? parentUser : studentUser,
    }));
  });

  it("returns the student's persisted card data and queries only RELEASED cards", async () => {
    mockPrisma.studentProfile.findFirst.mockResolvedValue({
      id: "student_profile_1",
      studentId: "FAMEX/001",
      displayName: "Student One",
      currentClass: { displayName: "SS1B" },
      reportCards: [storedReport],
    } as never);
    const { GET } = await import("@/app/api/student/report-cards/route");

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.student.className).toBe("SS1B");
    expect(body.reports).toHaveLength(1);
    expect(body.reports[0]).toMatchObject({
      id: "report_1",
      status: "RELEASED",
      verificationCode: "verify_opaque_1",
      classNameSnapshot: "JSS 2A",
      overallAverage: 76.5,
      overallTotal: 612,
      classPosition: 3,
      subjects: [{ subjectName: "Mathematics", total: 152, grade: "A" }],
    });
    expect(mockPrisma.studentProfile.findFirst.mock.calls[0][0].where).toMatchObject({
      schoolId: "school_1",
      userId: "student_user_1",
    });
    expect(mockPrisma.studentProfile.findFirst.mock.calls[0][0].select.reportCards.where).toEqual({
      status: "RELEASED",
    });
  });

  it("ignores a parent-supplied unlinked child id and returns only a linked child's released snapshot", async () => {
    mockPrisma.parentProfile.findFirst.mockResolvedValue({
      id: "parent_profile_1",
      displayName: "Parent One",
      studentLinks: [
        {
          isPrimary: true,
          relationship: "Guardian",
          studentProfile: {
            id: "linked_student_1",
            studentId: "FAMEX/001",
            displayName: "Student One",
            currentClass: { displayName: "SS1B" },
            reportCards: [storedReport],
          },
        },
      ],
    } as never);
    const { GET } = await import("@/app/api/parent/report-cards/route");
    const request = new NextRequest(
      "https://example.test/api/parent/report-cards?studentId=not-linked-student",
    );

    const response = await GET(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.selectedChild.id).toBe("linked_student_1");
    expect(body.reports).toHaveLength(1);
    expect(body.reports[0]).toMatchObject({
      status: "RELEASED",
      classNameSnapshot: "JSS 2A",
      overallTotal: 612,
      classPosition: 3,
    });
    expect(mockPrisma.parentProfile.findFirst.mock.calls[0][0].where).toMatchObject({
      schoolId: "school_1",
      userId: "parent_user_1",
    });
    expect(
      mockPrisma.parentProfile.findFirst.mock.calls[0][0].select.studentLinks.select.studentProfile
        .select.reportCards.where,
    ).toEqual({ status: "RELEASED" });
  });
});
