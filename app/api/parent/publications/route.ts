import { NewsAudience, UserRole } from "@prisma/client";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await requireRole([UserRole.PARENT]);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const recipients = await prisma.newsPostRecipient.findMany({
    where: {
      schoolId: user.schoolId,
      parentProfile: { userId: user.id, schoolId: user.schoolId, isActive: true },
      newsPost: {
        schoolId: user.schoolId,
        isPublished: true,
        audience: { not: NewsAudience.PUBLIC },
      },
    },
    orderBy: [{ newsPost: { publishedAt: "desc" } }, { createdAt: "desc" }],
    take: 100,
    select: {
      newsPost: {
        select: {
          id: true,
          title: true,
          category: true,
          excerpt: true,
          publishedAt: true,
        },
      },
    },
  });

  return NextResponse.json({
    publications: recipients.map(({ newsPost }) => ({
      ...newsPost,
      publishedAt: newsPost.publishedAt?.toISOString() ?? null,
    })),
  });
}
