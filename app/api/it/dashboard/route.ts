import { NextResponse } from "next/server";
import { getCourseCatalogForUser, getItPortalUser } from "@/lib/it-education";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getItPortalUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const catalog = await getCourseCatalogForUser(user.id);
  const enrolled = catalog.filter((course) => course.enrolled);
  const completed = enrolled.filter((course) => course.status === "COMPLETED");
  const certificates = await prisma.itCertificate.findMany({
    where: { enrollment: { userId: user.id } },
    orderBy: { issuedAt: "desc" },
    include: {
      enrollment: { include: { course: { select: { title: true, certification: true } } } },
    },
  });

  return NextResponse.json({
    user: { name: user.name, email: user.email, role: user.role },
    summary: {
      enrolledCourses: enrolled.length,
      completedCourses: completed.length,
      certificatesEarned: certificates.length,
      averageProgress: enrolled.length
        ? Math.round(
            enrolled.reduce((sum, course) => sum + course.progressPercent, 0) / enrolled.length,
          )
        : 0,
    },
    catalog,
    certificates: certificates.map((certificate) => ({
      certificateNumber: certificate.certificateNumber,
      issuedAt: certificate.issuedAt.toISOString(),
      courseTitle: certificate.enrollment.course.title,
      credential: certificate.enrollment.course.certification,
    })),
  });
}
