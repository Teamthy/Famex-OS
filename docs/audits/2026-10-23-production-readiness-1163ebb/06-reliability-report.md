# 06 — Reliability, operations & disaster-recovery report

## Overall verdict

**FAIL**, with deployment/restore/rollback specifically **BLOCKED** by missing live-environment evidence.

The repository contains a plausible single-host OCI topology, health endpoints, backup scripts, Sentry hooks, Uptime Kuma, and a database-backed notification queue. None of that has been proven as an operating production system.

## Deployment topology reviewed

- OCI production is prepared through `deploy/oci/docker-compose.yml`, Caddy, Cloudflare Tunnel, Postgres, notification/backup sidecars, and Uptime Kuma.
- Vercel is intended as staging/preview with a separate staging database, not a second production writer.
- Docker Publish builds multi-arch images after CI success.
- The application container runs as a non-root user in the final image.
- `docker-entrypoint.sh` runs `prisma migrate deploy` on every boot before starting the server.

## Reliability findings

### Health and readiness semantics are misleading

`app/api/health/route.ts` returns HTTP 200 whenever the database is up, including degraded Redis states. That choice is defensible for liveness if the body is monitored. `app/api/health/ready/route.ts`, however, explicitly returns HTTP 200 for `degraded` as well as `healthy`, despite describing itself as readiness/deep health. Pending migrations, unwritable data directory, or missing required env can therefore appear ready to automation that checks status code only.

Required model:

- `/health/live`: process is up; no dependency checks that can cause restart loops.
- `/health/ready`: DB, migrations, critical storage, and required configuration are ready; return 503 when not ready.
- `/health/details`: authenticated/internal detailed checks for operators.
- Monitor response bodies and queue age, not only HTTP 200.

### Notification failure can be silent

The application queue has claim/backoff behavior, but the OCI Compose sidecar uses the wrong auth header and `|| true`. Provider errors are also not consistently inspected at every email call site in source review. A school can believe fee reminders, admission updates, and result notices were sent when the dispatcher never authenticated.

### Migrations run at application boot

Boot-time `prisma migrate deploy` is simple for a single container, but it couples release, migration, and process startup. Risks include multiple replicas racing, long migrations exceeding health windows, failed migration preventing rollback to the prior app, and unclear operator ownership. For production, use a single explicit migration job/step with logs, backup gate, lock behavior, and compatibility policy.

### Mutable release identity

Compose defaults the app image tag to `main`; Docker Publish also tags `latest`. `cloudflared:latest` and broad tags such as `caddy:2-alpine` and `louislam/uptime-kuma:1` are also present. Operators cannot prove exactly which code is running from the Compose file alone. Production must pin the app by immutable digest and record third-party image digests or accepted update policy.

### Database privilege and RLS

The app defaults to the Postgres owner role in Compose. RLS is explicitly fail-open when no school context is set and is used only by push-token paths. Reliability and security therefore depend on every application query remaining correct forever. Separate DB roles and enforceable guardrails are required before production.

### JSON-file operations data

Clinic/library/inventory data in whole-file JSON lacks cross-process locking, transactions, constraints, and point-in-time consistency with Postgres backups. It will diverge or lose updates under concurrent writers, multiple containers, crashes, or partial restores.

## Failure-mode matrix

| Failure | Observed design | Audit status |
|---|---|---|
| Database unavailable | Health reports DB down and returns 503 in `/api/health`; most routes depend on Prisma | NOT VERIFIED dynamically |
| Redis/rate-limit dependency unavailable | Health can remain HTTP 200 with degraded body; behavior varies by rate-limit path | NOT VERIFIED dynamically |
| Paystack timeout after charge | Verification/webhook reconciliation exists, but attempt binding and reversal handling are flawed | FAIL |
| Duplicate Paystack webhook | Reference uniqueness helps, but exact-match binding is missing | FAIL |
| Refund/chargeback webhook | Not handled as a complete reversal journey | FAIL |
| Email/SMS/WhatsApp provider down | Queue/backoff exists; Compose trigger is broken and some provider errors are swallowed | FAIL |
| Notification dispatcher down | Sidecar masks failure with `|| true`; no verified queue-age alert | FAIL |
| App process restart during exam | DB-backed attempts/autosave patterns exist, but restart/offline conflict drills were not executed | NOT VERIFIED |
| App process restart during payment | Transactional posting helps; browser/webhook race and reference binding require fixes/tests | FAIL |
| Disk full / JSON data dir unwritable | Readiness can still return HTTP 200 when degraded | FAIL |
| Bad migration | Boot-time migration can block startup; rollback compatibility not rehearsed | BLOCKED |
| Bad image/config deploy | Mutable tags and no verified rollback run | BLOCKED |
| Backup job silently not copying offsite | `backup-offsite.sh` exits 0 when rclone remote is absent | FAIL |
| Restore from backup | Procedure exists but stale in places; no rehearsal evidence | BLOCKED |
| Sentry/alert provider unavailable | Instrumentation is defensive and may continue without Sentry; alert delivery not verified | NOT VERIFIED |

## Observability assessment

Present:

- Sentry client/server/edge configuration files.
- `instrumentation.ts` request-error capture when Sentry is available.
- Health endpoints.
- Uptime Kuma service in Compose.
- Structured logger module.
- Security-event logging path from middleware.

Missing or unverified:

- production DSN and environment separation;
- alert rules, escalation, on-call owner, and tested paging;
- metrics for request latency/errors, DB pool, queue age, job failures, webhook failures, payment exceptions, backup freshness, disk/memory/CPU;
- distributed/request tracing across provider calls;
- log retention, search, and PII redaction proof;
- SLOs/error budgets and incident runbooks;
- synthetic login/payment-webhook/notification checks using test accounts and test mode.

## Backup and disaster recovery

The backup design is a starting point, not a DR capability. Launch requires:

1. documented RPO/RTO approved by school leadership;
2. encrypted off-host backups for Postgres **and** uploaded files/object storage;
3. backup completion, size, checksum, and freshness monitoring;
4. restore into an isolated environment at least quarterly;
5. application login/smoke and record-count/file verification after restore;
6. credential/secret recovery procedure;
7. region/host-loss procedure;
8. named DR owner and communication plan.

No timed restore or host-loss rehearsal was available, so DR remains **BLOCKED**.

## Minimum operational exit criteria

A successor release cannot pass reliability until the team produces:

- staging deployment record with immutable digest;
- production deployment record with the same digest or an explicitly promoted digest;
- migration log and rollback decision point;
- health/readiness outputs under normal and induced dependency failure;
- queue dispatch proof and provider test receipts;
- backup listing, checksum, restore timing, and post-restore smoke;
- alert screenshots/tickets proving a human received test alerts;
- incident owner roster and escalation contacts;
- 7–14 days of staging/pilot error/latency observation or an explicitly accepted shorter hypercare plan.
