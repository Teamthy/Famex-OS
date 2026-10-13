import { describe, it, expect, vi, beforeEach } from "vitest";
import { mockPrisma } from "../setup";

/**
 * End-of-session promotion.
 *
 * This is the most destructive operation in the product: it moves every student
 * at once. A mistake here is not a rendering glitch — it puts a cohort in the
 * wrong class, or loses the record of where they were, and there is no way to
 * reconstruct it afterwards.
 */

const SCHOOL = "school_1";
const SESSION_A = "sess_2026";
const SESSION_B = "sess_2027";

const CLASSES = [
  { id: "c_jss1a", displayName: "JSS1A", level: "JSS1", arm: "A" },
  { id: "c_jss1b", displayName: "JSS1B", level: "JSS1", arm: "B" },
  { id: "c_jss2a", displayName: "JSS2A", level: "JSS2", arm: "A" },
  { id: "c_ss3a", displayName: "SS3A", level: "SS3", arm: "A" },
];

function enrolment(id: string, classroom: (typeof CLASSES)[number], active = true) {
  return {
    studentProfileId: id,
    classId: classroom.id,
    studentProfile: { id, displayName: `Student ${id}`, studentId: `YKC/${id}`, isActive: active },
    classroom,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockPrisma.schoolClass.findMany.mockResolvedValue(CLASSES);
});

describe("buildPlan", () => {
  it("moves a student to the same arm of the next level", async () => {
    mockPrisma.studentEnrolment.findMany.mockResolvedValue([enrolment("s1", CLASSES[0])]);

    const { buildPlan } = await import("@/lib/promotion");
    const [row] = await buildPlan(SCHOOL, SESSION_A);

    expect(row.proposedOutcome).toBe("PROMOTED");
    expect(row.targetClassName).toBe("JSS2A");
    expect(row.blocker).toBeNull();
  });

  it("graduates the terminal year instead of promoting it", async () => {
    mockPrisma.studentEnrolment.findMany.mockResolvedValue([enrolment("s2", CLASSES[3])]);

    const { buildPlan } = await import("@/lib/promotion");
    const [row] = await buildPlan(SCHOOL, SESSION_A);

    expect(row.proposedOutcome).toBe("GRADUATED");
    expect(row.targetClassId).toBeNull();
  });

  it("flags a missing destination rather than dropping the student elsewhere", async () => {
    // JSS1B exists but JSS2B does not. Quietly using JSS2A would scatter an
    // arm across the school with nothing to show it happened.
    mockPrisma.studentEnrolment.findMany.mockResolvedValue([enrolment("s3", CLASSES[1])]);

    const { buildPlan } = await import("@/lib/promotion");
    const [row] = await buildPlan(SCHOOL, SESSION_A);

    expect(row.targetClassId).toBeNull();
    expect(row.blocker).toMatch(/JSS2B/);
  });

  it("flags an unknown level instead of graduating it by accident", async () => {
    const odd = { id: "c_x", displayName: "Nursery2A", level: "Nursery2", arm: "A" };
    mockPrisma.studentEnrolment.findMany.mockResolvedValue([enrolment("s4", odd)]);
    mockPrisma.schoolClass.findMany.mockResolvedValue([...CLASSES, odd]);

    const { buildPlan } = await import("@/lib/promotion");
    const [row] = await buildPlan(SCHOOL, SESSION_A);

    // Must NOT be GRADUATED — that would deactivate a child still in school.
    expect(row.proposedOutcome).not.toBe("GRADUATED");
    expect(row.blocker).toMatch(/progression/i);
  });

  it("skips students whose profile is inactive", async () => {
    mockPrisma.studentEnrolment.findMany.mockResolvedValue([
      enrolment("s5", CLASSES[0], false),
      enrolment("s6", CLASSES[0], true),
    ]);

    const { buildPlan } = await import("@/lib/promotion");
    const rows = await buildPlan(SCHOOL, SESSION_A);
    expect(rows).toHaveLength(1);
    expect(rows[0].studentProfileId).toBe("s6");
  });

  it("only considers enrolments still in progress", async () => {
    mockPrisma.studentEnrolment.findMany.mockResolvedValue([]);

    const { buildPlan } = await import("@/lib/promotion");
    await buildPlan(SCHOOL, SESSION_A);

    const where = mockPrisma.studentEnrolment.findMany.mock.calls[0][0].where;
    expect(where.outcome).toBe("IN_PROGRESS");
    expect(where.sessionId).toBe(SESSION_A);
    expect(where.schoolId).toBe(SCHOOL);
  });
});

describe("summarisePlan", () => {
  it("counts each proposed outcome and any blockers", async () => {
    const { summarisePlan } = await import("@/lib/promotion");
    const rows = [
      { proposedOutcome: "PROMOTED", blocker: null },
      { proposedOutcome: "PROMOTED", blocker: "missing class" },
      { proposedOutcome: "GRADUATED", blocker: null },
      { proposedOutcome: "REPEATED", blocker: null },
    ] as never;

    expect(summarisePlan(rows)).toEqual({
      total: 4,
      promoting: 2,
      graduating: 1,
      repeating: 1,
      blocked: 1,
    });
  });
});

describe("commitPromotion", () => {
  const base = {
    schoolId: SCHOOL,
    fromSessionId: SESSION_A,
    toSessionId: SESSION_B,
    actorUserId: "u_admin",
  };

  beforeEach(() => {
    // Leaver handling reads back userId to close the login, so the update must
    // resolve to something. Default to a student who HAS an account.
    mockPrisma.studentProfile.update.mockResolvedValue({ userId: "u9" });
  });

  it("refuses to promote a session into itself", async () => {
    const { commitPromotion } = await import("@/lib/promotion");
    await expect(
      commitPromotion({
        ...base,
        toSessionId: SESSION_A,
        decisions: [{ studentProfileId: "s1", outcome: "PROMOTED", targetClassId: "c_jss2a" }],
      }),
    ).rejects.toThrow(/different from the one being closed/i);
  });

  it("refuses an empty decision list", async () => {
    const { commitPromotion } = await import("@/lib/promotion");
    await expect(commitPromotion({ ...base, decisions: [] })).rejects.toThrow(/no students/i);
  });

  it("refuses a promotion with no destination class", async () => {
    // Without this the student would be written with an undefined classId.
    const { commitPromotion } = await import("@/lib/promotion");
    await expect(
      commitPromotion({
        ...base,
        decisions: [{ studentProfileId: "s1", outcome: "PROMOTED", targetClassId: null }],
      }),
    ).rejects.toThrow(/destination class is required/i);
  });

  it("refuses a repeat with no destination class", async () => {
    const { commitPromotion } = await import("@/lib/promotion");
    await expect(
      commitPromotion({
        ...base,
        decisions: [{ studentProfileId: "s1", outcome: "REPEATED" }],
      }),
    ).rejects.toThrow(/destination class is required/i);
  });

  it("validates before opening a transaction, so a bad payload is cheap", async () => {
    const { commitPromotion } = await import("@/lib/promotion");
    await expect(
      commitPromotion({
        ...base,
        decisions: [{ studentProfileId: "s1", outcome: "PROMOTED" }],
      }),
    ).rejects.toThrow();
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
  });

  it("refuses a second run against the same target session", async () => {
    // Running twice would create a duplicate year in every student's history.
    mockPrisma.studentEnrolment.count.mockResolvedValue(6);

    const { commitPromotion } = await import("@/lib/promotion");
    await expect(
      commitPromotion({
        ...base,
        decisions: [{ studentProfileId: "s1", outcome: "PROMOTED", targetClassId: "c_jss2a" }],
      }),
    ).rejects.toThrow(/already been run/i);
  });

  it("closes the old enrolment, opens a new one and moves the cached class", async () => {
    mockPrisma.studentEnrolment.count.mockResolvedValue(0);

    const { commitPromotion } = await import("@/lib/promotion");
    const res = await commitPromotion({
      ...base,
      decisions: [{ studentProfileId: "s1", outcome: "PROMOTED", targetClassId: "c_jss2a" }],
    });

    expect(res.promoted).toBe(1);

    // Outgoing enrolment stamped with its outcome — this is the history row.
    const closed = mockPrisma.studentEnrolment.updateMany.mock.calls[0][0];
    expect(closed.where.sessionId).toBe(SESSION_A);
    expect(closed.data.outcome).toBe("PROMOTED");
    expect(closed.data.completedAt).toBeInstanceOf(Date);

    // Incoming enrolment created rather than the old row being edited.
    const opened = mockPrisma.studentEnrolment.create.mock.calls[0][0];
    expect(opened.data.sessionId).toBe(SESSION_B);
    expect(opened.data.classId).toBe("c_jss2a");
    expect(opened.data.outcome).toBe("IN_PROGRESS");

    expect(mockPrisma.studentProfile.update).toHaveBeenCalledWith({
      where: { id: "s1" },
      data: { currentClassId: "c_jss2a" },
    });
  });

  it("gives a repeater a fresh enrolment in the SAME class", async () => {
    // The repeated year must still appear in their history, not be skipped.
    mockPrisma.studentEnrolment.count.mockResolvedValue(0);

    const { commitPromotion } = await import("@/lib/promotion");
    const res = await commitPromotion({
      ...base,
      decisions: [{ studentProfileId: "s1", outcome: "REPEATED", targetClassId: "c_jss1a" }],
    });

    expect(res.repeated).toBe(1);
    expect(res.promoted).toBe(0);
    expect(mockPrisma.studentEnrolment.create.mock.calls[0][0].data.classId).toBe("c_jss1a");
  });

  it("deactivates a graduate without creating a new enrolment", async () => {
    mockPrisma.studentEnrolment.count.mockResolvedValue(0);

    const { commitPromotion } = await import("@/lib/promotion");
    const res = await commitPromotion({
      ...base,
      decisions: [{ studentProfileId: "s9", outcome: "GRADUATED" }],
    });

    expect(res.graduated).toBe(1);
    // No enrolment in the new session — they have left.
    expect(mockPrisma.studentEnrolment.create).not.toHaveBeenCalled();
    // Profile kept, just inactive, so transcripts still resolve.
    expect(mockPrisma.studentProfile.update).toHaveBeenCalledWith({
      where: { id: "s9" },
      data: { isActive: false },
      select: { userId: true },
    });
    // ...and the LOGIN is closed too. Deactivating only the profile left the
    // User row active, so a graduate could still sign in and then hit "No live
    // student profile is linked to this account yet" — a dead end for every
    // leaver, every year.
    expect(mockPrisma.user.update).toHaveBeenCalledWith({
      where: { id: "u9" },
      data: { isActive: false, tokenVersion: { increment: 1 } },
    });
  });

  it("revokes an existing session so a leaver is signed out, not just blocked", async () => {
    mockPrisma.studentEnrolment.count.mockResolvedValue(0);
    mockPrisma.studentProfile.update.mockResolvedValue({ userId: "u9" });

    const { commitPromotion } = await import("@/lib/promotion");
    await commitPromotion({
      ...base,
      decisions: [{ studentProfileId: "s9", outcome: "GRADUATED" }],
    });

    // Without the tokenVersion bump they stay signed in on their phone until
    // the token happens to expire.
    const call = mockPrisma.user.update.mock.calls[0][0];
    expect(call.data.tokenVersion).toEqual({ increment: 1 });
  });

  it("does not attempt a user update for a student with no login", async () => {
    mockPrisma.studentEnrolment.count.mockResolvedValue(0);
    // Plenty of younger students have a profile but no account of their own.
    mockPrisma.studentProfile.update.mockResolvedValue({ userId: null });

    const { commitPromotion } = await import("@/lib/promotion");
    await commitPromotion({
      ...base,
      decisions: [{ studentProfileId: "s9", outcome: "GRADUATED" }],
    });

    expect(mockPrisma.user.update).not.toHaveBeenCalled();
  });

  it("treats withdrawn and transferred as leavers too", async () => {
    mockPrisma.studentEnrolment.count.mockResolvedValue(0);

    const { commitPromotion } = await import("@/lib/promotion");
    const res = await commitPromotion({
      ...base,
      decisions: [
        { studentProfileId: "s1", outcome: "WITHDRAWN" },
        { studentProfileId: "s2", outcome: "TRANSFERRED" },
      ],
    });

    expect(res.withdrawn).toBe(1);
    expect(res.transferred).toBe(1);
    expect(mockPrisma.studentEnrolment.create).not.toHaveBeenCalled();
  });

  it("runs everything inside one transaction and writes an audit entry", async () => {
    // A partial rollover would leave half a school promoted with no way to
    // tell which half.
    mockPrisma.studentEnrolment.count.mockResolvedValue(0);

    const { commitPromotion } = await import("@/lib/promotion");
    await commitPromotion({
      ...base,
      decisions: [{ studentProfileId: "s1", outcome: "PROMOTED", targetClassId: "c_jss2a" }],
    });

    expect(mockPrisma.$transaction).toHaveBeenCalled();
    const audit = mockPrisma.auditLog.create.mock.calls[0][0];
    expect(audit.data.action).toBe("SESSION_PROMOTION_COMMITTED");
    expect(audit.data.metadata.fromSessionId).toBe(SESSION_A);
  });
});
