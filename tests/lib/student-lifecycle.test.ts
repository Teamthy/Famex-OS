import { beforeEach, describe, expect, it, vi } from "vitest";
import { mockPrisma } from "../setup";

const SCHOOL = "school_fis";
const ADMIN = "admin_1";
const STUDENT = "student_1";
const CLASS_OLD = "class_jss3a";
const CLASS_NEW = "class_ss1a";
const SESSION_OLD = "session_2025";
const SESSION_CURRENT = "session_2026";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("audited student lifecycle service", () => {
  it("dry-runs a class change with capacity, enrolment and subject effects without writing", async () => {
    mockPrisma.studentProfile.findFirst.mockResolvedValue({
      id: STUDENT,
      studentId: "FIS-001",
      displayName: "Ada Student",
      isActive: true,
      currentClassId: CLASS_OLD,
      currentClass: { id: CLASS_OLD, displayName: "JSS3A", level: "JSS3" },
    });
    mockPrisma.schoolClass.findFirst.mockImplementation(async (args: unknown) => {
      const id = (args as { where?: { id?: string } }).where?.id;
      if (id === CLASS_NEW)
        return { id, displayName: "SS1A", level: "SS1", capacity: 2, isActive: true };
      if (id === CLASS_OLD) return { id, displayName: "JSS3A", level: "JSS3" };
      return null;
    });
    mockPrisma.studentProfile.count.mockResolvedValue(1);
    mockPrisma.academicSession.findFirst.mockResolvedValue({
      id: SESSION_CURRENT,
      label: "2026/2027",
    });
    mockPrisma.studentEnrolment.findFirst.mockResolvedValue({
      id: "enrol-current",
      classId: CLASS_OLD,
      outcome: "IN_PROGRESS",
    });
    mockPrisma.subject.findMany.mockResolvedValue([{ id: "subject-physics", name: "Physics" }]);
    mockPrisma.studentSubject.findMany.mockResolvedValue([]);
    mockPrisma.teacherClassAssignment.findMany.mockResolvedValue([{ role: "FORM_TEACHER" }]);

    const { planClassChange } = await import("@/lib/student-lifecycle");
    const plan = await planClassChange({
      schoolId: SCHOOL,
      studentProfileId: STUDENT,
      toClassId: CLASS_NEW,
    });

    expect(plan.ok).toBe(true);
    expect(plan.capacity).toMatchObject({ occupied: 1, capacity: 2, projected: 2, full: false });
    expect(plan.enrolmentAction).toBe("move");
    expect(plan.sessionId).toBe(SESSION_CURRENT);
    expect(plan.subjects.add).toContain("Physics");
    expect(mockPrisma.studentProfile.update).not.toHaveBeenCalled();
    expect(mockPrisma.studentEnrolment.update).not.toHaveBeenCalled();
    expect(mockPrisma.auditLog.create).not.toHaveBeenCalled();
  });

  it("commits a cross-session class move atomically and preserves the earlier enrolment", async () => {
    mockPrisma.studentProfile.findFirst.mockResolvedValue({
      id: STUDENT,
      studentId: "FIS-001",
      displayName: "Ada Student",
      isActive: true,
      currentClassId: CLASS_OLD,
      currentClass: { displayName: "JSS3A" },
    });
    mockPrisma.schoolClass.findFirst.mockResolvedValue({
      id: CLASS_NEW,
      displayName: "SS1A",
      capacity: 40,
    });
    mockPrisma.studentProfile.count.mockResolvedValue(4);
    mockPrisma.academicSession.findFirst.mockResolvedValue({
      id: SESSION_CURRENT,
      label: "2026/2027",
    });
    mockPrisma.studentEnrolment.findFirst.mockResolvedValue({
      id: "enrol-current",
      classId: CLASS_OLD,
      outcome: "IN_PROGRESS",
    });
    mockPrisma.schoolClass.findFirst.mockImplementation(async (args: unknown) => {
      const id = (args as { where?: { id?: string } }).where?.id;
      if (id === CLASS_NEW)
        return { id, displayName: "SS1A", level: "SS1", capacity: 40, isActive: true };
      if (id === CLASS_OLD) return { id, displayName: "JSS3A", level: "JSS3" };
      return null;
    });
    mockPrisma.subject.findMany.mockResolvedValue([]);
    mockPrisma.studentSubject.findMany.mockResolvedValue([]);
    mockPrisma.studentSubject.create.mockResolvedValue({});
    mockPrisma.studentSubject.update.mockResolvedValue({});
    mockPrisma.studentSubject.updateMany.mockResolvedValue({ count: 0 });
    mockPrisma.teacherClassAssignment.findMany.mockResolvedValue([]);

    const { commitClassChange } = await import("@/lib/student-lifecycle");
    const result = await commitClassChange({
      schoolId: SCHOOL,
      studentProfileId: STUDENT,
      toClassId: CLASS_NEW,
      actorUserId: ADMIN,
      reason: "Promotion to senior secondary",
    });

    expect(result.enrolmentAction).toBe("moved");
    expect(mockPrisma.studentProfile.update).toHaveBeenCalledWith({
      where: { id: STUDENT },
      data: { currentClassId: CLASS_NEW },
    });
    expect(mockPrisma.studentEnrolment.update).toHaveBeenCalledWith({
      where: { id: "enrol-current" },
      data: { classId: CLASS_NEW, outcome: "IN_PROGRESS", completedAt: null },
    });
    expect(mockPrisma.studentEnrolment.findFirst).toHaveBeenCalledWith({
      where: { schoolId: SCHOOL, studentProfileId: STUDENT, sessionId: SESSION_CURRENT },
      select: { id: true, classId: true, outcome: true },
    });
    expect(mockPrisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: "STUDENT_MOVED",
          actorUserId: ADMIN,
          metadata: expect.objectContaining({ reason: "Promotion to senior secondary" }),
        }),
      }),
    );
    // The service's only enrolment write targets 2026/2027; it never rewrites
    // the 2025/2026 history row while correcting the current class.
    expect(mockPrisma.studentEnrolment.updateMany).not.toHaveBeenCalled();
    expect(mockPrisma.studentEnrolment.create).not.toHaveBeenCalled();
  });

  it("rejects a class move at capacity", async () => {
    mockPrisma.studentProfile.findFirst.mockResolvedValue({
      id: STUDENT,
      studentId: "FIS-001",
      displayName: "Ada Student",
      isActive: true,
      currentClassId: CLASS_OLD,
      currentClass: { displayName: "JSS3A" },
    });
    mockPrisma.schoolClass.findFirst.mockResolvedValue({
      id: CLASS_NEW,
      displayName: "SS1A",
      capacity: 1,
    });
    mockPrisma.studentProfile.count.mockResolvedValue(1);

    const { commitClassChange, LifecycleError } = await import("@/lib/student-lifecycle");
    await expect(
      commitClassChange({
        schoolId: SCHOOL,
        studentProfileId: STUDENT,
        toClassId: CLASS_NEW,
        actorUserId: ADMIN,
      }),
    ).rejects.toMatchObject({ code: "CLASS_AT_CAPACITY" });
    expect(LifecycleError).toBeDefined();
    expect(mockPrisma.studentProfile.update).not.toHaveBeenCalled();
    expect(mockPrisma.studentEnrolment.update).not.toHaveBeenCalled();
  });

  it("withdraws by closing open enrolments, revoking login, and retaining history", async () => {
    mockPrisma.studentProfile.findFirst.mockResolvedValue({
      id: STUDENT,
      studentId: "FIS-001",
      displayName: "Ada Student",
      isActive: true,
      userId: "user_student",
    });
    mockPrisma.studentEnrolment.updateMany.mockResolvedValue({ count: 2 });
    mockPrisma.studentProfile.update.mockResolvedValue({});
    mockPrisma.user.update.mockResolvedValue({});

    const { commitWithdraw } = await import("@/lib/student-lifecycle");
    const result = await commitWithdraw({
      schoolId: SCHOOL,
      studentProfileId: STUDENT,
      actorUserId: ADMIN,
      reason: "Family relocation",
    });

    expect(result.enrolmentsClosed).toBe(2);
    expect(result.retentionUntil.getFullYear()).toBe(new Date().getFullYear() + 10);
    expect(mockPrisma.studentEnrolment.updateMany).toHaveBeenCalledWith({
      where: { schoolId: SCHOOL, studentProfileId: STUDENT, outcome: "IN_PROGRESS" },
      data: expect.objectContaining({ outcome: "WITHDRAWN", completedAt: expect.any(Date) }),
    });
    expect(mockPrisma.user.update).toHaveBeenCalledWith({
      where: { id: "user_student" },
      data: { isActive: false, tokenVersion: { increment: 1 } },
    });
    expect(mockPrisma.auditLog.create).toHaveBeenCalled();
    expect(mockPrisma.parentStudentLink.create).not.toHaveBeenCalled();
    expect(mockPrisma.parentStudentLink.findMany).not.toHaveBeenCalled();
  });

  it("re-enters a withdrawn student by reopening the current-session row and reactivating login", async () => {
    mockPrisma.studentProfile.findFirst.mockResolvedValue({
      id: STUDENT,
      studentId: "FIS-001",
      displayName: "Ada Student",
      isActive: false,
      userId: "user_student",
      currentClassId: CLASS_OLD,
    });
    mockPrisma.schoolClass.findFirst.mockImplementation(async (args: unknown) => {
      const id = (args as { where?: { id?: string } }).where?.id;
      return id === CLASS_OLD
        ? { id, displayName: "JSS3A", level: "JSS3", capacity: 40, isActive: true }
        : null;
    });
    mockPrisma.studentProfile.count.mockResolvedValue(10);
    mockPrisma.academicSession.findFirst.mockResolvedValue({
      id: SESSION_CURRENT,
      label: "2026/2027",
    });
    mockPrisma.studentEnrolment.findFirst.mockResolvedValue({
      id: "enrol-current",
      classId: CLASS_OLD,
      outcome: "WITHDRAWN",
    });
    mockPrisma.studentProfile.update.mockResolvedValue({});
    mockPrisma.studentSubject.findMany.mockResolvedValue([]);
    mockPrisma.studentSubject.createMany.mockResolvedValue({ count: 0 });
    mockPrisma.studentSubject.upsert.mockResolvedValue({});
    mockPrisma.studentSubject.updateMany.mockResolvedValue({ count: 0 });
    mockPrisma.subject.findMany.mockResolvedValue([]);
    mockPrisma.teacherClassAssignment.findMany.mockResolvedValue([
      { role: "FORM_TEACHER", subjectName: null, teacherProfile: { displayName: "Teacher" } },
    ]);
    mockPrisma.user.update.mockResolvedValue({});

    const { commitReadmit } = await import("@/lib/student-lifecycle");
    const result = await commitReadmit({
      schoolId: SCHOOL,
      studentProfileId: STUDENT,
      actorUserId: ADMIN,
      reason: "Returned to school",
    });

    expect(result.enrolmentAction).toBe("reopened");
    expect(result.loginReopened).toBe(true);
    expect(mockPrisma.studentProfile.update).toHaveBeenCalledWith({
      where: { id: STUDENT },
      data: {
        isActive: true,
        lifecycleStatus: "ACTIVE",
        deactivatedAt: null,
        currentClassId: CLASS_OLD,
      },
    });
    expect(mockPrisma.studentEnrolment.update).toHaveBeenCalledWith({
      where: { id: "enrol-current" },
      data: { classId: CLASS_OLD, outcome: "IN_PROGRESS", completedAt: null },
    });
    expect(mockPrisma.user.update).toHaveBeenCalledWith({
      where: { id: "user_student" },
      data: { isActive: true, tokenVersion: { increment: 1 } },
    });
  });

  it("dry-runs and commits elective changes without touching compulsory rows", async () => {
    mockPrisma.studentProfile.findFirst.mockResolvedValue({
      id: STUDENT,
      studentId: "FIS-001",
      displayName: "Ada Student",
      isActive: true,
      currentClass: { level: "SS1" },
    });
    mockPrisma.subject.findMany.mockResolvedValue([
      { id: "physics", name: "Physics" },
      { id: "economics", name: "Economics" },
    ]);
    mockPrisma.studentSubject.findMany.mockImplementation(async (args: unknown) => {
      const where = (args as { where?: { subjectId?: { in?: string[] } } }).where;
      if (where?.subjectId?.in) {
        return [
          {
            subjectId: "economics",
            subject: { id: "economics", name: "Economics", category: "ELECTIVE" },
          },
        ];
      }
      return [
        {
          subjectId: "economics",
          subject: { id: "economics", name: "Economics", category: "ELECTIVE" },
        },
        {
          subjectId: "english",
          subject: { id: "english", name: "English", category: "COMPULSORY" },
        },
      ];
    });
    mockPrisma.studentSubject.updateMany.mockResolvedValue({ count: 1 });
    mockPrisma.studentSubject.upsert.mockResolvedValue({});

    const { planElectiveChange, commitElectiveChange } = await import("@/lib/student-lifecycle");
    const plan = await planElectiveChange({
      schoolId: SCHOOL,
      studentProfileId: STUDENT,
      subjectIds: ["physics", "invalid"],
    });
    expect(plan.add.map((subject) => subject.name)).toEqual(["Physics"]);
    expect(plan.remove.map((subject) => subject.name)).toEqual(["Economics"]);
    expect(plan.exceptions[0]?.code).toBe("INVALID_ELECTIVE_SELECTION");

    const result = await commitElectiveChange({
      schoolId: SCHOOL,
      studentProfileId: STUDENT,
      subjectIds: ["physics"],
      actorUserId: ADMIN,
    });
    expect(result).toMatchObject({ enrolled: 1, added: 1, removed: 1, ignored: 0 });
    expect(mockPrisma.studentSubject.updateMany).toHaveBeenCalledWith({
      where: {
        schoolId: SCHOOL,
        studentProfileId: STUDENT,
        subjectId: { in: ["physics", "economics"] },
      },
      data: { isActive: false },
    });
    expect(mockPrisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ action: "STUDENT_SUBJECTS_UPDATED", actorUserId: ADMIN }),
      }),
    );
  });

  it("reports enrolment drift, missing subjects and capacity overflow without repairing data", async () => {
    mockPrisma.academicSession.findFirst.mockResolvedValue({
      id: SESSION_CURRENT,
      label: "2026/2027",
    });
    mockPrisma.schoolClass.findMany.mockResolvedValue([
      { id: CLASS_NEW, displayName: "SS1A", level: "SS1", capacity: 1, isActive: true },
      { id: CLASS_OLD, displayName: "JSS3A", level: "JSS3", capacity: null, isActive: true },
    ]);
    mockPrisma.studentProfile.findMany.mockResolvedValue([
      {
        id: STUDENT,
        studentId: "FIS-001",
        displayName: "Ada Student",
        isActive: true,
        currentClassId: CLASS_NEW,
        userId: "user_student",
        guardianName: "Guardian",
        guardianPhone: "08000000000",
      },
      {
        id: "student_2",
        studentId: "FIS-002",
        displayName: "Bola Student",
        isActive: true,
        currentClassId: CLASS_NEW,
        userId: null,
        guardianName: null,
        guardianPhone: null,
      },
    ]);
    mockPrisma.studentEnrolment.findMany.mockResolvedValue([
      { studentProfileId: STUDENT, classId: CLASS_OLD, sessionId: SESSION_CURRENT },
    ]);
    mockPrisma.studentSubject.findMany.mockResolvedValue([]);
    mockPrisma.teacherClassAssignment.findMany.mockResolvedValue([]);
    mockPrisma.user.findMany.mockResolvedValue([{ id: "user_student", isActive: true }]);
    mockPrisma.parentStudentLink.findMany.mockResolvedValue([]);

    const { collectLifecycleExceptions } = await import("@/lib/student-lifecycle");
    const report = await collectLifecycleExceptions(SCHOOL);
    const codes = report.exceptions.map((exception) => exception.code);

    expect(codes).toContain("ENROLMENT_CLASS_DRIFT");
    expect(codes).toContain("NO_SUBJECTS");
    expect(codes).toContain("CAPACITY_OVERFLOW");
    expect(codes).toContain("NO_FORM_TEACHER");
    expect(report.blocking).toBeGreaterThanOrEqual(3);
    expect(mockPrisma.studentProfile.update).not.toHaveBeenCalled();
    expect(mockPrisma.studentEnrolment.update).not.toHaveBeenCalled();
  });

  it("synchronizes primary guardian contact details but does not change login identity", async () => {
    mockPrisma.parentStudentLink.findMany.mockResolvedValue([
      {
        parentProfile: {
          id: "parent_1",
          displayName: "Old Guardian",
          phone: "08000000000",
          user: { email: "old@example.test" },
        },
      },
    ]);
    mockPrisma.parentProfile.update.mockResolvedValue({});

    const { syncGuardianContact } = await import("@/lib/student-lifecycle");
    const result = await syncGuardianContact({
      schoolId: SCHOOL,
      studentProfileId: STUDENT,
      guardianName: "New Guardian",
      guardianPhone: "08011112222",
      guardianEmail: "new@example.test",
    });

    expect(result.synced).toBe(true);
    expect(result.warnings[0]).toMatch(/login was NOT changed/);
    expect(mockPrisma.parentProfile.update).toHaveBeenCalledWith({
      where: { id: "parent_1" },
      data: { displayName: "New Guardian", phone: "08011112222" },
    });
    expect(mockPrisma.user.update).not.toHaveBeenCalled();
  });
});
