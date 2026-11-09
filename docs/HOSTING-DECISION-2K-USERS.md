# OCI + Vercel for real public use — what to pick for 2,000 users

**Date:** 2026-11-07
**Question asked:** is deploying Famex OS on OCI *and* Vercel the best fit for
public use, with about 2,000 ready users?
**Short answer:** **No, not as a pair.** Vercel and OCI are two hosts for one
app, and this app has exactly one writer per school. Pick **one** environment to
serve real users. For 2,000 users the recommendation is **OCI production as the
only writer, and Vercel kept as a staging preview that never touches the
production database.** The rest of this document says why, with numbers, and
what it costs to change that opinion.

Everything below distinguishes **measured in this repository** from **published
by the vendor**. Vendor numbers were checked on 2026-11-07 and are cited; they
change, and two of them changed *against* this project in 2026.

---

## 1. The constraint that decides almost everything

Famex OS is **single-writer**. The repo states it in
`docs/VERCEL-OCI-DEPLOY.md`:

> Do **not** point OCI and Vercel at the same production database. Two live
> writers would make migrations, jobs, uploads and incident rollback ambiguous.

That is not a stylistic preference, it is what the code does:

| Thing | Why two writers break it |
| --- | --- |
| **Prisma migrations** (46 of them) | `migrate deploy` from two hosts at different commits means whichever boots last wins the schema. `_prisma_migrations` has no fencing. |
| **Cron** (`/api/jobs/dispatch-notifications`, `vercel.json` schedule `0 8 * * *`) | Vercel's cron fires on Vercel. If OCI also runs the same job from `deploy/oci/`, parents get each notification twice. Nothing in `NotificationJob` deduplicates by content. |
| **Background timers** (`famex-notify.timer`, `famex-backup-offsite.timer`) | systemd units on OCI; no equivalent on Vercel — so the backup and notification timers would simply not exist in the Vercel copy. |
| **Local module storage** (`lib/module-store.ts`) | library, inventory and clinic persist to `./data/<schoolId>/<module>.json` on the **local filesystem**. See §3. |

So "OCI + Vercel" is not a redundancy story — it is **two half-apps**. Either
Vercel is a read-only preview with its own database (safe, and what
`VERCEL-OCI-DEPLOY.md` already prescribes), or you have two contradictory
sources of truth for the same 2,000 users.

**The question is therefore: which single host serves the 2,000?**

---

## 2. What 2,000 users actually is

"2k ready users" for a Nigerian secondary school is not 2,000 concurrent
sessions. Model it before sizing anything:

| Segment | Count | Typical concurrency |
| --- | --- | --- |
| Students | ~1,400 | ~5% at once, mostly 07:00–09:00 and 14:00–21:00 |
| Parents | ~500 | bursty: fee deadlines, results day |
| Staff (teachers, admin, bursar) | ~100 | ~30% at once during school hours |

Realistic steady-state: **30–60 concurrent requests**, and a handful of spikes
that are genuinely heavy:

- **Results day** — every parent opens a report card in the same evening.
- **Fee deadline** — payment callbacks and invoice refreshes.
- **Mock/exam CBT** — a whole class starts a timed session within the same
  minute.

Those three are the events that decide whether hosting is adequate. A host that
is comfortable at 40 concurrent requests and collapses at 400 simultaneous
report-card reads is not adequate, whatever the monthly average says.

### Rough database load

2,000 users, ~15 requests each per day, ~1.5 queries per request, ≈ **45,000
queries/day**, concentrated into maybe 8 busy hours. That is around **1.5–2
queries/second average**, with peaks 10–20× that. Any decent Postgres handles
this on one core. **The database is not the bottleneck; the request/CPU budget
and the disk assumptions are.**

---

## 3. Where Vercel does not fit this app

### 3.1 Library, inventory and clinic write to local disk

`lib/module-store.ts` documents its own storage:

> records are persisted to `./data/<schoolId>/<module>.json` so they survive
> restarts

On Vercel that is wrong in three separate ways:

1. **`/tmp` is the only writable path**, and `process.cwd()/data` is not it.
   The `storage` check in `/api/health/ready` would report `down`.
2. **The filesystem is per-instance and ephemeral.** Two concurrent function
   instances see two different `data/` directories; a redeploy discards both.
3. **There is no volume.** Vercel Functions have no persistent disk at all.

Consequence: on Vercel, **a librarian can enter a book and it can silently
disappear**, or be visible to one user and not another, depending on which
instance served the request. That is a data-loss bug wearing an infrastructure
costume. It also explains audit blocker **B-13** ("clinic/library/inventory
JSON") — the file store was always a beta bridge.

**This is the single strongest reason Vercel cannot serve real users for this
app today.** It is fixable (move the three modules to Prisma/object storage),
but until it is fixed, Vercel is structurally unsafe for those modules.

### 3.2 The Hobby plan is not licensed for this

Verced's Fair Use Guidelines: *"Hobby teams are restricted to non-commercial
personal use only. All commercial usage of the platform requires either a Pro or
Enterprise plan."* Commercial includes *"any method of requesting or processing
payment"* — and this app takes Paystack fee payments, so it is commercial the
day it goes live. That makes the real Vercel price **Pro, $20/month/seat** — not
$0. See [Vercel fair use][1], [Hobby vs Pro][2].

### 3.3 The Hobby ceilings are too small for results day

Published Hobby limits (2026): [Vercel limits][3], [pricing 2026][4]

| Resource | Hobby | What it means here |
| --- | --- | --- |
| **Active CPU** | **4 CPU-hours/month** | This is the binding constraint. A server-rendered report-card page costs on the order of 0.05–0.3 CPU-seconds. 4 CPU-hours ≈ 48,000–290,000 renders/month **across the whole app**, and results day alone is ~1,400. It is survivable but close, and only because most pages are cheap. |
| Memory | 2 GB fixed, 1 vCPU | No tuning on Hobby. |
| Max duration | 300 s | Fine — the only heavy job (`dispatch-notifications`) declares `maxDuration = 60`. |
| Invocations | 1 M/month | Fine at 2,000 users (~30k). |
| Fast Data Transfer | 100 GB/month | Fine; this app is text-first, PDFs are generated client-side. |
| Regions | single | Fine for one school in Lagos if you pick a nearby region — but Hobby offers **no way to choose** the function region, and the default is `iad1` (Washington DC). |
| Over limit | **feature paused ~30 days, no bill** | You cannot buy your way out. A paused feature during results week is an outage with a 30-day tail. |

That last row is the one to stare at. On Vercel Hobby, **exceeding a limit is
not an invoice — it is a month-long outage.** For a school portal that parents
rely on during a fee deadline, that is an unacceptable failure mode.

### 3.4 Latency: Washington DC → Lagos

Vercel's default function region here is `iad1` (the deployment record shows
`"regions": ["iad1"]`, `"functionDefaultRegions": ["iad1"]`, and Hobby can't
move it). Every server-rendered page and API call is a round trip
**Lagos → Virginia → Lagos**: typically 120–180 ms of pure transit per request,
before compute. A page that makes three API calls pays it three times. On OCI
in `af-johannesburg-1` the transit is roughly a quarter of that.

For a school on Nigerian mobile data, that difference is felt on every tap.

### 3.5 What Vercel genuinely is good at

To be fair, and because the recommendation uses it for exactly this:

- **Preview deployments per branch**, with a real URL, in minutes.
- **Zero-ops TLS, CDN and rollback.**
- **Cron** declared in `vercel.json` and observable.
- Fine for **staging with seeded test accounts** — which is what the repo
  already says to use it for.

---

## 4. Where OCI fits — and where it does not

### 4.1 The free tier was halved in 2026

This matters because the repo's own plan is built on it. Oracle **cut the Always
Free Ampere A1 allowance from 4 OCPU / 24 GB to 2 OCPU / 12 GB**, first as a
documentation change in June 2026 with enforcement reported from 18 August 2026.
Sources differ on enforcement date; all agree the allowance is now halved.
[halving report][5], [enforcement-dated report][6], [free-tier table][7]

`docs/OCI-HOSTING.md` already reflects this (`VM.Standard.A1.Flex — 2 OCPU /
12 GB`, "stay within 2 OCPU / 12 GB total"), so the docs are current. What is
not written down anywhere is **what 2 OCPU / 12 GB can carry**.

### 4.2 Is 2 OCPU / 12 GB enough for 2,000 users?

Yes, with room, **if the app runs as one Node process and the database is not
fighting it for RAM.** Rough budget on the same box:

| Consumer | RAM | Notes |
| --- | --- | --- |
| Node/Next.js server | 1.5–3 GB | One `next start`; this app is mostly server-rendered pages. |
| Postgres | 2–4 GB | `shared_buffers` ~1 GB, rest for page cache; database will be well under 5 GB. |
| Caddy (TLS) | ~50 MB | |
| Backups, timers, OS | ~1 GB | |
| **Headroom** | **~4 GB** | for spikes, `docker build`, and the OS. |

CPU is the real question. 2 vCPU ARM cores will serve 40–60 concurrent requests
comfortably for this app's query shape, and will *feel* results day (1,400
report-card renders in an evening is roughly 5–10 minutes of solid CPU if they
all land at once — an unpleasant minute, not an outage). Notably it is the same
constraint that bites Vercel Hobby (4 CPU-hours/month ≈ 2 vCPU at ~6% duty
cycle), except on OCI **you cannot be paused for exceeding it** — you just get a
slower minute.

### 4.3 Where OCI is weak

- **You are on-call.** Single VM, no SLA, no managed failover.
- **"Out of host capacity"** on A1 is a real, common provisioning failure.
- **Idle reclamation** has been reported on Always Free tenancies; the repo's
  timers help but it is a risk to know about.
- **Postgres is yours to patch, back up and restore.** The repo has
  `deploy/oci/backup-offsite.sh` + rclone + systemd timers for exactly this —
  the work is done, but it is still your job to verify it.

---

## 5. Recommendation

**Serve the 2,000 from OCI. Keep Vercel as staging only.**

This is also what `docs/VERCEL-OCI-DEPLOY.md` already prescribes, so the
recommendation is "do what the repo says", now backed by numbers.

| Concern | OCI production | Vercel |
| --- | --- | --- |
| Who can write | **only this** | staging DB only |
| Licence | yours | **Pro required** (commercial use) — $20/mo/seat |
| Disk store (`module-store`) | works | **broken/ephemeral** until B-13 is fixed |
| Function region | `af-johannesburg-1` (close) | `iad1` fixed on Hobby |
| Cost at 2,000 users | ₦0 compute (free tier) + domain | $0–20/mo, but not production-licensed |
| Failure mode at the limit | slower | **feature paused ~30 days** |
| Cron | systemd timers | `vercel.json` cron |
| Migrations | `migrate deploy` at boot, one writer | must run before promote |

### If the owner wants Vercel to be the production host anyway

That is a legitimate choice — it is less work to operate — but it requires, in
this order:

1. **Fix `module-store` (B-13)** to use Prisma models or object storage. Until
   then library/inventory/clinic lose data. *Non-negotiable.*
2. **Move to Vercel Pro** (commercial licence, real overage billing instead of
   a month-long pause). ~$20/month.
3. **Pin the function region** to the closest available to Lagos (Pro feature).
4. **Point cron at Vercel only**, and remove the systemd notify timer from
   `deploy/oci/` so the job cannot run twice.
5. **Move the database off the VM** (Neon/Upstash Postgres) — the free Neon
   plan's 100 CU-hours/month is **not** enough for always-on production: at
   0.25 CU always-on that is ~400 hours short of a month, so this means a paid
   plan or a managed Postgres with a real monthly floor. Budget for it.
6. **Accept no local disk** in any future feature.

That is 4–6 weeks of work for a school that needs to be live. OCI is live now.

### The one thing worth doing regardless

**Staging on Vercel should be a *preview* environment with a seeded staging
database and `NEXT_PUBLIC_SHOW_DEMO_BADGE=true`** — it already is, per the run
book. It is genuinely valuable for the owner to click a branch URL before a
release. That is a different job from serving 2,000 users, and it is the job
Vercel is best at.

---

## 6. Cost of the recommended path

| Item | Monthly | Notes |
| --- | --- | --- |
| OCI VM (Always Free, 2 OCPU / 12 GB) | ₦0 | 200 GB storage, 10 TB egress included |
| Domain | ~₦1,000–2,000/yr | via registrar |
| TLS | ₦0 | Caddy, automatic |
| Off-site backups | ₦0–small | rclone to Cloudflare R2/B2 free tiers |
| Vercel (staging) | $0 | Hobby is fine for staging; it is not commercial because it is not public |
| **Total** | **~₦0–2,000/month** plus domain | |

Against Vercel-Pro-as-production: $20/month **plus** a managed Postgres floor
(≈$15–25/month) **plus** the B-13 fix, and a Lagos→Virginia round trip on every
request.

---

## 7. What changed in this analysis vs. the existing docs

Nothing contradicts `VERCEL-OCI-DEPLOY.md`; this adds the numbers it did not
have:

1. The **2 OCPU / 12 GB halving** is now dated and cited, with a sizing budget.
2. **Vercel Hobby cannot legally host this** (commercial use) — that is new and
   material, because the repo's staging plan assumes Hobby.
3. **`module-store` writes to local disk** is now named as the concrete reason
   Vercel cannot take production traffic, tied to blocker B-13.
4. Hobby's **"paused for 30 days"** overage behaviour is named as a failure
   mode, which matters more than any CPU number.
5. The **`iad1`** default region is named, with its latency consequence.

## 8. Open questions for the owner (decision, not research)

- Does the school intend to keep library/inventory/clinic? If not, B-13 is moot
  and the Vercel path gets shorter.
- Is there budget for Vercel Pro + managed Postgres (~$35–45/month)? If yes,
  Vercel-as-production becomes a reasonable 4–6 week project.
- Who is on-call for the OCI VM outside school hours? This is the real cost of
  the free path, and it does not appear on any invoice.

---

## Sources

[1]: https://vercel.com/docs/limits/fair-use-guidelines "Vercel Fair Use Guidelines — Hobby is non-commercial only"
[2]: https://thesearchsherpa.com/is-vercel-free-for-small-business/ "Is Vercel Free for Business? Hobby vs Pro (2026)"
[3]: https://musayilmaz.dev/en/blog/vercel-free-tier-production "Vercel Free Tier Limits — Hobby (Oct 2026)"
[4]: https://massivegrid.com/blog/vercel-pricing-explained-2026/ "Vercel Pricing 2026 — Hobby vs Pro limits"
[5]: https://terminalbytes.com/oracle-cloud-free-tier-changes-2026/ "Oracle Cloud free tier 2026: 4 OCPU/24GB cut to 2 OCPU/12GB"
[6]: https://ettayeb.fr/en/selfhosted/oracle-always-free-arm-limits-halved-2026/ "Oracle halves Always Free ARM limits, Aug 2026 enforcement"
[7]: https://cloudpricecheck.com/free-tier/oracle "OCI Free Tier (2026) — full limits table"

---

## 9. What was actually deployed (2026-11-07)

A Vercel project **`famex-os`** now exists under the `teamthy` team and builds
this branch. This is the honest state of it:

| Fact | Status |
| --- | --- |
| Project created, linked to `Teamthy/Famex-OS` | ✅ |
| GitHub-integration deploy of `arena/a545871c-famex-os` | ✅ built, `Deployment completed`, 3m build |
| Node runtime | ✅ pinned to 22.x via `package.json` `engines` (Vercel defaulted to 26.x, untested) |
| `prisma generate` during `npm ci` | ✅ `Generated Prisma Client (v6.19.3)` |
| Next.js build | ✅ completed, all routes emitted |
| Secrets generated and set (`AUTH_SECRET`, `JOBS_SECRET`, `CRON_SECRET`, `MFA_ENCRYPTION_KEY`) | ✅ |
| School identity env (`SCHOOL_*`, `SCHOOL_TIMEZONE`) | ✅ |
| **`DATABASE_URL`** | ⚠️ **placeholder only** — points at `localhost`, deliberately. No staging Postgres has been provisioned, and none should be invented. |
| **Runtime verified** | ❌ **Not verified.** The sandbox that prepared this has no network path to `*.vercel.app`, so no page was opened and `/api/health` was never curled. **The build passing is not the same as the app working.** |
| Public access | ⚠️ Vercel **deployment protection** is on (`readySubstate: STAGED`), so only a signed-in team member can open the URL. That is the right default while `DATABASE_URL` is a placeholder. |

### To finish it (needs a real staging database — owner action)

1. Create a staging Postgres (Neon staging branch, or any managed Postgres) in a
   region near the function region.
2. In Vercel → `famex-os` → Settings → Environment Variables, **replace
   `DATABASE_URL`** with the pooled URL (keep `connection_limit=1`).
3. Migrate and seed from a trusted shell, never from chat:

   ```bash
   DATABASE_URL="$STAGING_DIRECT_URL" npx prisma migrate deploy
   DATABASE_URL="$STAGING_DIRECT_URL" SEED_PASSWORD="…" npx tsx prisma/seed-all.ts
   ```

4. Redeploy, then open `/api/health/ready`. It must report `database: up`,
   `migrations.pending: 0`. **`storage` will report `down` on Vercel** — that is
   §3.1 of this document, not a misconfiguration.
5. Sign in with a seeded account and open `/report-cards/<verificationCode>/print`
   to confirm the new printable card renders on the deployed build.

Until step 4 passes, treat the Vercel deployment as a **build artefact**, not an
environment.

### Update (2026-11-09): "the UI doesn't show" — diagnosed and degraded honestly

Founder report: the Vercel deployment shows no UI. Diagnosis (Vercel API +
code): the production deployment of `main` builds and promotes fine
(`READY`/`PROMOTED`), but every page 500s at runtime — the root layout's first
Prisma read (`resolveSchoolForRequest` → `prisma.school.findFirst`) hits the
placeholder `localhost` `DATABASE_URL` inside a Vercel function, throws, and a
root-layout crash takes down **every** route as a blank error page. This is
exactly the "not an environment until step 4 passes" state above, made visible.

Code fix (this repo, no owner action needed): the root layout now distinguishes
database-infrastructure failures (unreachable server, missing/invalid
`DATABASE_URL`, unmigrated schema — `PrismaClientInitializationError`, `P2021`,
`P2022`) from application bugs. On an infrastructure failure it renders the
page shell from environment brand tokens plus an honest amber
**"Setup incomplete — database not connected"** banner
(`components/SetupIncompleteBanner.tsx`) pointing at `/api/health`; application
errors still propagate, and signed-in sessions still fail closed
(`IdentityCheckUnavailableError` → treated as signed out). `app/error.tsx` also
gained the same honest hint and no longer emits a nested `<html>` document.

Steps 1–5 above remain **required and unchanged**: the banner is truthful
degradation, not a working school OS. Public pages render; every signed-in
feature, live datum, and cron job still needs the real staging database.

### Update 2 (2026-11-09): the boot wall in front of the render wall

The founder's screenshot after update 1 still showed a bare error page — and
it was Next's *built-in* crash page, not any of ours, which meant the failure
happened before React: `instrumentation.ts` → `lib/env.ts` `assertEnv()`
treated `NEXT_PUBLIC_SITE_URL`, `PAYSTACK_PUBLIC_KEY` and `PAYSTACK_SECRET_KEY`
as fatal in `NODE_ENV=production` (which Vercel is), so **the server refused
to start at all**. Fixed in the same branch: `lib/site-url.ts` lets the
platform supply its own URL (preview `VERCEL_URL` / production project
domain), and missing Paystack keys now disable payments loudly instead of
fatally (`lib/paystack.ts` refuses every initiation and webhook verification,
so an unkeyed deployment can never silently take money). After this merges,
expect: boot succeeds, `/api/health` returns `503 database: down` (that JSON
is the "booted, DB missing" signal), and pages render the banner. Verified
locally with `next start` under the exact Vercel-shaped environment.

### Why the first attempt hung

The first deploy sat at `npm ci` with no output for over two minutes on Node
26.x and was cancelled. The retry — identical except for the `engines` pin and a
present `DATABASE_URL` — completed `npm ci` in 1m and the whole build in 3m.
Two changes, one build; the log does not prove which one fixed it, so record it
as **both were needed and neither was isolated**. The `engines` pin is correct
on its own merits (the suite ran on 22), and `DATABASE_URL` being absent is a
plausible hang cause because `postinstall` runs `prisma generate`, which reads
the datasource block.
