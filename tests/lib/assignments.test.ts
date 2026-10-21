import { describe, expect, it } from "vitest";
import { AssignmentStatus, AssignmentSubmissionStatus } from "@prisma/client";
import {
  canStudentSubmitAssignment,
  normalizeHttpsUrl,
  summarizeAssignmentSubmissions,
  validateAssignmentDueDate,
  validateAssignmentScore,
} from "@/lib/assignments";

const now = new Date("2026-10-21T09:00:00.000Z");
const future = new Date("2026-10-22T09:00:00.000Z");
const past = new Date("2026-10-20T09:00:00.000Z");

describe("assignment rules", () => {
  it("requires a future due date when saving", () => {
    expect(validateAssignmentDueDate(future, now)).toBeNull();
    expect(validateAssignmentDueDate(past, now)).toMatch(/future/);
    expect(validateAssignmentDueDate(new Date("not a date"), now)).toMatch(/valid/);
  });

  it("validates whole-number scores against the assignment maximum", () => {
    expect(validateAssignmentScore(8, 10)).toBeNull();
    expect(validateAssignmentScore(11, 10)).toMatch(/between 0 and 10/);
    expect(validateAssignmentScore(7.5, 10)).toMatch(/whole number/);
    expect(validateAssignmentScore(1, 0)).toMatch(/Maximum score/);
  });

  it("accepts only credential-free HTTPS attachment links", () => {
    expect(normalizeHttpsUrl("https://drive.google.com/file/abc")).toBe(
      "https://drive.google.com/file/abc",
    );
    expect(normalizeHttpsUrl("http://example.com/work")).toBeNull();
    expect(normalizeHttpsUrl("https://user:secret@example.com/work")).toBeNull();
    expect(normalizeHttpsUrl("not a link")).toBeNull();
    expect(normalizeHttpsUrl("")).toBeNull();
  });

  it("allows an overdue submission while published but flags it late", () => {
    expect(
      canStudentSubmitAssignment({
        assignmentStatus: AssignmentStatus.PUBLISHED,
        dueAt: past,
        now,
      }),
    ).toEqual({ allowed: true, reason: null, isLate: true });
  });

  it("blocks draft, closed and already-graded work", () => {
    expect(
      canStudentSubmitAssignment({ assignmentStatus: AssignmentStatus.DRAFT, dueAt: future, now })
        .allowed,
    ).toBe(false);
    expect(
      canStudentSubmitAssignment({
        assignmentStatus: AssignmentStatus.CLOSED,
        dueAt: future,
        now,
      }).reason,
    ).toMatch(/closed/);
    expect(
      canStudentSubmitAssignment({
        assignmentStatus: AssignmentStatus.PUBLISHED,
        dueAt: future,
        existingStatus: AssignmentSubmissionStatus.GRADED,
        now,
      }).reason,
    ).toMatch(/graded/);
  });

  it("allows a returned submission to be revised", () => {
    expect(
      canStudentSubmitAssignment({
        assignmentStatus: AssignmentStatus.PUBLISHED,
        dueAt: future,
        existingStatus: AssignmentSubmissionStatus.RETURNED,
        now,
      }).allowed,
    ).toBe(true);
  });

  it("summarises missing, late, returned and graded work", () => {
    const summary = summarizeAssignmentSubmissions(
      [
        {
          status: AssignmentSubmissionStatus.GRADED,
          score: 8,
          submittedAt: new Date("2026-10-21T08:00:00Z"),
        },
        {
          status: AssignmentSubmissionStatus.GRADED,
          score: 10,
          submittedAt: new Date("2026-10-23T08:00:00Z"),
        },
        {
          status: AssignmentSubmissionStatus.RETURNED,
          score: null,
          submittedAt: new Date("2026-10-21T07:00:00Z"),
        },
        {
          status: AssignmentSubmissionStatus.SUBMITTED,
          score: null,
          submittedAt: new Date("2026-10-21T06:00:00Z"),
        },
      ],
      6,
      future,
    );
    expect(summary).toEqual({
      submitted: 4,
      awaitingGrade: 1,
      graded: 2,
      returned: 1,
      missing: 2,
      late: 1,
      averageScore: 9,
    });
  });
});
