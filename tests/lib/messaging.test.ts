import { describe, it, expect, vi, beforeEach } from "vitest";
import { mockPrisma } from "../setup";

/**
 * Parent ↔ teacher messaging — access control.
 *
 * A leak here is a family's private conversation about their child shown to
 * the wrong parent, or to another school entirely. Participation is DERIVED
 * from ParentStudentLink / TeacherClassAssignment rather than stored, so these
 * tests pin the derivation itself: if someone later "optimises" it into a
 * stored membership list, these fail.
 */

const PARENT = { id: "u_parent", schoolId: "school_1", role: "PARENT" };
const TEACHER = { id: "u_teacher", schoolId: "school_1", role: "TEACHER" };
const STUDENT = { id: "u_student", schoolId: "school_1", role: "STUDENT" };
const ADMIN = { id: "u_admin", schoolId: "school_1", role: "ADMIN" };

beforeEach(() => {
  vi.clearAllMocks();
});

describe("reachableStudentIds", () => {
  it("gives a parent exactly their linked children", async () => {
    mockPrisma.parentProfile.findFirst.mockResolvedValue({
      studentLinks: [{ studentProfileId: "stu_1" }, { studentProfileId: "stu_2" }],
    });

    const { reachableStudentIds } = await import("@/lib/messaging");
    expect(await reachableStudentIds(PARENT)).toEqual(["stu_1", "stu_2"]);
  });

  it("returns nothing for a parent with no linked children", async () => {
    mockPrisma.parentProfile.findFirst.mockResolvedValue({ studentLinks: [] });

    const { reachableStudentIds } = await import("@/lib/messaging");
    expect(await reachableStudentIds(PARENT)).toEqual([]);
  });

  it("returns nothing when the parent profile is missing or inactive", async () => {
    mockPrisma.parentProfile.findFirst.mockResolvedValue(null);

    const { reachableStudentIds } = await import("@/lib/messaging");
    expect(await reachableStudentIds(PARENT)).toEqual([]);
  });

  it("gives a teacher the students in classes they are assigned to", async () => {
    mockPrisma.teacherProfile.findFirst.mockResolvedValue({
      classAssignments: [{ classId: "c_1" }, { classId: "c_2" }],
    });
    mockPrisma.studentProfile.findMany.mockResolvedValue([{ id: "stu_3" }, { id: "stu_4" }]);

    const { reachableStudentIds } = await import("@/lib/messaging");
    expect(await reachableStudentIds(TEACHER)).toEqual(["stu_3", "stu_4"]);

    // Scoped to the teacher's classes and their own school.
    const where = mockPrisma.studentProfile.findMany.mock.calls[0][0].where;
    expect(where.currentClassId).toEqual({ in: ["c_1", "c_2"] });
    expect(where.schoolId).toBe("school_1");
  });

  it("short-circuits for a teacher with no class assignments", async () => {
    mockPrisma.teacherProfile.findFirst.mockResolvedValue({ classAssignments: [] });

    const { reachableStudentIds } = await import("@/lib/messaging");
    expect(await reachableStudentIds(TEACHER)).toEqual([]);
    // No point querying students when the class list is empty.
    expect(mockPrisma.studentProfile.findMany).not.toHaveBeenCalled();
  });

  it("de-duplicates class ids so one student is not counted twice", async () => {
    // A teacher can hold both FORM and SUBJECT assignments on the same class.
    mockPrisma.teacherProfile.findFirst.mockResolvedValue({
      classAssignments: [{ classId: "c_1" }, { classId: "c_1" }, { classId: "c_2" }],
    });
    mockPrisma.studentProfile.findMany.mockResolvedValue([]);

    const { reachableStudentIds } = await import("@/lib/messaging");
    await reachableStudentIds(TEACHER);

    expect(mockPrisma.studentProfile.findMany.mock.calls[0][0].where.currentClassId).toEqual({
      in: ["c_1", "c_2"],
    });
  });

  it("excludes students entirely — messaging is parent/staff only", async () => {
    const { reachableStudentIds } = await import("@/lib/messaging");
    expect(await reachableStudentIds(STUDENT)).toEqual([]);
    expect(mockPrisma.parentProfile.findFirst).not.toHaveBeenCalled();
    expect(mockPrisma.teacherProfile.findFirst).not.toHaveBeenCalled();
  });

  it("lets oversight roles see their own school only", async () => {
    mockPrisma.studentProfile.findMany.mockResolvedValue([{ id: "stu_9" }]);

    const { reachableStudentIds } = await import("@/lib/messaging");
    expect(await reachableStudentIds(ADMIN)).toEqual(["stu_9"]);
    expect(mockPrisma.studentProfile.findMany.mock.calls[0][0].where.schoolId).toBe("school_1");
  });
});

describe("assertThreadAccess", () => {
  const thread = {
    id: "t_1",
    schoolId: "school_1",
    subject: "Homework",
    status: "OPEN",
    studentProfileId: "stu_1",
    createdAt: new Date(),
    lastMessageAt: new Date(),
    studentProfile: {
      id: "stu_1",
      displayName: "Adeola",
      studentId: "YKC/1",
      currentClass: { displayName: "JSS 1" },
    },
  };

  it("allows a parent linked to the thread's student", async () => {
    mockPrisma.messageThread.findFirst.mockResolvedValue(thread);
    mockPrisma.parentProfile.findFirst.mockResolvedValue({
      studentLinks: [{ studentProfileId: "stu_1" }],
    });

    const { assertThreadAccess } = await import("@/lib/messaging");
    expect(await assertThreadAccess(PARENT, "t_1")).not.toBeNull();
  });

  it("refuses a parent who is NOT linked to that student", async () => {
    mockPrisma.messageThread.findFirst.mockResolvedValue(thread);
    mockPrisma.parentProfile.findFirst.mockResolvedValue({
      studentLinks: [{ studentProfileId: "stu_OTHER" }],
    });

    const { assertThreadAccess } = await import("@/lib/messaging");
    expect(await assertThreadAccess(PARENT, "t_1")).toBeNull();
  });

  it("scopes the lookup by schoolId so another tenant cannot read by id", async () => {
    mockPrisma.messageThread.findFirst.mockResolvedValue(null);

    const { assertThreadAccess } = await import("@/lib/messaging");
    const foreign = { id: "u_x", schoolId: "school_2", role: "PARENT" };
    expect(await assertThreadAccess(foreign, "t_1")).toBeNull();

    expect(mockPrisma.messageThread.findFirst.mock.calls[0][0].where).toEqual({
      id: "t_1",
      schoolId: "school_2",
    });
  });

  it("refuses a teacher whose classes do not include the student", async () => {
    mockPrisma.messageThread.findFirst.mockResolvedValue(thread);
    mockPrisma.teacherProfile.findFirst.mockResolvedValue({
      classAssignments: [{ classId: "c_9" }],
    });
    mockPrisma.studentProfile.findMany.mockResolvedValue([{ id: "stu_ELSEWHERE" }]);

    const { assertThreadAccess } = await import("@/lib/messaging");
    expect(await assertThreadAccess(TEACHER, "t_1")).toBeNull();
  });
});

describe("participantsForStudent", () => {
  it("adds the linked parents and the FORM teacher only", async () => {
    mockPrisma.studentProfile.findFirst.mockResolvedValue({
      currentClassId: "c_1",
      parentLinks: [{ parentProfile: { userId: "u_mum" } }, { parentProfile: { userId: "u_dad" } }],
    });
    mockPrisma.teacherClassAssignment.findMany.mockResolvedValue([
      { teacherProfile: { userId: "u_form" } },
    ]);

    const { participantsForStudent } = await import("@/lib/messaging");
    const ids = await participantsForStudent("school_1", "stu_1");

    expect(ids.sort()).toEqual(["u_dad", "u_form", "u_mum"]);
    // Deliberate: subject teachers are NOT auto-added, or a private family
    // conversation would land in front of a dozen staff by default.
    expect(mockPrisma.teacherClassAssignment.findMany.mock.calls[0][0].where.role).toBe(
      "FORM_TEACHER",
    );
  });

  it("returns nothing for an unknown student", async () => {
    mockPrisma.studentProfile.findFirst.mockResolvedValue(null);

    const { participantsForStudent } = await import("@/lib/messaging");
    expect(await participantsForStudent("school_1", "nope")).toEqual([]);
  });

  it("de-duplicates a user who is both parent and staff", async () => {
    mockPrisma.studentProfile.findFirst.mockResolvedValue({
      currentClassId: "c_1",
      parentLinks: [{ parentProfile: { userId: "u_both" } }],
    });
    mockPrisma.teacherClassAssignment.findMany.mockResolvedValue([
      { teacherProfile: { userId: "u_both" } },
    ]);

    const { participantsForStudent } = await import("@/lib/messaging");
    expect(await participantsForStudent("school_1", "stu_1")).toEqual(["u_both"]);
  });
});

describe("previewOf", () => {
  it("collapses whitespace and newlines onto one line", async () => {
    const { previewOf } = await import("@/lib/messaging");
    expect(previewOf("  Good   morning\n\nsir  ")).toBe("Good morning sir");
  });

  it("truncates with an ellipsis at the limit", async () => {
    const { previewOf } = await import("@/lib/messaging");
    const out = previewOf("x".repeat(200));
    expect(out).toHaveLength(120);
    expect(out.endsWith("…")).toBe(true);
  });

  it("leaves a short body untouched", async () => {
    const { previewOf } = await import("@/lib/messaging");
    expect(previewOf("Thanks")).toBe("Thanks");
  });
});

describe("unreadCounts", () => {
  it("counts only messages from OTHER people after the read cursor", async () => {
    const readAt = new Date("2026-01-01T10:00:00Z");
    mockPrisma.messageParticipant.findMany.mockResolvedValue([
      { threadId: "t_1", lastReadAt: readAt },
    ]);
    mockPrisma.message.count.mockResolvedValue(3);

    const { unreadCounts } = await import("@/lib/messaging");
    expect(await unreadCounts("u_parent", ["t_1"])).toEqual({ t_1: 3 });

    const where = mockPrisma.message.count.mock.calls[0][0].where;
    // Your own messages never count as unread.
    expect(where.senderUserId).toEqual({ not: "u_parent" });
    expect(where.createdAt).toEqual({ gt: readAt });
  });

  it("counts every incoming message when the thread was never opened", async () => {
    mockPrisma.messageParticipant.findMany.mockResolvedValue([
      { threadId: "t_1", lastReadAt: null },
    ]);
    mockPrisma.message.count.mockResolvedValue(5);

    const { unreadCounts } = await import("@/lib/messaging");
    expect(await unreadCounts("u_parent", ["t_1"])).toEqual({ t_1: 5 });
    // No date filter at all, rather than a filter on null.
    expect(mockPrisma.message.count.mock.calls[0][0].where.createdAt).toBeUndefined();
  });

  it("avoids a query when there are no threads", async () => {
    const { unreadCounts } = await import("@/lib/messaging");
    expect(await unreadCounts("u_parent", [])).toEqual({});
    expect(mockPrisma.messageParticipant.findMany).not.toHaveBeenCalled();
  });
});

describe("postMessage", () => {
  it("writes the message, refreshes the preview and advances the sender's cursor", async () => {
    const createdAt = new Date("2026-02-01T09:00:00Z");
    mockPrisma.message.create.mockResolvedValue({
      id: "m_1",
      body: "Hello",
      createdAt,
      senderUserId: "u_parent",
    });

    const { postMessage } = await import("@/lib/messaging");
    const msg = await postMessage({
      schoolId: "school_1",
      threadId: "t_1",
      senderUserId: "u_parent",
      body: "Hello",
    });

    expect(msg.id).toBe("m_1");

    // The thread's denormalised preview must match what was just inserted, or
    // the inbox would advertise a message that is not there.
    const update = mockPrisma.messageThread.update.mock.calls[0][0];
    expect(update.data.lastMessagePreview).toBe("Hello");
    expect(update.data.lastMessageAt).toBe(createdAt);

    // Sending implies reading your own message.
    expect(mockPrisma.messageParticipant.upsert).toHaveBeenCalled();

    // All of it inside one transaction.
    expect(mockPrisma.$transaction).toHaveBeenCalled();
  });
});
