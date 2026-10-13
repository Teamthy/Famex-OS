# Tenancy & RLS — honest status

**Last verified:** 2026-09-07, against commit `a222c48`.

## The one-line summary

**Tenant isolation on this system is application-level only. Postgres Row-Level
Security is installed but does not enforce anything.**

## Measured state

`npm run check:tenant-coverage` output:

```
Tenant-model routes: 110
  RLS-scoped (withSchool): 1
  App-level schoolId filter present: 91
  UNCOVERED (no withSchool, no schoolId mention): 18
```

`withSchool()` call sites in application code — three, all of them DeviceToken
queries:

```
app/api/push/register/route.ts:39
lib/push.ts:154
lib/push.ts:171
```

## Why RLS enforces nothing

Two independent reasons, either of which would be sufficient on its own.

**1. The policy is fail-open.** The RESTRICTIVE policy added in
`20260802000000_eduos_rls_empty_context_fix` reads:

```sql
USING (
  NULLIF(current_setting('app.current_school_id', true), '') IS NULL
  OR "schoolId"::text = NULLIF(current_setting('app.current_school_id', true), '')
)
```

The first arm passes **everything** when the variable is unset or empty. That is
the default state of every connection in the Prisma pool, so the default
behaviour of the policy is "allow all rows".

**2. Nothing sets the variable.** `withSchool()` is the only code path that
calls `set_config('app.current_school_id', ...)`, and it is used in three
places. The other ~109 tenant routes use the plain Prisma client, so the GUC is
never set and the policy never restricts.

## What this means in practice

- A route that filters by `schoolId` is isolated. A route that forgets to is
  **not**, and fails **silently** — no error, no log, another school's rows.
- I read the two highest-risk entries on the UNCOVERED list.
  `app/api/teacher/analytics` scopes every query by `teacherProfileId`;
  `app/api/teacher/exams/[id]/results` scopes by `teacherProfileId`.
  **Neither is an exploitable IDOR.** The 18 are a latent-risk list, not a
  breach list.
- The `verify:rls` CI job does prove the policy *works* when the variable is
  set (it correctly runs as a non-superuser role, because a superuser has
  `BYPASSRLS` and would prove nothing). It does not prove the policy is
  *engaged*, because almost nothing engages it.

## Current risk exposure

**Low today, high at second-school onboarding.** Ykay College is presently the
only `School` row, so there is no second tenant to leak into. The EDUos
multi-tenant SaaS layer is on hold.

**This becomes a launch blocker the moment a second school is onboarded.**

## Path to a real DB-level guarantee

In order. Do not skip step 1 — flipping the policy to fail-closed first will
break every route that relies on app-level filtering.

1. **Drive the UNCOVERED list to zero.**
   `npm run check:tenant-coverage` prints the current 18. For each, confirm
   whether an imported helper already filters (the checker is a regex heuristic
   and reports false positives). Fix the ones that genuinely do not filter.

2. **Route tenant access through `withSchool()`.** Prefer this over more
   hand-written filters, so the database — not the developer — holds the
   invariant.

3. **Flip the policy to fail-closed.** The helper exists for exactly this:
   `eduos_apply_tenant_rls()` in
   `20260804000000_rls_backfill_and_coverage_guard`. It needs a variant with
   the `... IS NULL OR` arm removed, applied via:

   ```sql
   SELECT eduos_apply_tenant_rls_failclosed('<table>');
   ```

   Test against a real Postgres **as a non-superuser role** before deploying.

4. **Add the ratchet to CI** so coverage cannot silently regress:

   ```yaml
   - name: Verify tenant-route coverage (strict)
     run: npm run check:tenant-coverage -- --strict
   ```

5. **Re-run `npm run verify:rls` and `npm run verify:rls:coverage`** and confirm
   both pass against the fail-closed policy.

## Why there is no event trigger auto-securing new tables

It was written and deliberately abandoned: `eduos_apply_tenant_rls` issues
`ALTER TABLE` against the same table whose `CREATE TABLE` fired the trigger, so
the statement waits on a lock it already holds. Reproduced on PostgreSQL 18 —
`CREATE TABLE` hung until `statement_timeout` (57014) killed it. A guard that
can hang a migration is worse than the gap it closes. Coverage is therefore
enforced outside the database via `npm run verify:rls:coverage`.

## Related scripts

| Script | Purpose |
|---|---|
| `npm run check:tenant-coverage` | Static scan: which tenant routes filter, which do not |
| `npm run check:tenant-coverage -- --strict` | Same, exits non-zero on any UNCOVERED route |
| `npm run verify:rls` | Proves the policy isolates, as a non-superuser role |
| `npm run verify:rls:coverage` | Proves every table with a `schoolId` has the policy |
| `npm run check:drift` | Proves `schema.prisma` matches the migration history |
