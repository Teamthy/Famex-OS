import { ItEnrollmentStatus, UserRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireRole, type SessionUser } from "@/lib/session";

export const IT_PORTAL_ROLES: UserRole[] = [
  UserRole.IT_STUDENT,
  UserRole.STUDENT,
  UserRole.ADMIN,
  UserRole.DIRECTOR,
];

export type ItCourseSummary = {
  id: string;
  slug: string;
  title: string;
  tagline: string;
  level: string;
  certification: string;
  durationWeeks: number;
  moduleCount: number;
  enrolled: boolean;
  progressPercent: number;
  status: string | null;
  certificateNumber: string | null;
};

export async function getItPortalUser(): Promise<SessionUser | null> {
  return requireRole(IT_PORTAL_ROLES);
}

export function certificateNumber(courseSlug: string, userId: string) {
  const year = new Date().getFullYear();
  const tail = userId.slice(-6).toUpperCase();
  return `YKIT/${year}/${courseSlug.toUpperCase().replace(/-/g, "").slice(0, 8)}/${tail}`;
}

export async function getCourseCatalogForUser(userId: string): Promise<ItCourseSummary[]> {
  const courses = await prisma.itCourse.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: "asc" },
    include: {
      modules: { select: { id: true } },
      enrollments: {
        where: { userId },
        include: {
          progress: { select: { moduleId: true } },
          certificate: { select: { certificateNumber: true } },
        },
      },
    },
  });

  return courses.map((course) => {
    const enrollment = course.enrollments[0] || null;
    const moduleCount = course.modules.length;
    const completed = enrollment ? enrollment.progress.length : 0;
    return {
      id: course.id,
      slug: course.slug,
      title: course.title,
      tagline: course.tagline,
      level: course.level,
      certification: course.certification,
      durationWeeks: course.durationWeeks,
      moduleCount,
      enrolled: Boolean(enrollment),
      progressPercent: enrollment && moduleCount ? Math.round((completed / moduleCount) * 100) : 0,
      status: enrollment?.status || null,
      certificateNumber: enrollment?.certificate?.certificateNumber || null,
    };
  });
}

export async function completeModuleAndMaybeCertify(input: {
  userId: string;
  courseId: string;
  moduleId: string;
}) {
  const enrollment = await prisma.itEnrollment.findUnique({
    where: { userId_courseId: { userId: input.userId, courseId: input.courseId } },
    include: { course: { include: { modules: { select: { id: true } } } }, progress: true },
  });
  if (!enrollment) return { error: "You are not enrolled in this course." };

  const moduleIds = new Set(enrollment.course.modules.map((m) => m.id));
  if (!moduleIds.has(input.moduleId)) return { error: "Module not found in this course." };

  await prisma.itModuleProgress.upsert({
    where: { enrollmentId_moduleId: { enrollmentId: enrollment.id, moduleId: input.moduleId } },
    update: {},
    create: { enrollmentId: enrollment.id, moduleId: input.moduleId },
  });

  const completedCount = await prisma.itModuleProgress.count({
    where: { enrollmentId: enrollment.id },
  });
  const total = enrollment.course.modules.length;

  if (total > 0 && completedCount >= total && enrollment.status !== ItEnrollmentStatus.COMPLETED) {
    const certNumber = certificateNumber(enrollment.course.slug, input.userId);
    await prisma.$transaction([
      prisma.itEnrollment.update({
        where: { id: enrollment.id },
        data: { status: ItEnrollmentStatus.COMPLETED, completedAt: new Date() },
      }),
      prisma.itCertificate.upsert({
        where: { enrollmentId: enrollment.id },
        update: {},
        create: { enrollmentId: enrollment.id, certificateNumber: certNumber },
      }),
    ]);
    return {
      completed: true,
      certified: true,
      certificateNumber: certNumber,
      progressPercent: 100,
    };
  }

  return {
    completed: true,
    certified: false,
    certificateNumber: null,
    progressPercent: total ? Math.round((completedCount / total) * 100) : 0,
  };
}
