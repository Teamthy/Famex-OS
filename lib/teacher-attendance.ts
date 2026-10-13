import { AttendanceStatus, TeacherAssignmentRole, UserRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireRole, type SessionUser } from "@/lib/session";

export const ATTENDANCE_ALLOWED_ROLES: UserRole[] = [
  UserRole.TEACHER,
  UserRole.HOD,
  UserRole.ADMIN,
  UserRole.DIRECTOR,
];

export type TeacherAttendanceContext = {
  user: SessionUser;
  teacherProfile: {
    id: string;
    displayName: string;
    classAssignments: Array<{
      id: string;
      role: TeacherAssignmentRole;
      subjectName: string | null;
      classroom: {
        id: string;
        displayName: string;
        level: string;
        arm: string;
      };
    }>;
  };
};

export async function getTeacherAttendanceContext(): Promise<TeacherAttendanceContext | null> {
  const user = await requireRole(ATTENDANCE_ALLOWED_ROLES);
  if (!user) return null;

  const teacherProfile = await prisma.teacherProfile.findFirst({
    where: {
      schoolId: user.schoolId,
      userId: user.id,
      isActive: true,
    },
    select: {
      id: true,
      displayName: true,
      classAssignments: {
        where: { isActive: true },
        orderBy: [{ role: "asc" }, { classroom: { displayName: "asc" } }],
        select: {
          id: true,
          role: true,
          subjectName: true,
          classroom: {
            select: {
              id: true,
              displayName: true,
              level: true,
              arm: true,
            },
          },
        },
      },
    },
  });

  if (!teacherProfile) return null;
  return { user, teacherProfile };
}

export function normalizeAttendanceDate(input?: string | null) {
  const candidate =
    input && /^\d{4}-\d{2}-\d{2}$/.test(input) ? input : new Date().toISOString().slice(0, 10);
  return new Date(`${candidate}T12:00:00.000Z`);
}

export function attendanceDateKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

export function summarizeStatuses<T extends { status: AttendanceStatus }>(entries: T[]) {
  return entries.reduce(
    (summary, entry) => {
      if (entry.status === AttendanceStatus.PRESENT) summary.present += 1;
      if (entry.status === AttendanceStatus.ABSENT) summary.absent += 1;
      if (entry.status === AttendanceStatus.LATE) summary.late += 1;
      summary.total += 1;
      return summary;
    },
    { present: 0, absent: 0, late: 0, total: 0 },
  );
}
