import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { resolveTenantFromHost } from "@/lib/tenant";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Public academic calendar.
 *
 * Returns the current academic session's terms and upcoming events
 * (school events, exam windows, public holidays set by admin). Marked as
 * IS_PUBLIC so anyone can subscribe to it via iCal feed; we don't leak
 * private scheduling (internal staff meetings) here.
 */
export async function GET() {
  const h = await headers();
  const host = h.get("x-forwarded-host") || h.get("host");
  const resolved = await resolveTenantFromHost(host);
  if (!resolved?.school) return NextResponse.json({ terms: [], events: [] });

  const currentSession = await prisma.academicSession.findFirst({
    where: { schoolId: resolved.school.id, isActive: true },
    select: { id: true, name: true },
  });

  if (!currentSession) return NextResponse.json({ terms: [], events: [] });

  const terms = await prisma.term.findMany({
    where: { academicSessionId: currentSession.id },
    select: { name: true, startsAt: true, endsAt: true },
    orderBy: { startsAt: "asc" },
  });

  // NewsPosts that are public and dated within this session act as public events.
  const events = await prisma.newsPost.findMany({
    where: {
      schoolId: resolved.school.id,
      isPublished: true,
      publishedAt: {
        gte: terms[0]?.startsAt ?? new Date(Date.now() - 30 * 86400_000),
        lte: terms[terms.length - 1]?.endsAt ?? new Date(Date.now() + 365 * 86400_000),
      },
    },
    select: { id: true, title: true, slug: true, publishedAt: true, category: true },
    orderBy: { publishedAt: "asc" },
    take: 200,
  });

  return NextResponse.json({
    session: currentSession.name,
    terms: terms.map((t) => ({
      name: t.name,
      startsAt: t.startsAt?.toISOString() ?? null,
      endsAt: t.endsAt?.toISOString() ?? null,
    })),
    events: events.map((e) => ({
      id: e.id,
      title: e.title,
      date: e.publishedAt?.toISOString() ?? null,
      category: e.category,
      link: `/news-events/${e.slug}`,
    })),
  });
}
