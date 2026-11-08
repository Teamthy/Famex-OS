import { describe, expect, it, vi, beforeEach } from "vitest";
import { mockPrisma } from "../setup";

/**
 * Student onboarding.
 *
 * The failure this prevents is not a crash — it is a student who exists in the
 * system but cannot sit an exam, appears in no teacher's roster, and is skipped
 * by the year-end rollover. Every assertion here is about a row that must exist.
 */

const SCHOOL = "school_1";
const STUDENT = "stu_1";
const CLASS = "cls_1";

const CLASSROOM = { id: CLASS, level: "JSS1", displayName: "JSS 1A" };

const COMPULSORY = [
  { id: "sub_maths", name: "Mathematics" },
  { id: "sub_english", name: "English Language" },
];

beforeEach(() => {
  vi.clearAllMocks();
  mockPrisma.schoolClass.findFirst.mockResolvedValue(CLASSROOM);
  mockPrisma.subject.findMany.mockImplementation(async (args: { where?: { category?: string } }) => {
    if (args?.where?.category === "ELECTIVE") return [{ id: "sub_further" }];
    if (args?.where?.category === "COMPULSORY") return COMPULSORY;
    return [{ id: "sub_maths", name: "Mathematics" }];
  });
  mockPrisma.studentSubject.findMany.mockResolvedValue([]);
  mockPrisma.studentSubject.createMany.mockResolvedValue({ count: 2 });
  mockPrisma.studentSubject.upsert.mockResolvedValue({});
  mockPrisma.studentSubject.updateMany.mockResolvedValue({ count: 0 });
  mockPrisma.academicSession.findFirst.mockResolvedValue({ id: "sess_1" });
  mockPrisma.studentEnrolment.findFirst.mockResolvedValue(null);
  mockPrisma.studentEnrolment.create.mockResolvedValue({});
  mockPrisma.studentEnrolment.updateMany.mockResolvedValue({ count: 1 });
  mockPrisma.teacherClassAssignment.findMany.mockResolvedValue([]);
});

describe("onboardStudent", () => {
  it("assigns every compulsory subject for the student's level", async () => {
    const { onboardStudent } = await import("@/lib/enrolment");
    const result = await onboardStudent({
      tx: mockPrisma as never,
      schoolId: SCHOOL,
      studentProfileId: STUDENT,
      classId: CLASS,
    });

    expect(mockPrisma.studentSubject.createMany).toHaveBeenCalledTimes(1);
    const call = mockPrisma.studentSubject.createMany.mock.calls[0][0] as {
      data: Array<{ subjectId: string }>;
    };
    expect(call.data.map((row) => row.subjectId)).toEqual(["sub_maths", "sub_english"]);
    expect(result.compulsoryAssigned).toBe(2);
  });

  it("is safe to re-run — duplicate assignment is skipped, not duplicated", async () => {
    const { onboardStudent } = await import("@/lib/enrolment");
    await onboardStudent({
      tx: mockPrisma as never,
      schoolId: SCHOOL,
      studentProfileId: STUDENT,
      classId: CLASS,
    });
    const call = mockPrisma.studentSubject.createMany.mock.calls[0][0] as {
      skipDuplicates?: boolean;
    };
    // Without this the second admission retry throws a unique violation and the
    // clerk sees a 500 for an enrolment that actually succeeded.
    expect(call.skipDuplicates).toBe(true);
  });

  it("opens the session enrolment so promotion does not skip the student", async () => {
    const { onboardStudent } = await import("@/lib/enrolment");
    const result = await onboardStudent({
      tx: mockPrisma as never,
      schoolId: SCHOOL,
      studentProfileId: STUDENT,
      classId: CLASS,
    });

    expect(mockPrisma.studentEnrolment.create).toHaveBeenCalledTimes(1);
    const call = mockPrisma.studentEnrolment.create.mock.calls[0][0] as {
      data: { classId: string; sessionId: string; outcome: string };
    };
    expect(call.data).toMatchObject({
      classId: CLASS,
      sessionId: "sess_1",
      outcome: "IN_PROGRESS",
    });
    expect(result.enrolmentCreated).toBe(true);
  });

  it("does not open a second enrolment when one already exists", async () => {
    mockPrisma.studentEnrolment.findFirst.mockResolvedValue({ id: "enr_1" });
    const { onboardStudent } = await import("@/lib/enrolment");
    const result = await onboardStudent({
      tx: mockPrisma as never,
      schoolId: SCHOOL,
      studentProfileId: STUDENT,
      classId: CLASS,
    });

    expect(mockPrisma.studentEnrolment.create).not.toHaveBeenCalled();
    expect(result.enrolmentCreated).toBe(false);
  });

  it("moves an in-progress enrolment when the student is re-placed", async () => {
    mockPrisma.studentEnrolment.findFirst.mockResolvedValue({ id: "enr_1" });
    const { onboardStudent } = await import("@/lib/enrolment");
    await onboardStudent({
      tx: mockPrisma as never,
      schoolId: SCHOOL,
      studentProfileId: STUDENT,
      classId: "cls_2",
    });

    const call = mockPrisma.studentEnrolment.updateMany.mock.calls[0][0] as {
      where: { outcome: string };
      data: { classId: string };
    };
    expect(call.data.classId).toBe("cls_2");
    // Only the open enrolment moves; a closed one records history.
    expect(call.where.outcome).toBe("IN_PROGRESS");
  });

  it("warns rather than failing when the school has no current session", async () => {
    mockPrisma.academicSession.findFirst.mockResolvedValue(null);
    const { onboardStudent } = await import("@/lib/enrolment");
    const result = await onboardStudent({
      tx: mockPrisma as never,
      schoolId: SCHOOL,
      studentProfileId: STUDENT,
      classId: CLASS,
    });

    expect(result.enrolmentCreated).toBe(false);
    expect(result.warnings.join(" ")).toMatch(/no academic session/i);
  });

  it("warns when no compulsory subjects are configured for the level", async () => {
    mockPrisma.subject.findMany.mockResolvedValue([]);
    const { onboardStudent } = await import("@/lib/enrolment");
    const result = await onboardStudent({
      tx: mockPrisma as never,
      schoolId: SCHOOL,
      studentProfileId: STUDENT,
      classId: CLASS,
    });

    expect(result.compulsoryAssigned).toBe(0);
    expect(result.warnings.join(" ")).toMatch(/no compulsory subjects/i);
  });

  it("throws for a class outside the school rather than creating a stray student", async () => {
    mockPrisma.schoolClass.findFirst.mockResolvedValue(null);
    const { onboardStudent } = await import("@/lib/enrolment");
    await expect(
      onboardStudent({
        tx: mockPrisma as never,
        schoolId: SCHOOL,
        studentProfileId: STUDENT,
        classId: "someone_elses_class",
      }),
    ).rejects.toThrow(/CLASS_NOT_FOUND/);
  });

  describe("electives", () => {
    it("never assigns an elective the clerk did not choose", async () => {
      const { onboardStudent } = await import("@/lib/enrolment");
      await onboardStudent({
        tx: mockPrisma as never,
        schoolId: SCHOOL,
        studentProfileId: STUDENT,
        classId: CLASS,
      });
      // An automatic elective is a subject nobody chose; the student would sit
      // an exam they never studied for.
      expect(mockPrisma.studentSubject.upsert).not.toHaveBeenCalled();
    });

    it("assigns an elective that was actually chosen", async () => {
      mockPrisma.studentSubject.findMany.mockResolvedValueOnce([]).mockResolvedValueOnce([
        { subject: { name: "Mathematics" } },
        { subject: { name: "Further Mathematics" } },
      ]);
      const { onboardStudent } = await import("@/lib/enrolment");
      const result = await onboardStudent({
        tx: mockPrisma as never,
        schoolId: SCHOOL,
        studentProfileId: STUDENT,
        classId: CLASS,
        electiveSubjectIds: ["sub_further"],
      });

      expect(mockPrisma.studentSubject.upsert).toHaveBeenCalledTimes(1);
      expect(result.electivesAssigned).toBe(1);
    });

    it("ignores an elective from another level", async () => {
      mockPrisma.subject.findMany.mockImplementation(async (args: { where?: { category?: string } }) => {
        if (args?.where?.category === "ELECTIVE") return []; // nothing valid at this level
        if (args?.where?.category === "COMPULSORY") return COMPULSORY;
        return [];
      });
      const { onboardStudent } = await import("@/lib/enrolment");
      const result = await onboardStudent({
        tx: mockPrisma as never,
        schoolId: SCHOOL,
        studentProfileId: STUDENT,
        classId: CLASS,
        electiveSubjectIds: ["sub_ss3_physics"],
      });

      expect(mockPrisma.studentSubject.upsert).not.toHaveBeenCalled();
      expect(result.warnings.join(" ")).toMatch(/not electives/i);
    });

    it("deactivates an elective that is no longer chosen, without deleting it", async () => {
      // An empty choice list must resolve to NO electives, exactly as
      // `in: []` does in Postgres.
      mockPrisma.subject.findMany.mockImplementation(
        async (args: { where?: { category?: string } }) => {
          if (args?.where?.category === "ELECTIVE") return [];
          if (args?.where?.category === "COMPULSORY") return COMPULSORY;
          return [];
        },
      );
      mockPrisma.studentSubject.findMany
        .mockResolvedValueOnce([{ subjectId: "sub_further", isActive: true }])
        .mockResolvedValueOnce([{ subject: { name: "Mathematics" } }]);
      const { onboardStudent } = await import("@/lib/enrolment");
      const result = await onboardStudent({
        tx: mockPrisma as never,
        schoolId: SCHOOL,
        studentProfileId: STUDENT,
        classId: CLASS,
        electiveSubjectIds: [],
      });

      // Reversible, so dropping a subject mid-year can be undone and audited.
      expect(mockPrisma.studentSubject.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({ data: { isActive: false } }),
      );
      expect(result.electivesDropped).toBe(1);
    });

    it("never drops a compulsory subject, however stale the form", async () => {
      mockPrisma.subject.findMany.mockImplementation(
        async (args: { where?: { category?: string } }) => {
          if (args?.where?.category === "ELECTIVE") return [];
          if (args?.where?.category === "COMPULSORY") return COMPULSORY;
          return [];
        },
      );
      mockPrisma.studentSubject.findMany
        .mockResolvedValueOnce([{ subjectId: "sub_maths", isActive: true }])
        .mockResolvedValueOnce([{ subject: { name: "Mathematics" } }]);
      const { onboardStudent } = await import("@/lib/enrolment");
      await onboardStudent({
        tx: mockPrisma as never,
        schoolId: SCHOOL,
        studentProfileId: STUDENT,
        classId: CLASS,
        electiveSubjectIds: [],
      });

      const drops = mockPrisma.studentSubject.updateMany.mock.calls.map(
        (call) => (call[0] as { where: { subjectId: string } }).where.subjectId,
      );
      expect(drops).not.toContain("sub_maths");
    });
  });

  describe("teacher routing", () => {
    it("reports the subject teacher who will receive the student's scores", async () => {
      mockPrisma.studentSubject.findMany.mockResolvedValue([
        { subject: { name: "Mathematics" } },
        { subject: { name: "English Language" } },
      ]);
      mockPrisma.teacherClassAssignment.findMany.mockResolvedValue([
        {
          role: "SUBJECT_TEACHER",
          subjectName: "Mathematics",
          teacherProfile: { displayName: "Mrs Ade" },
        },
        {
          role: "FORM_TEACHER",
          subjectName: null,
          teacherProfile: { displayName: "Mr Bello" },
        },
      ]);
      const { onboardStudent } = await import("@/lib/enrolment");
      const result = await onboardStudent({
        tx: mockPrisma as never,
        schoolId: SCHOOL,
        studentProfileId: STUDENT,
        classId: CLASS,
      });

      expect(result.subjectTeachers).toEqual([
        { subjectName: "Mathematics", teacherName: "Mrs Ade" },
      ]);
      expect(result.classTeacher).toBe("Mr Bello");
    });

    it("warns when a subject has no teacher, because a score would reach nobody", async () => {
      mockPrisma.studentSubject.findMany.mockResolvedValue([
        { subject: { name: "Mathematics" } },
        { subject: { name: "English Language" } },
      ]);
      mockPrisma.teacherClassAssignment.findMany.mockResolvedValue([
        {
          role: "SUBJECT_TEACHER",
          subjectName: "Mathematics",
          teacherProfile: { displayName: "Mrs Ade" },
        },
      ]);
      const { onboardStudent } = await import("@/lib/enrolment");
      const result = await onboardStudent({
        tx: mockPrisma as never,
        schoolId: SCHOOL,
        studentProfileId: STUDENT,
        classId: CLASS,
      });

      expect(result.warnings.join(" ")).toMatch(/English Language/);
    });

    it("warns when the class has no form teacher", async () => {
      mockPrisma.studentSubject.findMany.mockResolvedValue([
        { subject: { name: "Mathematics" } },
      ]);
      mockPrisma.teacherClassAssignment.findMany.mockResolvedValue([
        {
          role: "SUBJECT_TEACHER",
          subjectName: "Mathematics",
          teacherProfile: { displayName: "Mrs Ade" },
        },
      ]);
      const { onboardStudent } = await import("@/lib/enrolment");
      const result = await onboardStudent({
        tx: mockPrisma as never,
        schoolId: SCHOOL,
        studentProfileId: STUDENT,
        classId: CLASS,
      });

      expect(result.warnings.join(" ")).toMatch(/form teacher/i);
    });

    it("matches a subject teacher case-insensitively, as teachers type their subject", async () => {
      mockPrisma.studentSubject.findMany.mockResolvedValue([
        { subject: { name: "Mathematics" } },
      ]);
      mockPrisma.teacherClassAssignment.findMany.mockResolvedValue([
        {
          role: "SUBJECT_TEACHER",
          subjectName: "mathematics",
          teacherProfile: { displayName: "Mrs Ade" },
        },
      ]);
      const { onboardStudent } = await import("@/lib/enrolment");
      const result = await onboardStudent({
        tx: mockPrisma as never,
        schoolId: SCHOOL,
        studentProfileId: STUDENT,
        classId: CLASS,
      });

      expect(result.subjectTeachers).toHaveLength(1);
      expect(result.warnings.join(" ")).not.toMatch(/mathematics/i);
    });

    it("does not treat a form teacher as the subject teacher of every subject", async () => {
      mockPrisma.studentSubject.findMany.mockResolvedValue([
        { subject: { name: "Mathematics" } },
      ]);
      mockPrisma.teacherClassAssignment.findMany.mockResolvedValue([
        {
          role: "FORM_TEACHER",
          subjectName: null,
          teacherProfile: { displayName: "Mr Bello" },
        },
      ]);
      const { onboardStudent } = await import("@/lib/enrolment");
      const result = await onboardStudent({
        tx: mockPrisma as never,
        schoolId: SCHOOL,
        studentProfileId: STUDENT,
        classId: CLASS,
      });

      // The two roles are separate entities. A form teacher receives the class
      // result, not the subject mark.
      expect(result.subjectTeachers).toHaveLength(0);
      expect(result.classTeacher).toBe("Mr Bello");
    });
  });
});

/**
 * Carrying subjects across a class change.
 *
 * Promotion moved the class and left the subjects alone. For JSS3 → SS1 that is
 * wrong in the most visible way possible: the student arrives in SS1 still
 * enrolled in Basic Science, sees no senior exam they are entitled to, and is
 * on no register for one they should be on. The report card a term later is
 * missing half its subjects and nobody knows why.
 */
describe("rolloverSubjectsForClassChange", () => {
  const SENIOR = { id: "cls_ss1", level: "SS1", displayName: "SS 1A" };

  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.studentSubject.create.mockResolvedValue({});
    mockPrisma.studentSubject.update.mockResolvedValue({});
    mockPrisma.studentSubject.updateMany.mockResolvedValue({ count: 1 });
  });

  it("does nothing when the level has not changed", async () => {
    // A repeater, or a move between arms of the same level: same catalogue.
    mockPrisma.schoolClass.findFirst.mockImplementation(async (args: { where?: { id?: string } }) =>
      args?.where?.id === "cls_1" ? CLASSROOM : { ...CLASSROOM, id: "cls_2", displayName: "JSS 1B" },
    );

    const { rolloverSubjectsForClassChange } = await import("@/lib/enrolment");
    const result = await rolloverSubjectsForClassChange({
      tx: mockPrisma as never,
      schoolId: SCHOOL,
      studentProfileId: STUDENT,
      fromClassId: "cls_1",
      toClassId: "cls_2",
    });

    expect(result).toMatchObject({ added: 0, reactivated: 0, deactivated: 0 });
    // Not one write: the student's subjects are already right.
    expect(mockPrisma.studentSubject.create).not.toHaveBeenCalled();
    expect(mockPrisma.studentSubject.updateMany).not.toHaveBeenCalled();
  });

  it("assigns the new level's compulsory subjects", async () => {
    mockPrisma.schoolClass.findFirst.mockImplementation(async (args: { where?: { id?: string } }) =>
      args?.where?.id === "cls_ss1" ? SENIOR : CLASSROOM,
    );
    mockPrisma.subject.findMany.mockResolvedValue([
      { id: "sub_physics", name: "Physics" },
      { id: "sub_chem", name: "Chemistry" },
    ]);
    mockPrisma.studentSubject.findMany.mockResolvedValue([]);

    const { rolloverSubjectsForClassChange } = await import("@/lib/enrolment");
    const result = await rolloverSubjectsForClassChange({
      tx: mockPrisma as never,
      schoolId: SCHOOL,
      studentProfileId: STUDENT,
      fromClassId: CLASS,
      toClassId: "cls_ss1",
    });

    expect(result.added).toBe(2);
    const created = mockPrisma.studentSubject.create.mock.calls.map(
      (call) => (call[0] as { data: { subjectId: string } }).data.subjectId,
    );
    expect(created.sort()).toEqual(["sub_chem", "sub_physics"]);
  });

  it("retires the old level's compulsory subjects", async () => {
    mockPrisma.schoolClass.findFirst.mockImplementation(async (args: { where?: { id?: string } }) =>
      args?.where?.id === "cls_ss1" ? SENIOR : CLASSROOM,
    );
    mockPrisma.subject.findMany.mockResolvedValue([{ id: "sub_physics", name: "Physics" }]);
    // The JSS3 student's junior compulsory subject, still active.
    mockPrisma.studentSubject.findMany.mockResolvedValue([
      {
        id: "ss_1",
        subjectId: "sub_basic_science",
        isActive: true,
        subject: { name: "Basic Science", level: "JSS1", category: "COMPULSORY" },
      },
    ]);

    const { rolloverSubjectsForClassChange } = await import("@/lib/enrolment");
    const result = await rolloverSubjectsForClassChange({
      tx: mockPrisma as never,
      schoolId: SCHOOL,
      studentProfileId: STUDENT,
      fromClassId: CLASS,
      toClassId: "cls_ss1",
    });

    expect(result.deactivated).toBe(1);
    expect(mockPrisma.studentSubject.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ subjectId: "sub_basic_science" }),
        data: { isActive: false },
      }),
    );
  });

  it("does not touch a subject both levels call compulsory", async () => {
    // English and Mathematics are compulsory in JSS1 and in SS1. Retiring and
    // re-adding them would rewrite the student's history for no reason.
    mockPrisma.schoolClass.findFirst.mockImplementation(async (args: { where?: { id?: string } }) =>
      args?.where?.id === "cls_ss1" ? SENIOR : CLASSROOM,
    );
    mockPrisma.subject.findMany.mockResolvedValue([{ id: "sub_english", name: "English Language" }]);
    mockPrisma.studentSubject.findMany.mockResolvedValue([
      {
        id: "ss_1",
        subjectId: "sub_english",
        isActive: true,
        subject: { name: "English Language", level: "SS1", category: "COMPULSORY" },
      },
    ]);

    const { rolloverSubjectsForClassChange } = await import("@/lib/enrolment");
    const result = await rolloverSubjectsForClassChange({
      tx: mockPrisma as never,
      schoolId: SCHOOL,
      studentProfileId: STUDENT,
      fromClassId: CLASS,
      toClassId: "cls_ss1",
    });

    expect(result).toMatchObject({ added: 0, reactivated: 0, deactivated: 0 });
    expect(mockPrisma.studentSubject.updateMany).not.toHaveBeenCalled();
  });

  it("keeps electives rather than guessing whether they still exist", async () => {
    // The student chose Further Mathematics. Whether SS1 offers it is not
    // something to infer from a class change; dropping it would silently drop
    // a real choice.
    mockPrisma.schoolClass.findFirst.mockImplementation(async (args: { where?: { id?: string } }) =>
      args?.where?.id === "cls_ss1" ? SENIOR : CLASSROOM,
    );
    mockPrisma.subject.findMany.mockResolvedValue([]);
    mockPrisma.studentSubject.findMany.mockResolvedValue([
      {
        id: "ss_1",
        subjectId: "sub_further",
        isActive: true,
        subject: { name: "Further Mathematics", level: "JSS1", category: "ELECTIVE" },
      },
    ]);

    const { rolloverSubjectsForClassChange } = await import("@/lib/enrolment");
    const result = await rolloverSubjectsForClassChange({
      tx: mockPrisma as never,
      schoolId: SCHOOL,
      studentProfileId: STUDENT,
      fromClassId: CLASS,
      toClassId: "cls_ss1",
    });

    expect(result.keptElectives).toBe(1);
    expect(result.deactivated).toBe(0);
    expect(mockPrisma.studentSubject.updateMany).not.toHaveBeenCalled();
  });

  it("re-activates a compulsory subject the student had dropped", async () => {
    mockPrisma.schoolClass.findFirst.mockImplementation(async (args: { where?: { id?: string } }) =>
      args?.where?.id === "cls_ss1" ? SENIOR : CLASSROOM,
    );
    mockPrisma.subject.findMany.mockResolvedValue([{ id: "sub_physics", name: "Physics" }]);
    mockPrisma.studentSubject.findMany.mockResolvedValue([
      {
        id: "ss_9",
        subjectId: "sub_physics",
        isActive: false,
        subject: { name: "Physics", level: "SS1", category: "COMPULSORY" },
      },
    ]);

    const { rolloverSubjectsForClassChange } = await import("@/lib/enrolment");
    const result = await rolloverSubjectsForClassChange({
      tx: mockPrisma as never,
      schoolId: SCHOOL,
      studentProfileId: STUDENT,
      fromClassId: CLASS,
      toClassId: "cls_ss1",
    });

    expect(result.reactivated).toBe(1);
    expect(mockPrisma.studentSubject.update).toHaveBeenCalledWith({
      where: { id: "ss_9" },
      data: { isActive: true },
    });
  });

  it("warns, rather than failing, when the new level has no catalogue", async () => {
    // A school that has not set up SS1 yet. Refusing the promotion would strand
    // the whole year; the admin needs to be told instead.
    mockPrisma.schoolClass.findFirst.mockImplementation(async (args: { where?: { id?: string } }) =>
      args?.where?.id === "cls_ss1" ? SENIOR : CLASSROOM,
    );
    mockPrisma.subject.findMany.mockResolvedValue([]);
    mockPrisma.studentSubject.findMany.mockResolvedValue([]);

    const { rolloverSubjectsForClassChange } = await import("@/lib/enrolment");
    const result = await rolloverSubjectsForClassChange({
      tx: mockPrisma as never,
      schoolId: SCHOOL,
      studentProfileId: STUDENT,
      fromClassId: CLASS,
      toClassId: "cls_ss1",
    });

    expect(result.warnings.join(" ")).toMatch(/no compulsory subjects/i);
  });
});
