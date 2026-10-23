# 08 — Remediation roadmap

## Roadmap principle

Fix in blast-radius order: stop public integrity leaks, patch the platform, make identity work, protect money and child records, prove operations, then scale. Do not start with cosmetic features or new modules.

## Phase 0 — Freeze and containment

**Goal:** Prevent accidental harm while remediation proceeds.

- Freeze `1163ebb` as a non-production audit baseline; do not deploy it with real secrets/data.
- Disable/remove public CBT APIs from any reachable environment.
- Keep live Paystack keys, real admissions, clinic data, and authoritative exams/results off the system.
- Mark `scripts/seed-students.ts` unsafe/deprecated in operator docs until replaced.
- Confirm staging uses separate DB, storage, secrets, provider test keys, and synthetic data.
- Record named owners for engineering, finance, exams, admissions, privacy, infrastructure, and release management.

**Exit criteria:** Written containment note; no real data/keys attached; staging isolation verified.

## Phase 1 — Patch platform and release path

**Goal:** Restore a trustworthy build/release foundation.

- Upgrade Next/Sentry/DOMPurify/jsPDF chain beyond affected ranges; rerun `npm run audit:deps`.
- Triage mobile advisories by runtime/build reachability; add a mobile dependency gate.
- Protect GitHub `main`; require PR review and exact-commit CI/Lighthouse/Docker checks.
- Enable Dependabot, code scanning, and secret scanning; scan Git history and container image.
- Pin production app image by digest; record third-party image update policy.
- Separate migration execution from app boot or implement a single-flight, observable migration step.
- Split DB roles: migration, app, backup, read-only/reporting.
- Separate secrets by purpose and environment; rotate any shared/uncertain secrets.

**Exit criteria:** Successor commit has green dependency/SAST/secret/container gates, protected release path, immutable digest, and least-privilege staging deployment.

## Phase 2 — Identity, RBAC, and provisioning

**Goal:** Every real user can be created, activated, authorized, suspended, and revoked safely.

- Build student/staff/parent provisioning and bulk import with dry-run, duplicate detection, and auditable one-time activation.
- Force first-password change; never display a reusable temporary password to staff after account creation.
- Verify guardian email/phone ownership before linking children.
- Implement guardian add/remove, access scope, leaver/alumni expiry, and account deactivation that revokes sessions.
- Create a complete role × page × API × object matrix from `lib/roles.ts`; align middleware, login destinations, nav, and APIs.
- Decide session lifetime by role/risk; add idle/absolute controls where appropriate; force MFA for privileged/finance roles.
- Clear or lock per-user offline data on logout/revocation for web and mobile.
- Add explicit CSRF/Origin policy for cookie-authenticated mutations.

**Exit criteria:** Parameterized tests for every role and critical object relationship; onboarding UAT for student/parent/teacher/admin/bursar/principal/nurse/librarian; revocation proven on web/mobile.

## Phase 3 — Finance integrity

**Goal:** No payment can be lost, double-posted, bound to the wrong child/invoice, or silently reversed.

- Bind payment completion to a locked server-created attempt and exact immutable fields.
- Implement pending-review completion/rejection with maker-checker controls.
- Handle Paystack refund/chargeback/reversal events with counter-postings, never deletes.
- Require payout proof and correct partial-refund state.
- Replace count-based numbering with sequences or retry-safe unique allocation.
- Make idempotency keys mandatory for transfers/adjustments/manual postings.
- Implement per-reference settlement ingestion and exception queues.
- Issue durable receipts and make fee-lock rules due-date/instalment aware.
- Add DB CHECK constraints for non-negative money, invoice invariant components, and ledger line bounds; assess `BigInt` migration for large ledger legs.

**Exit criteria:** Concurrency/replay/reversal test suite against real Postgres; finance UAT signed by bursar/finance lead; reconciliation of a full synthetic settlement file with zero unexplained differences.

## Phase 4 — Admissions, files, and privacy

**Goal:** Public admissions can safely handle sensitive family data and untrusted files.

- Replace low-entropy public status access with high-entropy applicant credentials/tokens and rate limits.
- Bind upload reservations to applicant/document/size/checksum/expiry.
- Verify stored hash, MIME, and magic bytes; require malware `CLEAN` before payment/submission/review.
- Quarantine infected objects; handle replacement/deletion and audited downloads.
- Enforce a server-side admissions state machine and reviewer checklist.
- Make enrolment create/reuse student identity, current enrolment, subjects, guardian links, and activation tasks atomically or with a recoverable saga.
- Minimize pre-admission sensitive fields; complete DPIA, retention schedule, unsuccessful-applicant purge, staff-directory opt-in, DSAR/deletion workflows, and processor inventory.
- Wire `assertDeletionAllowed` or its successor into every deletion path.

**Exit criteria:** Malicious-file suite passes; admissions E2E covers refresh/resume, duplicate payment, infected file, review, rejection, enrolment, activation, purge; privacy owner signs the data-flow/retention package.

## Phase 5 — Examinations, gradebooks, and reports

**Goal:** Academic outputs are authoritative, reproducible, and contest-resistant.

- Remove or authenticate/bind public CBT practice; separate public practice banks from secure assessment banks.
- Enforce enrolment + subject + publication window on every exam attempt/package/replay endpoint.
- Make attempt deadlines server-authoritative and include all configured sections/time.
- Sign offline packages/replays; bind attempt/device/nonce; reject duplicate/altered replay.
- Validate question semantics on create/import; lock and audit marking/release changes.
- Model missing/absent/exempt/not-enrolled distinctly from zero.
- Block report generation/release on completeness and comparable subject sets; version/regenerate snapshots after corrections.
- Replace deterministic public report verification with high-entropy tokens and minimal disclosure.
- Make promotion/transfer/rollover update enrolments, subjects, capacity, accounts, and guardian links through one audited lifecycle service.

**Exit criteria:** Cross-subject IDOR, timing, offline replay, correction-after-release, incomplete-report, promotion/transfer, and public-verification tests pass; exams/academic leads sign UAT.

## Phase 6 — Communications, operations data, and reliability

**Goal:** Messages and operational records survive failure and are observable.

- Fix the OCI notification trigger; remove failure masking; alert on queue age and repeated provider failures.
- Prove email/SMS/WhatsApp/push provider receipts in staging; reconcile provider IDs and costs.
- Move clinic/library/inventory to Postgres with constraints, audit history, and correct role/object authorization.
- Correct liveness/readiness semantics.
- Implement metrics/logs/traces/dashboards for requests, DB, jobs, webhooks, payments, backups, disk/memory/CPU, and provider errors.
- Run dependency/process/provider failure drills.
- Complete encrypted off-host DB/file backups, timed restore, and rollback rehearsals.

**Exit criteria:** Staging incident drill produces human-received alerts; notification drain and restore/rollback records are signed; JSON operations modules are retired or formally disabled.

## Phase 7 — UX, accessibility, mobile, and performance

**Goal:** Prove the product works for the school's real devices and peak moments.

- Isolate EAS preview from production APIs; add environment labels and test-data safeguards.
- Add mobile assignment/virtual-class parity or explicitly scope mobile out of those journeys.
- Namespace/encrypt/clear offline stores by user; test siblings/shared devices and revoked sessions.
- Expand Playwright to mobile viewports and critical authenticated journeys.
- Run axe/keyboard/focus/contrast tests beyond public pages; remediate serious violations, not only critical.
- Load/soak/stress test login, results, exams, payments, admissions, notifications, and report generation at production-like volume on the target OCI shape.
- Publish a capacity/cost model for the single-school launch and a separate architectural path for larger multi-school/DAU ambitions.

**Exit criteria:** Device matrix, accessibility report, and performance report meet agreed SLOs; no unresolved P0/P1 UX/data-loss defects.

## Phase 8 — Recertification and phased launch

**Goal:** Certify a new exact commit, not the memory of fixes.

1. Freeze a release candidate and record its full SHA and image digest.
2. Rerun all unit, integration, E2E, dependency, SAST, secret, container, accessibility, load, restore, and rollback gates.
3. Deploy to staging; run UAT with named school role owners using synthetic-but-realistic data.
4. Deploy to production with live integrations disabled; run smoke tests and backup.
5. Enable internal staff only; monitor.
6. Enable a small parent/student cohort; monitor support, payments in test/controlled mode, notifications, and data quality.
7. Enable admissions/finance/exams by module only after their owners sign module-specific readiness.
8. Expand school-wide with hypercare, daily reconciliation, and a rollback decision window.

**Exit criteria:** New launch certificate naming the successor SHA, environments, executed tests, accepted risks, approvers, and launch conditions.
