/**
 * Prisma client singleton with connection pooling for production.
 *
 * In development, hot-reload would create a new client on every save,
 * exhausting the connection pool. This singleton prevents that.
 *
 * Note: a global findMany cap via $extends was tried but Prisma's extended
 * client types are heavy enough to OOM `tsc`/`next build` on large codebases,
 * so query bounding is done per-route instead (and aggregation endpoints should
 * use SQL aggregation — groupBy/_count — rather than findMany).
 */

import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrismaClient() {
  const logLevel =
    process.env.NODE_ENV === "development"
      ? (["query", "error", "warn"] as const)
      : (["error"] as const);

  return new PrismaClient({
    log: logLevel.map((level) =>
      level === "query" ? { emit: "event", level: "query" } : { emit: "stdout", level },
    ),
  });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV === "development") {
  globalForPrisma.prisma = prisma;

  prisma.$on(
    "query" as never,
    ((e: { query: string; duration: number }) => {
      if (e.duration > 500) {
        console.warn(`[prisma] Slow query (${e.duration}ms): ${e.query.slice(0, 200)}`);
      }
    }) as never,
  );
}
