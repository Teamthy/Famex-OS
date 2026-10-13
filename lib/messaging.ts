import { TeacherAssignmentRole, UserRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";

/**
 * Parent ↔ teacher messaging — access rules and thread mutations.
 *
 * Every thread is anchored to a student. Who may read or post is DERIVED from
 * existing school relationships rather than stored as a membership list, so
 * access cannot drift out of sync with reality:
 *
 *   parent  → must hold a ParentStudentLink to the thread's student
 *   teacher → must hold an active TeacherClassAssignment covering that
 *             student's current class
 *   admin   → oversight roles may read any thread in their own school
 *
 * A MessageParticipant row still exists, but only to carry each user's own
 * `lastReadAt` cursor. It is never the authority on whether access is allowed.
 */

export type MessagingActor = {
  id: string;
  schoolId: string;
  role: string;
};

const OVERSIGHT_ROLES: string[] = [
  UserRole.ADMIN,
  UserRole.DIRECTOR,
  UserRole.COORDINATOR,
  UserRole.SUPER_ADMIN,
];

/** Students this user is entitled to discuss. Empty array = no access at all. */
export async function reachableStudentIds(user: MessagingActor): Promise<string[]> {
  if (user.role === UserRole.PARENT) {
    const parent = await prisma.parentProfile.findFirst({
      where: { schoolId: user.schoolId, userId: user.id, isActive: true },
      select: { studentLinks: { select: { studentProfileId: true } } },
    });
    return parent?.studentLinks.map((l) => l.studentProfileId) ?? [];
  }

  if (user.role === UserRole.TEACHER || user.role === UserRole.HOD) {
    const teacher = await prisma.teacherProfile.findFirst({
      where: { schoolId: user.schoolId, userId: user.id, isActive: true },
      select: {
        classAssignments: {
          where: { isActive: true },
          select: { classId: true },
        },
      },
    });
    const classIds = [...new Set(teacher?.classAssignments.map((a) => a.classId) ?? [])];
    if (classIds.length === 0) return [];

    const students = await prisma.studentProfile.findMany({
      where: { schoolId: user.schoolId, currentClassId: { in: classIds }, isActive: true },
      select: { id: true },
      take: 1000,
    });
    return students.map((s) => s.id);
  }

  /**
   * A student may discuss exactly one student: themselves.
   *
   * Before this, STUDENT fell through to the empty return, so students had no
   * messaging at all — no inbox, no way to ask a form teacher a question, no
   * reply to a message sent about them.
   *
   * Resolved by userId, deliberately NOT by class. Widening to classmates
   * would make every thread about every child in the class visible to all of
   * them, because the inbox query selects on `studentProfileId IN (...)`.
   */
  if (user.role === UserRole.STUDENT) {
    const student = await prisma.studentProfile.findFirst({
      where: { schoolId: user.schoolId, userId: user.id, isActive: true },
      select: { id: true },
    });
    return student ? [student.id] : [];
  }

  if (OVERSIGHT_ROLES.includes(user.role)) {
    const students = await prisma.studentProfile.findMany({
      where: { schoolId: user.schoolId, isActive: true },
      select: { id: true },
      take: 2000,
    });
    return students.map((s) => s.id);
  }

  return [];
}

/**
 * Confirm the user may access this thread, and return it.
 * Returns null when the thread does not exist, belongs to another school, or
 * concerns a student this user has no relationship with.
 */
export async function assertThreadAccess(user: MessagingActor, threadId: string) {
  const thread = await prisma.messageThread.findFirst({
    where: { id: threadId, schoolId: user.schoolId },
    select: {
      id: true,
      schoolId: true,
      subject: true,
      status: true,
      studentProfileId: true,
      createdAt: true,
      lastMessageAt: true,
      studentProfile: {
        select: {
          id: true,
          displayName: true,
          studentId: true,
          currentClass: { select: { displayName: true } },
        },
      },
    },
  });
  if (!thread) return null;

  const allowed = await reachableStudentIds(user);
  if (!allowed.includes(thread.studentProfileId)) return null;

  return thread;
}

/** The counterpart users who should be able to see a thread about a student. */
export async function participantsForStudent(
  schoolId: string,
  studentProfileId: string,
): Promise<string[]> {
  const student = await prisma.studentProfile.findFirst({
    where: { id: studentProfileId, schoolId },
    select: {
      currentClassId: true,
      // The student's own login. Without it, a thread ABOUT a student is
      // invisible TO that student — they would be the only participant in
      // their own conversation who could not read it.
      userId: true,
      parentLinks: { select: { parentProfile: { select: { userId: true } } } },
    },
  });
  if (!student) return [];

  const parentUserIds = student.parentLinks
    .map((l) => l.parentProfile?.userId)
    .filter((v): v is string => !!v);

  // Nullable: a student record can exist before its login is provisioned.
  const studentUserIds = student.userId ? [student.userId] : [];

  // Only the FORM teacher is auto-added. Adding every subject teacher would put
  // a private family conversation in front of a dozen staff by default.
  const formTeachers = await prisma.teacherClassAssignment.findMany({
    where: {
      schoolId,
      classId: student.currentClassId,
      role: TeacherAssignmentRole.FORM_TEACHER,
      isActive: true,
    },
    select: { teacherProfile: { select: { userId: true } } },
  });
  const teacherUserIds = formTeachers
    .map((a) => a.teacherProfile?.userId)
    .filter((v): v is string => !!v);

  return [...new Set([...studentUserIds, ...parentUserIds, ...teacherUserIds])];
}

/** Trim a body down to a one-line inbox preview. */
export function previewOf(body: string, max = 120): string {
  const flat = body.replace(/\s+/g, " ").trim();
  return flat.length <= max ? flat : `${flat.slice(0, max - 1)}…`;
}

/**
 * Post a message, creating participant rows for anyone missing and refreshing
 * the thread's denormalised preview fields.
 *
 * Runs in a transaction so a thread can never advertise a preview for a
 * message that failed to insert.
 */
export async function postMessage(params: {
  schoolId: string;
  threadId: string;
  senderUserId: string;
  body: string;
}) {
  const { schoolId, threadId, senderUserId, body } = params;

  return prisma.$transaction(async (tx) => {
    const message = await tx.message.create({
      data: { schoolId, threadId, senderUserId, body },
      select: { id: true, body: true, createdAt: true, senderUserId: true },
    });

    await tx.messageThread.update({
      where: { id: threadId },
      data: {
        lastMessageAt: message.createdAt,
        lastMessagePreview: previewOf(body),
      },
    });

    // The sender has, by definition, read their own message.
    await tx.messageParticipant.upsert({
      where: { threadId_userId: { threadId, userId: senderUserId } },
      create: { threadId, userId: senderUserId, lastReadAt: message.createdAt },
      update: { lastReadAt: message.createdAt },
    });

    return message;
  });
}

/** Unread count per thread for one user, based on their own read cursor. */
export async function unreadCounts(
  userId: string,
  threadIds: string[],
): Promise<Record<string, number>> {
  if (threadIds.length === 0) return {};

  const participants = await prisma.messageParticipant.findMany({
    where: { userId, threadId: { in: threadIds } },
    select: { threadId: true, lastReadAt: true },
  });
  const cursor = new Map(participants.map((p) => [p.threadId, p.lastReadAt]));

  const counts: Record<string, number> = {};
  await Promise.all(
    threadIds.map(async (threadId) => {
      const readAt = cursor.get(threadId) ?? null;
      counts[threadId] = await prisma.message.count({
        where: {
          threadId,
          senderUserId: { not: userId },
          ...(readAt ? { createdAt: { gt: readAt } } : {}),
        },
      });
    }),
  );
  return counts;
}
