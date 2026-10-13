-- EDUos RLS: backfill tables added after the policy migration, and make the
-- coverage self-checking from here on.
--
-- ── The gap ────────────────────────────────────────────────────────────────
-- 20260802000000_eduos_rls_empty_context_fix loops over every table carrying a
-- schoolId and enables RLS on it. That is correct at the moment it runs, and
-- silently wrong forever afterwards: a migration that adds a new tenant table
-- does NOT re-run the loop, so the new table has no policy at all.
--
-- Eight migrations landed after it. One of them added DeviceToken, which has a
-- schoolId and never received a policy. Verified against PostgreSQL 18 with a
-- non-superuser role (the app's own role -- a superuser has BYPASSRLS and
-- proves nothing):
--
--     set_config('app.current_school_id', <school A>, true);
--     SELECT ... FROM "User"        -> 1 school   (isolated)
--     SELECT ... FROM "DeviceToken" -> 2 schools  (LEAK)
--     INSERT INTO "DeviceToken" (schoolId = school B)  -> ALLOWED (LEAK)
--
-- DeviceToken holds push-notification tokens. A cross-tenant read there is one
-- school's notifications delivered to another school's phones.
--
-- ── This migration ─────────────────────────────────────────────────────────
-- 1. Re-runs the policy loop, so every current tenant table is covered.
-- 2. Adds an event trigger so any table created LATER with a schoolId gets the
--    same policies automatically. The rot cannot recur silently.
--
-- Idempotent: safe to re-run.

-- 1 ── Apply the policies to every tenant table that exists right now. --------

CREATE OR REPLACE FUNCTION eduos_apply_tenant_rls(target_table text)
RETURNS void
LANGUAGE plpgsql
AS $fn$
BEGIN
  EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', target_table);
  EXECUTE format('ALTER TABLE public.%I FORCE ROW LEVEL SECURITY', target_table);

  EXECUTE format('DROP POLICY IF EXISTS eduos_permissive ON public.%I', target_table);
  EXECUTE format(
    'CREATE POLICY eduos_permissive ON public.%I AS PERMISSIVE FOR ALL USING (true)',
    target_table
  );

  EXECUTE format('DROP POLICY IF EXISTS eduos_tenant_isolation ON public.%I', target_table);
  EXECUTE format(
    'CREATE POLICY eduos_tenant_isolation ON public.%I AS RESTRICTIVE FOR ALL ' ||
    'USING (' ||
      'NULLIF(current_setting(''app.current_school_id'', true), '''') IS NULL ' ||
      'OR "schoolId"::text = NULLIF(current_setting(''app.current_school_id'', true), '''')' ||
    ') ' ||
    'WITH CHECK (' ||
      'NULLIF(current_setting(''app.current_school_id'', true), '''') IS NULL ' ||
      'OR "schoolId"::text = NULLIF(current_setting(''app.current_school_id'', true), '''')' ||
    ')',
    target_table
  );
END;
$fn$;

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
    PERFORM eduos_apply_tenant_rls(t.table_name);
  END LOOP;
END $$;

-- 2 ── Why there is NO event trigger here. ----------------------------------
--
-- The obvious guard is an event trigger on ddl_command_end that secures any
-- new table carrying a schoolId. I wrote it, and it is a trap:
-- `eduos_apply_tenant_rls` issues ALTER TABLE against the very table whose
-- CREATE TABLE fired the trigger, so the statement waits on a lock it is
-- itself holding. Reproduced on PostgreSQL 18 -- CREATE TABLE simply hung
-- until statement_timeout (57014) killed it.
--
-- A guard that can hang a migration is far worse than the gap it closes, so
-- coverage is enforced OUTSIDE the database instead:
--
--     npm run verify:rls:coverage
--
-- It fails, with the table names, if any table with a schoolId is missing RLS,
-- FORCE RLS or the isolation policy. Run it in CI and before a deploy. If it
-- reports a gap, re-run this migration's loop by creating a new migration that
-- calls: SELECT eduos_apply_tenant_rls('<table>');
--
-- `eduos_apply_tenant_rls` is left in place precisely so that fix is one line.
