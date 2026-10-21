# Famex OS deployment — OCI production + Vercel staging

Famex International Schools (FIS) runs **one personalised school**, not a
multi-tenant platform. The deployment split is deliberately boring and safe:

| Environment | Host | Database | Purpose |
| --- | --- | --- | --- |
| **Production** | Oracle Cloud Infrastructure (OCI) | Postgres in `deploy/oci/docker-compose.yml` | The only live writer for the school domain |
| **Staging / preview** | Vercel | A **separate** staging Postgres database | Owner review, seeded test accounts, write-heavy browser E2E |

Do **not** point OCI and Vercel at the same production database. Two live
writers would make migrations, jobs, uploads and incident rollback ambiguous.
Hostnames never switch schools: every environment resolves the one configured
FIS school in its own database (`lib/school-resolution.ts`).

Secrets are entered only in the OCI VM's `/opt/famex/.env`, Vercel's project
environment settings, or the relevant provider console. Never paste passwords,
tokens or private keys into chat, GitHub issues, or committed files.

## Release flow

1. Work lands through a pull request into `main` only after the full GitHub CI
   suite is green.
2. Merging to `main` triggers `.github/workflows/docker-publish.yml`, gated on
   CI success for that exact commit. It publishes the multi-arch image to
   `ghcr.io/teamthy/famex-os`.
3. OCI pulls a pinned image tag and runs `./deploy.sh`; the container applies
   forward-only Prisma migrations at boot before serving.
4. Vercel's Git integration deploys the same commit to the **staging** project
   after its separate staging database has been migrated.

## A. OCI production (start here)

The complete VM guide is [`OCI-HOSTING.md`](./OCI-HOSTING.md). The owner-only
console steps are:

1. Create/confirm the OCI account and home region. From Nigeria, Johannesburg
   (`af-johannesburg-1`) is closest when capacity is available; Frankfurt is a
   practical fallback. Add a low budget alert before creating resources.
2. Create one Ubuntu 24.04 ARM VM (`VM.Standard.A1.Flex`, 2 OCPU / 12 GB) with
   an SSH key you control. Keep the boot volume and backups within the chosen
   free/paid limits.
3. Set the GitHub repository **Actions Variables** used for browser build
   config (`NEXT_PUBLIC_SITE_URL`, APK/Sentry public values as applicable),
   merge the release PR, and confirm the **Docker Publish** workflow produced
   the GHCR image for the merge commit.
4. Copy `deploy/oci/` to `/opt/famex` on the VM and run the bootstrap script
   from `OCI-HOSTING.md`. Review `/opt/famex/.env` on the VM; fill production
   secrets there only. Set:
   - `SCHOOL_SLUG=famex-international-schools`
   - `SCHOOL_NAME=Famex International Schools`
   - `IMAGE_TAG` to a version tag published from a `v*` Git tag for a formal
     release (`main` is acceptable only for the first bring-up)
   - production `NEXT_PUBLIC_SITE_URL` and `SITE_DOMAIN`
5. Run `./deploy.sh`, create the first real administrator with the documented
   one-time seed command, remove `INITIAL_ADMIN_PASSWORD`, and re-deploy.
6. Point DNS at the VM/Caddy or Cloudflare Tunnel hostname. Verify:
   - `GET /api/health` returns database `up`
   - `GET /api/health/ready` reports migrations applied
   - the real admin can sign in and MFA can be enrolled
   - a database backup appears under `/opt/famex/backups` and offsite copy is
     configured before real records are entered

Do not seed `prisma/seed-all.ts` into production. It creates demonstration
accounts for CI/staging only.

## B. Vercel staging / preview

1. Create a separate staging Postgres database (for example a Neon staging
   project/branch) in a region close to the Vercel function region. Create an
   Upstash Redis database for distributed rate limiting.
2. In Vercel, import `Teamthy/Famex-OS` as a **staging** project. Root
   Directory is the repository root. `vercel.json` already declares:
   - framework: Next.js
   - install: `npm ci` (the package `postinstall` generates Prisma Client)
   - build: `npm run build`
   - a daily notification-dispatch cron safe for the Hobby plan
3. Add environment variables in Vercel for the staging project (Production and
   Preview may share the staging database initially, but never production
   OCI credentials):
   - `DATABASE_URL` — pooled staging Postgres URL with `connection_limit=1`
     (the Prisma schema reads this variable only; keep the provider's
     direct/unpooled URL in your trusted shell as `STAGING_DIRECT_URL` for the
     migration/seed commands below)
   - a staging-only `AUTH_SECRET` and `MFA_ENCRYPTION_KEY` (32+ characters)
   - `NEXT_PUBLIC_SITE_URL` — the Vercel staging HTTPS URL
   - `SCHOOL_SLUG=famex-international-schools`
   - `SCHOOL_NAME=Famex International Schools`
   - `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`
   - test-mode Paystack keys; staging Resend/S3 credentials if those flows are
     being exercised
   - `JOBS_SECRET` and `CRON_SECRET` with the same staging-only value
   - `NEXT_PUBLIC_SHOW_DEMO_BADGE=true` if the owner wants the staging badge
4. Before the first staging deploy, run migrations from a trusted shell using
   the staging **direct** URL (do not paste it into chat):

   ```bash
   DATABASE_URL="$STAGING_DIRECT_URL" npx prisma migrate deploy
   SEED_PASSWORD="<staging-only password>" DATABASE_URL="$STAGING_DIRECT_URL" npx tsx prisma/seed-all.ts
   ```

   For later schema releases, migrate staging before promoting the same
   commit to OCI. Never use `prisma db push` in either environment.
5. Trigger/redeploy the Vercel project after env vars are saved. Verify
   `/api/health`, sign in with a seeded staging account, and run the write E2E
   journeys against staging (below).

If one-minute notification dispatch is needed while testing staging, use the
optional `deploy/oci/famex-notify.timer` from a trusted host. OCI production
already has its own 60-second cron container; do not run two dispatchers
against the production database.

## Real browser E2E against staging

The write journeys create exams, attendance registers, assignments and live
classes, so run them only against the seeded staging database or CI's
throwaway database — never production:

```bash
E2E_BASE_URL="https://<vercel-staging-host>" \
E2E_NO_SERVER=1 \
E2E_PASSWORD="$SEED_PASSWORD" \
npx playwright test tests/e2e/04-exams.spec.ts tests/e2e/07-learning-journeys.spec.ts
```

`tests/e2e/04-exams.spec.ts` proves teacher publish → student sit/submit →
auto-mark → released score. `tests/e2e/07-learning-journeys.spec.ts` proves:

- teacher takes and locks a real JSS1A attendance register;
- teacher creates an assignment in the portal, the student submits, the
  teacher grades, and the student sees score + feedback;
- teacher schedules a virtual class, the student joins only inside the
  permitted window, the external meeting opens, and the teacher sees the
  launch record;
- joining before the window is refused without leaking the meeting URL;
- teacher/student assignment powers stay separate.

For production OCI, restrict post-deploy checks to health, public pages,
real-admin login/MFA, backup presence, and read-only smoke checks unless the
school has explicitly created disposable production test accounts.

## DNS and provider callbacks

- School production domain → OCI Caddy/Cloudflare Tunnel.
- Vercel staging keeps its `*.vercel.app` hostname or a clearly named staging
  subdomain; it must not receive the production domain.
- Paystack live webhook/callback URLs → OCI production only. Staging uses
  test keys and staging callback URLs.
- Meta WhatsApp webhook → production only unless a separate test number/app
  is configured for staging. Unsigned callbacks are rejected.
- Object-storage CORS allows only the exact production origin on the
  production bucket and only the staging origin on any staging bucket.
