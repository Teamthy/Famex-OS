import { TeacherAssignmentRole } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { teacherMayViewReportCard } from "@/lib/report-card-access";

describe("teacher report-card print access", () => {
  it("allows a form teacher to view a card for their assigned class", () => {
    expect(
      teacherMayViewReportCard({
        classId: "class_1",
        assignments: [{ classId: "class_1", role: TeacherAssignmentRole.FORM_TEACHER }],
      }),
    ).toBe(true);
  });

  it("does not expose the complete report card to a subject teacher", () => {
    expect(
      teacherMayViewReportCard({
        classId: "class_1",
        assignments: [{ classId: "class_1", role: TeacherAssignmentRole.SUBJECT_TEACHER }],
      }),
    ).toBe(false);
  });

  it("denies teachers assigned to a different class", () => {
    expect(
      teacherMayViewReportCard({
        classId: "class_1",
        assignments: [
          { classId: "class_2", role: TeacherAssignmentRole.FORM_TEACHER },
          { classId: "class_2", role: TeacherAssignmentRole.SUBJECT_TEACHER },
        ],
      }),
    ).toBe(false);
  });

  it("denies a card without a current class", () => {
    expect(
      teacherMayViewReportCard({
        classId: null,
        assignments: [{ classId: "class_1", role: TeacherAssignmentRole.FORM_TEACHER }],
      }),
    ).toBe(false);
  });
});
