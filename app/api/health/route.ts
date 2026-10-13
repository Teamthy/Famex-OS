import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

interface HealthStatus {
  status: "healthy" | "degraded" | "unhealthy";
  timestamp: string;
  uptime: number;
  checks: {
    database: { status: "up" | "down"; latencyMs: number };
    redis: { status: "configured" | "not_configured" | "down" };
  };
}

export async function GET() {
  const checks: HealthStatus["checks"] = {
    database: { status: "down", latencyMs: 0 },
    redis: { status: "not_configured" },
  };

  // ── Database check ─────────────────────────────────────────
  const dbStart = Date.now();
  try {
    await prisma.$queryRaw`SELECT 1`;
    checks.database = { status: "up", latencyMs: Date.now() - dbStart };
  } catch {
    checks.database = { status: "down", latencyMs: Date.now() - dbStart };
  }

  // ── Redis check ────────────────────────────────────────────
  const redisUrl = process.env.UPSTASH_REDIS_REST_URL;
  const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (redisUrl && redisToken) {
    try {
      const { Redis } = await import("@upstash/redis");
      const redis = new Redis({ url: redisUrl, token: redisToken });
      await redis.ping();
      checks.redis = { status: "configured" };
    } catch {
      checks.redis = { status: "down" };
    }
  }

  // ── Overall status ─────────────────────────────────────────
  // Only the DATABASE decides the HTTP status.
  //
  // This used to 503 whenever Redis was down, which meant a Redis blip made
  // every otherwise-healthy instance look dead to the load balancer and got it
  // pulled from rotation — turning a degraded-rate-limiting incident into an
  // outage. Redis being down is real and still reported as "degraded" in the
  // body, but the app can serve every request without it.
  const databaseUp = checks.database.status === "up";
  const allUp = databaseUp && checks.redis.status !== "down";

  const status: HealthStatus["status"] = allUp ? "healthy" : databaseUp ? "degraded" : "unhealthy";

  const body: HealthStatus = {
    status,
    timestamp: new Date().toISOString(),
    uptime: Math.floor(process.uptime()),
    checks,
  };

  return NextResponse.json(body, { status: databaseUp ? 200 : 503 });
}
