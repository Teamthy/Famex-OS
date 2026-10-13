/**
 * RLS COVERAGE verification — is every tenant table actually protected?
 *
 *   DATABASE_URL="postgresql://...scratch" npm run verify:rls:coverage
 *
 * `verify:rls` proves that isolation WORKS on the tables that have policies.
 * This proves that the right SET of tables has them, which is a different
 * question and the one that silently rotted:
 *
 * The policy migration loops over every table carrying a `schoolId`. That is
 * correct the moment it runs and wrong forever after — a later migration that
 * adds a tenant table does not re-run the loop. Eight migrations landed after
 * it, and `DeviceToken` (push notification tokens) ended up with no policy at
 * all. Cross-tenant read AND write were both possible.
 *
 * ── Why this needs a non-superuser ─────────────────────────────────────────
 * A superuser, and any role with BYPASSRLS, ignores every policy. Local
 * embedded-postgres runs as a superuser, so a naive check here passes while
 * proving nothing — that is exactly what happened when this gap was found: the
 * first leak test reported `User` as leaking too, because the role bypassed
 * RLS entirely.
 *
 * So this script creates a throwaway unprivileged role and does the real
 * checks through it. If it cannot create one it says so loudly rather than
 * quietly downgrading to a meaningless pass.
 *
 * Exits non-zero on any gap, so it can gate a deploy.
 */
import { PrismaClient } from "@prisma/client";
import { logger } from "@/lib/logger";

const ADMIN_URL = process.env.DATABASE_URL;
const PROBE_ROLE = "eduos_rls_probe";
const PROBE_PASSWORD = "probe_only_local";

let failures = 0;

function check(passed: boolean, message: string) {
  console.log(`  ${passed ? "✓" : "✗"} ${message}`);
  if (!passed) failures += 1;
}

function probeUrl(raw: string) {
  const url = new URL(raw);
  url.username = PROBE_ROLE;
  url.password = PROBE_PASSWORD;
  // One connection, so the "no context" check reuses the same backend that
  // just ran a scoped transaction. With a pool it can silently pass.
  url.searchParams.set("connection_limit", "1");
  url.searchParams.set("pool_timeout", "20");
  return url.toString();
}

async function main() {
  if (!ADMIN_URL) throw new Error("DATABASE_URL is required.");
  if (/neon\.tech|prod/i.test(ADMIN_URL)) {
    throw new Error("Refusing to run against what looks like production.");
  }

  const admin = new PrismaClient();

  /* ---------------------------------------------------------------
     1. Static coverage — the question that rotted
     --------------------------------------------------------------- */
  console.log("\nCoverage");

  const uncovered = await admin.$queryRawUnsafe<Array<{ table_name: string }>>(`
    SELECT c.table_name
    FROM information_schema.columns c
    JOIN pg_class pc ON pc.relname = c.table_name
    JOIN pg_namespace pn ON pn.oid = pc.relnamespace AND pn.nspname = 'public'
    WHERE c.column_name = 'schoolId'
      AND c.table_schema = 'public'
      AND NOT pc.relrowsecurity
    ORDER BY 1`);
  check(
    uncovered.length === 0,
    `every table with a schoolId has RLS enabled${uncovered.length ? ` — MISSING: ${uncovered.map((r) => r.table_name).join(", ")}` : ""}`,
  );

  const unforced = await admin.$queryRawUnsafe<Array<{ table_name: string }>>(`
    SELECT c.table_name
    FROM information_schema.columns c
    JOIN pg_class pc ON pc.relname = c.table_name
    JOIN pg_namespace pn ON pn.oid = pc.relnamespace AND pn.nspname = 'public'
    WHERE c.column_name = 'schoolId'
      AND c.table_schema = 'public'
      AND NOT pc.relforcerowsecurity
    ORDER BY 1`);
  // Without FORCE, the table OWNER bypasses RLS — and migrations usually run
  // as the owner, which is often the same role the app uses.
  check(
    unforced.length === 0,
    `every tenant table has FORCE RLS${unforced.length ? ` — MISSING: ${unforced.map((r) => r.table_name).join(", ")}` : ""}`,
  );

  const missingPolicy = await admin.$queryRawUnsafe<Array<{ table_name: string }>>(`
    SELECT c.table_name
    FROM information_schema.columns c
    WHERE c.column_name = 'schoolId'
      AND c.table_schema = 'public'
      AND NOT EXISTS (
        SELECT 1 FROM pg_policies p
        WHERE p.schemaname = 'public'
          AND p.tablename = c.table_name
          AND p.policyname = 'eduos_tenant_isolation'
      )
    ORDER BY 1`);
  check(
    missingPolicy.length === 0,
    `every tenant table carries eduos_tenant_isolation${missingPolicy.length ? ` — MISSING: ${missingPolicy.map((r) => r.table_name).join(", ")}` : ""}`,
  );

  /* ---------------------------------------------------------------
     2. No DDL event trigger — it deadlocks
     --------------------------------------------------------------- */
  console.log("\nFuture tables");

  // An event trigger that secures new tables looks like the right guard and
  // is a trap: applying the policy runs ALTER TABLE against the table whose
  // CREATE TABLE fired it, so the statement waits on its own lock and hangs
  // until statement_timeout. Verified on PostgreSQL 18. If someone reaches for
  // it again, fail here rather than letting them discover it during a deploy.
  const ddlTriggers = await admin.$queryRawUnsafe<Array<{ evtname: string }>>(
    `SELECT evtname FROM pg_event_trigger WHERE evtevent = 'ddl_command_end'`,
  );
  check(
    ddlTriggers.length === 0,
    `no ddl_command_end event trigger (they deadlock on CREATE TABLE)${ddlTriggers.length ? ` — FOUND: ${ddlTriggers.map((t) => t.evtname).join(", ")}` : ""}`,
  );

  // The helper that makes fixing a gap a one-liner must still be present.
  const helper = await admin.$queryRawUnsafe<Array<{ proname: string }>>(
    `SELECT proname FROM pg_proc WHERE proname = 'eduos_apply_tenant_rls'`,
  );
  check(helper.length === 1, "eduos_apply_tenant_rls() is available to secure a new table");

  /* ---------------------------------------------------------------
     3. Real enforcement, as an unprivileged role
     --------------------------------------------------------------- */
  console.log("\nEnforcement (unprivileged role)");

  let probe: PrismaClient | null = null;
  try {
    await admin.$executeRawUnsafe(`DROP ROLE IF EXISTS ${PROBE_ROLE}`);
    await admin.$executeRawUnsafe(
      `CREATE ROLE ${PROBE_ROLE} LOGIN PASSWORD '${PROBE_PASSWORD}' NOBYPASSRLS`,
    );
    await admin.$executeRawUnsafe(`GRANT USAGE ON SCHEMA public TO ${PROBE_ROLE}`);
    await admin.$executeRawUnsafe(
      `GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO ${PROBE_ROLE}`,
    );
    await admin.$executeRawUnsafe(
      `GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO ${PROBE_ROLE}`,
    );
    probe = new PrismaClient({ datasources: { db: { url: probeUrl(ADMIN_URL) } } });
  } catch (roleError) {
    console.error(
      `  ! Could not create an unprivileged probe role: ${roleError instanceof Error ? roleError.message : roleError}`,
    );
    console.error("  ! Enforcement checks SKIPPED — this run does not prove isolation.");
    failures += 1;
  }

  if (probe) {
    const bypass = await probe.$queryRawUnsafe<Array<{ rolsuper: boolean; rolbypassrls: boolean }>>(
      `SELECT rolsuper, rolbypassrls FROM pg_roles WHERE rolname = current_user`,
    );
    check(
      bypass[0]?.rolsuper === false && bypass[0]?.rolbypassrls === false,
      "the probe role is genuinely unprivileged (no BYPASSRLS)",
    );

    const stamp = Date.now();
    const schoolA = await admin.school.create({
      data: { name: `rlsA-${stamp}`, slug: `rlsa-${stamp}`, address: "x", phone: "y" },
    });
    const schoolB = await admin.school.create({
      data: { name: `rlsB-${stamp}`, slug: `rlsb-${stamp}`, address: "x", phone: "y" },
    });
    const userA = await admin.user.create({
      data: {
        schoolId: schoolA.id,
        email: `a-${stamp}@e.t`,
        name: "A",
        passwordHash: "x",
        role: "STUDENT",
      },
    });
    const userB = await admin.user.create({
      data: {
        schoolId: schoolB.id,
        email: `b-${stamp}@e.t`,
        name: "B",
        passwordHash: "x",
        role: "STUDENT",
      },
    });
    await admin.deviceToken.create({
      data: { schoolId: schoolA.id, userId: userA.id, token: `a-${stamp}`, platform: "android" },
    });
    await admin.deviceToken.create({
      data: { schoolId: schoolB.id, userId: userB.id, token: `b-${stamp}`, platform: "android" },
    });
    const ids = [schoolA.id, schoolB.id];

    try {
      const scoped = await probe.$transaction(async (tx) => {
        await tx.$executeRaw`SELECT set_config('app.current_school_id', ${schoolA.id}, true)`;
        const users = await tx.user.findMany({ where: { schoolId: { in: ids } } });
        const tokens = await tx.deviceToken.findMany({ where: { schoolId: { in: ids } } });
        return {
          users: new Set(users.map((u) => u.schoolId)).size,
          tokens: new Set(tokens.map((t) => t.schoolId)).size,
        };
      });
      check(scoped.users === 1, `User read is isolated (saw ${scoped.users} school(s))`);
      check(scoped.tokens === 1, `DeviceToken read is isolated (saw ${scoped.tokens} school(s))`);

      let wrote = false;
      try {
        await probe.$transaction(async (tx) => {
          await tx.$executeRaw`SELECT set_config('app.current_school_id', ${schoolA.id}, true)`;
          await tx.deviceToken.create({
            data: {
              schoolId: schoolB.id,
              userId: userB.id,
              token: `x-${stamp}`,
              platform: "android",
            },
          });
          wrote = true;
        });
      } catch {
        /* expected */
      }
      check(!wrote, "a cross-tenant INSERT is refused");

      // The regression that the empty-context migration fixed: after a scoped
      // transaction commits, the GUC becomes '' rather than NULL, and an
      // unscoped query on the same pooled connection must still see everything.
      const unscoped = await probe.deviceToken.findMany({ where: { schoolId: { in: ids } } });
      check(
        unscoped.length === 2,
        `with no context the same connection still sees all rows (saw ${unscoped.length}/2)`,
      );
    } finally {
      await admin.school.deleteMany({ where: { id: { in: ids } } });
      await probe.$disconnect();
      await admin.$executeRawUnsafe(`REVOKE ALL ON ALL TABLES IN SCHEMA public FROM ${PROBE_ROLE}`);
      await admin.$executeRawUnsafe(
        `REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM ${PROBE_ROLE}`,
      );
      await admin.$executeRawUnsafe(`REVOKE ALL ON SCHEMA public FROM ${PROBE_ROLE}`);
      await admin.$executeRawUnsafe(`DROP ROLE IF EXISTS ${PROBE_ROLE}`);
    }
  }

  await admin.$disconnect();

  console.log(
    failures ? `\n${failures} CHECK(S) FAILED` : "\nRLS coverage is complete and self-maintaining.",
  );
  if (failures) process.exitCode = 1;
}

main().catch((error) => {
  logger.error("Request failed", { error: error instanceof Error ? error.message : String(error) });
  process.exitCode = 1;
});
