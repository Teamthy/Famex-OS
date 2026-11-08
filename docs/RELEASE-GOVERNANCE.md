# Release governance — what is code now, what the owner must switch on

B-18 (audit register) found "an unreviewed path to production": unprotected
`main`, Dependabot disabled, scanning not verifiable, mutable image tags, and
migrations racing app boots. This file splits the fix in two: the parts that
live in the repository (done, code-reviewed, gate-checked) and the parts that
only exist in GitHub/OCI/Vercel settings — **owner steps**, listed with exact
values so they can be done once, in order, and evidenced with screenshots for
the recertification bundle (roadmap Phase 8).

Created 2026-11-08 (branch `arena/e697eea8-famex-os`, remediation Phase 1).

---

## 1. Already code (this repository)

| Item | Where | Gate that keeps it true |
|---|---|---|
| Dependency gate, root **and** mobile | `scripts/audit-deps.mjs` (dual scope, scoped+dated exclusions only) | `npm run audit:deps` — blocking CI step "Audit dependencies" |
| Mobile advisory triage | 2026-11-08: `npm audit fix --prefix mobile` cleared the critical (`shell-quote` RCE-class) and 7 highs; the remaining high chain (`decode-uri-component` ← `query-string` ← `expo-router`) has a dated exclusion with a reachability argument (on-device deep-link parsing only; fix requires the Expo SDK-major upgrade) | same gate; exclusion expires 2027-01-08 |
| Expo validation pinned | CI runs `expo-doctor@1.21.6` (was `@latest`), retries once, and re-emits failures as job annotations | CI "Mobile (Expo)" job |
| Migrations separated from app boot | `deploy/oci/docker-compose.yml` one-shot `migrate` service; app starts with `MIGRATE_ON_BOOT=false` only after it exits 0; `docker-entrypoint.sh` honours the flag (single-container hosts keep migrate-at-boot) | `tests/lib/release-path.test.ts` |
| Digest pinning mechanism | every compose image is `${VAR:-default}`; `deploy/oci/pin-image.sh` resolves immutable `@sha256:` refs (app + `--all` third-party) and writes them to `.env`; `deploy.sh` reports whether the deploy is pinned | `tests/lib/release-path.test.ts` |
| Notification sidecar auth (B-09) | compose `cron` sends `Authorization: Bearer ${JOBS_SECRET}` (the form the route accepts), logs every tick's HTTP status, and fails loudly — the old `x-jobs-secret … || true` silently 401'd forever | `tests/lib/release-path.test.ts` |
| Dependabot update PRs | `.github/dependabot.yml` — weekly, grouped minor/patch, separate ecosystems for root npm, mobile npm, GitHub Actions, Dockerfile; majors get individual PRs; every Dependabot PR runs full CI including the audit gate | CI on each Dependabot PR |

## 2. Owner steps (settings — cannot be done from a repository file)

Do these in order; each is evidence for Phase-8 recertification.

1. **Protect `main`** — GitHub → Settings → Branches → Add branch ruleset:
   - Require a pull request before merging; required approvals: **1**.
   - Require status checks to pass before merging, search and add exactly:
     `Lint & Type Check`, `Schema Drift`, `Build`, `Browser E2E`, `Load test`,
     `Mobile (Expo)`, `Lighthouse CI (budgets)`.
   - Require branches to be up to date before merging. Do **not** include
     administrators. Evidence: ruleset page screenshot + a blocked
     direct-push attempt.
2. **Enable security tooling** — Settings → Advanced Security → enable all:
   - Dependabot **alerts** and **security updates** (the audit found alerts
     disabled; `.github/dependabot.yml` alone only does update PRs).
   - **Code scanning** → Default setup (repository-wide).
   - **Secret scanning** + **push protection**.
   - Evidence: the three panels showing "enabled", plus the alert list (empty
     or triaged).
3. **Create the `production` environment** — Settings → Environments → New:
   - Required reviewers: the founder's account. Wait timer: 0.
   - Then add `environment: production` to the `build-and-push` job in
     `.github/workflows/docker-publish.yml` (one-line PR; the agent can do
     this once the environment exists). Evidence: an approval prompt on a
     `workflow_dispatch` publish.
4. **Restrict GHCR writes** — the `famex-os` package → Settings → manage
   Actions access: keep only this repository with write. Evidence: package
   settings screenshot.
5. **DB role split (B-12, on the OCI VM)** — the compose stack currently runs
   one `famex` superuser for migrations, app, and backups. Before real data:
   create `famex_migrate` (owner of schema; the `migrate` service uses it),
   `famex_app` (DML only + `SET ROLE` for RLS; the `app` service uses it),
   `famex_backup` (pg_dump role), and keep superuser for psql admin only.
   Verify RLS **fails closed** for `famex_app` (a query with no
   `app.current_school` set must return zero rows, not all rows). The exact
   SQL and the fail-closed drill belong to the B-12 slice; this line is the
   reminder that the compose `POSTGRES_USER` single-user default is not the
   end state.
6. **Secrets separation & rotation** — production and staging must not share
   `AUTH_SECRET`, `JOBS_SECRET`, gateway keys, or DB passwords; rotate any
   secret that ever transited chat, a screenshot, or a shared `.env`
   (audit found uncertain provenance). Values live only in `/opt/famex/.env`
   (OCI) and the Vercel project settings (staging). Evidence: rotation dates
   recorded in the owner's password manager, never in the repo.

## 3. Image update policy (third-party + app)

- **App image**: deploy digests, never tags. After each merged release:
  `./pin-image.sh --write` (resolves `ghcr.io/teamthy/famex-os:<tag>` →
  `@sha256:`), then `./deploy.sh`. Rollback = re-pin the previous digest
  (migrations are forward-only: roll back to a digest whose code works with
  the migrated schema).
- **Third-party compose images** (caddy, cloudflared, postgres, curl,
  uptime-kuma): pin all with `./pin-image.sh --all --write` at VM setup and
  re-resolve **monthly** or when an advisory touches one of them.
  `cloudflare/cloudflared:latest` is the worst default in the stack — never
  run a school day on it unpinned.
- **Re-enable the Expo directory check** at the next Expo SDK upgrade:
  remove `expo.doctor.reactNativeDirectoryCheck.enabled:false` from
  `mobile/package.json`, re-run `npx expo-doctor` and confirm the transport
  works from CI again (the dataset itself was verified clean against
  `react-native-community/react-native-directory` on 2026-11-08).
- **Review the mobile audit exclusion** (`decode-uri-component`, until
  2027-01-08) at the same SDK upgrade — the expo-router major is its fix.

## 4. What "green" means for publishing

`Docker Publish` only builds when the CI workflow concluded **success** on
that exact `main` commit (the gate is in the workflow and it works — it
refused to publish throughout 2026-10-23→11-08 because CI was red). With
the mobile job fixed, the first green `main` after this merge produces
`ghcr.io/teamthy/famex-os:main` + `:latest`; the owner then pins a digest
per §3. Tag releases (`v1.2.3`) for deliberate human cuts; tags publish
directly because they are cut from already-green commits.
