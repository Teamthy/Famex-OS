# 02 — Production-readiness scorecard

## Reading rule

A domain is **PASS** only when the evidence covers the production claim, not merely a happy-path implementation. A green unit test or CI job can support a narrow sub-claim while the production domain still fails.

## Domain scorecard

| # | Domain | Status | Evidence summary | Launch consequence |
|---:|---|---|---|---|
| 1 | Architecture & boundaries | FAIL | Next.js/Prisma monolith is coherent for a single school, but clinic/library/inventory still use unlocked whole-file JSON in `lib/module-store.ts`; scale and multi-instance behavior are unproven | Disable JSON-backed operations or move them to Postgres before real use |
| 2 | Build reproducibility | FAIL | Exact-commit CI/Docker workflow passed, but production Compose defaults to mutable `:main`, Docker Publish also emits `:latest`, and GHCR digest could not be independently verified | Pin and verify an immutable digest for every release |
| 3 | Supply-chain security | FAIL | `scripts/audit-deps.mjs` passed in 2026-10-21 CI but exits 1 on 2026-10-23 for pinned `next`, `@sentry/nextjs`, and `dompurify`; mobile lockfile audit reports 1 critical, 27 high, 8 moderate | Patch, triage reachability, and rerun all gates on a successor commit |
| 4 | Authentication & sessions | FAIL | Email/bcrypt login, MFA, and DB rechecks exist; however sessions last 30 days, provisioning is incomplete, and middleware trusts JWT claims for page shells | Complete provisioning/reset and role/session policy before onboarding |
| 5 | Authorization, RBAC & object access | FAIL | Newer roles are omitted from page allowlists; authenticated exam attempt/package/replay checks emphasize current class rather than full subject entitlement; clinic role handling is unsafe | Produce and test a complete role × route × object matrix |
| 6 | Application security | FAIL | Public CBT answer oracle, admissions file-state gaps, no explicit CSRF token/Origin enforcement found, and incomplete SAST/secret/container scanning evidence | Remove public exam oracles and close file/CSRF gaps |
| 7 | Secrets & configuration | FAIL | `AUTH_SECRET` is reused as an internal-event secret in middleware and can back MFA encryption fallback; live secret storage/rotation was not verified | Separate secrets by purpose and verify production secret handling |
| 8 | Database & migrations | FAIL | CI applies 43 migrations and schema is indexed, but app defaults to the Postgres owner in Compose, RLS is fail-open/opt-in, and most money/score invariants lack DB CHECK constraints | Least-privilege DB roles, enforceable isolation, and DB invariants required |
| 9 | Admissions & documents | FAIL | Type-only completeness, content/scan-state gaps, low-entropy public status identifier, refresh-fragile draft/payment state, and incomplete enrolment provisioning | Do not open real admissions on this commit |
| 10 | Finance, payments & ledger | FAIL | Balanced transactional ledger foundations are undermined by reference-binding, pending-review, refund/chargeback, numbering, and reconciliation gaps | Do not accept real money on this commit |
| 11 | Examinations & CBT | FAIL | Public answer oracle; subject-entitlement, timing, offline-replay, bulk-question, and result-locking concerns | Do not run high-stakes exams on this commit |
| 12 | Gradebooks, reports & results | FAIL | Missing/exempt can become zero, incomplete cohorts can be ranked/reported, corrections can leave snapshots stale, public verification is predictable | Do not treat released output as authoritative until corrected |
| 13 | Assignments & virtual classes | FAIL | Seeded happy-path E2E exists, but elective scoping, notifications, versioning/races, mobile parity, and raw meeting-URL handling remain incomplete | Limited synthetic/classroom pilot only after containment |
| 14 | Attendance | FAIL | Register happy path is E2E-covered; GPS/static-QR anti-spoofing and replay resistance are not sufficient for high-assurance attendance claims | Use only with human supervision and explicit risk acceptance after other blockers |
| 15 | Messaging & notifications | FAIL | Queue/lease/backoff exists, but OCI Compose dispatcher authentication is wrong and masked; provider delivery was not live-verified | Fix trigger, alert on failure, and prove provider receipts in staging |
| 16 | Mobile & offline | FAIL | Logout does not clear all local offline stores; EAS preview points at the production hostname in inspected config; no real-device E2E evidence | Isolate preview, clear per-user data on logout, and run device QA |
| 17 | Privacy, retention & child-data protection | FAIL | Sensitive admissions data, automatic public staff exposure, incomplete consent/deletion/retention execution, and stale privacy claims | Complete NDPA/DPIA-style remediation before real child/family data |
| 18 | Frontend UX & accessibility | NOT VERIFIED | Lighthouse covers `/` and `/admissions`; axe covers six public pages and blocks only critical violations; Playwright is Desktop Chrome only | Expand authenticated, mobile-viewport, keyboard, and assistive-technology testing |
| 19 | Performance & capacity | BLOCKED | Only 40 users/30 seconds/read-heavy CI load evidence; no production-like data volume, exam burst, webhook, soak, or cost/capacity model | No 1,000+ DAU claim can be certified yet |
| 20 | Reliability & failure handling | FAIL | Readiness returns HTTP 200 for degraded states; several provider/job failures can be swallowed; failure drills were not executed | Correct health semantics and run dependency/process failure drills |
| 21 | Backup, restore & disaster recovery | BLOCKED | Backup scripts/docs exist, but no restore rehearsal, RTO/RPO measurement, offsite verification, or rollback drill evidence was available | Restore and rollback must be rehearsed before launch |
| 22 | Observability & incident response | FAIL | Sentry code is conditional on DSN; Uptime Kuma is declared; live alert routing, dashboards, tracing, paging, and on-call ownership were not verified | Prove alert delivery and incident ownership in staging/production |
| 23 | CI/CD & release governance | FAIL | Workflows are meaningful, but GitHub `main` reports `protected:false`, rulesets/environments were empty, and Dependabot alerts are disabled; code/secret-scanning state could not be verified | Protect release path and add required checks/approvals/scanning |
| 24 | Test quality | FAIL | 972 unit/component tests and selected E2E are valuable, but coverage observed was only about 26% lines/statements with no enforced thresholds; critical negative/concurrency/provider flows are missing | Add risk-based E2E and coverage/concurrency gates |
| 25 | Documentation & operations | FAIL | Strong handoff discipline exists, but go-live, backup, privacy, README/security, and branch-status material contain stale or contradictory claims | Reconcile operator docs with the deployed topology and rehearse them |
| 26 | YK-Virtual Go/tutoring/escrow scope | NOT APPLICABLE | No such backend or escrow system exists in this checkout | Combined launch remains BLOCKED until that repository/system is separately audited |

## Narrow sub-claims that did pass

These do not override the domain failures above:

| Sub-claim | Status | Basis |
|---|---|---|
| Exact-commit GitHub CI completed successfully | PASS | Run `39561208778`, head `1163ebb` |
| Exact-commit Lighthouse workflow completed successfully | PASS | Run `39561208768`, head `1163ebb` |
| Exact-commit Docker Publish workflow completed successfully | PASS | Run `39561859369`, head `1163ebb` |
| Repository contains 88 unit/component test files and 10 Playwright specs | PASS | File inventory at `1163ebb` |
| Local same-commit Vitest suite was observed passing 972 tests during audit work | PASS | Audit-session observation; raw `/tmp` log not retained |
| GHCR image tags/digest independently verified | NOT VERIFIED | Package API attempts returned 403/404 |
| Live OCI production deployment | BLOCKED | No OCI resource/URL/credentials available to audit |
| Live Vercel staging deployment | BLOCKED | No Vercel project/URL/credentials available to audit |

## Overall readiness statement

No weighted percentage is issued. A percentage would imply that excellence in one area can compensate for an examination answer oracle, unsafe admissions-document state, or unbound payment references. It cannot. The presence of unresolved P0 blockers makes the release **NO-GO** regardless of feature breadth or green CI.
