import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/session";
import { UserRole } from "@prisma/client";

export const dynamic = "force-dynamic";

const INSTRUCTOR_ROLES = [UserRole.TEACHER, UserRole.HOD, UserRole.ADMIN, UserRole.DIRECTOR];

export async function GET() {
  const user = await requireRole(INSTRUCTOR_ROLES);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const teacherProfile = await prisma.teacherProfile.findFirst({
    where: { schoolId: user.schoolId, userId: user.id, isActive: true },
  });

  // Get all IT courses with enrollment + progress stats
  const courses = await prisma.itCourse.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: "asc" },
    include: {
      modules: { select: { id: true, title: true, durationMinutes: true } },
      enrollments: {
        include: {
          progress: { select: { id: true } },
          certificate: { select: { id: true } },
          user: { select: { name: true, email: true } },
        },
      },
    },
  });

  // Calculate stats per course
  const courseStats = courses.map((course) => {
    const totalEnrollments = course.enrollments.length;
    const completions = course.enrollments.filter((e) => e.certificate).length;
    const activeLearners = course.enrollments.filter(
      (e) => !e.certificate && e.progress.length > 0,
    ).length;
    const avgProgress =
      totalEnrollments > 0
        ? Math.round(
            course.enrollments.reduce(
              (sum, e) => sum + (e.progress.length / Math.max(1, course.modules.length)) * 100,
              0,
            ) / totalEnrollments,
          )
        : 0;

    return {
      id: course.id,
      slug: course.slug,
      title: course.title,
      tagline: course.tagline,
      level: course.level,
      moduleCount: course.modules.length,
      totalDurationMinutes: course.modules.reduce((sum, m) => sum + m.durationMinutes, 0),
      totalEnrollments,
      completions,
      activeLearners,
      completionRate: totalEnrollments > 0 ? Math.round((completions / totalEnrollments) * 100) : 0,
      avgProgress,
      certificatesIssued: completions,
    };
  });

  // Global stats
  const totalEnrollments = courseStats.reduce((sum, c) => sum + c.totalEnrollments, 0);
  const totalCompletions = courseStats.reduce((sum, c) => sum + c.completions, 0);
  const totalCertificates = courseStats.reduce((sum, c) => sum + c.certificatesIssued, 0);

  // Recent enrollments (last 20)
  const recentEnrollments = await prisma.itEnrollment.findMany({
    orderBy: { enrolledAt: "desc" },
    take: 20,
    include: {
      user: { select: { name: true, email: true } },
      course: { select: { title: true, slug: true } },
      progress: { select: { id: true } },
    },
  });

  // Exam stats
  const exams = await prisma.exam.findMany({
    where: {
      ...(teacherProfile ? { teacherProfileId: teacherProfile.id } : {}),
    },
    include: {
      classroom: { select: { displayName: true } },
      questions: { select: { id: true } },
      attempts: { select: { id: true, status: true, totalScore: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 10,
  });

  return NextResponse.json({
    instructor: {
      name: user.name,
      email: user.email,
      role: user.role,
      isTeacher: !!teacherProfile,
    },
    overview: {
      totalCourses: courses.length,
      totalEnrollments,
      totalCompletions,
      totalCertificates,
      overallCompletionRate:
        totalEnrollments > 0 ? Math.round((totalCompletions / totalEnrollments) * 100) : 0,
    },
    courses: courseStats,
    recentEnrollments: recentEnrollments.map((e) => ({
      studentName: e.user.name,
      studentEmail: e.user.email,
      courseTitle: e.course.title,
      courseSlug: e.course.slug,
      enrolledAt: e.enrolledAt.toISOString(),
      modulesCompleted: e.progress.length,
    })),
    exams: exams.map((exam) => ({
      id: exam.id,
      title: exam.title,
      subjectName: exam.subjectName,
      className: exam.classroom.displayName,
      questionCount: exam.questions.length,
      attemptCount: exam.attempts.length,
      avgScore:
        exam.attempts.length > 0
          ? Math.round(
              exam.attempts.reduce((sum, a) => sum + a.totalScore, 0) / exam.attempts.length,
            )
          : null,
      status: exam.status,
    })),
  });
}
