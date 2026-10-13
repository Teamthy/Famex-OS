-- EDUos: Postgres Row-Level Security (RLS) for tenant isolation.
--
-- ⚠️ ACCURACY CORRECTION (2026-09-07, post-launch-readiness audit) ⚠️
--
-- The line below originally claimed this is "the DB-level backstop that
-- GUARANTEES one school can NEVER see another school's data". As shipped, that
-- claim is FALSE, and leaving it here is more dangerous than having no RLS at
-- all — it invites the next engineer to trust a guarantee that does not exist.
--
-- The truth, measured by `npm run check:tenant-coverage`:
--
--     Tenant-model routes:                     110
--     RLS-scoped (actually call withSchool):     1   <- app/api/push/register
--     App-level schoolId filter present:        91
--     UNCOVERED (neither):                      18
--
-- Two reasons the policy enforces nothing today:
--
--   1. It is FAIL-OPEN by construction. The RESTRICTIVE clause passes whenever
--      app.current_school_id is unset/empty, which is the default state of
--      every pooled connection. See the `NULLIF(...) IS NULL OR ...` predicate
--      in 20260802000000_eduos_rls_empty_context_fix.
--   2. withSchool() — the only thing that sets the variable — is called from
--      exactly three places (app/api/push/register/route.ts and lib/push.ts),
--      all of them DeviceToken queries. Every other route uses the plain
--      Prisma client, so the variable is never set and the policy is inert.
--
-- Consequence: tenant isolation on this system is APPLICATION-LEVEL ONLY.
-- Every route must filter by schoolId itself. A route that forgets the filter
-- is a silent cross-tenant hole — no error, no log, wrong school's rows.
--
-- Status: the EDUos multi-tenant SaaS layer is ON HOLD; Ykay College is
-- currently the only school, so no live cross-tenant exposure exists today.
-- This MUST be resolved before a second school is onboarded.
--
-- Path to a real guarantee (see docs/TENANCY_RLS_STATUS.md):
--   1. Drive `npm run check:tenant-coverage` UNCOVERED list to zero.
--   2. Route those accesses through withSchool().
--   3. Re-apply the policy with the fail-open arm REMOVED, via the helper
--      left in place for exactly this purpose:
--          SELECT eduos_apply_tenant_rls('<table>');
--   4. Add `-- --strict` to the CI step so coverage cannot regress.
--
-- ── Original design notes (retained for history) ─────────────────────────
--
-- Design (incremental, backward-compatible):
--   1. PERMISSIVE policy  → USING (true) — always passes.
--   2. RESTRICTIVE policy → passes when app.current_school_id is NOT set
--      (backward-compatible with existing code that doesn't set it), or
--      restricts to matching schoolId when it IS set.
--
-- The app sets the variable via SET LOCAL inside a transaction:
--   SET LOCAL app.current_school_id = '<cuid>';
-- (see lib/db-rls.ts → withSchool())
--
-- Tables without a schoolId column (child tables, platform tables like Plan,
-- School, SystemFlags) are left unprotected — they're either implicitly scoped
-- by their parent's FK or are global by design.

DO $$
DECLARE
  t RECORD;
BEGIN
  FOR t IN
    SELECT table_name
    FROM information_schema.columns
    WHERE column_name = 'schoolId'
      AND table_schema = 'public'
  LOOP
    -- Enable RLS
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t.table_name);

    -- Force RLS even for table owners (superusers bypass by default)
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t.table_name);

    -- Permissive policy (always passes — backward-compatible)
    EXECUTE format('DROP POLICY IF EXISTS eduos_permissive ON %I', t.table_name);
    EXECUTE format(
      'CREATE POLICY eduos_permissive ON %I AS PERMISSIVE FOR ALL USING (true)',
      t.table_name
    );

    -- Restrictive policy (only applies when app.current_school_id is set)
    EXECUTE format('DROP POLICY IF EXISTS eduos_tenant_isolation ON %I', t.table_name);
    EXECUTE format(
      'CREATE POLICY eduos_tenant_isolation ON %I AS RESTRICTIVE FOR ALL USING (' ||
      'current_setting(''app.current_school_id'', true) IS NULL ' ||
      'OR "schoolId"::text = current_setting(''app.current_school_id'', true)' ||
      ')',
      t.table_name
    );

    RAISE NOTICE 'RLS enabled on %', t.table_name;
  END LOOP;
END $$;
