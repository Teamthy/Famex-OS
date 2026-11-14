import { beforeEach, describe, expect, it, vi } from "vitest";
import { mockPrisma } from "../setup";
import { compileClassTermResults } from "@/lib/results";

const compileInput = {
  schoolId: "school_1",
  classId: "class_1",
  sessionLabel: "2026/2027",
  termIndex: 1,
  termLabel: "First Term",
  actorUserId: "admin_1",
  recompile: true,
};

describe("compileClassTermResults release lock", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.schoolClass.findFirst.mockResolvedValue({
      id: "class_1",
      displayName: "JSS 1A",
      stage: "JUNIOR_SECONDARY",
    });
    mockPrisma.subjectGradebook.findMany.mockResolvedValue([]);
  });

  it("refuses a requested recompile while results are released", async () => {
    mockPrisma.classTermResult.findUnique.mockResolvedValue({ status: "RELEASED" });

    await expect(compileClassTermResults(compileInput)).rejects.toThrow("RESULTS_RELEASED");

    expect(mockPrisma.studentProfile.findMany).not.toHaveBeenCalled();
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
  });

  it("rechecks the release state inside the write transaction before replacing rows", async () => {
    mockPrisma.subjectGradebook.findMany.mockResolvedValue([
      {
        id: "gradebook_1",
        subjectName: "Mathematics",
        status: "LOCKED",
        entries: [
          {
            studentProfileId: "student_1",
            ca1: 8,
            ca2: 8,
            midterm: 8,
            assignment: 8,
            exam: 48,
            total: 80,
            comment: null,
          },
        ],
      },
    ]);
    mockPrisma.classTermResult.findUnique
      .mockResolvedValueOnce({ status: "COMPILED" })
      .mockResolvedValueOnce({ status: "RELEASED" });
    mockPrisma.studentProfile.findMany.mockResolvedValue([
      { id: "student_1", displayName: "Student One" },
    ]);
    mockPrisma.gradeBand.findMany.mockResolvedValue([]);
    mockPrisma.exam.findMany.mockResolvedValue([]);
    mockPrisma.termResult.findMany.mockResolvedValue([]);
    mockPrisma.term.findFirst.mockResolvedValue(null);
    mockPrisma.feeInvoice.groupBy.mockResolvedValue([]);

    await expect(compileClassTermResults(compileInput)).rejects.toThrow("RESULTS_RELEASED");

    expect(mockPrisma.classTermResult.updateMany).not.toHaveBeenCalled();
    expect(mockPrisma.termResult.upsert).not.toHaveBeenCalled();
  });

  it("aborts if the class result changes after the transactional read", async () => {
    mockPrisma.subjectGradebook.findMany.mockResolvedValue([
      {
        id: "gradebook_1",
        subjectName: "Mathematics",
        status: "LOCKED",
        entries: [
          {
            studentProfileId: "student_1",
            ca1: 8,
            ca2: 8,
            midterm: 8,
            assignment: 8,
            exam: 48,
            total: 80,
            comment: null,
          },
        ],
      },
    ]);
    mockPrisma.classTermResult.findUnique
      .mockResolvedValueOnce({ status: "COMPILED" })
      .mockResolvedValueOnce({ status: "COMPILED" });
    mockPrisma.classTermResult.updateMany.mockResolvedValue({ count: 0 });
    mockPrisma.studentProfile.findMany.mockResolvedValue([
      { id: "student_1", displayName: "Student One" },
    ]);
    mockPrisma.gradeBand.findMany.mockResolvedValue([]);
    mockPrisma.exam.findMany.mockResolvedValue([]);
    mockPrisma.termResult.findMany.mockResolvedValue([]);
    mockPrisma.term.findFirst.mockResolvedValue(null);
    mockPrisma.feeInvoice.groupBy.mockResolvedValue([]);

    await expect(compileClassTermResults(compileInput)).rejects.toThrow("RESULT_STATE_CHANGED");

    expect(mockPrisma.termResult.upsert).not.toHaveBeenCalled();
  });
});
