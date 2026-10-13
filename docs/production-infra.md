# Ykay College production infrastructure checklist

This repo can run on Vercel/managed Postgres, but self-hosted production needs more than the app container.

Minimum production shape:

- Next.js app container built from `Dockerfile`.
- PostgreSQL 16 with automated backups and a tested restore drill.
- Redis or Upstash for distributed rate limiting / queue coordination.
  - The app rate-limits through **Upstash's REST API** (`UPSTASH_REDIS_REST_URL`
    + `UPSTASH_REDIS_REST_TOKEN`); the `redis` container in
    `docker-compose.prod.yml` is provisioned for future queue/session use and
    is not yet used by the limiter.
  - Without Upstash configured, **security-critical limiters (login, password
    reset, payments, admissions) fail closed with 503** rather than silently
    downgrading to a per-process budget. A single-instance deployment can
    accept the memory fallback explicitly with `ALLOW_MEMORY_RATE_LIMITS=true`
    — documented risk acceptance, one app container only.
- Authenticated cron/worker for `/api/jobs/dispatch-notifications`.
- Object storage for admission documents.
- Secret manager for `AUTH_SECRET`, Paystack keys, email keys, S3 keys and `JOBS_SECRET`.
- TLS at the proxy/load balancer.
- Monitoring and alerts for 5xx, queue backlog, failed payment webhooks and failed notification delivery.
- SMS reachability (optional but recommended for Nigerian parents): configure
  `TERMII_API_KEY` + `TERMII_SENDER_ID` (see `lib/notifications.ts`). Without
  them SMS/WhatsApp notification jobs are marked "provider not configured" and
  skipped — they are never silently treated as sent. Email/in-app/push work
  regardless.

`docker-compose.prod.yml` documents the required local/self-hosted stack. For managed hosting, map each service to its managed equivalent and keep the same environment requirements.
