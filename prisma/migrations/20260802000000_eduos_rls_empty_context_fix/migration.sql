-- EDUos RLS hardening: treat an EMPTY tenant context the same as an UNSET one.
--
-- ── The bug ────────────────────────────────────────────────────────────────
-- The original policy (20260727000000_eduos_rls) opened with:
--
--     current_setting('app.current_school_id', true) IS NULL
--     OR "schoolId"::text = current_setting('app.current_school_id', true)
--
-- That relies on the setting being NULL when no tenant context is active. But
-- Postgres does NOT restore a custom GUC to NULL after `SET LOCAL` — once the
-- transaction commits, the value becomes the EMPTY STRING, not NULL:
--
--     BEGIN; SET LOCAL app.current_school_id='sch_A'; COMMIT;
--     SELECT current_setting('app.current_school_id', true) IS NULL;  -- false
--     SELECT quote_literal(current_setting('app.current_school_id', true)); -- ''
--
-- So on any connection that has *ever* run withSchool(), the guard clause stops
-- matching and the policy degrades to:
--
--     "schoolId"::text = ''      -- true for zero rows
--
-- ── Why that is dangerous ──────────────────────────────────────────────────
-- Prisma pools connections. The moment one request uses withSchool(), that
-- connection is poisoned for every later request that does NOT set the context:
-- their queries silently return ZERO ROWS instead of data. Not an error — an
-- empty dashboard, an empty invoice list, a report card with no subjects.
-- Reproduced on PostgreSQL 17:
--
--     BEGIN; SET LOCAL app.current_school_id='sch_A';
--       SELECT count(*) FROM "FeeInvoice";   -- 1  (correct)
--     COMMIT;
--     SELECT count(*) FROM "FeeInvoice";     -- 0  (WRONG — should be 2)
--
-- ── The fix ────────────────────────────────────────────────────────────────
-- Collapse '' to NULL with NULLIF before the check, so "no context" covers both
-- never-set and reset-after-commit. Belt and braces: compare against the
-- NULLIF'd value too, so an empty context can never match a real schoolId.
--
-- Idempotent: recreates the policy on every table carrying a schoolId column.

DO $$
DECLARE
  t RECORD;
BEGIN
  FOR t IN
    SELECT c.table_name
    FROM information_schema.columns c
    JOIN information_schema.tables tb
      ON tb.table_name = c.table_name
     AND tb.table_schema = c.table_schema
    WHERE c.column_name = 'schoolId'
      AND c.table_schema = 'public'
      AND tb.table_type = 'BASE TABLE'
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t.table_name);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t.table_name);

    -- Permissive baseline (unchanged — always passes).
    EXECUTE format('DROP POLICY IF EXISTS eduos_permissive ON %I', t.table_name);
    EXECUTE format(
      'CREATE POLICY eduos_permissive ON %I AS PERMISSIVE FOR ALL USING (true)',
      t.table_name
    );

    -- Restrictive tenant isolation, now empty-string safe.
    EXECUTE format('DROP POLICY IF EXISTS eduos_tenant_isolation ON %I', t.table_name);
    EXECUTE format(
      'CREATE POLICY eduos_tenant_isolation ON %I AS RESTRICTIVE FOR ALL ' ||
      'USING (' ||
        'NULLIF(current_setting(''app.current_school_id'', true), '''') IS NULL ' ||
        'OR "schoolId"::text = NULLIF(current_setting(''app.current_school_id'', true), '''')' ||
      ') ' ||
      'WITH CHECK (' ||
        'NULLIF(current_setting(''app.current_school_id'', true), '''') IS NULL ' ||
        'OR "schoolId"::text = NULLIF(current_setting(''app.current_school_id'', true), '''')' ||
      ')',
      t.table_name
    );
  END LOOP;
END $$;
