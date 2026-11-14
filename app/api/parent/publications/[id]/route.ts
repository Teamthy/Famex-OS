import { NewsAudience, UserRole } from "@prisma/client";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/session";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: RouteContext) {
  const user = await requireRole([UserRole.PARENT]);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const post = await prisma.newsPost.findFirst({
    where: {
      id,
      schoolId: user.schoolId,
      isPublished: true,
      audience: { not: NewsAudience.PUBLIC },
      recipients: {
        some: {
          schoolId: user.schoolId,
          parentProfile: { userId: user.id, schoolId: user.schoolId, isActive: true },
        },
      },
    },
    select: {
      id: true,
      title: true,
      category: true,
      excerpt: true,
      content: true,
      publishedAt: true,
    },
  });
  if (!post) return NextResponse.json({ error: "Publication not found." }, { status: 404 });

  return NextResponse.json({
    publication: { ...post, publishedAt: post.publishedAt?.toISOString() ?? null },
  });
}
