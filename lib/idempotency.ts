import { createHash } from "crypto";
import type { IdempotencyRecord, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, val]) => `${JSON.stringify(key)}:${stableStringify(val)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

type RequestLike = {
  method?: string;
  url?: string;
  nextUrl?: { pathname?: string | null } | null;
};

export function requestMethodForIdempotency(request: RequestLike, fallback = "POST"): string {
  return request.method || fallback;
}

export function requestPathForIdempotency(request: RequestLike, fallback: string): string {
  const nextPath = request.nextUrl?.pathname;
  if (nextPath) return nextPath;
  if (request.url) {
    try {
      return new URL(request.url).pathname;
    } catch {
      // Test doubles may provide a partial Request; fall back to the route's
      // canonical path while production NextRequest continues to use nextUrl.
    }
  }
  return fallback;
}

export function idempotencyRequestHash(input: {
  method: string;
  path: string;
  actorId: string;
  scope: string;
  body: unknown;
}): string {
  return createHash("sha256")
    .update(input.method.toUpperCase())
    .update("\n")
    .update(input.path)
    .update("\n")
    .update(input.actorId)
    .update("\n")
    .update(input.scope)
    .update("\n")
    .update(stableStringify(input.body))
    .digest("hex");
}

export const IDEMPOTENCY_PROCESSING = "PROCESSING";
export const IDEMPOTENCY_COMPLETED = "COMPLETED";

/**
 * How long a PROCESSING reservation is honoured before another request with
 * the same key may take it over (crash recovery). Every route protected by a
 * reservation is expected to finish well inside this window; if it does not,
 * the completing write fails its `status`/`lockedUntil` guard, the transaction
 * rolls back, and the caller is told to retry.
 */
export const IDEMPOTENCY_LOCK_MS = 60_000;

function isUniqueConstraintViolation(error: unknown): boolean {
  return (
    typeof error === "object" && error !== null && (error as { code?: unknown }).code === "P2002"
  );
}

/**
 * Outcome of trying to reserve an idempotency key:
 *
 *  - "reserved"     — caller owns the key and must run side effects, then
 *                     completeReservedIdempotency (ideally in the same
 *                     transaction). `lockedUntil` identifies this lease and
 *                     must be passed back when completing.
 *  - "replay"       — a completed record with the same request hash exists;
 *                     respond with the stored body/status, do NOT re-run.
 *  - "conflict"     — the key was used with a different request body (409).
 *  - "in-progress"  — another request holds a live lease on this key (409 +
 *                     Retry-After). The client should retry the SAME request.
 */
export type IdempotencyReservation =
  | { outcome: "reserved"; lockedUntil: Date }
  | { outcome: "replay"; body: Record<string, unknown>; status: number }
  | { outcome: "conflict"; body: { error: string }; status: 409 }
  | { outcome: "in-progress"; body: { error: string }; status: 409; retryAfterSeconds: number };

export async function reserveIdempotency(params: {
  schoolId: string;
  scope: string;
  key: string;
  requestHash: string;
  lockMs?: number;
}): Promise<IdempotencyReservation> {
  const lockMs = params.lockMs ?? IDEMPOTENCY_LOCK_MS;
  const lockedUntil = new Date(Date.now() + lockMs);
  const uniqueKey = {
    schoolId_scope_key: {
      schoolId: params.schoolId,
      scope: params.scope,
      key: params.key,
    },
  };

  try {
    await prisma.idempotencyRecord.create({
      data: {
        schoolId: params.schoolId,
        scope: params.scope,
        key: params.key,
        requestHash: params.requestHash,
        status: IDEMPOTENCY_PROCESSING,
        lockedUntil,
      },
      select: { id: true },
    });
    return { outcome: "reserved", lockedUntil };
  } catch (error) {
    if (!isUniqueConstraintViolation(error)) throw error;
  }

  // The key already exists — decide between replay, conflict and takeover.
  const existing = await prisma.idempotencyRecord.findUnique({ where: uniqueKey });
  if (!existing) {
    // The conflicting row vanished between the insert and this read (cascade
    // delete). Retry the reservation once; if it collides again, treat the
    // state as unusable and ask the client to retry.
    try {
      await prisma.idempotencyRecord.create({
        data: {
          schoolId: params.schoolId,
          scope: params.scope,
          key: params.key,
          requestHash: params.requestHash,
          status: IDEMPOTENCY_PROCESSING,
          lockedUntil,
        },
        select: { id: true },
      });
      return { outcome: "reserved", lockedUntil };
    } catch (retryError) {
      if (!isUniqueConstraintViolation(retryError)) throw retryError;
      return {
        outcome: "in-progress",
        body: { error: "This request is already being processed. Please retry." },
        status: 409,
        retryAfterSeconds: Math.ceil(lockMs / 1000),
      };
    }
  }

  if (existing.requestHash !== params.requestHash) {
    return {
      outcome: "conflict",
      body: { error: "This idempotency key was already used with a different request body." },
      status: 409,
    };
  }

  if (existing.status !== IDEMPOTENCY_PROCESSING || !existing.lockedUntil) {
    return {
      outcome: "replay",
      body: { ...(existing.response as object), idempotentReplay: true },
      status: existing.statusCode ?? 200,
    };
  }

  // PROCESSING: if the lease has expired, take it over atomically (crash
  // recovery). updateMany's WHERE is the compare-and-swap — only a request
  // that sees the same expired lease can win.
  const takeover = await prisma.idempotencyRecord.updateMany({
    where: {
      schoolId: params.schoolId,
      scope: params.scope,
      key: params.key,
      status: IDEMPOTENCY_PROCESSING,
      lockedUntil: { lt: new Date() },
    },
    data: { lockedUntil, requestHash: params.requestHash },
  });
  if (takeover.count === 1) {
    return { outcome: "reserved", lockedUntil };
  }

  return {
    outcome: "in-progress",
    body: {
      error:
        "A request with this idempotency key is still in progress. Retry the same request shortly.",
    },
    status: 409,
    retryAfterSeconds: Math.min(Math.ceil(lockMs / 1000), 30),
  };
}

/** Accepts either the shared client or an interactive transaction client. */
type DbLike = Prisma.TransactionClient;

/**
 * Marks a reservation COMPLETED with the response future retries will replay.
 * When the side effects are DB-only, call this INSIDE the same
 * `prisma.$transaction` so the stored response commits (or rolls back) with
 * them — a crash can then never leave "side effects committed, record stuck
 * at PROCESSING".
 *
 * The status + lockedUntil guard is the second half of the mutual exclusion:
 * if another request took over the expired lease while this one was still
 * running, this write matches 0 rows, `IDEMPOTENCY_RESERVATION_LOST` is
 * thrown, and the surrounding transaction rolls back so a slow duplicate
 * cannot commit side effects on top of the takeover winner.
 */
export async function completeReservedIdempotency(
  db: DbLike,
  params: {
    schoolId: string;
    scope: string;
    key: string;
    lockedUntil: Date;
    response: unknown;
    statusCode: number;
  },
): Promise<void> {
  const result = await db.idempotencyRecord.updateMany({
    where: {
      schoolId: params.schoolId,
      scope: params.scope,
      key: params.key,
      status: IDEMPOTENCY_PROCESSING,
      lockedUntil: params.lockedUntil,
    },
    data: {
      status: IDEMPOTENCY_COMPLETED,
      lockedUntil: null,
      response: params.response as Prisma.InputJsonValue,
      statusCode: params.statusCode,
    },
  });
  if (result.count !== 1) {
    throw new Error("IDEMPOTENCY_RESERVATION_LOST");
  }
}

/**
 * Deletes a PROCESSING reservation when the request failed BEFORE any side
 * effect committed (validation error, class at capacity, provider outage).
 * This un-burns the key so the client can correct and retry immediately with
 * the same key instead of waiting out the lease. Only ever deletes a row that
 * is still PROCESSING with our lease — a COMPLETED record (replay source) is
 * never removed.
 */
export async function releaseReservedIdempotency(params: {
  schoolId: string;
  scope: string;
  key: string;
  lockedUntil: Date;
}): Promise<void> {
  try {
    await prisma.idempotencyRecord.deleteMany({
      where: {
        schoolId: params.schoolId,
        scope: params.scope,
        key: params.key,
        status: IDEMPOTENCY_PROCESSING,
        lockedUntil: params.lockedUntil,
      },
    });
  } catch {
    // Releasing is best-effort: if it fails the lease simply expires.
  }
}

/**
 * Resolves an already-stored record against a request hash. Kept for
 * read-only replay checks; records created by the reservation flow are
 * normally handled by reserveIdempotency's outcomes instead.
 */
export function replayIdempotency(record: IdempotencyRecord, requestHash: string) {
  if (record.requestHash !== requestHash) {
    return {
      conflict: true as const,
      body: {
        error: "This idempotency key was already used with a different request body.",
      },
      status: 409,
    };
  }
  // A row still in PROCESSING (legacy callers, or a crashed request) has no
  // replayable response yet.
  if (record.status === IDEMPOTENCY_PROCESSING && record.response == null) {
    return {
      conflict: true as const,
      body: { error: "This request is still being processed. Please retry." },
      status: 409,
    };
  }
  return {
    conflict: false as const,
    body: { ...(record.response as object), idempotentReplay: true },
    status: record.statusCode ?? 200,
  };
}
