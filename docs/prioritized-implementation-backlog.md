# Prioritized Implementation Backlog

_Last updated: 2026-08-02 · Baseline commit: `b011baf`_

Living backlog for Ykay EduPortal. Ordered by risk × effort. Tick items as they land.

**Legend:** 🔴 blocking · 🟡 hardening · 🟢 polish

---

## P0 — CI & correctness

- [x] 🔴 **Fix `next/headers` test mock** — `tests/setup.ts` mocked only `cookies`, but
      `getSession()` also reads the `Authorization` header for mobile clients, so `requireRole`
      threw. Added a `headers` mock. _(done 2026-08-02)_
- [x] 🔴 **Format 17 unformatted files** — recent super-admin/teacher pages landed without a
      Prettier pass, failing the `prettier --check` CI gate. Also stripped stray UTF-8 BOMs from
      `.npmrc`, `app/robots.ts`, `app/teacher/attendance/page.tsx`. _(done 2026-08-02)_
- [ ] 🔴 **Add a `format:check` pre-commit hook** so formatting never breaks CI again.

## P1 — Tenant isolation & data safety

- [ ] 🟡 **Activate the RLS backstop.** `withSchool()` (`lib/db-rls.ts`) and migration
      `20260727000000_eduos_rls` are written, migrated, and documented — but have **zero callers**.
      Adopt incrementally, highest-risk first:
  - [ ] `app/api/admin/finances/*`, `app/api/admin/fees/*`, `app/api/admin/expenses`, `budgets`
  - [ ] `app/api/admin/report-cards/*`, `app/api/teacher/gradebook`
  - [ ] `app/api/admin/students/*`, `app/api/admin/staff/*`
  - [ ] Backfill the rest, then consider making `withSchool` the default access path.
- [ ] 🟡 **Bound unbounded queries.** ~58 of 114 `findMany` calls in `app/api` have no `take:`.
      `lib/pagination.ts` already exists — apply it. Prioritise list endpoints that grow per-student
      (attendance entries, gradebook entries, notifications, audit log).
- [ ] 🟡 **Add a regression test for cross-tenant leakage** — seed two schools, assert school A's
      session cannot read school B's students/invoices/report cards.

## P2 — Test coverage where bugs cost money

**160 tests** across 15 files (was 61 / 9). The payments + grading core is now covered;
API-route integration tests are still outstanding.

- [x] 🟡 **Paystack webhook signature** — valid/missing/wrong-secret/tampered-amount/flipped-byte,
      length-mismatch safety, and fail-loud on unset `PAYSTACK_SECRET_KEY`. _(11 tests)_
- [x] 🟡 **Fee payment posting** — idempotent replay (double-charge prevention), optimistic
      concurrency on the balance reservation, amount validation, invoice status recompute, attempt
      closure, audit trail. **100% stmts / 100% funcs.** _(20 tests)_
- [x] 🟡 **Invoice status transitions** — PAID/PARTIAL/OVERDUE/UNPAID precedence, overpayment,
      zero-total (waived) invoices. _(11 tests)_
- [x] 🟡 **Gradebook totals & WAEC boundaries** — all 9 grade cut-offs pinned at the boundary and
      one mark below, clamping, rounding, NaN/Infinity, session/term rollover. _(34 tests)_
- [x] 🟡 **Exam auto-grading** — MCQ/TRUE_FALSE/FILL_BLANK matching, essays left ungraded for a
      human, `finalizeAttempt` scoring and GRADED-vs-SUBMITTED status. _(17 tests)_
- [x] 🟡 **CBT fee gate** — blocking statuses, outstanding total, tenant scoping. **100%.** _(6 tests)_
- [ ] 🟡 Report-card generation + release/lock flow (`lib/report-cards.ts` — still 0% covered).
- [ ] 🟡 Exam retake grants (`app/api/teacher/exams/[id]/retake`).
- [ ] 🟢 Impersonation write-guard — assert every non-GET API route 403s while impersonating.
- [ ] 🟢 **Add `@vitest/coverage-v8` to devDependencies.** `npm run test:coverage` currently fails
      with "Cannot find dependency '@vitest/coverage-v8'". Install it in a dedicated commit so the
      lockfile change is reviewable on its own.

> **Mutation-tested.** These tests were validated by deliberately breaking the source: removing the
> idempotency guard failed 3 tests, disabling the concurrency reservation failed 1, and shifting the
> WAEC C6 boundary by one mark failed 2. They catch real regressions, not just execute lines.

## P3 — Platform & housekeeping

- [ ] 🟡 **Migrate `middleware.ts` → `proxy.ts`.** Next.js 16 emits a deprecation warning on every
      build; the convention will be removed in a future major.
- [ ] 🟢 **Untrack PowerShell ingest artifacts.** 14 `*.ps1` files / ~1.5 MB are `.gitignore`d but
      were force-added, so they remain tracked. `git rm --cached *.ps1`.
- [ ] 🟢 **Wire `app/student/waec-practice`** to live data — the last file in the app still
      importing `lib/questionBank` mock data.
- [ ] 🟢 **Wire remaining static pages:** `app/student/e-exams`, `app/teacher/evaluations`,
      `app/teacher/evaluations/create`, `app/super-admin/portals`.
- [ ] 🟢 **Fix `.env.example` mojibake** — "Paystack â€"" from a Windows encoding round-trip.
- [ ] 🟢 **Clear 74 ESLint warnings** — mostly `react-hooks/exhaustive-deps` and anonymous default
      exports. `lib/useApi.ts` spreads deps into a `useCallback` array, which the rule can't verify.
- [ ] 🟢 **Decompose oversized components** — `app/super-admin/page.tsx` (1,498 lines),
      `components/admissions/AdmissionApplicationForm.tsx` (1,279),
      `app/teacher/upload-questions/page.tsx` (1,038).

## P4 — Product / feature candidates

_To be prioritised with stakeholders._

- [ ] Timetable builder (admin-side authoring; student/teacher views already read it).
- [ ] Parent–teacher messaging threads (currently one-way announcements).
- [ ] Bulk student promotion / end-of-session rollover.
- [ ] Report-card comment bank for teachers.
- [ ] Mobile push delivery via `DeviceToken` (model + `lib/push.ts` exist; dispatch not wired).
- [ ] Alumni portal (`app/alumni` is currently marketing-only).

---

## Notes for contributors

- Business logic belongs in `lib/*`, not in route handlers. Routes stay thin.
- Auth is obtained via context helpers (`getTeacherContext`, `getAdminFinanceContext`,
  `getParentPortalProfile`, …) which call `requireRole()` internally. A route importing one of
  these **is** authenticated — don't add a redundant check, and don't assume a route is unprotected
  just because `requireRole` isn't spelled out in the file.
- Aggregations should use `groupBy`/`_count`, not `findMany` + JS reduce. A global Prisma
  `$extends` query cap was tried and reverted — it OOM'd `tsc` (see the comment in `lib/prisma.ts`).
