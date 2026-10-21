# Famex OS — Session Handoff (LIVING DOCUMENT)

> **Read this first, every session.** It is the single source of truth for "what
> has been done, what is decided, what is next". The workspace files are the
> source of truth for code; this file is the source of truth for *context*.

---

## 0. Session protocol (MANDATORY — added 2026-10-14)

Every session, **before creating or merging any pull request**, the agent MUST:

1. **Read this file top to bottom** at session start (plus the governing docs in §2).
2. Do the work for **one workstream only**, in the order set by §3 / the master prompt.
3. Run the §8 gates and **paste actual output** into the PR description ("tests pass" is not evidence).
4. **Update this file** (§3 status board, §4 what changed, §7 new decisions, §9 next steps) so the next session starts with zero drift.
5. Commit the handoff update **in the same branch/PR** as the work, then push, then open/update the PR.
6. **Never merge** a PR unless: gates are green (or explicitly environment-blocked and stated), the handoff is updated, and feature IDs are cited.

If a session ends mid-workstream, §9 must say exactly where it stopped and what the very next edit is.

---

## 1. Repo & branch identity

- Repo: `Teamthy/Famex-OS` (origin). W3 base commit: `ca1c10886f50b5c699dd0f0327f3d90606ed7c1f` (main, W1 + W2 merged); stage A merged at `e96217a` (PR #4).
- **Session branches (fixed, one per session):** W3 stage A used `arena/ce3a9b67-famex-os` → PR #4 (merged); stage B used `arena/f5d78cef-famex-os` → PR #5 (merged `193ff93`); OCI hosting used `arena/ca91d7ae-famex-os` → PR #9 (merged `e9a1193`); **the CI-rescue session (2026-10-20) works on `arena/ea852f26-famex-os`** (base `1f50c0f`, PR #11). Always work/commit/push on your session branch; open PRs from it to `main`. Never create/switch/push other branches. (W1 used `arena/7f29531d-famex-os` → PR #1; W2 used `arena/9abf8aef-famex-os` → PR #2, merge `74f236c`.)
- The old Ykay repo (`upstream`) is **read-only, out of bounds** (Rule 15). Never push/edit it.
- Product: **Famex OS** — single-school Nigerian secondary-school OS (~3,000 users, 5-yr horizon). Rebuilt from a school EduPortal base with the SaaS platform layer removed.

---

## 2. Governing docs & read order

Read in this order before any work:
1. `docs/famex/08-feature-catalogue.md` — the 331-feature contract (IDs F0-01…F24-03, tags ✅🔧🆕✂️⏸, §25 counts).
2. `docs/famex/09-master-build-prompt-go.md` — §0 process, §2 strip list, §3 verified facts (do NOT re-derive), §4 the 17 rules, §5 workstreams, §6 per-screen acceptance, §7 banned moves, §8 gates, §9 sensitive domains, §10 DoD.
3. `docs/famex/10-scope-additions.md` — **founder scope added after W1**: reference grouped admin nav (de-AI labels), virtual-class system (W9), pre-school→SS3 generalisation + breakage audit, alumni 5-year data window (W11).
4. `docs/rebuild/*` — Ykay-era engineering pack (background).
5. **This file.**

---

## 3. Workstream status board

| WS | Scope (short) | Status |
|---|---|---|
| **W1** | Strip EDUos platform + Ykay arms; single-school boot; brand tokens; Licence & Usage; re-cut audit | ✅ **MERGED into main** — PR #1, 2026-10-14 (commits `a9451cd`, `ccaab0b` + this handoff commit). Gates green at merge; DB gates environment-blocked and stated in the PR. |
| **W2** | Module registry drives nav/routes/entitlements; settings framework; first-run wizard; `check:modules` | ✅ **merged** — PR #2, merge commit `74f236c` (branch `arena/9abf8aef-famex-os`, 2026-10-14). All CI jobs green except the pre-existing red `Lighthouse budgets` workflow (also red on the W1 merge). |
| **W3** | Double-entry ledger → Fees & Billing; bursar dashboard; gateway reconciliation | ✅ **stage A MERGED** (PR #4, `e96217a`) and **stage B MERGED** (PR #5, `193ff93`, 2026-10-15): discounts (F5-12), refunds (F5-13), credits (F5-11), transfers (F5-14), gateway settlement (F5-16), ageing + statements (F5-17/18), bursar queues (F5-19), receipts re-brand (F5-04/22) + `verify:ledger` extended to 12 steps. Instalment plans (F5-10) delivered 2026-10-21 (§4e). **Close-out still owed** (§9): real-DB ledger backfill/opening balances, manual adjustments screen (F5-20), cashbook polish (F5-15/F5-23/F5-25), per-reference settlement matching |
| W4 | Notification spine + WhatsApp Business (categories, receipts, cost) | 🟡 **Core delivered 2026-10-21** (§4e): governed templates + versioning, NDPA consent, WhatsApp delivery receipts, per-channel cost reporting, real WhatsApp adapter. Owed (§9): Meta-approved template mapping for cold sends, Termii SMS DLR webhook, fee/result/admission flows fully on templates, consent self-service UI |
| W5 | Admissions funnel, classes/streams, timetable, attendance, GPS clock-in | pending |
| W6 | Marks → broadsheet → report cards → release; post-lock corrections | 🟡 **Post-lock correction workflow delivered 2026-10-21** (§4e): request → independent approval → apply with full history. Marks/broadsheet/report-card pipeline pre-exists from the base — verify the rest of the W6 catalogue before claiming W6 done |
| W7 | CBT at 15,000 items + schoolId, blueprints, item analysis, offline centre | pending |
| W8 | AI layer: prompt templates, router, metering, drafts-queue, redaction | pending |
| W9 | AI Learning Hub e-learning + **virtual/live classes** (assigned URL) | pending |
| W10 | HR + payroll | pending |
| W11 | Parent PRM, Front Desk, Help Desk, **alumni 5-yr portal** | pending |
| W12 | Website CMS, Licence & Usage full, hardening, NDPA/DPIA, UAT | pending |

---

## 4. What W1 delivered (commit `a9451cd` + `ccaab0b`, merged via PR #1)

- **Platform strip (F0-26/27/28/30):** deleted `app/super-admin/**` + its 10 API routes (impersonation, broadcast, cross-school console), `app/signup/**` + `/api/platform/signup`, `Plan/PlanTier/Subscription` models + `seed-plans.ts`. Boot no longer seeds a super-admin; first ADMIN comes from `npm run db:seed` (`prisma/seed-all.ts`), then the W2 wizard. `app/page.tsx` boots to the school home (PlatformLanding + PLATFORM_MODE gone).
- **Ykay arms retired (F0-29):** deleted `app/it-portal/**`, `app/it-education/**`, `lib/it-education.ts`, IT API routes, IT cert PDF, `it_education` module key, IT seeds/nav/stats; deleted `app/virtual/**` + `VirtualBridge` (YK-Virtual SSO bridge).
- **Single-school identity (F0-21/23):** `lib/brand.ts` tokens (`PRODUCT_NAME="Famex OS"`, `getSchoolBrandTokens()`) drive name/colour/logo/site across `app/layout.tsx` (generateMetadata + JSON-LD), `Header`, `Footer`, `AdminSidebar`, student/admin ID cards, report-card PDF. `SchoolProfileContext` now carries `{name, address, phone, email}`. Neutral assets `public/logo.png` + `logo-280.webp` (old `ykay-logo*`, `logo-ykay.svg`, `it-education-hero.jpg` git-removed). Token-driven `app/manifest.ts`, `app/sitemap.ts`, `app/robots.ts` replaced brand-hardcoded statics (statics git-removed). `.env.example` re-cut (dead platform vars removed).
- **Tenant freeze (F0-15 kept):** `lib/tenant.ts` + RLS untouched (schoolId hygiene retained); `lib/modules.ts` cleaned of `it_education`.
- **Subscriptions → Licence & Usage (F20-01):** `app/admin/licence/page.tsx` (client) + role-guarded `app/api/admin/licence/route.ts` (ADMIN/DIRECTOR) show licence identity, `School.modules` switches, honest unmetered usage, integration config.
- **New gates:** `scripts/audit-brand.ts` (+ `scripts/brand-baseline.json` ratchet) → `npm run audit:brand`; `scripts/check-features.ts` → `npm run check:features`.
- **Docs:** `docs/famex/10-scope-additions.md` (founder scope), README retitled to Famex OS.

---

## 4b. What W2 delivered (branch `arena/9abf8aef-famex-os`, 2026-10-14)

- **Module registry (F0-17/F0-25):** `lib/module-registry.ts` (pure, 22 keys: the base 11 + `users, communication, documents, timetable, learning_hub, studio, hr, parents, front_desk, help_desk, website`) + `lib/modules.ts` (server reads: `getEnabledModules` display-fallback, `getEnabledModulesStrict` + `ModuleLookupError` for enforcement). Semantics fixed: a config naming no known key = unconfigured (all on); an explicit all-off config stays **all off** (the base re-enabled everything).
- **Grouped nav registry (`lib/nav.ts`):** 20 groups / 35 live rows / 77 planned rows, de-AI labels from 10-scope-additions §1. Planned rows carry **no href** and render as disabled rows with a release badge. Rules: module off → rows and group disappear; core groups (`Home`, `Settings`, `Licence & Usage`) are `moduleKey: null` and can never be switched off; item `roles` mirror the route guard (`/admin/licence` = ADMIN/DIRECTOR). `AdminSidebar` renders it, adds a mobile drawer (was `hidden lg:block` with no mobile nav at all).
- **`npm run check:modules`** (`scripts/check-modules.ts`): live row without a page → fail; planned row whose page exists → fail; admin page in no row → fail; unknown/unused module key → fail; admin API dir without an owner or without `requireModule(owner)` → fail. Currently: 20 groups / 35 live / 77 planned, 22 modules, 36 admin pages, 26 API dirs, 56 guard calls — “Modules, nav and routes agree.”
- **Route entitlement (Rule 13):** `lib/module-guard.ts` (`requireModule(key | null, roles?)`, `requireAnyModule`, `moduleDisabledResponse`). Wired through **36 admin API route files** (56 guard calls, 26 owned directories); refusals are 401 (no session) / 403 `MODULE_DISABLED` (school switched it off, message names Licence & Usage) / 503 `ENTITLEMENT_UNAVAILABLE` (never a silent allow).
- **Settings framework (F0-18):** `School.settings` JSON (typed by `lib/settings.ts`, tolerant reads / strict writes) + `StageConfig` + `GradeBand`; screens `/admin/settings`, `/admin/settings/academic`, `/admin/settings/results`; APIs `GET/PUT /api/admin/settings`, `/api/admin/settings/stages` (`PUT` stage, `POST` academic year), `/api/admin/settings/grading` (`PUT` bands, `POST` result policy). All audited.
- **Stage concept (10-scope-additions §4):** `lib/stages.ts` — ordered ladder CRE 0 … SS3 15, `SchoolStage`/`GradingMode` enums, `SchoolClass.stage` backfilled from `level` in **one forward-only migration** (`20261014090000_w2_school_stages_and_settings`), per-stage grading (WAEC / primary letters / early-years descriptors), band validation (no gaps/overlaps), provisioning templates and `suggestedModulesForStages` (early-years-only ⇒ CBT + marks off). Audit written up in `docs/famex/11-w2-stage-audit.md`.
- **First-run wizard (F0-22):** `/onboarding` — 7 resumable steps (School, Academic year, Stages, Classes, Subjects, Modules, Staff) over `POST /api/onboarding/provision`, one step per request, **idempotent per step** (re-sending creates nothing twice), every derived value computed server-side; `GET` reports where the school got to so closing the tab is not fatal.
- **Licence & Usage (F0-25):** module switches are now editable on `/admin/licence` via `PATCH /api/admin/licence` (audited, refuses unknown keys) and render labels/summaries from the registry; server returns the resolved list.
- **Brand burn-down:** `PortalTopbar` and `CommandSearch` no longer say the old brand (`PRODUCT_NAME` / `useSchoolProfile()`); `lib/branding-defaults.ts` split out so `lib/brand.ts` is client-safe (this fixed a latent `check:boundary` trap). Baseline re-cut twice, 474 → 471 → **464 findings / 148 files**.
- **One onboarding API:** the legacy `POST /api/onboarding` (school profile + palette, superseded by the wizard's `identity` step) is **deleted**; `scripts/audit-project.ts` and `scripts/e2e-full.ts` follow.
- **Static-analysis precision (so W2 does not hide behind stale checkers):** `scripts/audit-project.ts` now counts `requireModule()`/`requireAnyModule()` as the auth guard (they call `requireRole` internally — before this, 31 W2-guarded routes read as "no auth guard" and the audit went from 1 pre-existing blocker to 30). Its `PUBLIC_ROUTES` allowlist also gained `/api/contact` and `/api/cbt/topics` — both genuinely public, both pre-existing false positives. `npm run audit` is now **0 blockers** where `main` is 1.
- **Formatting:** `npx prettier --write` over the 27 files `npx prettier --check` flagged (9 of them already failing on `main`) — the CI formatting step passes now.
- **Tests:** **+6 files / 64 tests** (`module-registry`, `stages`, `nav-registry`, `module-guard`, `settings-framework`, `onboarding-provision`). `tests/setup.ts` gained `school`, `stageConfig`, `gradeBand`, `tenantBranding`, `subject.create/count` mocks (the module guard reads `School.modules` on every guarded route).

---

## 4c. What W3 stage A delivered (branch `arena/ce3a9b67-famex-os`, 2026-10-14)

**The ledger exists, and the money paths post into it.** F5-08, F5-09, F5-13 (reversal mechanics),
F5-07 (expenses are voided, not deleted), F5-19 (bursar figures read from the ledger).

- **Schema + migration** `prisma/migrations/20261014140000_w3_ledger`: `LedgerAccount` (chart; `systemKey`
  unique per school), `LedgerJournal` (number, `postedAt`, description, `sourceType`/`sourceId`, actor,
  unique `idempotencyKey` per school, unique `reversesJournalId`), `LedgerLine` (**signed integer kobo**:
  +debit / −credit). Plus `Expense.voidedAt/voidedByUserId/voidReason`, a **deferred constraint trigger**
  `LedgerLine_balanced` that refuses an unbalanced journal at COMMIT, refuses a journal with no legs, and
  refuses emptying a journal that still exists (a cascade that removes the journal itself — deleting a
  school — is allowed, or tear-down would be impossible); RLS via `eduos_apply_tenant_rls` on all three
  new tables. The migration SQL was syntax-checked with a Postgres parser locally (`pgsql-parser`);
  applying it for real is CI's job.
- **`lib/money.ts`** — the single unit boundary. Fee/expense/budget documents are whole NAIRA; the ledger,
  Paystack and admissions are KOBO. `nairaToKobo` refuses fractional naira rather than rounding;
  `formatKobo` never hides a kobo remainder. Every sum is integer arithmetic (`sumKobo`), no floats.
- **`lib/ledger-accounts.ts`** (pure, prisma-free — client screens read it): 10-account chart
  (1000 cash, 1010 bank, 1100 fees receivable, 2000 credit held, 2100 suspense, 3000 capital, 4000 fee
  income, 4100 discounts, 4110 refunds, 5000 operating expenses), `expense:<slug>` category keys at 5xxx
  created on demand, `isDebitNormal()`, and string unions mirroring the Prisma enums (asserted by a test).
- **`lib/ledger.ts`** — `postJournal` (refuses unbalanced/zero/fractional/short journals; replays on the
  idempotency key, including a lost race on the unique index), `reverseJournal` (counter-entry only;
  refuses a second reversal and refuses reversing a counter-entry; reason required), `trialBalance`
  (two SQL aggregates; `balanced` is measured, not assumed), `accountBalance`, `accountStatement`
  (running balance whose closing figure always equals `accountBalance`), `recentJournals`,
  `ensureLedgerAccounts` (idempotent; never renames an existing account).
- **`lib/ledger-postings.ts`** — the posting rules: invoice → DR fees receivable / CR fee income;
  payment → DR cash|bank / CR fees receivable (CASH→cash, everything else→bank); expenditure → DR
  `expense:<category>` / CR cash|bank; opening balances as their own source type. Idempotency keys
  `fee-invoice:<id>`, `fee-payment:<id>`, `expense:<id>`, `reversal:<journalId>`, `opening-balance:<date>`.
- **Wired into the documents, in the same transaction as the document**: `postCompletedFeePayment`
  (so Paystack webhook, parent intents and bursar cash/transfer approval all post), `generateInvoices`
  (each invoice `$transaction` wraps create + accrual), expenses POST (create + spend) and DELETE
  (void + `reverseJournal` + audit `EXPENSE_VOIDED`). Voided rows are excluded from the overview, budget
  spend and the expenses list.
- **Screens**: `/admin/finances/ledger` (trial balance, recent postings with DR/CR legs, per-account
  statement) + a ledger card block on `/admin/finances` (cash, bank, receivable, surplus, and an explicit
  "the books balance / do not balance" banner). Nav row added in `lib/nav.ts` (fees group).
- **Expenses UI**: "delete" became **Void** (`Ban` icon, reason recorded and shown as the ledger
  counter-entry number), because Rule 9 forbids deleting a financial record.
- **`npm run verify:ledger`** (`scripts/verify-ledger-loop.ts`, in CI's schema-drift job): against a real
  Postgres it provisions the chart, raises an invoice, takes a payment, **reconciles the ledger receivable
  to the invoice documents to the kobo**, proves a repeated posting is one journal, **proves the database
  refuses an unbalanced journal**, reverses by counter-entry (original still on the books, second reversal
  refused), posts and voids an expenditure, and asserts every line is an integer.
- **`npm run ledger:backfill`** (`scripts/backfill-ledger.ts`): dry-run by default, `-- --apply` to post the
  journals for documents that pre-date the ledger (seeds, a school moving from the old build). Safe to
  re-run; never invents history.
- **Tests**: +4 files / 55 tests (`money`, `ledger-accounts`, `ledger`, `ledger-postings`) — suite is
  **76 files / 898 tests**, all green. `tests/setup.ts` learned the three ledger models (with
  `resetLedgerMocks()` for files that override them, because `vi.clearAllMocks()` does not undo
  `mockResolvedValue`).

### 4d. W3 stage B — the remaining money documents (2026-10-15, PR #5)

Stage A deliberately shipped the ledger and left every adversarial money document for this
stage: nothing in stage A could discount, refund, hold or move money. Stage B, on branch
`arena/f5d78cef-famex-os` (rebased onto stage A's `e96217a`):

- **Migration** `20261015120000_w3_stage_b_money_documents` (forward-only, rollback note in-file):
  `FeeDiscount`, `FeeRefund`, `FeeCredit`, `GatewaySettlement` (+ RLS on all four via
  `eduos_apply_tenant_rls`), `LedgerSourceType.FEE_CREDIT`, and `FeeInvoice.amountDiscounted` /
  `amountCredited` so the document invariant `balanceDue == totalAmount − amountPaid −
  amountDiscounted − amountCredited` is assertable. Documents stay whole naira; settlements are
  kobo (gateway-native).
- **Posting rules** appended to `lib/ledger-postings.ts` (still the ONLY place rules live):
  `postFeeDiscount` (`fee-discount:<id>`, DR 4100 / CR 1100), `postFeeRefund` (`fee-refund:<id>`,
  DR 4110 / CR cash|bank), `postCreditApplication` (`fee-credit-apply:<creditId>:<invoiceId>`,
  DR 2000 / CR 1100, source `FEE_CREDIT`), `postFeeTransfer` (`fee-transfer:<id>`, receivable-to-
  receivable between pupils), `postGatewaySettlement` (`gateway-settlement:<id>`, DR
  `expense:gateway_charges` / CR bank — charges only, because payments already credit the bank
  gross), and `postPaymentReceipt` learned an optional `creditNaira` split.
- **Controls** in `lib/fee-adjustments.ts`: discounts/refunds are request → approve with
  **approver ≠ requester** (bursar may request; only ADMIN/DIRECTOR approve), reason mandatory
  and permanent; approval posts in the same transaction as the document change. A refund marks
  the payment `REFUNDED` and never reopens the invoice (income nets through 4110).
  `postCompletedFeePayment` gained `allowExcessAsCredit` (bursar cash desk opt-in only — the
  parent intent route still caps at `balanceDue`); `generateInvoices` spends open credits
  oldest-first inside the billing transaction; `computeInvoiceStatus` settles on
  paid + discounted + credited.
- **Routes** (all under existing `API_OWNERS` prefixes): `admin/fees/discounts`,
  `admin/fees/refunds`, `admin/fees/credits`, `admin/finances/settlements`. The ledger GET was
  extended with an income statement, arrears ageing (projection of the receivable), approval
  queues and credits held; `/admin/finances/ledger` renders them, and the finances overview
  carries the pending counts + unmatched settlement total (F5-19).
- **Receipts** (F5-04/F5-22): `lib/receipt.ts` is profile-driven now (School name/address/
  phone/email from `useSchoolProfile`, no hard-coded school); `ReceiptModal` adds a
  verification QR (`FAMEX-RECEIPT:<receiptNo>:<reference>`, local `lib/qr.ts`). Brand ratchet
  banked 464 → **451**.
- **`verify:ledger` extended to 12 steps**: discount invariant asserted against the documents,
  refund counter-entry (invoice NOT reopened), credit held then spent at the next billing,
  gateway charges booked. Still CI-gated; DB gates remain environment-blocked locally.
- **Tests**: stage-B suites in `tests/lib/ledger-postings.test.ts` (+8) and new
  `tests/lib/fee-adjustments.test.ts` (11) — suite is **77 files / 917 tests**, green.
  `tests/setup.ts` learned the four new models.

## 4d. Pulled-forward waves + CI rescue (PRs #6–#11, then 2026-10-20 on `arena/ea852f26-famex-os`)

PRs merged outside this board's order — the board in §3 still governs the *remaining* scope:

- **PR #6** (`f609c72`) — GPS clock-ins, offline CBT v1, parent portal, alumni records, operations screens (clinic/inventory/library). **PR #7** (`a42e859`) — 100% offline CBT sitting/sync. **PR #8** (`9be7924`) — teacher theory-marking carousel, offline sittings, bursar transfer review, CBT chaos runner. These pulled pieces of W5/W7/W11 forward and introduced the ad-hoc release tags `W16`/`W17` now in `ReleaseTag`.
- **PR #9** (`e9a1193`) — Oracle Cloud Always Free (Ampere A1 ARM64) support: CI-published multi-arch GHCR image, `deploy/oci/` self-contained pack, Caddy/Cloudflare-Tunnel ingress, `docs/OCI-HOSTING.md`. Render/Vercel paths preserved. **PR #10/#11** — print-ready school proposal docs.
- These PRs landed while CI was red, so the **Docker image never published** (publishing is correctly gated on green CI). Root causes found and fixed on `arena/ea852f26-famex-os`:
  - `mobile/package-lock.json` missed `expo-location@18.0.10` → Mobile job install failed; behind it: a stray `` `); `` breaking `mobile/lib/offline/exams.ts`, duplicate `BEACON_PREF`, non-existent lucide `Offline` icon, unexported `ExamAnswer`. Mobile `npm ci` + `typecheck` green.
  - Schema drift: two indexes Prisma cannot model — PR #6's partial unique on `StudentProfile (schoolId, alumniNumber)` and PR #7's expression index on `ExamAttempt (metadata->>'clientAttemptId')`. Fixed forward-only: real `ExamAttempt.clientAttemptId` column + `@@index([examId, studentProfileId, clientAttemptId])`, migration `20261020140000_align_index_drift_client_attempt_id` (backfills from metadata, drops both unmodelled indexes, recreates the alumni unique plain — Postgres plain unique still allows multiple NULL pairs). **Applied migrations were not edited.** Offline-replay idempotency now reads the column, falls back to the metadata scan for legacy rows, and self-heals them.
  - `check:modules`: operations screens had no module owner. New **`operations`** module key (23rd) owns clinic/inventory/library nav + APIs (`requireModule("operations", …)`, role lists unchanged); `admin/gps-clockins` owned by `staff_attendance` (`requireAnyModule(["staff_attendance","attendance"], …)`).
  - Lint/format backlog from PRs #6–#8 burned down: repo-wide Prettier (43 files), 13 `no-unused-vars` errors removed (warnings remain as backlog).
  - Real type/runtime bugs fixed behind the Prisma stub noise: lucide `Child`→`Baby`; staff-attendance page `Overview.fence`; `/api/public/staff` + `/api/public/calendar` used a non-existent `resolved.school` (now `.tenant`), a non-existent `School.flags` column (removed — endpoint exposes directory-safe fields only) and invented `AcademicSession`/`Term` field names (now `label`/`isCurrent`/`sessionId`/`startsOn`/`endsOn`, ordered by `Term.index`); missing `NextRequest` imports; `isValidPoint` now accepts `number | null` coordinates; `ParentLike.userId`; nav `operations` icon (`Boxes`) + `W16`/`W17` release tags.
- **Verified locally (sandbox):** `check:modules`, `check:features`, `check:orphans`, `check:dead-ui`, `check:mobile`, `check:boundary`, `audit:deps`, Prettier check, full ESLint (0 errors), mobile `npm ci` + `tsc`. **Environment-blocked here** (Prisma engines/Postgres unavailable): `check:drift`, root `tsc` against the generated client, Vitest, `next build` — the PR's GitHub CI is the verdict for those; iterate there before requesting merge.

## 4e. FIS rename + production core (2026-10-21, branch `arena/0e9f562e-famex-os`)

Founder-directed core-first slice after PR #12 (CI/Lighthouse green, merged `4422fe9`). Locked scope: school renamed to FIS, go-live core first, **Q stays parked**, OCI deploy target unchanged.

- **School rename → Famex International Schools (FIS).** Scripted rename of the school/tenant across runtime, seeds, public site, emails and mobile (product stays **Famex OS**). Slug default `famex-international-schools`; `prisma/seed-fis.ts` (`npm run db:seed-fis`); `FISLogo` component; brand ratchet burned **451 → 63 findings** (remainders are legitimate: the confirmed `ykaycollege.com` / `ykaycollege.edu.ng` mail/web domains — retained until an FIS domain is provided, never invented — frozen `eduos_` DB function names, legacy EduPortal mentions). Form-supplied school facts (phone, motto, Head of School) untouched. Contact page + WhatsApp float now read the School profile, no hard-coded contacts. Pre-release storage keys renamed (`fis_session`, `fis-offline`, `fis_offline.db`, PWA cache, rate-limit `fis:` prefixes) — **test devices should clear site/app data**; nothing was deployed, so no live data is orphaned. An existing DB keeps its current School row: update name/slug under Admin → School profile + `SCHOOL_NAME`/`SCHOOL_SLUG` env on deploy. `SystemFlags.maintenanceMessage` default renamed in schema **and** migration (factory-default rows only). Public marketing copy (Timeline history, statistics) is still placeholder content — the school must confirm/replace it (W12 CMS).
- **Roles (B).** `UserRole` + `PROPRIETOR`, `PRINCIPAL`, `VICE_PRINCIPAL`, `LIBRARIAN`, `NURSE` (append-only migration `20261021100000_fis_production_core`). New prisma-free `lib/roles.ts` is the one vocabulary: **name the group, never re-derive it** (`LEADERSHIP_ROLES`, `FINANCE_ROLES`, `ACADEMIC_ADMIN_ROLES`, `OPERATIONS_ROLES`, `MFA_EXPECTED_ROLES`, …); `tests/lib/roles.test.ts` welds it to the Prisma enum. Guards/finance/adjustments/gradebook roles now read the groups.
- **MFA (B).** Dependency-free TOTP (RFC 4226/6238, pinned by RFC test vectors), secrets AES-256-GCM at rest (`MFA_ENCRYPTION_KEY` or `AUTH_SECRET`), hashed single-use recovery codes. A correct password for an enrolled user returns a 5-minute **challenge, not a session** (`/api/auth/mfa/verify` exchanges it, rate-limited, re-checks active/suspended). Self-service at `/settings/security`; **mobile login has the code step too**. Enrolment is opt-in; leadership + bursar are `MFA_EXPECTED_ROLES` — enrol them first at go-live (forced-enrolment policy is a follow-up, not silently on).
- **Instalment plans (F5-10, W3 close-out item 1).** Schedule-only design (§7): fragments never bill separately and there is **no new ledger posting rule** — paid/partial/overdue is a projection of the invoice's settled amount (pre-plan baseline excluded, sequence-order allocation). Sum must equal `balanceDue` exactly; one ACTIVE plan per invoice (service-enforced, Prisma can't model the partial unique); cancel keeps history + reason. API `/api/admin/fees/instalments` + bursar panel on the fees screen.
- **Post-lock result corrections (W6).** Locked gradebooks only; old value captured server-side; exact values (no clamping); approver (academic admin) ≠ requester; stale-value conflict refuses apply; transactional recompute of total/grade stored on the request; warns when a report-card snapshot must be regenerated. API `/api/admin/gradebook/corrections` + panel on the gradebook-lock screen (request form takes an entry ID — teacher entry-picker is a follow-up).
- **Comms governance (W4 core).** `MessageTemplate` per (school, key, channel) with strict `{{variable}}` rendering (missing = error, never blank), version on every edit, starter set seeded once (`ensureDefaultTemplates`, admin panel on the notifications screen). `CommunicationConsent` decides legality in one place: SYSTEM always sends, explicit opt-out wins, transactional default-allowed, **BROADCAST requires a recorded opt-in**; wired into `queueNotificationJob` after preferences. Real WhatsApp adapter (Cloud API, no silent SMS fallback in the dispatcher), provider message IDs recorded at accept, `/api/webhooks/whatsapp` promotes SENT→DELIVERED / FAILED by `providerMessageId` under HMAC (`WHATSAPP_APP_SECRET`, fail-closed in production), estimated `costKobo` per channel (env rates) + spend in the admin notifications API/UI. Cold business-initiated sends still need Meta-approved template mapping (§9).
- **Schema:** 76 models. Six new tables, all with `schoolId` + explicit `eduos_apply_tenant_rls(...)`; `AlertDeliveryStatus.DELIVERED` appended; `NotificationJob` delivery/cost/template fields. Tenant-coverage checker gained a **reviewed provider-global exemption** for the WhatsApp webhook (printed every run; ratchet stays 14).
- **Verified locally:** root + mobile `tsc` exit 0; Vitest **86 files / 961 tests** (incl. 44 new: roles weld, RFC TOTP vectors, instalment projection, correction validation, template rendering, consent policy, webhook transitions, cost estimator, iCal format); ESLint 0 errors; Prettier clean; `npm run audit` back to **0 blockers** (the previously-404 public iCal feed `/api/public/calendar.ics` is implemented, and the intentionally-public routes — MFA verify, WhatsApp webhook, readiness, public calendar/staff — are declared in the audit with their guard mechanisms); `audit:deps`, `audit:brand` (63), `check:modules`, `check:orphans` (86), `check:dead-ui` (94), `check:boundary` (158), tenant ratchet 14/14. DB gates (drift, RLS, admissions, ledger loop, build, Playwright, load) are CI-only here as ever — GitHub CI on this PR is the verdict.

## 5. Gates: commands + latest evidence + blockers

Run from repo root. Latest (**FIS production core, 2026-10-21**, branch `arena/0e9f562e-famex-os`, §4e; prior PR #12 merged `4422fe9` with CI + Lighthouse green):

| Gate | Command | Result (actual output) |
|---|---|---|
| typecheck | `npx tsc --noEmit` | exit 0 — no errors |
| unit/integration | `npx vitest run` | `Test Files 86 passed (86)` / `Tests 961 passed (961)` (stage B: 77 / 917) |
| lint | `npm run lint` | `✖ 118 problems (0 errors, 118 warnings)` — warnings are the standing backlog (mainly `react-hooks/set-state-in-effect` on fetch-on-mount pages) |
| formatting | `npx prettier --check .` | `All matched files use Prettier code style!` (main: 9 files failing) |
| dep audit | `npm run audit:deps` | `Dependency audit passed.` (4 scoped, dated exclusions unchanged) |
| project audit | `npm run audit` | `No blockers. 16 warning(s).` (warnings are pre-existing hardcoded-URL/unbounded-query backlog; the broken `/api/public/calendar.ics` link is now a real route) |
| brand ratchet | `npm run audit:brand` | `Brand audit OK — 63 finding(s) across 38 file(s); baseline allows 63.` (FIS rename burned 451 → 63, banked via `--update`; remainders are the confirmed live domains + frozen `eduos_` DB identifiers) |
| feature IDs | `npm run check:features` | OK — `Catalogue: 331 features parsed` / `§25 declares TOTAL 331 — matches.` |
| orphans | `npm run check:orphans` | `All 86 portal pages are reachable.` |
| dead UI | `npm run check:dead-ui` | `Checked 94 portal pages.` / `No dead UI found.` |
| modules | `npm run check:modules` | `Nav registry: 21 groups, 41 live items, 77 planned.` / `Modules: 23 declared, 23 used by nav/API.` / `Admin pages: 42 found, 41 linked.` / `Admin API directories: 30 owned, 77 guard calls.` / `Modules, nav and routes agree.` |
| client boundary | `npm run check:boundary` | `Checking 158 client component(s)…` / `No client component reaches a server-only module.` |
| prisma schema | `npx prisma validate` | `The schema at prisma/schema.prisma is valid 🚀` (needs a dummy `DATABASE_URL`) |
| tenant coverage | `npm run check:tenant-coverage` | 14 UNCOVERED = CI baseline (`--max-uncovered 14`), all pre-existing; the WhatsApp webhook is a reviewed provider-global exemption printed on every run (no tenant context in Meta callbacks) |
| ledger loop | `npm run verify:ledger` (`scripts/verify-ledger-loop.ts`) | **Blocked locally** (no Postgres). Runs in CI's `schema-drift` job on Postgres 17 — it is the only place the deferred balance trigger and the kobo reconciliation are proved for real |
| DB gates | `check:drift`, migration apply, `verify:rls` + `verify:rls:coverage`, `verify:admissions`, `verify:ledger`, `db:seed*`, `npx playwright test` | **Blocked in the local sandbox** (no Postgres, Prisma engines stubbed → `check:drift` prints `DATABASE_URL is required`). **Run for real by CI on the W3 PR** (Postgres 17 service): "Apply migrations to a clean database", "Assert no schema drift", "Verify RLS tenant isolation", "Verify RLS coverage", "Verify admissions operations loop", "Verify the ledger (money loop)" (new), Build, Browser E2E, Load test, Mobile. W2's CI was green on all of these. `check:readiness` needs a *seeded* school and still has no CI step; apply the migration and seed on deploy before opening a term. |
| Lighthouse budgets | GitHub `Lighthouse budgets` workflow | Green since PR #12 (`4422fe9`, 2026-10-20): home performance 0.88, LCP 3845ms, TBT 53ms, accessibility 0.96 (medians). Variance-prone — judge the exact PR head, never a single run. |

Re-cut brand baseline after de-branding: `npm run audit:brand -- --update` (only lowers; gate fails if it grows).

---

## 6. Environment recipes (sandbox quirks — do not rediscover)

- **node_modules is snapshot-excluded.** After a sandbox restart: `npm install --ignore-scripts --no-audit --no-fund`, then regenerate Prisma (below). `mobile/node_modules` also needs install for the mobile vitest files to load.
- **Prisma engines are blocked** (binaries.prisma.sh unreachable). Regenerate client with stub engines (types are real; **runtime/migrations are NOT executable locally**):
  ```
  mkdir -p /tmp/fake-engines
  printf '#!/bin/sh\necho "prisma-schema-engine 6.19.3"\n' > /tmp/fake-engines/schema-engine
  chmod +x /tmp/fake-engines/schema-engine
  cp /tmp/fake-engines/schema-engine /tmp/fake-engines/libquery-engine.so.node
  PRISMA_SCHEMA_ENGINE_BINARY=/tmp/fake-engines/schema-engine \
  PRISMA_QUERY_ENGINE_LIBRARY=/tmp/fake-engines/libquery-engine.so.node npx prisma generate
  ```
  Validate schema with `npx prisma validate`. **Re-run generate after every schema change.** Never retry plain engine downloads.
- Migrations are forward-only and committed but **cannot be applied here** (stub engines, no DB). Say so in PRs.

---

## 7. Locked decisions (do not re-litigate)

- Impersonation stripped entirely (F0-27). No cross-school console.
- Boot does NOT require an admin user; first ADMIN via `db:seed`, then W2 wizard (F0-22). `/onboarding` wizard kept.
- Brand burn-down is a **ratchet**, not zero: redis prefix (`ykay:`), cookie `ykay_session`, demo seed emails (`@ykaycollege.com`), marketing copy (about/careers/privacy), OG image, `lib/receipt.ts` receipt PDF, `lib/email.ts` sender, mobile app branding, docker-compose names all **stay in the brand baseline** and are de-branded in their owning workstream (receipts→W3, comms/email→W4, website→W12/W18, mobile→mobile WS).
- Receipt PDFs are money documents → re-branded with the W3 ledger rework, not W1.
- Licence & Usage = client page + role-guarded API (rule 13); usage meters land in W12 (F20) — UI shows an honest empty state until then.
- Logo default = `/logo.png`; school-specific logo later via `School.logoUrl`/branding (W2 settings).
- Admin page shell pattern = `app/admin/gradebook-lock/page.tsx` (PortalTopbar + AdminSidebar + fetch). Licence page follows it.
- **De-AI naming rule** (10-scope-additions §2): no `AI` prefix in nav/buttons; capability named by what it does; AI = draft + named approver.

### W2 decisions (2026-10-14)

- **Nav is data, not JSX.** `lib/nav.ts` is the only place admin nav lives. A `live` row MUST have a page; a `planned` row MUST NOT carry a href (roadmap rows render disabled with their release badge). New admin pages go in the registry or in `NAV_ALLOWED_PAGES` with a reason, or `check:modules` fails.
- **Module keys are a closed set.** Adding a key means adding it to `lib/module-registry.ts` AND owning at least one nav row / API dir; unknown keys are refused by the licence PATCH and fail `check:modules`.
- **Core is `moduleKey: null`** — Home, Settings, Licence & Usage (and their APIs: dashboard, sessions, subjects, class-manager, school-profile, settings, licence, onboarding). A school must never be able to switch off the screen that switches modules back on.
- **Guard refusals are diagnosable:** 401 no session / 403 `MODULE_DISABLED` (names Licence & Usage) / 503 `ENTITLEMENT_UNAVAILABLE` when the DB cannot answer. Never a silent allow — a disabled module must not come back during an outage.
- **Stage ladder is ladder-derived, not a hand-kept map:** KG→PRI1, PRI6→JSS1, JSS3→SS1, SS3→terminal. `LEVEL_PROGRESSION` in `lib/academic-session.ts` stays for the existing promotion tests but must be replaced by `nextLevelOnLadder` when W5 touches promotion.
- **Grading is per stage.** WAEC bands mirror `waecGrade()` exactly (tested); early years uses descriptors on a **1–4** scale (no zero); `validateGradeBands(bands, maxScore, floor)` enforces coverage. W6 switches the results pipeline onto these bands.
- **`lib/brand.ts` is client-safe only because `DEFAULT_BRANDING` moved to `lib/branding-defaults.ts`.** Do not re-merge them: importing `lib/brand` from a client component used to drag prisma into the browser bundle.
- **Wizard steps are one-per-request and idempotent.** Never add a mega-POST; the school office runs this on 3G and re-taps.
- **One onboarding API.** `POST /api/onboarding` was deleted; everything first-run goes through `/api/onboarding/provision` (step union, idempotent). Do not re-add a second write path — a school provisioned twice is worse than one that retries.
- **Checkers are code.** When a static checker goes red because the convention changed (e.g. `requireModule` replacing `requireRole`), fix the checker in the same PR and say so; do not whitelist the routes and never leave it red. `npm run audit` is now expected at **0 blockers** — treat a new blocker as a W3 regression.
- **No module guards on teacher/student/parent APIs in W2** (owned by their workstreams); admin APIs are fully covered and gated by `check:modules`.

### W3 decisions (2026-10-14, stage A)

- **The ledger is kobo; the documents are naira.** `FeeInvoice`/`FeePayment`/`Expense`/`Budget`/`FeeStructureItem`
  store WHOLE NAIRA (verified: `amount * 100` at Paystack init in `app/api/parent/fees/payment-intents/route.ts`);
  the ledger, admissions and the gateway speak KOBO. `lib/money.ts` is the ONE conversion point, and it
  refuses fractional naira instead of rounding. Do not add a second conversion; do not migrate the
  documents' unit as part of a feature — that is its own migration with a backfill.
- **Ledger lines are SIGNED kobo (+debit / −credit).** One column, one invariant (Σ = 0). Never add
  separate debit/credit columns or a `side` field — `reverseJournal` is just negation, and the trial
  balance is one `groupBy`.
- **The invariant lives in the database too.** `LedgerLine_balanced` (deferred constraint trigger,
  `20261014140000_w3_ledger`) refuses an unbalanced journal at COMMIT, refuses a legless journal, and
  refuses emptying a journal that still exists. A new table that posts money needs the same treatment or
  an explicit reason why not.
- **Delete journals before lines when tearing data down** (tests, scripts): the trigger protects a journal
  that still exists, so `ledgerJournal.deleteMany` first (its cascade takes the lines) — deleting the
  lines alone is refused, by design.
- **Posting happens inside the document's transaction.** A payment that is not in the ledger must not
  exist; `postCompletedFeePayment`, invoice generation and the expenses route all wrap create + post in
  one `$transaction`. Never post in a separate request, a cron, or an `after()` hook.
- **Documents post under their own idempotency key** (`fee-invoice:<id>`, `fee-payment:<id>`,
  `expense:<id>`, `reversal:<journalId>`, `opening-balance:<date>`). A new posting rule MUST pick a
  deterministic key; a random or timestamped key is a double-post waiting to happen.
- **Accrual, not cash.** An invoice is income when billed and a receivable until paid. A cash-basis
  ledger cannot produce arrears ageing (F5-17) or a position statement (F5-18) at all.

### W3 stage B decisions (2026-10-15)

- **Approver ≠ requester, in the service.** Discounts and refunds check
  `requestedByUserId !== actorUserId` inside `lib/fee-adjustments.ts`, not just in the UI; a
  bursar can request (they see hardship first) but only ADMIN/DIRECTOR can move the money.
- **A refund never reopens an invoice.** Income nets through `refunds` (4110), so billed-vs-net
  stays readable; reopening would pretend the fee was never settled. The invoice document is
  deliberately untouched by `decideRefund` (pinned by test).
- **Overpayment is opt-in, never accidental.** Only the bursar cash desk can set
  `allowExcessAsCredit`; online amounts remain capped at `balanceDue` by the intent route, so
  a client cannot invent credit.
- **Gateway settlement books the charges only.** Payments credit the bank at gross on receipt;
  the settlement's one missing movement is DR `expense:gateway_charges` / CR bank. Settlement
  amounts stay kobo end-to-end — `nairaToKobo` is never inverted for them.
- **Ageing/statements are projections.** The ledger GET computes the income statement from the
  trial balance and ageing from the receivable's document projection; no screen recomputes
  money from raw payments.
- **Reversal is the only correction.** `reverseJournal` refuses a second reversal (unique index on
  `reversesJournalId`) and refuses reversing a counter-entry. Nothing in `lib/ledger.ts` updates or
  deletes a journal or a line, and there is deliberately no "post a manual journal" API — a manual
  adjustment gets its own screen, approval rule and actor (F5-20), not a back door on the ledger API.
- **Expenses are voided, never deleted** (as of W3 the DELETE route is a void): `voidedAt` +
  `voidedByUserId` + `voidReason` + a counter-entry + an `EXPENSE_VOIDED` audit row. Voided rows are
  excluded from the overview, budget spend and the list — but they stay in the table.
- **`lib/ledger-accounts.ts` must stay prisma-free** (client screens read the chart) — the string unions
  mirror the Prisma enums and `tests/lib/ledger-accounts.test.ts` asserts they match.
- **Test mocks: `vi.clearAllMocks()` does NOT undo `mockResolvedValue`.** A test that overrides
  `ledgerJournal.findFirst` (e.g. to simulate a replay) leaks into the next test and turns real postings
  into silent replays. Use `resetLedgerMocks()` from `tests/setup.ts` in `beforeEach` — that bug bit this
  session and was caught only because the reversal tests assert `create` was called.

---

### FIS production-core decisions (2026-10-21)

- **The school is Famex International Schools (FIS); the product is Famex OS.** Only the school/tenant identity was renamed. The confirmed `ykaycollege.com` / `ykaycollege.edu.ng` domains stay until the school provides an FIS domain — never invent contact details (demo/test accounts use `fis.example.edu.ng`).
- **Roles are named groups in `lib/roles.ts`** (prisma-free, welded to the enum by test). New code imports a group; it never hand-writes a role list.
- **MFA:** password success alone never issues a session for an enrolled user — a 5-minute challenge is exchanged for the session after TOTP/recovery verification. Enrolment self-service; `MFA_EXPECTED_ROLES` (leadership + bursar) enrol first at go-live.
- **Instalments are a schedule, not billing:** no new posting rule; fragment states are projected from the invoice's settled amount. Schedule must sum exactly to `balanceDue`; one ACTIVE plan per invoice.
- **Result corrections:** locked-only, server-captured old value, approver ≠ requester, stale-value conflict refuses, applied total/grade stored on the history row. Report cards are snapshots — regenerate after an applied correction.
- **Consent vs preferences are different layers:** preferences mute interruptions; `lib/communication-consent.ts` decides legality (SYSTEM always, explicit opt-out wins, BROADCAST needs recorded opt-in).
- **WhatsApp dispatcher honesty:** a WHATSAPP job is never marked sent because an SMS fallback fired (`allowSmsFallback: false`); delivery is only ever claimed from the signature-verified webhook.
- **Q remains parked** (payroll engine beyond W10 scope, biometrics/RFID, AI tutoring/proctoring) — no fake claims; offline fee entries stay `PENDING_REVIEW`, device-offline is never called LAN.

## 8. Landmines & gotchas

- **Do not put `/*` inside a `//` line comment in `middleware.ts`** — `tests/lib/cors-response-headers.test.ts` strips comments naively and an unterminated `/*` swallows code, faking a CORS regression. (Bit us once; fixed by rewording.)
- `signup` rate-limit kind has zero consumers but is pinned by `tests/lib/rate-limit-fail-closed.test.ts` — don't remove without editing that test.
- New pages must be linked somewhere or `check:orphans` fails; non-functional nav rows must be disabled/labelled, never dead links (`check:dead-ui`).
- Money = integer kobo, no floats/parseFloat (Rule 2). Server-authoritative for money/marks/results/attendance (Rule 3). Idempotency keys on money+enrolment writes (Rule 4). No random sampling for assessable things (Rule 5).
- Every route: auth → role → module entitlement, in that order (Rule 13). Tests ship with money/CBT/attendance/results logic (Rule 14). No `any` in new code (Rule 12).
- `check:features` citation regex requires **two-digit feature numbers** (`F5-04`); hex classes like `[A-F0-9]` must not false-match.
- **New admin API directory ⇒ add it to `API_OWNERS` in `scripts/check-modules.ts`** (`null` = core). Otherwise `check:modules` fails with `api-unowned`, which is the intended behaviour, not a bug.
- **New admin page ⇒ add it to `lib/nav.ts`.** `check:orphans` now scans `lib/` too, so the registry counts as a link — but `check:modules` still fails a page that no row reaches.
- **Module guard tests:** `tests/setup.ts` mocks `prisma.school.findUnique` to a school with `modules: null` (all enabled). A route under a switched-off module answers 403; if a test needs the 503 path, resolve `findUnique` with a rejected promise.
- **New money path ⇒ post through `lib/ledger-postings.ts`, not `postJournal` directly.** The posting
  rules are the only place that knows which account and which idempotency key a document uses; a raw
  `postJournal` from a route is how two postings end up on different accounts for the same event.
- **`FeePayment.status` is `COMPLETED` for a posted payment** — the ledger is settled by the payment id,
  so backfilling (`npm run ledger:backfill -- --apply`) is idempotent but must run invoices before
  payments (accrual before settlement) or the receivable goes negative mid-run and back.
- **Ledger amounts are kobo; every screen must render them with `formatKobo`** (or `formatKobo(x, {decimals: true})`
  on statements). Printing a kobo integer as naira makes a ₦8,500 payment read as ₦850,000.
- **`lib/module-registry.ts` must stay prisma-free** and `lib/stages.ts`/`lib/stage-types.ts` must stay `@prisma/client`-free — client components import them; `check:boundary` fails otherwise.
- **W2 migration is unapplied locally** (`20261014090000_w2_school_stages_and_settings`): 2 enums, `SchoolClass.stage` + backfill, `School.settings`, `StageConfig`, `GradeBand`, and **RLS (`eduos_apply_tenant_rls`) on both new tables** — the 2026-08 policy backfill only covers tables that existed then, so a new tenant table needs the explicit call or `verify:rls:coverage` fails the build (it caught this on the first CI run of the PR). Re-run `PRISMA_*` stub generate after any schema change (recipe in §6).

---

## 9. Next session: green CI first, then W3 close-out, then W4 (exact stop-point)

**Immediate (2026-10-21):** merge this PR (§4e) when GitHub CI is green on its exact head
(DB gates, build, Playwright and load test are CI-only from the sandbox), then deploy the
published GHCR image via the OCI pack and run the staging drills in order: migrations →
`db:seed-fis` (real structure + Head of School) → School profile/env confirmation
(`SCHOOL_NAME`, domain, contacts) → backup/restore drill → Paystack test payment →
admissions loop → MFA enrolment for leadership + bursar → WhatsApp webhook registration
(`WHATSAPP_VERIFY_TOKEN` + `WHATSAPP_APP_SECRET`) and a real delivery receipt. Nothing is
"go-live ready" until those drills pass against real infrastructure.

**Where W3 stopped (2026-10-15, PR #5 from `arena/f5d78cef-famex-os`):** stage A (PR #4) built
the ledger; stage B built the remaining money documents on it — discounts, refunds, credits,
transfers, gateway settlements — plus the income statement, arrears ageing, approval queues,
bursar drill-downs and the receipts re-brand. `verify:ledger` now runs 12 steps and reconciles
to the kobo including the discount invariant. **W3 is DONE except the close-out list below;
do not start W4 until it is burned down or explicitly deferred by the founder.**

### W3 close-out (small, in order)

1. ✅ **Instalment plans (F5-10)** — DONE 2026-10-21 (§4e): schedule fragments only, still
   settled through the invoice; no new posting rule (decision recorded in §7).
2. **Go-live data (§9 of stage A, still owed):** `npm run ledger:backfill -- --apply`, opening
   balances via `postOpeningBalance`, `npm run verify:ledger` against a copy of the seeded DB.
   Needs a real Postgres — run it where one exists, paste the output in the PR.
3. **Cashbook polish (F5-15/F5-23/F5-25)** and **manual adjustments screen (F5-20)**: the
   ledger route header already reserves the shape; adjustments enter through a document with
   an actor and approval, never a free-text journal on the read-only ledger route.
4. **Per-reference settlement matching (F5-16 continuation):** the settlement route matches a
   payout window today; matching individual payment references from the gateway's settlement
   report is the follow-up.

### W4 follow-ups (core delivered in §4e) + next slices

1. **Meta-approved template mapping** for business-initiated (cold) WhatsApp sends — the
   adapter sends free-form text inside the 24h service window today; map governed template
   keys to approved Meta template names as deployment configuration.
2. **Termii SMS delivery-report webhook**, mirroring the WhatsApp receipt flow.
3. Move fee reminders, report releases and admission updates fully onto governed templates
   (`queueTemplatedNotification`) so every outbound send is traceable to a template version.
4. **Consent self-service UI** in web settings + mobile (API at `/api/notifications/consent`
   is ready); **teacher entry-picker** for correction requests (panel takes an entry ID today).
5. Then the standing workstreams in board order (W5 depth, W7 item analysis @15k, W9 homework/
   lesson content, W10 payroll, W12 CMS/NDPA) — real backends, never stubs. Library/inventory/
   clinic still persist to JSON (`lib/module-store.ts`) and need real DB models before go-live claims.

Rules for whoever continues: post through `lib/ledger-postings.ts`, never `postJournal` directly
from a route; every new posting gets a deterministic idempotency key; corrections are counter-entries.
Cite feature IDs in commits and update §3/§4/§5/§7/§9 here in the same PR.

## 10. Reference nav & founder scope

Full grouped nav table, de-AI labels, virtual-class system, pre-school→SS3 breakage audit, and alumni 5-year rule live in **`docs/famex/10-scope-additions.md`**. Build pages in workstream order with real backends + tests; never stub.

---

## 11. Rules pointer

The 17 rules + banned moves + per-screen acceptance + DoD are in `09-master-build-prompt-go.md` §4/§7/§6/§10. They are non-negotiable. This handoff never overrides them.
