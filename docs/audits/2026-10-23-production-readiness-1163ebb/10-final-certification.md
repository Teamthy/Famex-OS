# 10 — Final launch certification

## Certificate

| Field | Value |
|---|---|
| Product | Famex OS |
| School | Famex International Schools (FIS) |
| Repository | `Teamthy/Famex-OS` |
| Audited commit | `1163ebbc5a2a467cb4401e37294931cc2d9d4f83` |
| Audit branch | `arena/7e03c832-famex-os` |
| Audit date | 2026-10-23 |
| Intended production model | OCI production; Vercel staging/preview with separate staging data |
| Certification decision | **NO-GO** |
| Real-user production authorization | **Not granted** |
| Real-money authorization | **Not granted** |
| Real admissions/document authorization | **Not granted** |
| Authoritative exam/results authorization | **Not granted** |
| Synthetic staging pilot | Permitted only under the containment conditions below |

## Basis of decision

The exact commit has unresolved P0 blockers affecting dependency safety, examination integrity, admissions files, payment binding, account provisioning, role authorization, communications dispatch, database privilege, academic records, privacy, deployment verification, backup/restore, and rollback. Green exact-commit CI establishes that the configured automated checks passed in GitHub's environment; it does not close those blockers.

## Evidence executed

| Evidence | Status | Detail |
|---|---|---|
| Repository/source/schema/config inspection | PASS | 140 web pages, 160 API routes, 65 mobile screens, 80 Prisma models, 42 enums, 43 migrations, 88 unit/component test files, 10 Playwright specs inventoried |
| Exact-commit GitHub CI | PASS | Run `39561208778`, head `1163ebb`, completed success |
| Exact-commit Lighthouse workflow | PASS | Run `39561208768`, head `1163ebb`, completed success |
| Exact-commit Docker Publish workflow | PASS | Run `39561859369`, head `1163ebb`, completed success |
| Same-commit local unit/component observation | PASS | 88 files / 972 tests observed during audit work; raw `/tmp` logs were not preserved across sandbox restart |
| Root dependency gate recheck on 2026-10-23 | FAIL | `node scripts/audit-deps.mjs` exited 1 for critical ranges in pinned `next`, `@sentry/nextjs`, and `dompurify` |
| Mobile lockfile audit on 2026-10-23 | FAIL | 36 reported vulnerable packages: 1 critical, 27 high, 8 moderate; runtime reachability remains partly NOT VERIFIED |
| GitHub governance checks | FAIL | Public repo; `main` reported `protected:false`; rulesets 0; environments 0; Dependabot alerts disabled |
| GHCR tag/digest verification | NOT VERIFIED | Available package API attempts returned 403/404 |
| Live OCI deployment verification | BLOCKED | No OCI resource, URL, digest record, or authorized access available |
| Live Vercel staging verification | BLOCKED | No Vercel project, URL, or authorized access available |
| Production-like load/stress/soak | BLOCKED | No target staging environment or representative data volume available |
| Restore/rollback rehearsal | BLOCKED | No live/staging rehearsal evidence available |
| Provider live verification | BLOCKED | Paystack, email, SMS, WhatsApp, push, storage, Sentry, and alert routing not live-tested |
| Real-device mobile verification | BLOCKED | No device farm/real-device evidence available |
| YK-Virtual/Go/escrow audit | NOT APPLICABLE | System is not present in this repository |

## Tests and environments not executed

The following were **not** executed against a live production-like environment during this certification:

- OCI production deployment and smoke tests;
- Vercel staging deployment and smoke tests;
- real Paystack sandbox/live webhook replay, refund, and chargeback drills;
- real object-storage malware/content verification drills;
- email/SMS/WhatsApp/push delivery and receipt drills;
- database restore, point-in-time recovery, and host-loss recovery;
- application rollback after a real migration;
- production-shape load, stress, soak, and exam-burst tests;
- real Android/iOS device and offline-network tests;
- authenticated DAST, penetration test, container scan, and full-history secret scan;
- user-acceptance testing by named FIS staff/parents/students.

None of these may be reported as PASS for `1163ebb`.

## Launch conditions for a future successor

A future GO or CONDITIONAL GO requires all of the following:

1. A new exact commit and immutable image digest; `1163ebb` itself remains NO-GO.
2. All P0 blockers in `03-launch-blocker-register.md` closed with regression evidence.
3. All P1 blockers closed for every module enabled at launch, or that module disabled and excluded from the certificate.
4. Root/mobile dependency, SAST, secret, and container gates green or formally triaged with dated, owner-approved exceptions.
5. Protected GitHub release path with required reviews/checks and environment approvals.
6. Isolated staging deployment using the production candidate digest, production-like data volume, and provider test modes.
7. Named UAT sign-off from finance, admissions, exams/academic, privacy/safeguarding, infrastructure, and school leadership.
8. Backup restore and application rollback rehearsals with timings and smoke results.
9. Load/soak results meeting agreed SLOs for login, results, exams, payments, admissions, notifications, and report generation.
10. Alert delivery proven to named humans; incident/support rota active.
11. Production secrets, DB roles, webhook callbacks, storage, TLS, DNS, and provider accounts verified without exposing secret values in evidence.
12. Phased rollout plan with module-level kill switches and rollback triggers.

## Accepted risks

No production risk acceptance was supplied or recorded for this audit. Silence must not be interpreted as acceptance.

| Risk ID | Description | Accepted by | Role | Date | Expiry | Compensating control |
|---|---|---|---|---|---|---|
| — | None recorded | — | — | — | — | — |

## Approvals

Production approval is not granted by this document. The fields below are for a future recertification only.

| Approver | Role | Decision | Signature/record | Date |
|---|---|---|---|---|
|  | Proprietor / school owner |  |  |  |
|  | Principal / Head of School |  |  |  |
|  | Bursar / finance lead |  |  |  |
|  | Admissions lead |  |  |  |
|  | Exams / academic lead |  |  |  |
|  | Privacy / safeguarding lead |  |  |  |
|  | Engineering / release manager |  |  |  |
|  | Infrastructure / operations owner |  |  |  |

## Permitted use before recertification

The audited commit may be used only for:

- local development;
- isolated staging with synthetic data and test provider credentials;
- remediation, UAT design, data-migration rehearsals, and accessibility/performance test development;
- demonstrations that are clearly labeled non-production and do not collect real child/family documents or payments.

## Prohibited use before recertification

Do not use `1163ebb` for:

- real admissions applications or document uploads;
- live Paystack or other real-money collection;
- authoritative CBT examinations, report cards, promotion decisions, or released results;
- clinic/medication records;
- school-wide parent/student onboarding;
- combined Famex + YK-Virtual launch claims;
- marketing claims of proven 1,000+ DAU or higher capacity.

## Final statement

Famex OS at `1163ebb` is a substantial pre-production platform, but it does not yet meet the safety, integrity, privacy, reliability, or operational-evidence threshold required for a school to trust it with children, families, staff, examinations, documents, communications, and money.

**Certification: NO-GO.**
