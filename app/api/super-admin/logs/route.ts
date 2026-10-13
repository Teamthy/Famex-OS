import { UserRole } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/session";

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
  const user = await requireRole([UserRole.SUPER_ADMIN]);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const params = request.nextUrl.searchParams;
  const action = params.get("action")?.trim() || "";
  const actorEmail = params.get("actor")?.trim().toLowerCase() || "";
  const entityType = params.get("entityType")?.trim() || "";
  const range = (params.get("range") || "24h") as TimeRange;
  const page = Math.max(1, parseInt(params.get("page") || "1", 10) || 1);
  const pageSize = 50;

  const since = rangeToStart(VALID_RANGES.includes(range) ? range : "24h");

  const where: Record<string, unknown> = {};
  if (since) where.createdAt = { gte: since };
  if (action) where.action = { contains: action.toUpperCase() };
  if (entityType) where.entityType = { contains: entityType, mode: "insensitive" as const };
  if (actorEmail) where.actor = { email: { contains: actorEmail } };

  const [total, logs, actionCounts] = await Promise.all([
    prisma.auditLog.count({ where }),
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: { actor: { select: { name: true, email: true, role: true } } },
    }),
    prisma.auditLog.groupBy({
      by: ["action"],
      where,
      _count: true,
      orderBy: { _count: { action: "desc" } },
      take: 15,
    }),
  ]);

  return NextResponse.json({
    total,
    page,
    pageSize,
    pages: Math.max(1, Math.ceil(total / pageSize)),
    range: VALID_RANGES.includes(range) ? range : "24h",
    topActions: actionCounts.map((row) => ({ action: row.action, count: row._count })),
    logs: logs.map((entry) => ({
      id: entry.id,
      action: entry.action,
      entityType: entry.entityType,
      entityId: entry.entityId,
      actorName: entry.actor?.name || "System",
      actorEmail: entry.actor?.email || null,
      actorRole: entry.actor?.role || null,
      ipAddress: entry.ipAddress,
      metadata: entry.metadata,
      at: entry.createdAt.toISOString(),
    })),
  });
}
