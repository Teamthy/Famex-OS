import { NextRequest, NextResponse } from "next/server";
import { getItPortalUser } from "@/lib/it-education";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(_request: NextRequest, context: { params: Promise<{ slug: string }> }) {
  const user = await getItPortalUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { slug } = await context.params;

  const course = await prisma.itCourse.findFirst({
    where: { slug, isActive: true },
    include: {
      modules: { orderBy: { sortOrder: "asc" } },
      enrollments: {
        where: { userId: user.id },
        include: {
          progress: { select: { moduleId: true } },
          certificate: { select: { certificateNumber: true, issuedAt: true } },
        },
      },
    },
  });

  if (!course) return NextResponse.json({ error: "Course not found." }, { status: 404 });

  const enrollment = course.enrollments[0] || null;
  const completedModuleIds = new Set(enrollment?.progress.map((entry) => entry.moduleId) || []);

  return NextResponse.json({
    course: {
      id: course.id,
      slug: course.slug,
      title: course.title,
      tagline: course.tagline,
      description: course.description,
      level: course.level,
      certification: course.certification,
      durationWeeks: course.durationWeeks,
      enrolled: Boolean(enrollment),
      status: enrollment?.status || null,
      certificateNumber: enrollment?.certificate?.certificateNumber || null,
      progressPercent:
        enrollment && course.modules.length
          ? Math.round((completedModuleIds.size / course.modules.length) * 100)
          : 0,
      modules: course.modules.map((module) => ({
        id: module.id,
        title: module.title,
        summary: module.summary,
        content: module.content,
        durationMinutes: module.durationMinutes,
        completed: completedModuleIds.has(module.id),
      })),
    },
  });
}
