import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { promises as fs } from "node:fs";
import path from "node:path";

export const dynamic = "force-dynamic";

/**
 * Kubernetes/AWS-style readiness + deep health.
 *
 * Verifies DB, migration status (presence of _prisma_migrations table),
 * and writable data directory (for module-store JSON records / backups).
 * Returns 200 only when everything critical is reachable.
 *
 * Release-gate requirement: monitoring.
 */
export async function GET() {
  const start = Date.now();
  const out: any = {
    status: "healthy",
    timestamp: new Date().toISOString(),
    uptime: Math.floor(process.uptime()),
    version: process.env.NEXT_PUBLIC_APP_VERSION ?? process.env.RENDER_GIT_COMMIT ?? "dev",
    checks: {} as Record<string, any>,
  };

  // 1. Database (SELECT 1)
  try {
    const t0 = Date.now();
    await prisma.$queryRaw`SELECT 1`;
    out.checks.database = { status: "up", latencyMs: Date.now() - t0 };
  } catch (e: any) {
    out.checks.database = { status: "down", error: e?.message };
    out.status = "unhealthy";
  }

  // 2. Prisma migrations applied
  try {
    const applied: any[] = await prisma.$queryRawUnsafe(
      `SELECT COUNT(*)::int AS count FROM "_prisma_migrations" WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL`,
    );
    const pending: any[] = await prisma.$queryRawUnsafe(
      `SELECT COUNT(*)::int AS count FROM "_prisma_migrations" WHERE finished_at IS NULL`,
    );
    out.checks.migrations = {
      applied: applied[0]?.count ?? 0,
      pending: pending[0]?.count ?? 0,
      status: pending[0]?.count > 0 ? "pending" : "up",
    };
    if (pending[0]?.count > 0) out.status = "degraded";
  } catch (e: any) {
    out.checks.migrations = { status: "down", error: e?.message };
  }

  // 3. Writable data dir (for offline queue + module-store)
  try {
    const dir = process.env.FAMEX_DATA_DIR ?? path.join(process.cwd(), "data");
    await fs.mkdir(dir, { recursive: true });
    const probe = path.join(dir, ".health-probe");
    await fs.writeFile(probe, String(Date.now()));
    await fs.unlink(probe);
    out.checks.storage = { status: "up", dir };
  } catch (e: any) {
    out.checks.storage = { status: "down", error: e?.message };
    out.status = out.status === "healthy" ? "degraded" : out.status;
  }

  // 4. Env sanity (required secrets)
  const missing: string[] = [];
  for (const k of ["DATABASE_URL"]) if (!process.env[k]) missing.push(k);
  out.checks.env = { status: missing.length ? "missing" : "up", missing };
  if (missing.length) out.status = out.status === "healthy" ? "degraded" : out.status;

  out.latencyMs = Date.now() - start;
  return NextResponse.json(out, {
    status: out.status === "unhealthy" ? 503 : out.status === "degraded" ? 200 : 200,
  });
}
