import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { resolveTenantFromHost } from "@/lib/tenant";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const slug = request.nextUrl.searchParams.get("slug")?.trim();
  // AUD-F1: this route used to ignore the request host and always serve the
  // OLDEST school's posts (findFirst by createdAt) — so tenant B's portal
  // showed tenant A's news and never its own. Resolve the school from the
  // host exactly like the login route does (customDomain → subdomain →
  // default school), and scope the query to it.
  const { tenant: school } = await resolveTenantFromHost(request.headers.get("host"));
  if (!school) return NextResponse.json({ posts: [] });

  if (slug) {
    const post = await prisma.newsPost.findFirst({
      where: { schoolId: school.id, slug, isPublished: true },
      select: {
        id: true,
        title: true,
        slug: true,
        category: true,
        excerpt: true,
        content: true,
        publishedAt: true,
      },
    });
    if (!post) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ post });
  }

  const posts = await prisma.newsPost.findMany({
    where: { schoolId: school.id, isPublished: true },
    orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
    take: 40,
    select: {
      id: true,
      title: true,
      slug: true,
      category: true,
      excerpt: true,
      publishedAt: true,
    },
  });

  return NextResponse.json({ posts });
}
