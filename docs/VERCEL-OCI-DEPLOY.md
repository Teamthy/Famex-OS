# EduPortal deployment — Vercel + OCI (production)

EduPortal is a **Next.js monolith**: pages and `/api/*` deploy together. On
Vercel the whole Node app runs in serverless functions; OCI hosts the
stateful dependencies (or the entire standalone image — both options below).
The API cannot be split from the pages.

## Option A (recommended for launch): full app on Vercel + managed Postgres

1. **Database — use Neon (or OCI Autonomous Postgres).** The committed
   `.env.example` connection string already assumes Neon. A self-hosted
   Postgres on the OCI Ampere VM is reachable from Vercel only through an
   IP allowlist/TLS tunnel, and Vercel egress IPs are not stable outside
   paid plans — do not open 5432 to `0.0.0.0/0`.
   - Use the **pooled/transaction** connection string for serverless and
     keep `connection_limit=1` (already in the template). Use the
     unpooled **direct** URL (`DIRECT_URL`) for migrations in CI.
2. **Upstash Redis is mandatory on Vercel.** The auth/admissions limiters
   are in `DISTRIBUTED_REQUIRED` and **answer 503 without a shared store**
   (`lib/rate-limit.ts`). Set:
   - `UPSTASH_REDIS_REST_URL`
   - `UPSTASH_REDIS_REST_TOKEN`
   Never set `ALLOW_MEMORY_RATE_LIMITS=true` on Vercel (each function is a
   separate instance; per-instance budgets are no control).
3. **Vercel environment variables** (Production): see full list in
   `.env.example`. Minimum to boot: `DATABASE_URL`, `DIRECT_URL`,
   `AUTH_SECRET` (≥32 chars, unique), `NEXT_PUBLIC_SITE_URL` (https URL),
   `PAYSTACK_PUBLIC_KEY`/`PAYSTACK_SECRET_KEY` (live), `JOBS_SECRET`
   (= the timer's secret below), S3 (`S3_BUCKET`, `S3_REGION`,
   `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, optional `S3_ENDPOINT`),
   `RESEND_API_KEY`, `EMAIL_FROM`, Sentry DSN, and `COLLEGE_SSO_SECRET`
   only if YK-Virtual federation is enabled (must match Virtual's value).
4. **Notifications cron** — Vercel Hobby plans run `vercel.json` crons once
   a day; the dispatcher expects a 60-second tick. Install the supplied
   timer on the OCI box instead:
   ```bash
   sudo cp deploy/oci/eduportal-notify.service /etc/systemd/system/
   sudo cp deploy/oci/eduportal-notify.timer   /etc/systemd/system/
   sudo install -m 600 /dev/stdin /opt/ykay/eduportal-cron.env <<'EOF'
   EDUPORTAL_JOBS_URL=https://<your-vercel-app>/api/jobs/dispatch-notifications
   JOBS_SECRET=<same as Vercel JOBS_SECRET / CRON_SECRET>
   EOF
   sudo systemctl daemon-reload
   sudo systemctl enable --now eduportal-notify.timer
   systemctl list-timers eduportal-notify.timer
   # manual proof:
   sudo systemctl start eduportal-notify.service && journalctl -u eduportal-notify.service
   ```
   The endpoint also accepts Vercel's `Authorization: Bearer $CRON_SECRET`.
5. **Migrations** run from CI/gate (the `schema-drift` job proves the chain
   applies cleanly). For production, run `prisma migrate deploy` from a
   controlled step or the Docker image entrypoint — never `prisma db push`.
6. Vercel project settings: Root Directory = repo root, Framework Next.js;
   security headers/CSP ship from `next.config.ts` (review the
   `connect-src` list for your exact Upstash/Neon/S3 hostnames).

## Option B: standalone container on OCI (same box as Virtual)

The repo builds a non-root standalone image (`.github/workflows/docker-publish.yml`
publishes to GHCR, gated on CI). On the VM:

```bash
docker run -d --name eduportal --restart unless-stopped \
  --network ykv-prod_default \
  -p 127.0.0.1:3000:3000 \
  --env-file /opt/ykay/college.env \
  ghcr.io/teamthy/ykay_eduport-:<sha>
```

- Put Caddy in front for `*.ykaycollege.edu.ng` (same pattern as Virtual;
  the container entrypoint already runs `prisma migrate deploy` and seeds
  idempotently).
- On a single instance you MAY set `ALLOW_MEMORY_RATE_LIMITS=true`
  (documented risk acceptance) — but prefer Upstash anyway.
- `docker-compose.prod.yml` here includes Postgres, Redis, a 60s cron
  container and a daily backup container; it works directly on the VM.

## Pre-launch verification (staging)

- Login burst: 11th attempt/15 min from one IP returns 429, never 503
  (proves Upstash is wired).
- Paystack test: fee init → checkout → webhook → invoice settlement;
  duplicate webhook doesn't double-post; mismatched amount is rejected.
- Admissions: upload EICAR and a clean PDF (if ClamAV is wired), submit,
  review, enroll; expired upload token rejected.
- Exam: 60 students start/submit at the deadline simultaneously (load
  workflow exists); late resume auto-submits; retake consumed once.
- Parent messaging IDOR: a parent cannot open another family's thread.
- Notification timer creates actual deliveries within ~2 min.
- Restore drill: `npm run db:restore-drill` against a scratch database.

## DNS / domains

- `ykaycollege.edu.ng` / `www` → Vercel (or Caddy for option B).
- S3/R3 bucket CORS: presigned PUT/GET from the Vercel origin only.
- Paystack dashboard callback/webhook URLs point at the production origin;
  the webhook secret is the Paystack secret already in use.
