/**
 * Shared teacher context helper — used by all teacher API routes
 * to fetch the current teacher's profile, assignments, and form class.
 */
import { TeacherAssignmentRole, UserRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/session";

export async function getTeacherContext() {
  const user = await requireRole([
    UserRole.TEACHER,
    UserRole.HOD,
    UserRole.ADMIN,
    UserRole.DIRECTOR,
  ]);
  if (!user) return null;

  const profile = await prisma.teacherProfile.findFirst({
    where: { schoolId: user.schoolId, userId: user.id, isActive: true },
    include: {
      classAssignments: {
        where: { isActive: true },
        include: {
          classroom: {
            select: {
              id: true,
              displayName: true,
              level: true,
              capacity: true,
            },
          },
        },
      },
    },
  });

  if (!profile) return null;

  const formAssignments = profile.classAssignments.filter(
    (a) => a.role === TeacherAssignmentRole.FORM_TEACHER,
  );
  const subjectAssignments = profile.classAssignments.filter(
    (a) => a.role === TeacherAssignmentRole.SUBJECT_TEACHER && a.subjectName,
  );

  return {
    user,
    profile,
    formClassId: formAssignments[0]?.classroom.id || null,
    formClassName: formAssignments[0]?.classroom.displayName || null,
    isFormTeacher: formAssignments.length > 0,
    subjectAssignments,
  };
}

/**
 * Fetch students for the teacher's form class.
 */
export async function getFormClassStudents(
  teacherCtx: NonNullable<Awaited<ReturnType<typeof getTeacherContext>>>,
) {
  if (!teacherCtx.formClassId) return [];

  const students = await prisma.studentProfile.findMany({
    where: {
      currentClassId: teacherCtx.formClassId,
      isActive: true,
    },
    select: {
      id: true,
      studentId: true,
      displayName: true,
      firstName: true,
      lastName: true,
      gender: true,
      guardianName: true,
      guardianPhone: true,
      guardianEmail: true,
    },
    orderBy: { displayName: "asc" },
  });

  return students;
}
