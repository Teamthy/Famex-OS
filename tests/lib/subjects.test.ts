import { describe, it, expect, vi, beforeEach } from "vitest";
import { availabilityLabel, examAvailability, normaliseSubjectName } from "@/lib/subjects";

/**
 * Subjects, per-student enrolment, and exam availability.
 *
 * Subjects were free-text strings, so there was nowhere to record that Adeola
 * takes Further Maths and Chidi takes Literature. Every exam therefore appeared
 * for every student in the class — including subjects they had never been
 * taught.
 *
 * `examAvailability` is the single definition of "can this be sat right now",
 * shared by the student list, the API and the runner. If those three ever
 * disagree, a student either sits an exam twice or is locked out of one they
 * can plainly see on screen.
 */

const { prisma } = await import("@/lib/prisma");
const mockPrisma = prisma as unknown as {
  subject: { findMany: ReturnType<typeof vi.fn> };
  studentProfile: { findMany: ReturnType<typeof vi.fn>; findFirst: ReturnType<typeof vi.fn> };
  studentSubject: {
    findMany: ReturnType<typeof vi.fn>;
    createMany: ReturnType<typeof vi.fn>;
  };
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.resetModules();
});

describe("normaliseSubjectName", () => {
  it("trims and collapses whitespace so one subject cannot become two", () => {
    expect(normaliseSubjectName("  Mathematics  ")).toBe("Mathematics");
    expect(normaliseSubjectName("Further   Mathematics")).toBe("Further Mathematics");
  });

  it("leaves an already-clean name alone", () => {
    expect(normaliseSubjectName("Biology")).toBe("Biology");
  });
});

describe("examAvailability", () => {
  const now = new Date("2026-06-15T10:00:00Z");
  const hours = (n: number) => new Date(now.getTime() + n * 3_600_000);

  it("is UPCOMING before the window opens", () => {
    expect(
      examAvailability({
        scheduledFor: hours(2),
        availableUntil: hours(4),
        hasSubmitted: false,
        now,
      }),
    ).toBe("UPCOMING");
  });

  it("is READY inside the window", () => {
    expect(
      examAvailability({
        scheduledFor: hours(-1),
        availableUntil: hours(2),
        hasSubmitted: false,
        now,
      }),
    ).toBe("READY");
  });

  it("is CLOSED after the window", () => {
    expect(
      examAvailability({
        scheduledFor: hours(-4),
        availableUntil: hours(-2),
        hasSubmitted: false,
        now,
      }),
    ).toBe("CLOSED");
  });

  it("is COMPLETED once submitted, even mid-window", () => {
    // A submitted attempt outranks every window. Without this a student who
    // finished early could re-enter and overwrite their own paper.
    expect(
      examAvailability({
        scheduledFor: hours(-1),
        availableUntil: hours(2),
        hasSubmitted: true,
        now,
      }),
    ).toBe("COMPLETED");
  });

  it("is COMPLETED even after the window closed", () => {
    expect(
      examAvailability({
        scheduledFor: hours(-4),
        availableUntil: hours(-2),
        hasSubmitted: true,
        now,
      }),
    ).toBe("COMPLETED");
  });

  it("treats an exam with no window as READY", () => {
    // Every exam created before scheduling existed has null dates. Defaulting
    // those to CLOSED would hide the entire existing question bank overnight.
    expect(
      examAvailability({ scheduledFor: null, availableUntil: null, hasSubmitted: false, now }),
    ).toBe("READY");
  });

  it("treats an open-ended window as READY once it has started", () => {
    expect(
      examAvailability({ scheduledFor: hours(-1), availableUntil: null, hasSubmitted: false, now }),
    ).toBe("READY");
  });

  it("is UPCOMING when only a start time is set and it has not arrived", () => {
    expect(
      examAvailability({ scheduledFor: hours(1), availableUntil: null, hasSubmitted: false, now }),
    ).toBe("UPCOMING");
  });

  it("labels every state in words a student understands", () => {
    expect(availabilityLabel("UPCOMING")).toBe("Not yet open");
    expect(availabilityLabel("READY")).toBe("Ready to take");
    expect(availabilityLabel("CLOSED")).toMatch(/Missed/);
    expect(availabilityLabel("COMPLETED")).toBe("Completed");
  });
});

describe("syncCompulsorySubjects", () => {
  it("enrols compulsory subjects and never electives", async () => {
    const { syncCompulsorySubjects } = await import("@/lib/subjects");
    mockPrisma.subject.findMany.mockResolvedValue([{ id: "sub-maths", level: "JSS1" }]);
    mockPrisma.studentProfile.findMany.mockResolvedValue([
      { id: "stu-1", currentClass: { level: "JSS1" } },
    ]);
    mockPrisma.studentSubject.createMany.mockResolvedValue({ count: 1 });

    await syncCompulsorySubjects("school-1", "JSS1");

    // The query itself must be restricted to COMPULSORY — filtering later
    // would be one refactor away from auto-assigning electives.
    expect(mockPrisma.subject.findMany.mock.calls[0][0].where.category).toBe("COMPULSORY");
  });

  it("is idempotent — skipDuplicates lets it be re-run after an admission", async () => {
    const { syncCompulsorySubjects } = await import("@/lib/subjects");
    mockPrisma.subject.findMany.mockResolvedValue([{ id: "sub-maths", level: "JSS1" }]);
    mockPrisma.studentProfile.findMany.mockResolvedValue([
      { id: "stu-1", currentClass: { level: "JSS1" } },
    ]);
    mockPrisma.studentSubject.createMany.mockResolvedValue({ count: 0 });

    await syncCompulsorySubjects("school-1", "JSS1");
    expect(mockPrisma.studentSubject.createMany.mock.calls[0][0].skipDuplicates).toBe(true);
  });

  it("only matches a student to subjects at their OWN level", async () => {
    const { syncCompulsorySubjects } = await import("@/lib/subjects");
    mockPrisma.subject.findMany.mockResolvedValue([
      { id: "sub-jss1", level: "JSS1" },
      { id: "sub-ss3", level: "SS3" },
    ]);
    mockPrisma.studentProfile.findMany.mockResolvedValue([
      { id: "stu-1", currentClass: { level: "JSS1" } },
    ]);
    mockPrisma.studentSubject.createMany.mockResolvedValue({ count: 1 });

    await syncCompulsorySubjects("school-1");

    const rows = mockPrisma.studentSubject.createMany.mock.calls[0][0].data;
    expect(rows).toHaveLength(1);
    expect(rows[0].subjectId).toBe("sub-jss1");
  });

  it("does nothing when there are no subjects, rather than failing", async () => {
    const { syncCompulsorySubjects } = await import("@/lib/subjects");
    mockPrisma.subject.findMany.mockResolvedValue([]);
    await expect(syncCompulsorySubjects("school-1")).resolves.toEqual({ created: 0 });
    expect(mockPrisma.studentSubject.createMany).not.toHaveBeenCalled();
  });

  it("only ever enrols ACTIVE students", async () => {
    const { syncCompulsorySubjects } = await import("@/lib/subjects");
    mockPrisma.subject.findMany.mockResolvedValue([{ id: "s", level: "JSS1" }]);
    mockPrisma.studentProfile.findMany.mockResolvedValue([]);

    await syncCompulsorySubjects("school-1");
    expect(mockPrisma.studentProfile.findMany.mock.calls[0][0].where.isActive).toBe(true);
  });
});

describe("studentSubjectIds", () => {
  it("returns only active enrolments, so a dropped subject disappears", async () => {
    const { studentSubjectIds } = await import("@/lib/subjects");
    mockPrisma.studentSubject.findMany.mockResolvedValue([{ subjectId: "a" }]);

    await studentSubjectIds("stu-1");
    expect(mockPrisma.studentSubject.findMany.mock.calls[0][0].where.isActive).toBe(true);
  });
});
