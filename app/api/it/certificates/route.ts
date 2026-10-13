import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getItPortalUser } from "@/lib/it-education";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getItPortalUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const certificates = await prisma.itCertificate.findMany({
    where: { enrollment: { userId: user.id } },
    orderBy: { issuedAt: "desc" },
    include: {
      enrollment: {
        include: {
          course: {
            select: {
              slug: true,
              title: true,
              tagline: true,
              level: true,
              certification: true,
              durationWeeks: true,
            },
          },
          progress: { select: { id: true } },
        },
      },
    },
  });

  // Also get learning stats
  const enrollments = await prisma.itEnrollment.findMany({
    where: { userId: user.id },
    include: {
      course: { select: { title: true, durationWeeks: true } },
      progress: { select: { id: true, completedAt: true } },
    },
  });

  const totalModulesCompleted = enrollments.reduce((sum, e) => sum + e.progress.length, 0);
  const totalWeeksLearning = enrollments
    .filter((e) => e.status === "COMPLETED")
    .reduce((sum, e) => sum + e.course.durationWeeks, 0);

  const streakDays = calculateStreak(
    enrollments.flatMap((e) => e.progress.map((p) => p.completedAt)),
  );

  return NextResponse.json({
    user: { name: user.name, email: user.email },
    certificates: certificates.map((cert) => ({
      id: cert.id,
      certificateNumber: cert.certificateNumber,
      issuedAt: cert.issuedAt.toISOString(),
      course: cert.enrollment.course,
      modulesCompleted: cert.enrollment.progress.length,
    })),
    stats: {
      totalCertificates: certificates.length,
      totalModulesCompleted,
      totalWeeksLearning,
      streakDays,
      totalEnrollments: enrollments.length,
      completedCourses: enrollments.filter((e) => e.status === "COMPLETED").length,
    },
  });
}

function calculateStreak(dates: Date[]): number {
  if (dates.length === 0) return 0;
  const uniqueDays = [...new Set(dates.map((d) => new Date(d).toDateString()))].sort(
    (a, b) => new Date(b).getTime() - new Date(a).getTime(),
  );
  let streak = 1;
  for (let i = 1; i < uniqueDays.length; i++) {
    const prev = new Date(uniqueDays[i - 1]);
    const curr = new Date(uniqueDays[i]);
    const diffDays = Math.round((prev.getTime() - curr.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays === 1) streak++;
    else break;
  }
  return streak;
}
