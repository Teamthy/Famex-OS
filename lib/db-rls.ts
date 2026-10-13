import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

type Tx = Prisma.TransactionClient;

/**
 * Shape of a legitimate tenant id (cuid, uuid, or a slug-ish seed id).
 *
 * The value is passed to Postgres as a bind parameter, so this is not the
 * injection defence — it is a correctness guard. Its real job is to reject a
 * blank/garbage id, because an empty context is interpreted by the RLS policy
 * as "no tenant selected", which silently turns isolation OFF rather than on.
 * Must start and end alphanumeric, so `--`-style trailing junk is refused too.
 */
const SCHOOL_ID_PATTERN = /^[A-Za-z0-9](?:[A-Za-z0-9_-]{0,62}[A-Za-z0-9])?$/;

/**
 * Run database operations with Postgres Row-Level Security enforcement.
 *
 * Sets `app.current_school_id` for the duration of a transaction so the RLS
 * policies restrict every statement to that school.
 *
 * ⚠️ THIS IS CURRENTLY AN OPT-IN MECHANISM, NOT A GUARANTEE. ⚠️
 *
 * The RLS policy is deliberately FAIL-OPEN: when app.current_school_id is
 * unset — which is the state of every connection that did not come through
 * this function — the RESTRICTIVE policy passes everything. Since only three
 * call sites exist (app/api/push/register/route.ts and lib/push.ts, both
 * DeviceToken queries), the policy is inert for the other ~109 tenant routes.
 *
 * So do not read this file and conclude the database is protecting you. Tenant
 * isolation today is application-level: every route must filter by schoolId.
 * Measured by `npm run check:tenant-coverage`. Full status and the path to a
 * real guarantee: docs/TENANCY_RLS_STATUS.md.
 *
 * Usage (opt-in — routes that don't use this still work, just without the
 * DB-level isolation):
 *
 *   const students = await withSchool(user.schoolId, (tx) =>
 *     tx.studentProfile.findMany({ where: { isActive: true } })
 *   );
 *
 * Multiple queries in one call share the same transaction + RLS context:
 *
 *   const [students, invoices] = await withSchool(user.schoolId, async (tx) => {
 *     return Promise.all([
 *       tx.studentProfile.count({ where: { isActive: true } }),
 *       tx.feeInvoice.count({ where: { status: "UNPAID" } }),
 *     ]);
 *   });
 *
 * ── Implementation notes (both learned the hard way against real Postgres) ──
 *
 * 1. We use `set_config(name, value, is_local => true)` rather than
 *    `SET LOCAL app.current_school_id = ${schoolId}`. `SET LOCAL` is utility
 *    syntax and cannot take a bind parameter — the tagged-template form
 *    compiles to `SET LOCAL ... = $1` and Postgres rejects it outright with
 *    `42601: syntax error at or near "$1"`. `set_config()` is an ordinary
 *    function call, so the value binds safely and the id is never interpolated
 *    into SQL text.
 *
 * 2. `is_local => true` scopes the setting to the surrounding transaction, so
 *    it is rolled back before the pooled connection is handed to another
 *    request. Note that Postgres resets it to the EMPTY STRING (not NULL) after
 *    commit — the RLS policy compensates with NULLIF(...,''), see migration
 *    20260802000000_eduos_rls_empty_context_fix. Without that, any connection
 *    that had once run withSchool() would silently return zero rows for every
 *    later unscoped query.
 */
export async function withSchool<T>(schoolId: string, fn: (_tx: Tx) => Promise<T>): Promise<T> {
  if (!schoolId || !SCHOOL_ID_PATTERN.test(schoolId)) {
    // Fail loud. A blank or malformed id would set an empty context, which the
    // policy treats as "no tenant" — i.e. it would silently disable isolation.
    throw new Error("withSchool() requires a valid schoolId.");
  }

  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config('app.current_school_id', ${schoolId}, true)`;
    return fn(tx);
  });
}
