# 03 — Launch-blocker register

## Severity key

- **P0** — must be fixed and retested before real users, real child/family data, authoritative exams/results, or real money.
- **P1** — must be fixed before the affected module is launched or before scale/operational claims are made.
- **BLOCKED** — cannot be closed from this repository/sandbox without an external system, environment, or owner evidence.

## B-01 — Pinned web dependencies now fail the project's critical-advisory gate

- **Severity/status:** P0 / FAIL
- **Evidence:** `package-lock.json` resolves `next@16.4.0`, `@sentry/nextjs@10.69.0`, and `dompurify@3.4.16`. On 2026-10-23, `node scripts/audit-deps.mjs` reported 5 high, 3 critical, and 2 moderate findings and exited 1. The five high findings are the script's scoped ESLint-chain exclusion; the failing critical modules are `@sentry/nextjs`, `dompurify`, and `next` (GHSA-mchm-gjx6-7h55, GHSA-cg2g-xh64-v4q7 plus related DOMPurify advisories, GHSA-2464-fhr4-w9xw, GHSA-p3m5-59mp-jv5r, and GHSA-673q-mjm6-r5xr).
- **Reachability note:** No exploit was reproduced. Next image optimization is enabled in `next.config.ts`, `next/image` is used, and middleware excludes `_next/image`; no `dangerouslyAllowSVG` or `use cache` usage was found. No Sentry `tunnelRoute` was found. DOMPurify arrives through `jspdf`, which is used by `lib/branded-pdf.ts`, `lib/receipt.ts`, and ID-card export. Reachability is therefore mixed and partly **NOT VERIFIED**, but the release gate itself is red.
- **Impact:** Potential remote code execution, middleware bypass, XSS, or denial of service depending on advisory/path; at minimum, the release no longer satisfies its own supply-chain policy.
- **Required fix:** Upgrade to patched, mutually compatible releases; regenerate the lockfile; remove stale exclusions; rerun build, unit, E2E, image-optimization, PDF, and Sentry tests.
- **Regression evidence:** `npm run audit:deps` exits 0 on the successor commit in CI; exact-commit build/E2E pass; dependency diff reviewed.

## B-02 — Public CBT APIs expose an answer oracle and unauthenticated attempt surface

- **Severity/status:** P0 / FAIL
- **Evidence:** `app/cbt/page.tsx` and `app/cbt/[slug]/page.tsx` redirect to login, but `app/api/cbt/check/route.ts` remains public. At lines 34–42 it loads `correctIndex`/`explanation` by arbitrary `questionId` and returns correctness, `correctIndex`, and `explanation`. Related public quiz/attempt routes were inventoried under `app/api/cbt/`.
- **Impact:** Anyone who obtains a question ID can interrogate the answer key one question at a time; unauthenticated attempts can pollute analytics/results. Rate limiting slows abuse but does not make disclosure safe.
- **Required fix:** Remove public CBT APIs from production, or bind every check/attempt to an authenticated, server-issued practice attempt with per-question commit state and no reusable question-ID oracle. Keep assessment question banks separate from public practice content.
- **Regression evidence:** Unauthenticated and cross-attempt requests return 401/403/404; repeated checks cannot enumerate answers; E2E proves the intended practice mode without exposing keys before authorized submission.

## B-03 — Admissions documents can pass by type without a clean, verified stored file

- **Severity/status:** P0 / FAIL
- **Evidence:** `app/api/admissions/payments/start/route.ts:48` and `app/api/admissions/submit/route.ts:59` build completeness from `application.documents.map((document) => document.type)`. `app/api/admin/admissions/route.ts:30` selects document `id`, `type`, `fileName`, and `sizeBytes`, not a scan verdict. Source review also found presigned upload/confirmation gaps around stored MIME/magic bytes, checksum/length binding, quarantine, and deletion of infected/replaced objects in `lib/storage.ts`, `lib/security.ts`, `lib/malware.ts`, and the admissions document routes.
- **Impact:** Pending/infected or substituted content can be treated as satisfying an admissions requirement; staff may download malicious files; child identity/medical documents may remain in unsafe locations.
- **Required fix:** Require `CLEAN` scan state plus verified size, checksum, MIME, and magic bytes before payment/submission/review; quarantine infected objects; delete or isolate replaced objects; show scan state to reviewers; use short-lived authorized downloads with audit logs.
- **Regression evidence:** EICAR/malware fixtures, renamed executables, MIME spoofs, oversized bodies, checksum mismatch, duplicate confirmation, and replacement races all fail closed in integration tests against real object storage or a faithful test double.

## B-04 — Fee payment reference replay is not bound to the intended attempt

- **Severity/status:** P0 / FAIL
- **Evidence:** `lib/fee-payment-service.ts:46–49`, `postCompletedFeePayment()`, finds an existing payment solely by `reference` and returns it as a replay before validating the supplied school, invoice, student, amount, method, status, or `attemptId`. Parent verification and the Paystack webhook both call this service (`app/api/parent/fees/payments/route.ts`, `app/api/payments/paystack/webhook/route.ts`). Source review also found offline `PENDING_REVIEW` collisions/dead ends, paid-attempt rebinding risk, and ignored refund/chargeback webhook events.
- **Impact:** A duplicate/conflicting reference can be reported as success for the wrong financial context, strand a legitimate payment, or conceal a reversal. Ledger balance checks do not cure wrong-document binding.
- **Required fix:** Resolve and lock the server-created attempt first; compare every immutable field; transition attempt and payment atomically; make replay return success only for an exact match and a conflict otherwise; implement first-class pending-review completion/rejection and refund/chargeback reversal postings.
- **Regression evidence:** Concurrent duplicate webhook + browser verify, wrong-amount/invoice/student references, paid-reference reuse, partial refund, full refund, chargeback, provider timeout, and webhook-before-browser ordering tests against real Postgres.

## B-05 — Student and parent account provisioning can strand or expose users

- **Severity/status:** P0 / FAIL
- **Evidence:** Actual login in `app/api/auth/login/route.ts` is lowercased email + bcrypt password with school resolution. `scripts/seed-students.ts:122–125` says shared-password login does not use the stored hash and sets a random hash; lines 198–200 nevertheless advertise a hard-coded shared password (redacted). No supported in-product student-login provisioning/reset workflow was found. `scripts/make-student-login.ts` sets `mustChangePassword:false`. Student-creation flows were also found to create/reuse parent accounts from unverified email and return temporary passwords to staff.
- **Impact:** Students may be enrolled without usable credentials; staff workarounds invite shared passwords, account takeover, and support chaos at term start.
- **Required fix:** Build audited admin provisioning and reset flows: unique school email/identifier policy, one-time activation links, forced first-password change, guardian-link verification, bulk import with dry-run/errors, and no password disclosure to staff after creation.
- **Regression evidence:** Admissions enrolment → student activation → login → forced password change → parent link verification → reset/revocation E2E, including duplicate email and wrong-guardian cases.

## B-06 — Leadership and operations roles have inconsistent page/API authority

- **Severity/status:** P0 / FAIL
- **Evidence:** `lib/roles.ts` defines `PROPRIETOR`, `PRINCIPAL`, `VICE_PRINCIPAL`, `LIBRARIAN`, and `NURSE`; `app/login/page.tsx` sends several to `/admin` destinations. `middleware.ts:26–31` defaults unhandled roles to `/student/dashboard`, while its admin/staff allowlists omit those roles. Role-group APIs can still authorize some of them.
- **Impact:** The proprietor/principal/nurse/librarian may be unable to work, loop between pages, or possess API authority without a coherent UI/audit path.
- **Required fix:** Define one server-enforced role × page × API × object matrix, use the same role groups in middleware/login/nav/APIs, add provisioning for every supported role, and remove or explicitly disable unsupported roles.
- **Regression evidence:** Parameterized login/route tests for every `UserRole`, including direct URL access, API access, nav visibility, and denied-object access.

## B-07 — Authenticated exam entitlement, timing, and offline replay are not examination-safe

- **Severity/status:** P0 / FAIL
- **Evidence:** Student exam lists are subject-filtered, but source review of `app/api/student/exams/[id]/attempt/route.ts`, `.../offline-package/route.ts`, and `.../attempt/offline-replay/route.ts` found authorization centered on current class. Advertised `theoryMinutes` is not consistently included in attempt/offline deadlines derived from `durationMinutes`. Offline replay accepts broad client-supplied timing assertions.
- **Impact:** A student may access an exam for a subject they do not take, lose theory time, or replay manipulated offline timing. Results become contestable.
- **Required fix:** Authorize by current enrolment + subject + exam publication window on every attempt/package/replay endpoint; make server-issued attempt deadlines authoritative; sign offline packages and replay envelopes; bind device/attempt/nonce; reject stale or altered timing.
- **Regression evidence:** Cross-subject IDOR, class-transfer, expired-window, duplicate replay, altered timestamps, theory-duration, autosave/offline/online conflict, and submission-after-deadline tests.

## B-08 — Gradebook/report outputs can be incomplete, stale, or publicly guessable

- **Severity/status:** P0 / FAIL
- **Evidence:** Source review of `lib/gradebook.ts`, `lib/report-cards.ts`, result-correction code, broadsheet routes, and public verification found missing/absent/exempt work collapsing to zero, whole-class treatment despite electives, rankings over incomparable subject sets, correction workflows reporting affected report cards without regenerating them, and deterministic public verification identifiers of the form `RC/{session}/T{term}/{studentId}`.
- **Impact:** Incorrect grades/ranks, stale official reports, and unauthorized disclosure of a child's results.
- **Required fix:** Model missing/absent/exempt/not-enrolled explicitly; block generation/release on completeness rules; version snapshots and regenerate/invalidate after corrections; use high-entropy verification tokens with rate limits and minimal public fields.
- **Regression evidence:** Elective cohorts, incomplete marks, transferred students, correction-after-release, duplicate release, broadsheet session isolation, and verification-token guessing tests.

## B-09 — Notification dispatch is broken in the OCI Compose topology

- **Severity/status:** P0 / FAIL
- **Evidence:** `deploy/oci/docker-compose.yml:180` calls `/api/jobs/dispatch-notifications` with `x-jobs-secret` and appends `|| true`. `app/api/jobs/dispatch-notifications/route.ts:9–19` accepts only `Authorization: Bearer ${JOBS_SECRET|CRON_SECRET}` or an ADMIN/DIRECTOR session. The separate `deploy/oci/famex-notify.service:15` uses the correct Bearer form, proving the Compose sidecar is inconsistent.
- **Impact:** Fee, admissions, result, attendance, and announcement jobs can remain queued while the sidecar appears successful.
- **Required fix:** Use one supported trigger mechanism, send the correct header, fail visibly, expose queue age/failure metrics, and alert on repeated dispatch failure or oldest-job age.
- **Regression evidence:** Compose-level integration test queues a notification, runs the sidecar/timer once, and proves provider-test delivery or a recorded provider acceptance; wrong-secret and provider-down drills produce alerts.

## B-10 — No production or staging deployment has been verified

- **Severity/status:** P0 / BLOCKED
- **Evidence:** Repository artifacts prepare OCI production and Vercel staging (`deploy/oci/`, `vercel.json`, deployment docs), and Docker Publish run `39561859369` passed. No live OCI VM, Vercel project, staging URL, production URL, provider console, DNS/TLS state, or image digest was available for verification. GHCR package API checks returned 403/404.
- **Impact:** The audited code may never have booted with real production topology, secrets, storage, callbacks, mail/SMS/WhatsApp providers, or data volume.
- **Required fix:** Deploy a patched successor to isolated staging, then production; record immutable image digest, migration output, health, smoke tests, callback registration, TLS, backup, and rollback evidence.
- **Regression evidence:** Signed deployment checklist with URLs, digest, timestamps, smoke output, provider test receipts, and restore/rollback drill records.

## B-11 — Backup, restore, and rollback are documented but unrehearsed

- **Severity/status:** P0 / BLOCKED
- **Evidence:** `deploy/oci/docker-compose.yml` declares local `pg_dump` backups; `deploy/oci/backup-offsite.sh:23–24` exits successfully when the rclone remote is unconfigured. `docs/backup-restore.md` still contains stale Neon/`ykay_restored` material. No restore timing, checksum verification, application smoke after restore, object-storage restore, RTO/RPO, or rollback rehearsal evidence was available.
- **Impact:** Data loss or a failed release may become an extended outage; silent offsite misconfiguration can leave only same-host backups.
- **Required fix:** Encrypted, monitored, off-host backups for DB and files; backup success/freshness alerts; quarterly restore drills; documented RTO/RPO; release rollback rehearsal including migration compatibility.
- **Regression evidence:** Timed restore into an isolated environment, row/file checksum comparisons, login/smoke tests, and a rollback drill signed by the release owner.

## B-12 — Database least privilege and RLS do not provide a production safety net

- **Severity/status:** P0 / FAIL
- **Evidence:** `deploy/oci/docker-compose.yml:82` defaults the app `DATABASE_URL` to `${POSTGRES_USER:-famex}`, the database owner created at line 143. `lib/db-rls.ts` explicitly states RLS is fail-open and opt-in, with push-token paths as the only `withSchool()` call sites. Most isolation therefore depends on route-level `schoolId` filters.
- **Impact:** Application compromise or a missed filter has owner-level blast radius; migrations and destructive actions share too much privilege.
- **Required fix:** Separate migration, application, backup, and read-only roles; revoke owner/DDL rights from the app; either enforce fail-closed RLS or prove route/object authorization comprehensively; add DB CHECK constraints for core money/score/date invariants.
- **Regression evidence:** Permission matrix tests, attempted DDL/destructive operations as app role, cross-school/object IDOR suite, and migration-role separation in staging.

## B-13 — Clinic/library/inventory records are JSON-file backed and clinic access is unsafe

- **Severity/status:** P0 for module launch / FAIL
- **Evidence:** `lib/module-store.ts:25` uses `FAMEX_DATA_DIR` or `process.cwd()/data`; reads/writes whole JSON arrays with temp-file rename but no cross-process lock or transaction. Source review found clinic authorization admitting broad teacher access while omitting the intended nurse-centered model.
- **Impact:** Lost updates, no referential integrity/audit transaction, backup inconsistency, multi-instance divergence, and exposure of child health information.
- **Required fix:** Move these modules to Prisma/Postgres models with school/object authorization, audit history, retention rules, and migration/backfill. Keep clinic disabled until then.
- **Regression evidence:** Concurrent update tests, role/object authorization tests, backup/restore inclusion, and audit-trail verification.

## B-14 — Privacy and retention controls are incomplete for child and family data

- **Severity/status:** P0 / FAIL
- **Evidence:** Admissions collects religion, blood group, genotype, and extensive family data before enrolment. `lib/retention.ts:55` exports `assertDeletionAllowed`, but no production callers were found. Cookie choice is stored in `components/CookieConsent.tsx`, while `components/Analytics.tsx` is rendered independently when configured. Source review also found automatic public staff-directory exposure, stale privacy text, and no complete consent/DSAR/retention execution evidence.
- **Impact:** Excess sensitive-data collection, unlawful or non-consensual disclosure/retention, and inability to honor deletion/correction obligations confidently.
- **Required fix:** Complete data inventory and DPIA; minimize pre-admission fields; separate health data collection; staff publication opt-in; enforce consent state; implement retention/deletion jobs and DSAR workflows; update notices to match actual processors.
- **Regression evidence:** Privacy test cases for consent withdrawal, retention due dates, deletion blocks/exceptions, staff opt-out, applicant purge, and processor/notice consistency review sign-off.

## B-15 — Mobile/web offline data survives logout on shared devices

- **Severity/status:** P1, P0 for shared-device deployment / FAIL
- **Evidence:** `mobile/app/logout.tsx` calls `logout()`; `mobile/lib/http.ts:108–125` clears the token, while `mobile/lib/offline/db.ts:134` exposes a separate `clearOfflineData()`. Offline exams use a different database (`famex_offline.db`) from the general cache (`fis_offline.db`). Web logout in `components/AuthProvider.tsx` posts to `/api/auth/logout` without clearing the `fis-offline` IndexedDB in the inspected flow.
- **Impact:** The next user of a shared phone/browser may see cached student, fee, message, or exam data.
- **Required fix:** Namespace offline data by user/school, encrypt sensitive stores where appropriate, and clear or lock all per-user stores on logout/session revocation; preserve only explicitly anonymous public cache.
- **Regression evidence:** Two-account shared-device tests on web, Android, and iOS; revoked-session/offline-exam tests; storage inspection after logout.

## B-16 — Finance operations still contain material reconciliation and control gaps

- **Severity/status:** P1 / FAIL
- **Evidence:** Beyond B-04, source review found count-based invoice/journal numbering races, arbitrary cash references, zero-total fee-structure generation failure, single-actor expense/transfer weaknesses, caller-optional credit-transfer idempotency, aggregate settlement recounting, refund proof gaps, no automatic/downloadable receipt path, and fee-lock behavior that can block CBT for not-yet-due instalment balances across `lib/finance.ts`, `lib/ledger.ts`, `lib/fee-adjustments.ts`, `lib/fee-lock.ts`, and admin/parent finance routes.
- **Impact:** Duplicate numbers, unexplained balances, weak segregation of duties, incorrect student blocking, and difficult month-end reconciliation.
- **Required fix:** Database sequences/unique retry-safe numbering, mandatory idempotency keys, maker-checker thresholds, per-reference settlement ingestion, payout proof, receipt issuance, and due-date-aware fee locks.
- **Regression evidence:** High-concurrency numbering/posting tests, settlement-file reconciliation fixtures, partial-payment/instalment schedules, refund/payout proof, and ledger-to-bank exception reports.

## B-17 — Academic lifecycle transitions can lose subject/enrolment context

- **Severity/status:** P1 / FAIL
- **Evidence:** Source review of `lib/promotion.ts`, `lib/subjects.ts`, admin promotion/session/subject routes, admissions enrolment, and student PATCH flows found promotion/subject rollover gaps, inactive compulsory rows not reliably reactivated, transfers that do not consistently update enrolments/subjects/capacity, and enrolment paths that do not consistently create current enrolment, subjects, or login.
- **Impact:** Students appear in wrong classes/subjects, disappear from registers/exams/reports, or inherit stale electives after promotion/transfer.
- **Required fix:** Make session promotion/transfer a single audited lifecycle service that updates enrolment, class capacity, subjects, guardian links, and account state with dry-run and exception reports.
- **Regression evidence:** Promotion, repeat, transfer, withdrawal, re-entry, elective-change, and capacity-overflow integration tests across two sessions.

## B-18 — Release governance permits an unreviewed path to production

- **Severity/status:** P1 / FAIL
- **Evidence:** GitHub API reported the public repository's `main` as `protected:false`, with zero rulesets and zero environments at audit refresh. Dependabot alerts returned “disabled for this repository.” Code-scanning and secret-scanning alert APIs returned 403, so their enablement is **NOT VERIFIED**. Docker/Compose use mutable tags, and `docker-entrypoint.sh:15` runs migrations on every boot.
- **Impact:** A direct or insufficiently reviewed change can become the production image; rollback and approval evidence are weak.
- **Required fix:** Protect `main`, require PR review and exact-commit checks, add environment approvals, enable dependency/code/secret scanning, pin digests, sign/attest images where feasible, and separate migration execution from app boot or make it single-flight and observable.
- **Regression evidence:** Repository settings export/screenshots, blocked direct-push test, failed-check merge test, image digest/signature verification, and release approval record.

## B-19 — Performance, accessibility, and device evidence do not match launch claims

- **Severity/status:** P1 / BLOCKED
- **Evidence:** `lighthouserc.json` tests only `/` and `/admissions`. Playwright has one Desktop Chrome project in `playwright.config.ts`. CI load is `npm run loadtest -- --users 40 --seconds 30`; `scripts/load-test.ts` uses five seeded accounts and read-heavy page paths with a p95 budget of 3000 ms. Mobile lockfile audit reports 36 vulnerable packages, with runtime reachability not fully triaged.
- **Impact:** Authenticated school-day bursts, low-end Android devices, assistive technologies, slow networks, and exam/payment peaks remain unknown.
- **Required fix:** Production-like staging load/soak/stress tests, authenticated accessibility coverage, mobile viewport/device matrix, offline/low-network tests, and dependency reachability triage.
- **Regression evidence:** Signed performance report at agreed DAU/peak concurrency, axe/keyboard reports for critical authenticated journeys, and real-device test records.

## B-20 — Combined YK-Virtual launch scope is absent from this repository

- **Severity/status:** BLOCKED / NOT APPLICABLE
- **Evidence:** This checkout contains Famex OS web/API/mobile code for FIS. No Go service, Redis-backed tutoring platform, tutor marketplace, booking escrow, payout, recording-consent, or dispute system was present to inspect.
- **Impact:** A combined Famex + YK-Virtual launch cannot be certified from this audit.
- **Required fix:** Audit that system in its own repository/environment, then perform an integration certification covering identity, payments/escrow, safeguarding, recordings, refunds/disputes, and data sharing.
- **Regression evidence:** Separate exact-commit audit and cross-system contract/E2E evidence.
