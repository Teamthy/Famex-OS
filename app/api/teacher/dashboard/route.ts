import {
  AttendanceStatus,
  ExamStatus,
  GradebookStatus,
  TeacherAssignmentRole,
  UserRole,
} from "@prisma/client";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await requireRole([
    UserRole.TEACHER,
    UserRole.HOD,
    UserRole.ADMIN,
    UserRole.DIRECTOR,
  ]);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

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
              students: { where: { isActive: true }, select: { id: true } },
            },
          },
        },
      },
    },
  });

  if (!profile) {
    return NextResponse.json(
      { error: "No teacher profile is linked to this account. Contact the school administrator." },
      { status: 404 },
    );
  }

  const formAssignments = profile.classAssignments.filter(
    (a) => a.role === TeacherAssignmentRole.FORM_TEACHER,
  );
  const subjectAssignments = profile.classAssignments.filter(
    (a) => a.role === TeacherAssignmentRole.SUBJECT_TEACHER && a.subjectName,
  );

  const classIds = [...new Set(profile.classAssignments.map((a) => a.classroom.id))];
  const totalStudents = [
    ...new Set(profile.classAssignments.flatMap((a) => a.classroom.students.map((s) => s.id))),
  ].length;

  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const [todaySessions, recentSessions, pendingCorrections, activity, openGradebooks, liveExams] =
    await Promise.all([
      prisma.attendanceSession.findMany({
        where: { teacherProfileId: profile.id, sessionDate: { gte: startOfDay } },
        include: {
          classroom: { select: { displayName: true } },
          entries: { select: { status: true } },
        },
      }),
      prisma.attendanceSession.findMany({
        where: { teacherProfileId: profile.id, submittedAt: { not: null } },
        orderBy: { sessionDate: "desc" },
        take: 5,
        include: {
          classroom: { select: { displayName: true } },
          entries: { select: { status: true } },
        },
      }),
      prisma.attendanceCorrectionRequest.count({
        where: { teacherProfileId: profile.id, status: "PENDING" },
      }),
      prisma.auditLog.findMany({
        where: { schoolId: user.schoolId, actorUserId: user.id },
        orderBy: { createdAt: "desc" },
        take: 6,
        select: { action: true, entityType: true, createdAt: true },
      }),
      prisma.subjectGradebook.findMany({
        where: {
          teacherProfileId: profile.id,
          status: { in: [GradebookStatus.OPEN, GradebookStatus.SUBMITTED] },
        },
        orderBy: { updatedAt: "desc" },
        take: 8,
        include: {
          classroom: { select: { displayName: true } },
          _count: { select: { entries: true } },
        },
      }),
      prisma.exam.findMany({
        where: {
          teacherProfileId: profile.id,
          status: { in: [ExamStatus.PUBLISHED, ExamStatus.DRAFT] },
        },
        orderBy: { updatedAt: "desc" },
        take: 6,
        include: {
          classroom: { select: { displayName: true } },
          _count: { select: { questions: true, attempts: true } },
        },
      }),
    ]);

  // Map gradebooks back to assignment ids for deep-links
  const assignmentByKey = new Map(
    subjectAssignments.map((a) => [
      `${a.classroom.id}::${(a.subjectName || "").toLowerCase()}`,
      a.id,
    ]),
  );

  return NextResponse.json({
    teacher: {
      displayName: profile.displayName,
      roleLabel: profile.roleLabel,
      photoUrl: profile.photoUrl,
      isFormTeacher: formAssignments.length > 0,
      isSubjectTeacher: subjectAssignments.length > 0,
      formClassName: formAssignments[0]?.classroom.displayName || null,
      formClassId: formAssignments[0]?.classroom.id || null,
    },
    stats: {
      classCount: classIds.length,
      totalStudents,
      subjectCount: [...new Set(subjectAssignments.map((a) => a.subjectName).filter(Boolean))]
        .length,
      pendingCorrections,
      todayRegisterDone: todaySessions.some((session) => session.submittedAt),
      openGradebooks: openGradebooks.filter((g) => g.status === GradebookStatus.OPEN).length,
      liveExams: liveExams.filter((e) => e.status === ExamStatus.PUBLISHED).length,
    },
    assignments: profile.classAssignments.map((assignment) => ({
      id: assignment.id,
      role: assignment.role,
      subjectName: assignment.subjectName,
      classId: assignment.classroom.id,
      className: assignment.classroom.displayName,
      studentCount: assignment.classroom.students.length,
      gradebookHref:
        assignment.role === TeacherAssignmentRole.SUBJECT_TEACHER && assignment.subjectName
          ? `/teacher/gradebook?assignmentId=${encodeURIComponent(assignment.id)}`
          : null,
      attendanceHref:
        assignment.role === TeacherAssignmentRole.FORM_TEACHER ? `/teacher/class/attendance` : null,
    })),
    gradebooks: openGradebooks.map((g) => {
      const key = `${g.classId}::${g.subjectName.toLowerCase()}`;
      const assignmentId = assignmentByKey.get(key) || null;
      return {
        id: g.id,
        subjectName: g.subjectName,
        className: g.classroom.displayName,
        status: g.status,
        entryCount: g._count.entries,
        href: assignmentId
          ? `/teacher/gradebook?assignmentId=${encodeURIComponent(assignmentId)}`
          : "/teacher/gradebook",
      };
    }),
    exams: liveExams.map((e) => ({
      id: e.id,
      title: e.title,
      subjectName: e.subjectName,
      className: e.classroom.displayName,
      status: e.status,
      questionCount: e._count.questions,
      attemptCount: e._count.attempts,
      href: "/teacher/cbt-center",
    })),
    recentSessions: recentSessions.map((session) => ({
      className: session.classroom.displayName,
      date: session.sessionDate.toISOString(),
      present: session.entries.filter((entry) => entry.status === AttendanceStatus.PRESENT).length,
      total: session.entries.length,
      isLocked: session.isLocked,
    })),
    activity: activity.map((entry) => ({
      action: entry.action,
      entityType: entry.entityType,
      at: entry.createdAt.toISOString(),
    })),
  });
}
