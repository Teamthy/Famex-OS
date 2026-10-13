import { UserRole } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getClientIp } from "@/lib/requests";
import { enforceRateLimit } from "@/lib/rate-limit";
import { requireRole } from "@/lib/session";

export const dynamic = "force-dynamic";

const ADMIN_ROLES = [UserRole.ADMIN, UserRole.DIRECTOR, UserRole.COORDINATOR, UserRole.SUPER_ADMIN];

function slugify(title: string) {
  return `${title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)}-${Date.now().toString(36)}`;
}

export async function GET() {
  const user = await requireRole(ADMIN_ROLES);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const posts = await prisma.newsPost.findMany({
    take: 500,
    where: { schoolId: user.schoolId },
    orderBy: { createdAt: "desc" },
    include: { author: { select: { name: true } } },
  });

  return NextResponse.json({
    posts: posts.map((post) => ({
      id: post.id,
      title: post.title,
      slug: post.slug,
      category: post.category,
      excerpt: post.excerpt,
      content: post.content,
      isPublished: post.isPublished,
      publishedAt: post.publishedAt?.toISOString() || null,
      authorName: post.author?.name || "—",
      createdAt: post.createdAt.toISOString(),
    })),
  });
}

const createSchema = z.object({
  title: z.string().trim().min(4).max(180),
  category: z.string().trim().min(2).max(40),
  excerpt: z.string().trim().min(10).max(300),
  content: z.string().trim().min(20).max(20_000),
  publish: z.boolean().optional(),
});

export async function POST(request: NextRequest) {
  const user = await requireRole(ADMIN_ROLES);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const limit = await enforceRateLimit("newsPost", user.id);
  if (!limit.success) {
    return NextResponse.json(
      { error: "Too many news posts. Please wait before posting again." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } },
    );
  }

  let payload: z.infer<typeof createSchema>;
  try {
    payload = createSchema.parse(await request.json());
  } catch (error) {
    const message =
      error instanceof z.ZodError ? error.issues[0]?.message || "Invalid post." : "Invalid post.";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const post = await prisma.newsPost.create({
    data: {
      schoolId: user.schoolId,
      authorUserId: user.id,
      title: payload.title,
      slug: slugify(payload.title),
      category: payload.category,
      excerpt: payload.excerpt,
      content: payload.content,
      isPublished: Boolean(payload.publish),
      publishedAt: payload.publish ? new Date() : null,
    },
  });

  await prisma.auditLog.create({
    data: {
      schoolId: user.schoolId,
      actorUserId: user.id,
      action: payload.publish ? "NEWS_POST_PUBLISHED" : "NEWS_POST_DRAFTED",
      entityType: "NewsPost",
      entityId: post.id,
      metadata: { title: post.title },
      ipAddress: getClientIp(request),
    },
  });

  return NextResponse.json({
    ok: true,
    message: payload.publish ? "Post published." : "Draft saved.",
  });
}

const patchSchema = z.object({
  postId: z.string().trim().min(1),
  action: z.enum(["PUBLISH", "UNPUBLISH", "DELETE"]),
});

export async function PATCH(request: NextRequest) {
  const user = await requireRole(ADMIN_ROLES);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let payload: z.infer<typeof patchSchema>;
  try {
    payload = patchSchema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const post = await prisma.newsPost.findFirst({
    where: { id: payload.postId, schoolId: user.schoolId },
  });
  if (!post) return NextResponse.json({ error: "Post not found." }, { status: 404 });

  if (payload.action === "DELETE") {
    await prisma.newsPost.delete({ where: { id: post.id } });
    return NextResponse.json({ ok: true, message: "Post deleted." });
  }

  const publish = payload.action === "PUBLISH";
  await prisma.newsPost.update({
    where: { id: post.id },
    data: { isPublished: publish, publishedAt: publish ? post.publishedAt || new Date() : null },
  });
  return NextResponse.json({
    ok: true,
    message: publish ? "Post published." : "Post unpublished.",
  });
}
