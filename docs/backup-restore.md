# Backup, Restore & Monitoring Runbook

_Ykay College EduPortal — operational procedures_

This is the document you open when something has already gone wrong. It assumes you are stressed
and in a hurry, so the recovery steps come first.

---

## ⚠️ Read this before your first backup

The RLS migration sets `FORCE ROW LEVEL SECURITY` on all 29 tenant tables. **`FORCE` applies to the
table owner too**, so a plain `pg_dump` run as the application role fails part-way through:

```
pg_dump: error: query failed: ERROR: query would be affected by
row-level security policy for table "AdmissionApplication"
```

This is the dangerous kind of failure — `pg_dump` can exit `0` having written a **truncated file**,
so a cron job looks healthy while producing unusable backups. It was found by attempting a real
restore drill, not by reading the config.

**Fix — once, per database:**

```sql
-- Create a role used ONLY by the backup job.
CREATE ROLE ykay_backup LOGIN PASSWORD '<strong-password>' BYPASSRLS;
GRANT CONNECT ON DATABASE <db> TO ykay_backup;
GRANT USAGE ON SCHEMA public TO ykay_backup;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO ykay_backup;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO ykay_backup;
```

Point the backup job's `DATABASE_URL` at `ykay_backup`, and leave the application role alone.

> **Do not simply add `BYPASSRLS` to the application role.** It works, but it disables tenant
> isolation for every request the app makes — I verified this: granting `BYPASSRLS` to the app role
> makes `npm run verify:rls` fail 7 of its 10 checks, because a role with `BYPASSRLS` ignores RLS
> policies entirely. Read-only, backup-only is the safe shape.

**Do NOT "fix" this by disabling FORCE RLS either.** That is the control stopping one school from
reading another's data once EDUos onboards a second tenant.

After changing roles, re-run `npm run verify:rls` against a scratch database to confirm isolation
still holds.

`npm run db:backup` checks for this and prints the remedy rather than writing a broken archive.

---

## 1. Recovery — "we need the data back"

### 1a. Someone deleted something (most common)

**First, check whether it is actually gone.** Most destructive actions in this app are *soft*
deletes — the row is still there with `isActive: false`:

| Thing | Behaviour |
| --- | --- |
| Student removed from a class | Soft — `StudentProfile.isActive = false` |
| Class archived | Soft — `SchoolClass.isActive = false` |
| Staff suspended | Soft — `User.isSuspended = true` |
| Expense, news post, exam question | **Hard delete** — needs a restore |
| Attendance entries on re-submit | Replaced inside a transaction |

To undo a soft delete, flip the flag back — no restore needed:

```sql
UPDATE "StudentProfile" SET "isActive" = true WHERE "studentId" = 'YKC/2026/XXXX';
UPDATE "SchoolClass"    SET "isActive" = true WHERE "displayName" = 'JSS1A';
```

### 1b. Point-in-time restore (Neon)

Neon keeps a continuous history, so you can branch the database as it was at a specific moment.
This is the fastest route and it does **not** touch production.

1. Neon Console → your project → **Branches** → **New branch**
2. Choose **"From a point in time"**, set the timestamp to just *before* the incident
3. Name it `recovery-YYYYMMDD`
4. Copy that branch's connection string
5. Inspect it **before** touching production:

   ```bash
   psql "<recovery-branch-url>" -c 'SELECT count(*) FROM "StudentProfile";'
   ```

6. Copy back only what you need, e.g. one class of students:

   ```bash
   pg_dump "<recovery-branch-url>" --data-only \
     --table='"StudentProfile"' -Fc -f /tmp/students.dump

   pg_restore "<production-url>" --data-only --disable-triggers /tmp/students.dump
   ```

> Check your Neon plan's history window. Free tier retains far less than paid — if it is shorter
> than a week, the nightly logical backup in §2 is your real safety net, not PITR.

### 1c. Full restore from a logical backup

Only when the whole database is lost or corrupted.

```bash
# 1. Create an empty target (never restore over a live database)
createdb ykay_restored

# 2. Restore
pg_restore --dbname="postgresql://.../ykay_restored" \
  --no-owner --no-privileges \
  backups/ykay-2026-08-02T05-36-40.dump

# 3. Verify BEFORE repointing the app
psql "postgresql://.../ykay_restored" -c '
  SELECT
    (SELECT count(*) FROM "StudentProfile") AS students,
    (SELECT count(*) FROM "FeeInvoice")     AS invoices,
    (SELECT count(*) FROM "User")           AS users,
    (SELECT count(*) FROM pg_policies WHERE schemaname = '"'"'public'"'"') AS rls_policies;'
```

`rls_policies` should be **58** (29 tables × 2 policies). If it is 0, tenant isolation did not come
across — stop and investigate before letting anyone in.

4. Point `DATABASE_URL` at the restored database and redeploy.
5. Run `npm run check:drift` and `npm run verify:rls` against it before reopening to users.

**Verified:** this exact round-trip was tested against PostgreSQL 17 with 800 students and 4,800
invoices — 0 errors, all row counts matched, all 58 RLS policies preserved.

---

## 2. Taking backups

### Manual

```bash
DATABASE_URL="postgresql://..." npm run db:backup
DATABASE_URL="postgresql://..." npm run db:backup -- --out /mnt/backups
```

The script writes a compressed custom-format archive and then **verifies it by listing its
contents**. An unverified backup is not a backup.

### Scheduled

Run nightly, off-peak (Nigeria is UTC+1, so 02:00 local = 01:00 UTC):

```cron
0 1 * * *  cd /path/to/app && DATABASE_URL="..." npm run db:backup -- --out /mnt/backups >> /var/log/ykay-backup.log 2>&1
```

**Retain**: 7 daily, 4 weekly, 12 monthly. A term's worth of history matters here — a data problem
introduced in week 2 may not be noticed until reports are generated in week 12.

**Store off-Neon.** A backup living only in the same account as the database does not protect you
from losing the account.

### What is NOT in the database

- **Uploaded documents** (admission files, student photos) live in S3/R2. Enable **bucket
  versioning** — the dump does not contain them.
- **Environment variables / secrets** — keep a sealed copy of `.env` somewhere safe. Losing
  `AUTH_SECRET` signs every user out; losing `PAYSTACK_SECRET_KEY` breaks payment verification.

---

## 3. Before a risky operation

Take a backup first. Specifically before:

- `prisma migrate deploy` with a migration that drops or alters a column
- Bulk enrolment, promotion or archival
- End-of-term report-card generation
- Any manual `UPDATE`/`DELETE` in the SQL console

```bash
npm run db:backup -- --out ./backups/pre-migration
```

**Always read the generated SQL before applying a migration.** If it contains `DROP INDEX` for an
index that exists in the database but not in `schema.prisma`, the correct fix is usually to
*declare* that index — dropping it silently removes a performance guarantee. `npm run check:drift`
catches this class of problem in CI.

---

## 4. Monitoring

### Health endpoint

`GET /api/health` — checks database connectivity (with latency) and Redis.

```json
{ "status": "healthy", "checks": { "database": { "status": "up", "latencyMs": 12 } } }
```

Returns **200** when healthy, **503** when degraded or unhealthy. Point an uptime monitor
(UptimeRobot, Better Stack, Vercel Monitors) at it on a 5-minute interval.

| Status | Meaning | Action |
| --- | --- | --- |
| `healthy` | All good | — |
| `degraded` | DB up, Redis down | Rate limiting fell back to in-memory. Not urgent, but login throttling is weakened. |
| `unhealthy` | Database unreachable | Urgent. Check Neon status and connection limits. |

### Errors

Sentry is wired via `sentry.client.config.ts`. Confirm `SENTRY_DSN` is set in production — without
it, exceptions go nowhere.

### Things worth watching

| Signal | Why |
| --- | --- |
| `AuditLog` volume by action | A spike in `ADMISSION_FEE_RECORDED_OFFLINE` may mean Paystack is failing |
| `SecurityEvent` denials | Repeated `AUTH_DENIED_*` from one IP suggests probing |
| `NotificationJob` stuck `PENDING` | The cron at `/api/jobs/dispatch-notifications` has stopped |
| Neon connection count | `connection_limit=1` per instance; serverless fan-out can exhaust the pool |
| Slow queries | `lib/prisma.ts` logs anything over 500ms in development |

### Scheduled job

`vercel.json` runs `/api/jobs/dispatch-notifications` daily at 08:00 UTC. It is protected by
`CRON_SECRET`/`JOBS_SECRET`. If parents stop receiving alerts, check that the cron ran and that the
secret matches.

---

## 5. Quarterly restore drill

**A backup you have never restored is a hypothesis, not a backup.**

Once a term, ideally before a busy period:

1. `npm run db:backup -- --out /tmp/drill`
2. Restore into a scratch database (§1c)
3. Run `npm run check:drift` and `npm run verify:rls` against it
4. Spot-check a student, an invoice and a report card
5. Note how long the whole thing took — that is your real recovery time

Record the date and duration here:

| Date | Duration | Restored by | Notes |
| --- | --- | --- | --- |
| 2026-08-02 | ~2 min (4.8k invoices) | Initial verification | 0 errors, 58 RLS policies intact. Verified with a dedicated read-only `ykay_backup` role: dump succeeds and `verify:rls` still passes 10/10 on the app role. |

---

## 6. Emergency contacts

Fill these in before go-live:

| Service | Console | Account owner |
| --- | --- | --- |
| Neon (database) | console.neon.tech | |
| Vercel (hosting) | vercel.com/dashboard | |
| Paystack (payments) | dashboard.paystack.com | |
| Resend (email) | resend.com | |
| Cloudflare R2 / AWS S3 | | |
