import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SLUG_PATH: Record<string, string> = {
  python: "python",
  ai: "ai",
  cybersecurity: "cybersecurity",
  "digital-literacy": "digital-literacy",
  "microsoft-word": "microsoft-word",
  "microsoft-excel": "microsoft-excel",
  "microsoft-powerpoint": "microsoft-powerpoint",
  "excel-expert": "excel-expert",
};

export async function GET() {
  try {
    const courses = await prisma.itCourse.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: "asc" },
      include: { modules: { select: { id: true } }, _count: { select: { enrollments: true } } },
    });
    return NextResponse.json({
      courses: courses.map((c) => ({
        id: c.id,
        slug: c.slug,
        title: c.title,
        tagline: c.tagline,
        description: c.description,
        level: c.level,
        certification: c.certification,
        durationWeeks: c.durationWeeks,
        moduleCount: c.modules.length,
        enrollmentCount: c._count.enrollments,
        href: `/it-education/${SLUG_PATH[c.slug] || c.slug}`,
      })),
    });
  } catch (error) {
    logger.error("Request failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ courses: [] }, { status: 200 });
  }
}
