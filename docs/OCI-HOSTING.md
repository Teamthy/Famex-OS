# Famex OS on Oracle Cloud (OCI) Always Free — deployment guide

Run the whole platform on **one free ARM VM**: app + Postgres + cron + backups
behind HTTPS, for ₦0/month of server spend. This is "Path C" for the budget in
[`operating-cost.md`](./operating-cost.md); the managed alternative is in
[`VERCEL-OCI-DEPLOY.md`](./VERCEL-OCI-DEPLOY.md).

```
                         ┌─────────────── OCI Ampere A1 VM (2 OCPU / 12 GB) ───────────────┐
  parents/teachers ─────▶│  caddy :80/:443  ──or──  cloudflared tunnel                      │
   (Cloudflare DNS)      │        │                                                          │
                         │        ▼                                                          │
                         │  app :3000  (Next.js standalone image from GHCR, arm64)         │
                         │        │                                                          │
                         │  db  Postgres 16 ── backup (daily pg_dump) ──▶ ./backups       │
                         │  cron (60s notification tick)                                   │
                         └──────────────────┬─────────────────────────────────────────────┘
                                            │ rclone (systemd timer)
                                            ▼
                              OCI Object Storage (20 GB free) / Cloudflare R2
                              R2 also holds admission documents + the Android APK
```

Everything you need is in [`deploy/oci/`](../deploy/oci/): a self-contained
compose stack, Caddyfile, bootstrap/deploy/backup scripts. The VM never needs
a source checkout or a local build.

---

## 1. How the system supports OCI (what was built, and why)

OCI's free shape is **ARM64 (Ampere A1)** — that single fact drives most of
the integration work:

| Piece | Where | Why OCI needs it |
|---|---|---|
| Multi-arch image (`linux/amd64` + `linux/arm64`) | `.github/workflows/docker-publish.yml` | An amd64-only image dies on Ampere with `exec format error`. Prisma engines and `sharp` are platform binaries, so each platform builds its own layers. |
| `NEXT_PUBLIC_*` as Docker **build args** | `Dockerfile` builder stage | Browser config (APK URL, Sentry DSN…) is inlined at build time; runtime env alone can't set it in a prebuilt image. Passed from GitHub repo *Variables*. |
| Boot-time migrations + bundled seeds | `docker-entrypoint.sh`, `/out-seeds` | `prisma migrate deploy` runs before the server; the CBT seed and the **manual** first-admin seed (`prisma/seed-admin.mjs`) are esbuild-bundled because the slim image has no `tsx`. |
| Single-VM compose stack | `deploy/oci/docker-compose.yml` | Caddy *or* Cloudflare Tunnel ingress, Postgres tuned for 6–12 GB, in-memory rate limits (single-instance acceptance), daily backups, log rotation, memory limits. App port is never published. |
| Bootstrap + offsite backups | `deploy/oci/bootstrap.sh`, `backup-offsite.sh` | Docker install, swap, the OCI host-firewall fix, secret generation, rclone timer to OCI Object Storage/R2. |

If this VM must be **shared with another service** (e.g. a second API on the
same Ampere box): size the instance 1 OCPU / 6 GB per service or keep 2/12 and
share, drop the `public`/`tunnel` profile here, and route through the box's
existing proxy to `app:3000`.

## 2. One-time preparation (before touching OCI)

1. **GitHub repo Variables** (Settings → Secrets and variables → Actions →
   *Variables*) — these get baked into the browser bundle by CI:
   `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_APK_URL`, `NEXT_PUBLIC_APK_SIZE`,
   `NEXT_PUBLIC_SENTRY_DSN` (and optionally `NEXT_PUBLIC_APK_FALLBACK_URL`,
   `NEXT_PUBLIC_PLAUSIBLE_DOMAIN`). Trigger a Docker Publish run afterwards.
   If the GHCR package is private, also create a PAT with `read:packages`
   for the VM to pull with.
2. **OCI account**: at sign-up choose your **home region** carefully —
   Always Free resources can *only* be created there and it can never be
   changed. From Nigeria, **South Africa North (Johannesburg,
   `af-johannesburg-1`)** is the closest; EU Frankfurt is the fallback with
   the most capacity. Then: Billing → *Upgrade to Pay As You Go* (still ₦0
   within Always Free limits; exempts you from idle-instance reclamation),
   and create a **budget alert at ₦1,000 / $1** so nothing can bill silently.
   Stay within **2 OCPU / 12 GB total** A1 usage and 200 GB block storage.
3. **Accounts**: Cloudflare (DNS + R2 bucket for admission documents,
   apply [`S3_ADMISSIONS_CORS.json`](./S3_ADMISSIONS_CORS.json) to it),
   Resend (verify your sending domain's SPF/DKIM records), Paystack
   (live keys + education-rate confirmation).

## 3. Create the VM (OCI console)

Compute → Instances → Create instance:

| Setting | Value |
|---|---|
| Image | **Canonical Ubuntu 24.04** (aarch64) — *not* the Minimal variant (bootstrap expects full apt) |
| Shape | `VM.Standard.A1.Flex` — **2 OCPU / 12 GB** (or 1/6 if sharing) |
| Networking | Create/select a VCN with a **public subnet**; assign a public IPv4 |
| Boot volume | Custom size **100 GB** (of the 200 GB free pool; leaves room for volume backups) |
| SSH keys | Upload your public key; save the private key |

"Out of host capacity" on A1 is common: retry, or pick another availability
domain, or create at 1 OCPU / 6 GB and resize later.

**Security list** (VCN → Security Lists → default) ingress rules:

| Port | Source | Purpose |
|---|---|---|
| 22/tcp | your IP only (`<your-ip>/32`) | SSH |
| 80/tcp, 443/tcp, 443/udp | `0.0.0.0/0` | website — **public (Caddy) mode only**; skip for tunnel mode |

Then reserve the address: Networking → IP Management → Reserved Public IPs →
reserve one and assign it to the instance's VNIC (so the IP survives stops).

## 4. Bootstrap the VM

```bash
ssh ubuntu@<reserved-ip>
git clone https://github.com/Teamthy/Famex-OS.git   # or scp deploy/oci/ up
cd Famex-OS/deploy/oci
sudo ./bootstrap.sh            # public/Caddy mode
# sudo ./bootstrap.sh --tunnel # Cloudflare Tunnel mode (no inbound ports)
```

`bootstrap.sh` installs Docker + rclone, adds 2 GB swap, opens the **host**
iptables firewall in public mode (OCI Ubuntu images REJECT 80/443 at host
level even when the security list allows them — the classic trap), installs
the stack to `/opt/famex`, generates `.env` with fresh secrets (including a
random first-admin password — note it down), and enables the offsite-backup
timer. Re-runnable; it never overwrites an existing `.env`.

## 5. Configure

Edit `/opt/famex/.env` (template: `deploy/oci/.env.example`). The load-bearing
values: `SITE_DOMAIN`, `NEXT_PUBLIC_SITE_URL`, Paystack keys (test keys fail
loudly-by-warning in production; live keys for go-live), `RESEND_API_KEY` +
`EMAIL_FROM`, the R2 `S3_*` set, `SCHOOL_*`, and `IMAGE_TAG` (pin a release
tag like `1.2.3` instead of tracking `main`).

Ingress, pick one in `COMPOSE_PROFILES`:

- **public** — Cloudflare DNS `A` record → reserved IP. Start **DNS-only
  (grey cloud)** so Caddy can issue its first Let's Encrypt certificate,
  then enable the orange-cloud proxy with Cloudflare SSL mode
  **Full (Strict)** (never Flexible) and uncomment the trusted-proxies block
  in `Caddyfile`.
- **tunnel** — Cloudflare Zero Trust → Networks → Tunnels → create a tunnel,
  add a public hostname (your domain) pointing to service `http://app:3000`,
  paste the token into `TUNNEL_TOKEN`. No ports open anywhere.

Private GHCR package? Log in once:

```bash
echo <pat> | docker login ghcr.io -u <github-user> --password-stdin
```

## 6. First deploy

```bash
cd /opt/famex
./deploy.sh                                             # pull, migrate, wait for health
docker compose exec app node prisma/seed-admin.mjs      # create the first ADMIN
```

Then **remove `INITIAL_ADMIN_PASSWORD` from `.env`** and re-run `./deploy.sh`
(the seed resets that password on every run — it must not linger), log in,
change the password in the portal. `SEED_CBT_ON_BOOT=true` loads the CBT
question bank idempotently at boot.

Migrating an existing database instead? Dump the old one
(`pg_dump "$OLD_DATABASE_URL" | gzip > famex.sql.gz`), copy it to the VM, and
*before first deploy* restore with:

```bash
docker compose up -d db
gunzip -c famex.sql.gz | docker compose exec -T db psql -U "$POSTGRES_USER" -d "$POSTGRES_DB"
./deploy.sh   # entrypoint migrations bring it to the image's schema
```

## 7. Go-live checklist

- [ ] `curl https://<domain>/api/health` → `healthy`, and `/api/health/ready` shows migrations applied
- [ ] Admin login works; seeded password changed; `INITIAL_ADMIN_PASSWORD` gone from `.env`
- [ ] Paystack dashboard webhook URL = `https://<domain>/api/payments/paystack/webhook`; a ₦100 test payment confirms end-to-end (then refund)
- [ ] Password-reset email arrives (Resend domain verified, not from `onboarding@resend.dev`)
- [ ] Admission document upload succeeds (R2 bucket + CORS)
- [ ] `./backups/` contains a dump and `rclone ls offsite:` shows the offsite copy (§8)
- [ ] `docker compose logs app | grep WARNING` — no unresolved env warnings

Only now point the production domain / printed links at this box.

## 8. Backups and restore

Three layers, all free:

1. **Local** — the `backup` service dumps daily to `/opt/famex/backups`
   (14 days kept).
2. **Offsite** — `famex-backup-offsite.timer` rclone-copies to OCI Object
   Storage (20 GB free) or R2, 90 days kept. Configure once: create a
   *private* bucket (e.g. `famex-backups`), generate a **Customer Secret
   Key** (Identity → Users → your user), fill in
   `~/.config/rclone/rclone.conf` from `rclone.conf.example` (endpoint:
   `https://<namespace>.compat.objectstorage.<region>.oraclecloud.com`),
   verify with `rclone lsd offsite:` and `systemctl start
   famex-backup-offsite.service`.
3. **Boot-volume backups** (optional) — attach a weekly backup policy to the
   boot volume in the console; 5 volume backups are Always Free.

**Test a restore quarterly** into a scratch database (an untested backup is a
hope, not a backup):

```bash
docker compose exec db createdb -U "$POSTGRES_USER" restore_test
gunzip -c backups/famex-<date>.sql.gz | docker compose exec -T db psql -U "$POSTGRES_USER" -d restore_test
docker compose exec db psql -U "$POSTGRES_USER" -d restore_test -c 'select count(*) from "User";'
docker compose exec db dropdb -U "$POSTGRES_USER" restore_test
```

Full disaster recovery = new VM → §4 → restore latest offsite dump (§6) →
`./deploy.sh`. Nothing in this stack is OCI-specific at runtime, so the same
steps work on any VPS.

## 9. Updates and rollback

Push to `main` → CI gates → Docker Publish builds both architectures and tags
the image (`main`, or the release version for `v*` tags). To update:

```bash
cd /opt/famex
sed -i 's/^IMAGE_TAG=.*/IMAGE_TAG=1.3.0/' .env   # pin the new release
./deploy.sh
```

Rollback is the same with the previous tag — with one caveat: Prisma
migrations are forward-only. An older image may not understand a newer
schema; if a bad release also migrated badly, restore the pre-deploy backup
(§8) instead of only rolling the tag back. Take a manual dump before risky
upgrades: `docker compose restart backup` dumps immediately on start.

## 10. Operations

| Task | Command / note |
|---|---|
| Logs | `docker compose logs -f app` (rotated at 10 MB × 3 per service) |
| Health | `docker compose ps`, `curl localhost:3000` via `docker compose exec app wget -qO- http://localhost:3000/api/health/ready` |
| Uptime dashboard | add `monitoring` to `COMPOSE_PROFILES`, then `ssh -L 3001:127.0.0.1:3001 ubuntu@<ip>` and open `http://localhost:3001` |
| Disk | `df -h`, `docker system df`; monthly `docker image prune -f` (never `volume prune`) |
| Memory/CPU | `free -h`, `docker stats` — 20%-idle reclamation only applies to non-PAYG accounts (§2) |
| OS patches | unattended-upgrades is enabled by bootstrap; containers restart on reboot (`restart: unless-stopped`) |

## 11. Troubleshooting

| Symptom | Likely cause / fix |
|---|---|
| `exec format error` in app logs | Image tag predates the multi-arch build, or a locally-built amd64 image was copied over. Pull a current GHCR tag. |
| Site times out, SSH works | Public mode needs **both** the security-list rules (§3) *and* host iptables (bootstrap does it — was it run with `sudo`?). Check `sudo iptables -L INPUT -n`. |
| Certificate errors / redirect loop | Cloudflare proxy enabled before the first cert, or SSL mode Flexible. Grey-cloud until issuance, then Full (Strict). |
| App unhealthy, env stack trace in logs | Production env validation doing its job: `NEXT_PUBLIC_SITE_URL` must be a full URL and Paystack keys present (`lib/env.ts`). Fix `.env`, `./deploy.sh`. |
| 503 on login / password reset | Rate limiters failing closed: set `ALLOW_MEMORY_RATE_LIMITS=true` (single-instance) or the Upstash pair. |
| "Out of host capacity" creating the VM | Normal on A1. Retry / other availability domain / start 1 OCPU 6 GB and resize. |
| `unauthorized` pulling the image | Private GHCR package — `docker login ghcr.io` with a `read:packages` PAT (§5). |
| Admission uploads fail CORS | Bucket CORS not applied (`docs/S3_ADMISSIONS_CORS.json`), or `S3_*` points at OCI Object Storage (no bucket CORS — use R2 for documents; OCI storage is for backups). |
| Emails not arriving | sender domain unverified in Resend, or still on the free 100/day cap on results day. |
| Instance stopped by Oracle | Idle reclamation on a non-PAYG account. Upgrade to PAYG (§2); data on the boot volume survives a stop. |

## 12. Limits you accepted with this path

Single VM = single point of failure; free-tier shapes can be resized or
re-priced by Oracle (they were halved once, in 2026); 10 TB/month free
egress; you are the on-call engineer. In exchange: ₦0 server bill and full
portability — every artifact here (image, compose, dumps) runs unchanged on
any ₦-payable Nigerian VPS if the free tier ever stops being worth it. See
[`operating-cost.md`](./operating-cost.md) for the 5-year budget built on
this path.
