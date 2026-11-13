import { TeacherAssignmentRole } from "@prisma/client";

export type ReportCardTeacherAssignment = {
  classId: string;
  role: TeacherAssignmentRole;
};

/** Full report cards are visible to a form teacher assigned to that class. */
export function teacherMayViewReportCard(params: {
  classId: string | null;
  assignments: ReportCardTeacherAssignment[];
}): boolean {
  return Boolean(
    params.classId &&
    params.assignments.some(
      (assignment) =>
        assignment.classId === params.classId &&
        assignment.role === TeacherAssignmentRole.FORM_TEACHER,
    ),
  );
}
