# 01 — Executive summary

## Certification outcome

**NO-GO** for production launch of commit `1163ebbc5a2a467cb4401e37294931cc2d9d4f83` with real students, parents, teachers, staff, admissions documents, high-stakes examinations/results, clinic records, or real financial transactions.

A closed staging pilot using synthetic data, test payment credentials, and isolated infrastructure may proceed for remediation and user-acceptance work. That pilot must not be described as production readiness.

## Why the answer is NO-GO

The application is substantial and its exact-commit CI is green, but launch safety fails at several independent points. Any one of the first six items below is sufficient to stop a real launch; together they make certification impossible for this commit.

1. **The dependency gate no longer passes for this pinned release.** On 2026-10-23, `node scripts/audit-deps.mjs` exited 1. The lockfile resolves `next@16.4.0`, `@sentry/nextjs@10.69.0`, and `dompurify@3.4.16`, all inside ranges reported by npm as critical. Exploitability was not reproduced, and reachability differs by advisory, but an internet-facing launch cannot be certified on a release whose own high/critical dependency gate is currently red.
2. **A public CBT answer oracle remains live.** The public pages under `app/cbt/` redirect to login, but `POST /api/cbt/check` accepts a question ID and returns correctness, the correct index, and explanation. That is incompatible with examination integrity.
3. **Admissions document safety is not enforced end-to-end.** Payment/submission completeness checks map document rows to `document.type` only. A retained row can therefore satisfy a requirement without proof that the stored object is clean, legible, and of the verified content type. The admin review projection inspected does not expose scan verdicts.
4. **Fee-payment idempotency is not safely bound to the payment attempt.** `postCompletedFeePayment()` returns any existing `FeePayment` found by reference without first proving that it belongs to the supplied school, invoice, student, amount, method, and attempt. Offline `PENDING_REVIEW` handling, refund/chargeback events, and several reconciliation paths also leave finance dead ends.
5. **Account provisioning is operationally incomplete.** Login is email + bcrypt password, but there is no supported in-product student-login provisioning/reset flow. `scripts/seed-students.ts` advertises a shared password while creating random unknown password hashes, so accounts created that way cannot sign in as claimed.
6. **Several first-class roles cannot reliably use the web product.** `PROPRIETOR`, `PRINCIPAL`, `VICE_PRINCIPAL`, `LIBRARIAN`, and `NURSE` exist in the role vocabulary and login destinations, but `middleware.ts` omits them from the relevant page allowlists and defaults unknown roles to `/student/dashboard`, creating dead ends or redirect loops while some APIs still grant role-group powers.
7. **Production operations are prepared, not proven.** No live OCI production or Vercel staging deployment was available to verify. GHCR run success was evidenced, but the image digest/tags could not be independently verified through the available package APIs. Restore, rollback, alert delivery, provider callbacks, and production smoke tests remain unexecuted.
8. **The OCI notification sidecar is misconfigured.** Compose sends `x-jobs-secret` and masks failure with `|| true`; the route requires `Authorization: Bearer …` or an admin/director session. Admissions, fee, result, and attendance messages can therefore silently stop in that topology.
9. **Academic-record integrity is not yet strong enough.** Missing work can collapse into zero/F9, elective membership is not consistently honored, report snapshots can become stale after corrections, and public report verification uses predictable identifiers.
10. **Capacity claims exceed evidence.** The only load gate found is 40 concurrent users for 30 seconds over five seeded, read-heavy accounts. That is useful smoke evidence; it does not prove 1,000+ DAU, examination bursts, payment/webhook concurrency, or a path to 5K–100K DAU.

## What is genuinely strong

The audit also found real engineering strengths that should be preserved:

- Exact-commit GitHub CI, Lighthouse, and Docker Publish workflows passed for `1163ebb`.
- The codebase has a broad unit/component suite: 88 test files were inventoried, and the audit observed 972 passing Vitest tests during same-commit local work.
- Browser E2E exists for selected high-value journeys, including CBT sitting/submission, attendance locking, assignment submission/grading, and virtual-class launch in CI's seeded environment.
- Money is modeled in integer minor units, ledger postings are transactional and idempotency-keyed, and Paystack verification code checks status, exact amount, currency, and email before the flawed downstream binding step.
- MFA uses TOTP with encrypted secrets and hashed recovery codes; API session checks re-read active/suspended/token-version state from the database.
- The Prisma schema is broad and materially indexed: 80 models, 42 enums, 147 `@@index` declarations, 38 `@@unique` declarations, and 43 migration directories were counted.
- Notification dispatch includes an atomic claim/lease pattern, attempts, and backoff in the application code, even though one deployment trigger is wrong.
- The repository contains unusually candid internal documentation about several known limitations. That honesty is valuable; it is not, by itself, production evidence.

## Repository surface inventoried

| Surface | Count at audit |
|---|---:|
| Web `page.tsx` files | 140 |
| API `route.ts` files | 160 |
| Mobile `app/**/*.tsx` screens | 65 |
| Prisma models | 80 |
| Prisma enums | 42 |
| Migration directories | 43 |
| Unit/component test files | 88 |
| Playwright spec files | 10 |

Scale cuts both ways: there is a real product here, but the authorization, privacy, data-integrity, and regression surface is far larger than the currently proven test envelope.

## Immediate containment before any external pilot

Until a patched successor is certified:

- Do not attach live Paystack keys or accept real fee/admissions payments.
- Do not invite real applicants to upload identity, medical, genotype, or family documents.
- Do not use the system as the authoritative record for high-stakes exams or released results.
- Disable or remove public CBT APIs from any externally reachable deployment.
- Keep clinic/library/inventory out of real operational use until they are database-backed and correctly authorized.
- Use synthetic accounts/data only in staging; keep staging data and secrets isolated from production.
- Do not run OCI and Vercel as two production writers against one database.
- Do not use `scripts/seed-students.ts` as an account-provisioning mechanism.

## Bottom line

Famex OS is a credible pre-production school platform with meaningful test and ledger foundations. It is **not yet a certifiable production system** for a school's money, examinations, child records, admissions files, and daily communications. The correct next step is a focused P0 remediation release, followed by staging rehearsals and a fresh certification at the new exact commit.
