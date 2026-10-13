import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/session";
import type { SecurityEventType } from "@prisma/client";

export const dynamic = "force-dynamic";

const VALID_RANGES = ["24h", "7d", "30d", "90d", "all"] as const;
type TimeRange = (typeof VALID_RANGES)[number];

function rangeToStart(range: TimeRange): Date | null {
  const now = Date.now();
  switch (range) {
    case "24h":
      return new Date(now - 24 * 60 * 60 * 1000);
    case "7d":
      return new Date(now - 7 * 24 * 60 * 60 * 1000);
    case "30d":
      return new Date(now - 30 * 24 * 60 * 60 * 1000);
    case "90d":
      return new Date(now - 90 * 24 * 60 * 60 * 1000);
    case "all":
      return null;
  }
}

export async function GET(request: NextRequest) {
  const user = await requireRole(["SUPER_ADMIN"]);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const params = request.nextUrl.searchParams;
  const range = (params.get("range") || "24h") as TimeRange;
  const eventType = params.get("eventType") as SecurityEventType | null;
  const email = params.get("email")?.trim().toLowerCase() || "";
  const page = Math.max(1, parseInt(params.get("page") || "1", 10) || 1);
  const pageSize = 50;

  const since = rangeToStart(VALID_RANGES.includes(range) ? range : "24h");

  const where: Record<string, unknown> = {};
  if (since) where.createdAt = { gte: since };
  if (eventType) where.eventType = eventType;
  if (email) where.userEmail = { contains: email, mode: "insensitive" };

  const [total, events, eventTypeCounts, hourlyBreakdown] = await Promise.all([
    prisma.securityEvent.count({ where }),
    prisma.securityEvent.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.securityEvent.groupBy({
      by: ["eventType"],
      where,
      _count: true,
      orderBy: { _count: { eventType: "desc" } },
    }),
    // Hourly breakdown for the last 24h chart
    since && range === "24h"
      ? prisma.securityEvent.groupBy({
          by: ["eventType"],
          where: { ...where, createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
          _count: true,
        })
      : Promise.resolve([]),
  ]);

  // Top offending IPs
  const recentEvents = await prisma.securityEvent.findMany({
    where: {
      ...where,
      eventType: { in: ["LOGIN_FAILED_BAD_PASSWORD", "LOGIN_FAILED_ACCOUNT_NOT_FOUND"] },
    },
    select: { ipAddress: true },
    take: 1000,
    orderBy: { createdAt: "desc" },
  });
  const ipCounts = new Map<string, number>();
  for (const e of recentEvents) {
    if (e.ipAddress) ipCounts.set(e.ipAddress, (ipCounts.get(e.ipAddress) || 0) + 1);
  }
  const topIps = [...ipCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([ip, count]) => ({ ip, count }));

  return NextResponse.json({
    total,
    page,
    pageSize,
    pages: Math.max(1, Math.ceil(total / pageSize)),
    range: VALID_RANGES.includes(range) ? range : "24h",
    summary: eventTypeCounts.map((row) => ({ eventType: row.eventType, count: row._count })),
    topOffendingIps: topIps,
    hourlyBreakdown,
    events: events.map((e) => ({
      id: e.id,
      eventType: e.eventType,
      schoolId: e.schoolId,
      userEmail: e.userEmail,
      userId: e.userId,
      ipAddress: e.ipAddress,
      userAgent: e.userAgent,
      targetPath: e.targetPath,
      reason: e.reason,
      metadata: e.metadata,
      at: e.createdAt.toISOString(),
    })),
  });
}
