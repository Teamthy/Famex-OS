import { describe, it, expect, vi, beforeEach } from "vitest";
import { mockPrisma } from "../setup";

/**
 * Student access to messaging.
 *
 * `reachableStudentIds()` decides which students a user may discuss, and it is
 * the ONLY gate on the whole messaging system — the inbox query, thread access
 * and posting all derive from it. Every role fell into one of three branches
 * (parent, teacher, oversight) and everything else returned `[]`, so STUDENT
 * silently had no messaging at all: no inbox, no way to ask their form teacher
 * a question, no reply path.
 *
 * Extending it to students is the highest-risk change in this area, because a
 * mistake does not fail loudly — it shows one child another child's private
 * conversation with the school. These tests pin the boundary hard.
 */

vi.mock("@/lib/session", () => ({
  getSession: vi.fn(),
  requireRole: vi.fn(),
}));

const STUDENT = { id: "usr_stu", schoolId: "school_1", role: "STUDENT" };

describe("reachableStudentIds — STUDENT", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns the student's OWN profile, and nothing else", async () => {
    mockPrisma.studentProfile.findFirst.mockResolvedValue({ id: "stu_self" });

    const { reachableStudentIds } = await import("@/lib/messaging");
    const ids = await reachableStudentIds(STUDENT);

    expect(ids).toEqual(["stu_self"]);
  });

  it("scopes the lookup to the caller's own school and user id", async () => {
    mockPrisma.studentProfile.findFirst.mockResolvedValue({ id: "stu_self" });

    const { reachableStudentIds } = await import("@/lib/messaging");
    await reachableStudentIds(STUDENT);

    const where = mockPrisma.studentProfile.findFirst.mock.calls[0][0].where;
    expect(where.userId).toBe("usr_stu");
    expect(where.schoolId).toBe("school_1");
    expect(where.isActive).toBe(true);
  });

  /**
   * A student is never resolved by class. If they were, the inbox query
   * (`studentProfileId: { in: ids }`) would return every thread about every
   * classmate — including fee disputes and behaviour discussions.
   */
  it("never widens to classmates", async () => {
    mockPrisma.studentProfile.findFirst.mockResolvedValue({ id: "stu_self" });

    const { reachableStudentIds } = await import("@/lib/messaging");
    const ids = await reachableStudentIds(STUDENT);

    expect(ids).toHaveLength(1);
    // findMany is how the teacher/oversight branches fan out. A student must
    // never touch it.
    expect(mockPrisma.studentProfile.findMany).not.toHaveBeenCalled();
  });

  it("returns nothing for a student with no active profile", async () => {
    mockPrisma.studentProfile.findFirst.mockResolvedValue(null);

    const { reachableStudentIds } = await import("@/lib/messaging");
    expect(await reachableStudentIds(STUDENT)).toEqual([]);
  });

  it("still returns nothing for roles with no messaging relationship", async () => {
    const { reachableStudentIds } = await import("@/lib/messaging");

    // BURSAR handles money, not pastoral conversations; IT_STUDENT is an
    // external course learner with no school profile at all.
    expect(await reachableStudentIds({ ...STUDENT, role: "BURSAR" })).toEqual([]);
    expect(await reachableStudentIds({ ...STUDENT, role: "IT_STUDENT" })).toEqual([]);
  });
});

describe("assertThreadAccess — STUDENT", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("allows a student into a thread about themselves", async () => {
    mockPrisma.messageThread.findFirst.mockResolvedValue({
      id: "thr_1",
      schoolId: "school_1",
      studentProfileId: "stu_self",
      subject: "Absence",
      status: "OPEN",
    });
    mockPrisma.studentProfile.findFirst.mockResolvedValue({ id: "stu_self" });

    const { assertThreadAccess } = await import("@/lib/messaging");
    const thread = await assertThreadAccess(STUDENT, "thr_1");

    expect(thread?.id).toBe("thr_1");
  });

  it("REFUSES a student a thread about a classmate", async () => {
    mockPrisma.messageThread.findFirst.mockResolvedValue({
      id: "thr_other",
      schoolId: "school_1",
      studentProfileId: "stu_classmate",
      subject: "Fees",
      status: "OPEN",
    });
    mockPrisma.studentProfile.findFirst.mockResolvedValue({ id: "stu_self" });

    const { assertThreadAccess } = await import("@/lib/messaging");
    const thread = await assertThreadAccess(STUDENT, "thr_other");

    // The single most important assertion in this file.
    expect(thread).toBeNull();
  });

  it("REFUSES a thread in another school even if the ids line up", async () => {
    mockPrisma.messageThread.findFirst.mockResolvedValue(null);
    mockPrisma.studentProfile.findFirst.mockResolvedValue({ id: "stu_self" });

    const { assertThreadAccess } = await import("@/lib/messaging");
    expect(await assertThreadAccess(STUDENT, "thr_elsewhere")).toBeNull();
    expect(mockPrisma.messageThread.findFirst.mock.calls[0][0].where.schoolId).toBe("school_1");
  });
});

describe("participantsForStudent — includes the student", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("adds the student's own user id so they can see their thread", async () => {
    mockPrisma.studentProfile.findFirst.mockResolvedValue({
      currentClassId: "cls_1",
      userId: "usr_stu",
      parentLinks: [{ parentProfile: { userId: "usr_parent" } }],
    });
    mockPrisma.teacherClassAssignment.findMany.mockResolvedValue([
      { teacherProfile: { userId: "usr_form" } },
    ]);

    const { participantsForStudent } = await import("@/lib/messaging");
    const ids = await participantsForStudent("school_1", "stu_1");

    // Without the student, a thread ABOUT them is invisible TO them.
    expect(ids).toContain("usr_stu");
    expect(ids).toContain("usr_parent");
    expect(ids).toContain("usr_form");
  });

  it("does not break when the student has no linked user account", async () => {
    mockPrisma.studentProfile.findFirst.mockResolvedValue({
      currentClassId: "cls_1",
      userId: null,
      parentLinks: [],
    });
    mockPrisma.teacherClassAssignment.findMany.mockResolvedValue([]);

    const { participantsForStudent } = await import("@/lib/messaging");
    const ids = await participantsForStudent("school_1", "stu_1");

    expect(ids).toEqual([]);
  });

  it("deduplicates when the same user appears twice", async () => {
    mockPrisma.studentProfile.findFirst.mockResolvedValue({
      currentClassId: "cls_1",
      userId: "usr_dup",
      parentLinks: [{ parentProfile: { userId: "usr_dup" } }],
    });
    mockPrisma.teacherClassAssignment.findMany.mockResolvedValue([]);

    const { participantsForStudent } = await import("@/lib/messaging");
    const ids = await participantsForStudent("school_1", "stu_1");

    expect(ids).toEqual(["usr_dup"]);
  });
});
