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
- **Session branches (fixed, one per session):** W3 stage A used `arena/ce3a9b67-famex-os` → PR #4 (merged); stage B used `arena/f5d78cef-famex-os` → PR #5 (merged `193ff93`); OCI hosting used `arena/ca91d7ae-famex-os` → PR #9 (merged `e9a1193`); the CI-rescue session (2026-10-20) used `arena/ea852f26-famex-os` (base `1f50c0f`, PR #11/#12 lineage); FIS production core used `arena/0e9f562e-famex-os` → PR #13 (merged `fa8d092`, 2026-10-21); the single-school/assignments/live-classes/deployment slice used `arena/cb6c3d85-famex-os` → PR #14 (merged `c586c4a`, 2026-10-21) and PR #15 (GHCR lowercase publish fix, merged `1163ebb`, 2026-10-21). The audit session used `arena/7e03c832-famex-os` → PR #16 (audit docs only, merged `5ba9a16`, 2026-10-23). The launch-blocker close-out session used `arena/a545871c-famex-os` → PR #17 (merged `b4415d0`, 2026-11-08). The B-01 dependency-gate session used `arena/2aed24db-famex-os` → PR #18 (merged `75caee3`, 2026-11-08). The release-path session used `arena/e697eea8-famex-os` → PR #19 (merged `c0a2fd9`, 2026-11-09). **The current Vercel-degradation session works only on `arena/a6b381c5-famex-os`, branched from merged `main` at `c0a2fd9`.** Always work/commit/push on your session branch; open PRs from it to `main`. Never create/switch/push other branches. (W1 used `arena/7f29531d-famex-os` → PR #1; W2 used `arena/9abf8aef-famex-os` → PR #2, merge `74f236c`.)
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
| **REM** | Audit remediation (§4h roadmap: Phases 0–8) | 🟡 **IN PROGRESS — supersedes W-workstreams until Phase 3 is green.** PR #16 (`5ba9a16`) landed the audit package; PR #17 (`b4415d0`) closed fixable-now launch blockers; PR #18 (`75caee3`) closed B-01; PR #19 (`c0a2fd9`) closed B-09/B-18 code-ables + mobile CI. Phase 2 B-06 merged (PR #40); Phase 3 B-04 merged (PR #41) and B-16 finance lifecycle merged as PR #42 (`f347f55`). **B-17 academic lifecycle is implemented on `arena/50d27962-famex-os`, PR #43 open**; real-Postgres verifier passed in CI run `43156704166` and all 9 PR checks are green. |
| **W1** | Strip EDUos platform + Ykay arms; single-school boot; brand tokens; Licence & Usage; re-cut audit | ✅ **MERGED into main** — PR #1, 2026-10-14 (commits `a9451cd`, `ccaab0b` + this handoff commit). Gates green at merge; DB gates environment-blocked and stated in the PR. |
| **W2** | Module registry drives nav/routes/entitlements; settings framework; first-run wizard; `check:modules` | ✅ **merged** — PR #2, merge commit `74f236c` (branch `arena/9abf8aef-famex-os`, 2026-10-14). All CI jobs green except the pre-existing red `Lighthouse budgets` workflow (also red on the W1 merge). |
| **W3** | Double-entry ledger → Fees & Billing; bursar dashboard; gateway reconciliation | ✅ **stage A MERGED** (PR #4, `e96217a`) and **stage B MERGED** (PR #5, `193ff93`, 2026-10-15): discounts (F5-12), refunds (F5-13), credits (F5-11), transfers (F5-14), gateway settlement (F5-16), ageing + statements (F5-17/18), bursar queues (F5-19), receipts re-brand (F5-04/22) + `verify:ledger` extended to 12 steps. Instalment plans (F5-10) delivered 2026-10-21 (§4e). **Close-out still owed** (§9): real-DB ledger backfill/opening balances, manual adjustments screen (F5-20), cashbook polish (F5-15/F5-23/F5-25), per-reference settlement matching |
| W4 | Notification spine + WhatsApp Business (categories, receipts, cost) | 🟡 **Core delivered 2026-10-21** (§4e): governed templates + versioning, NDPA consent, WhatsApp delivery receipts, per-channel cost reporting, real WhatsApp adapter. Owed (§9): Meta-approved template mapping for cold sends, Termii SMS DLR webhook, fee/result/admission flows fully on templates, consent self-service UI |
| W5 | Admissions funnel, classes/streams, timetable, attendance, GPS clock-in | pending |
| W6 | Marks → broadsheet → report cards → release; post-lock corrections | 🟡 **Post-lock correction workflow delivered 2026-10-21** (§4e): request → independent approval → apply with full history. Marks/broadsheet/report-card pipeline pre-exists from the base — verify the rest of the W6 catalogue before claiming W6 done |
| W7 | CBT at 15,000 items + schoolId, blueprints, item analysis, offline centre | pending |
| W8 | AI layer: prompt templates, router, metering, drafts-queue, redaction | pending |
| W9 | AI Learning Hub e-learning + **virtual/live classes** (assigned URL) | 🟡 **Live classes + assignments delivered 2026-10-21** (§4f): teacher schedules an HTTPS meeting URL, students join only in-window, FIS records the launch honestly (not in-call duration); teacher-set assignments support student submission and grading. AI Learning Hub remains pending |
| W10 | HR + payroll | pending |
| W11 | Parent PRM, Front Desk, Help Desk, **alumni 5-yr portal** | pending |
| W12 | Website CMS, Licence & Usage full, hardening, NDPA/DPIA, UAT | pending |

---

## 4. What W1 delivered (commit `a9451cd` + `ccaab0b`, merged via PR #1)

- **Platform strip (F0-26/27/28/30):** deleted `app/super-admin/**` + its 10 API routes (impersonation, broadcast, cross-school console), `app/signup/**` + `/api/platform/signup`, `Plan/PlanTier/Subscription` models + `seed-plans.ts`. Boot no longer seeds a super-admin; first ADMIN comes from `npm run db:seed` (`prisma/seed-all.ts`), then the W2 wizard. `app/page.tsx` boots to the school home (PlatformLanding + PLATFORM_MODE gone).
- **Ykay arms retired (F0-29):** deleted `app/it-portal/**`, `app/it-education/**`, `lib/it-education.ts`, IT API routes, IT cert PDF, `it_education` module key, IT seeds/nav/stats; deleted `app/virtual/**` + `VirtualBridge` (YK-Virtual SSO bridge).
- **Single-school identity (F0-21/23):** `lib/brand.ts` tokens (`PRODUCT_NAME="Famex OS"`, `getSchoolBrandTokens()`) drive name/colour/logo/site across `app/layout.tsx` (generateMetadata + JSON-LD), `Header`, `Footer`, `AdminSidebar`, student/admin ID cards, report-card PDF. `SchoolProfileContext` now carries `{name, address, phone, email}`. Neutral assets `public/logo.png` + `logo-280.webp` (old `ykay-logo*`, `logo-ykay.svg`, `it-education-hero.jpg` git-removed). Token-driven `app/manifest.ts`, `app/sitemap.ts`, `app/robots.ts` replaced brand-hardcoded statics (statics git-removed). `.env.example` re-cut (dead platform vars removed).
- **Tenant freeze (F0-15 kept at W1):** `lib/tenant.ts` + RLS were untouched then (schoolId hygiene retained); `lib/modules.ts` cleaned of `it_education`. The runtime host/subdomain school-selection layer was removed in §4f (2026-10-21); `schoolId` + RLS remain only as invisible data-integrity guardrails.
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

## 4f. Single-school lockdown, assignments, live classes, deployment + real E2E (2026-10-21, branch `arena/cb6c3d85-famex-os`)

Founder correction after PR #13: Famex/FIS is **one personalised school, not multi-tenant**. This slice removes the remaining runtime school-selection behaviour, builds the two missing teaching workflows needed for honest end-to-end tests, and prepares OCI production + Vercel staging without running two production writers.

- **Single-school lockdown (F0-15/F0-21).** Deleted `lib/tenant.ts`; new `lib/school-resolution.ts` resolves only the configured FIS `School` row (or the sole school if the slug has not been reconciled) and deliberately refuses to guess when multiple school rows exist without the configured slug. Hostnames, preview domains and `PLATFORM_BASE_DOMAIN` no longer select/switch schools; `PLATFORM_BASE_DOMAIN` is removed from env templates. Login, password reset, contact, news, public calendar/staff, iCal, layout branding and the public address all use `resolveSchoolForRequest()`. Internal `schoolId` columns and Postgres RLS remain as invisible integrity guardrails; they are not a tenant product surface. There was already no runtime platform school-signup route, and `lib/school.ts:getSchool()` remains the only runtime School upsert path. Brand baseline banked **63 → 62 findings / 38 → 37 files**.
- **Assignments (F2-03).** Forward migration `20261021120000_assignments_virtual_classes` adds `Assignment` + `AssignmentSubmission` (plus live-class tables below), all `schoolId`-scoped with explicit legacy-named `eduos_apply_tenant_rls(...)` calls. Teachers can create/publish/close/delete-draft work only for an active class+subject they teach; students discover published/closed work only through `StudentProfile.currentClassId`, submit/resubmit text plus an optional credential-free HTTPS attachment link, and see late/graded/returned state. Overdue submissions remain possible while published and are marked late; graded work is locked unless returned. Teachers view the full roster (submitted/missing), grade with exact whole-number score validation, or return with required feedback. Screens: `/teacher/assignments`, `/student/assignments`; APIs under `/api/teacher/assignments*` and `/api/student/assignments*`; pure rules in `lib/assignments.ts` (7 unit tests). Binary file upload is **not** claimed in this slice — the attachment is an HTTPS link.
- **Virtual/live classes (F2-05 + student side of F1-06; W9 live-class slice).** `VirtualClassSession` + `VirtualClassJoin`: a teacher schedules only for an active class+subject they teach, supplies a credential-free HTTPS meeting URL, start/end and an early-join window (0–120 minutes, max 12-hour session). Student list payloads never expose `meetingUrl`; the audited `POST /api/student/virtual-classes/[id]/join` returns it only when the server confirms the student is in the permitted window and upserts one launch record. UI copy is explicit: FIS proves the student launched the external meeting from FIS, not provider admission or time-in-call. Teachers can cancel/end and inspect launches by roster. Screens: `/teacher/virtual-classes`, `/student/virtual-classes`; pure rules in `lib/virtual-classes.ts` (4 unit tests). This is the assigned-URL model, not embedded WebRTC/proctoring.
- **Navigation.** Teacher subject nav gains Assignments + Live Classes; student dashboard and the new student pages gain Assignments + Live Classes. Attendance register rows gained stable test IDs so the real register journey does not depend on fragile DOM ancestry.
- **Real E2E.** `tests/e2e/04-exams.spec.ts` now creates/publishes a two-question CBT, has student1 sit and submit it in the browser, releases results, and proves API `GRADED`/2/2/100%. New `tests/e2e/07-learning-journeys.spec.ts` proves: teacher takes/locks a JSS1A register (student1 late + note, API-verified); teacher creates an assignment in UI → student submits → teacher grades 8/10 → student sees feedback; teacher schedules a live class → student list does not leak URL → student joins in-window and lands in the meeting popup → teacher sees launch; early join returns 409 without the URL; teacher/student assignment powers remain separate. Existing login/fees/admissions/staff-QR/rate-limit/axe journeys remain. DB-backed Playwright runs in GitHub CI or against seeded Vercel staging — never write journeys against production.
- **Deployment preparation (P).** `docs/VERCEL-OCI-DEPLOY.md` is now the canonical split: **OCI production** (GHCR image gated on CI-successful `main`, Postgres in compose, pinned tag, first admin, backups) and **Vercel staging/preview** (Git integration, separate staging Postgres + Upstash, staging-only secrets in Vercel, migrate + `seed-all` only there). `vercel.json` declares framework/install/build + the daily cron. OCI env/compose defaults now resolve FIS (`famex-international-schools`) instead of a placeholder slug; stale EduPortal systemd units are renamed to `famex-notify.*`. Actual OCI VM/Vercel project creation still requires the owner to use their OCI/Vercel/provider consoles — no cloud token or password exists in the sandbox and none may be pasted into chat. After this PR merges, Docker Publish is the concrete OCI artifact to pull; attach the Vercel staging URL + staging E2E output to the deployment record once the owner connects the project.
- **Verified locally:** Prisma validate + generated client; root `tsc` exit 0; mobile `tsc` exit 0; Vitest **88 files / 972 tests** (86/961 + 11 new assignment/live-class tests); full ESLint **0 errors / 122 warnings** (118 standing + 4 fetch-on-mount warnings on the new portal pages); Prettier clean; local Next production build compiled successfully; `npm run audit` **0 blockers / 16 warnings** (313 app files, 160 API routes); `audit:brand` 62/37; `audit:deps` passed; `check:modules`, `check:orphans` (90), `check:dead-ui` (98), `check:boundary` (165), `check:features` (331), school-scope ratchet still 14/14. Schema drift/RLS/DB-backed Playwright/load remain GitHub-CI-authoritative in this sandbox.

## 4g. PR #14 merge + GHCR publish fix (2026-10-21)

PR #14 (`8704113`) passed all seven GitHub checks — Lint & Type Check, Schema Drift, Build, Browser E2E, Load test, Mobile and Lighthouse — and merged as `c586c4a`; the post-merge `main` CI also passed. The gated **Docker Publish** run then failed before building with `invalid tag "ghcr.io/Teamthy/Famex-OS:main": repository name must be lowercase` (the same latent failure as earlier merges). Root cause: the workflow used `${{ github.repository }}` directly despite a comment claiming it was lowercase. This follow-up computes the lowercase GHCR image name in a job step and uses it for every tag/summary reference, so the next CI-successful `main` publish can actually produce `ghcr.io/teamthy/famex-os:main` for OCI. No OCI VM or Vercel project has been created from the sandbox; those remain the owner-console steps in `docs/VERCEL-OCI-DEPLOY.md`.

## 4h. Master production-readiness & launch-certification audit (2026-10-23, branch `arena/7e03c832-famex-os`)

Independent audit of merged `main` at exact commit `1163ebbc5a2a467cb4401e37294931cc2d9d4f83`. Deliverable package: `docs/audits/2026-10-23-production-readiness-1163ebb/` (executive summary, scorecard, launch-blocker register, critical journeys, security/privacy, reliability, performance/capacity, remediation roadmap, conditional release runbook, final certification).

- **Certification: NO-GO** for production with real students/parents/staff, real admissions/documents, authoritative exams/results, clinic records, or real money. Synthetic-data staging only until a patched successor is recertified at its own exact commit.
- Principal blockers: current critical dependency gate failure for pinned Next/Sentry/DOMPurify; public CBT answer oracle; admissions documents satisfying checks by type without clean verified stored content; fee-payment replay not bound to the intended attempt; broken/incomplete student-parent provisioning; newer-role page dead ends; exam subject/timing/offline-replay gaps; report/public-verification integrity; OCI notification sidecar auth mismatch; DB owner/RLS posture; JSON clinic/library/inventory; unverified live deployment, restore, rollback, providers, devices, and capacity.
- Exact-commit GitHub evidence remains green (CI `39561208778`, Lighthouse `39561208768`, Docker Publish `39561859369`, all head `1163ebb`) and is explicitly treated as necessary but insufficient. GHCR digest/tags, OCI/Vercel live resources, restore/rollback, provider receipts, and production-like load remain **NOT VERIFIED/BLOCKED**.
- No source fixes, production deployment, or production-data changes were made in this audit session. Next engineering work must follow the audit roadmap P0 order before any owner-side launch steps in §9 are treated as go-live work.

## 4i. Launch-blocker close-out (PR #17, branch `arena/a545871c-famex-os`, merged `b4415d0`, 2026-11-08)

PR #17 burned down the register items that were fixable in code without infrastructure, and made the hosting call. Highlights (full list in the PR body and in `docs/audits/2026-10-23-production-readiness-1163ebb/03-launch-blocker-register.md`, whose statuses it updated):

- **Report-card print**: standalone A4 `/report-cards/[code]/print`; deliberate-absence rules (missing field → ruling line, missing score → em dash, no QR without a verification code). Reports now carry a 128-bit `verificationCode` (migration backfilled); the guessable `RC/{year}/T{term}/{studentId}` page and the `/api/alumni/transcript` oracle were **deleted** (B-02 public-CBT fix + report-integrity work).
- **Onboarding holes closed**: enrolment-subject assignment on every enrol path (`lib/enrolment-subjects.ts`, transactional, ambiguity reported not guessed); weighted student-completeness (`lib/student-completeness.ts`, teacher-scoped); seeded admin now gets `mustChangePassword`; student login provisioning (`POST /api/admin/students/[id]/login`, token bump on reset); API-wide password gate (`lib/password-gate.ts` → 403 `PASSWORD_CHANGE_REQUIRED`, mutation-verified).
- **Exam/offline integrity**: theory-half timing via `examMinutes()` on all three exam routes; offline replay timing refusals via `offlineTimingProblem()`; sign-out clears offline data but keeps `AWAITING_SYNC`/`IN_PROGRESS` papers (`StoredPaper.ownerUserId`); admissions documents require a CLEAN/SKIPPED scan verdict (`lib/admissions-documents.ts`).
- **Hosting decision** (`docs/HOSTING-DECISION-2K-USERS.md`): **OCI is the sole production writer** (single-writer app: one disk store, one cron, sequential migrations); **Vercel is staging on a separate database** — Hobby's non-commercial terms also rule it out for a fee-collecting school. Vercel staging DATABASE_URL is still a placeholder; no staging Postgres exists yet.
- Gate baseline at #17: tsc 0, **1362 tests**, lint 0 errors. The 2 failing mobile test *files* were missing Expo deps in the sandbox, not code failures (fixed by installing `mobile/` deps — see §4j).

## 4j. Audit remediation Phase 1 / B-01 — dependency gate GREEN (2026-11-08, branch `arena/2aed24db-famex-os`)

Closed **B-01** (the audit's critical dependency-gate failure) by upgrading to patched releases — no exclusions, no lockfile overrides:

- `next` 16.4.0 → **16.4.5** (fixes image-opt SVG RCE), `@sentry/nextjs` 10.69.0 → **10.78.0** (fixes tunnel route; stayed on 10.x — 11.x is a major and not this slice), `zod` 3.25.76 → **4.6.7** (fixes memory-exhaustion advisory; major bump), `dompurify` 3.4.16 → **3.4.17** (via `npm update`, it is an optional dep of jspdf), `jsdom` 29.1.1 → **31** dev (pulls undici 8.12.4, clearing the dev-only EventSource DoS).
- **zod v4 migration cost was tiny**: 3 `z.enum(..., { errorMap })` call sites in `lib/admissions.ts` → `{ error: "..." }`; no other v3-only API in the repo (checked `invalid_type_error`, `required_error`, `.nonempty`, `deepPartial`). All 96 zod-importing files typecheck unchanged.
- Removed the now-stale braces exclusion from `scripts/audit-deps.mjs` (`EXCLUSIONS` is empty again); `npm run audit:deps` → **`0 high, 0 critical` (exit 0)** — first pass since the 2026-10-23 audit.
- Installed `mobile/` deps in-sandbox (`npm ci`), so the 2 mobile test files that had been failing on missing Expo deps now run: **108 files / 1378 tests, all green** (1362 + 16 mobile).
- Fixed two gate failures that were pre-existing at `b4415d0`: `audit:brand` (RLS coverage test cites the frozen `eduos_apply_tenant_rls` migration identifiers 10× — legitimate legacy, baseline re-cut 62 → **72/38 files**) and `check:dead-ui` (student results page matched the action-verb heuristic on the **"Assign" column header** — added to ALLOWED with that reason).
- `npm run build` compiles locally on the upgraded stack (prebuild `prisma generate` needs the §6 stub-engine env vars).
- **CI unblocked, then two CI truths surfaced** (on `main`, the failing `Audit dependencies` step skipped everything after it, so prettier/E2E hadn't actually run since 2026-10-23):
  1. 52 files (mostly from #17) were never prettier-formatted — banked as a formatting-only commit (`prettier --write .`, prettier itself unchanged at 3.9.6).
  2. **Browser E2E red**: one chromium crash in `02-attendance-camera` restarted the Playwright worker, wiping the in-memory E2E session cache while the server-side login limiter (10/15min/IP, deliberately not weakened for tests) kept its count — every later spec signed in afresh and hit a 429 wall (11 misleading failures from one flake). Fixed at the root: the cache now **persists to disk** under `test-results/` (wiped per run, restored at module load, written after every login) so a worker restart costs zero login attempts; the limiter-burning spec was renamed `99-` → `zz-rate-limit.spec.ts` because `axe-smoke` sorted after `99-` ("deliberately last" was luck); and `tests/lib/e2e-login-budget.test.ts` (3 static guards) keeps persistence, budget < limit, and last-position from regressing. The crash itself was an unreproducible runner flake — retries now cost nothing.
- CI on this PR: Lint & Type Check, Build, Schema Drift, Load test, Lighthouse, Vercel all **pass**. Mobile (Expo) `expo-doctor` still fails — pre-existing on `main` since at least #16, untouched here (local: typecheck exit 0, expo-doctor 16/18 with the 2 failures being network-dependent checks that can't run in this sandbox). Docker Publish failing in ~9s on `main` is B-18/Phase-1 release-path work for the next slice.

**Register state after this session**: B-01 ✅, B-02 ✅, B-15-web ✅; B-03/B-05/B-07/B-08 partial; B-06 ✅ merged (PR #40); B-04 ✅ merged (PR #41); **B-16 ✅ merged (PR #42, main `f347f55`)**; **B-17 ✅ implemented, real-Postgres verified in CI, PR #43 open on `arena/50d27962-famex-os`**; open P0s: B-12 (DB least-privilege/RLS fail-open), B-13 (JSON stores → Postgres), B-14 (privacy/retention); B-09/B-18 code-ables are complete (§4k), infrastructure follow-ups remain owner-bound. B-10/B-11/B-19 remain infra-blocked. After B-17, start the requested cross-role backend-source-of-truth sweep as its own feature slice.

## 4k. Phase 1 remainder — release path: B-09 fixed, B-18 code-ables done, mobile CI unblocked (2026-11-08, branch `arena/e697eea8-famex-os`)

PR #18 merged (`75caee3`) with B-01 green. This slice finishes what Phase 1 can do from code, and diagnosed the two reds PR #18 left on `main`'s release path:

- **Why Docker Publish was failing in ~9s**: not a bug — its gate (`workflow_run` on CI conclusion) was correctly refusing to publish while CI on `main` was red. The last remaining red was **Mobile (Expo) `expo-doctor`**, which also blocked the image the whole OCI deploy path waits for.
- **Mobile diagnosis (runner logs are unfetchable from the sandbox — results-receiver host blocked; diagnosed from source instead)**: `mobile/package.json`+`app.json` are byte-identical to the last green run (PR #14, 2026-10-21, verified via the contents API), so nothing repo-side changed; `npx expo-doctor@latest` floated (1.21.5 → 1.21.6 mid-window). Unpacked `expo-doctor@1.21.6` from npm and read its bundled source: the ReactNativeDirectoryCheck fails on ANY non-2xx from `https://reactnative.directory/api/libraries/check` ("unexpected server response"), and the config-schema check fetches from `exp.host`. Verified the directory dataset directly from its GitHub source of truth (`react-native-community/react-native-directory` → `react-native-libraries.json`, 2830 entries): **zero** of our deps are flagged unmaintained/new-arch-untested/unsupported. `app.json` validated against the SDK-54 config types (the only tsc complaint was JSON-import literal widening; `runtimeVersion.policy: "appVersion"` is valid). So the check's *answer* was confirmed by hand; only its flaky third-party transport was removed.
- **Mobile fix (CI + config, gate stays honest)**: `expo-doctor` pinned to `1.21.6` (no more `@latest`); directory check disabled via the tool's own official setting (`expo.doctor.reactNativeDirectoryCheck.enabled:false` in `mobile/package.json`, reason + re-enable step recorded in the workflow comment and `docs/RELEASE-GOVERNANCE.md` §3); `EXPO_DOCTOR_WARN_ON_NETWORK_ERRORS=1` downgrades transient failures of the remaining network check only; one retry; persistent failures re-emitted as `::error` annotations (the one diagnostic channel that works from the sandbox). Local proof: `17 checks`, exit 0.
- **Mobile dependency gate (roadmap Phase 1 bullet)**: `scripts/audit-deps.mjs` now audits BOTH lockfiles (root + `--prefix mobile`) with per-scope exclusions. `npm audit fix --prefix mobile` cleared the **critical** (`shell-quote` command injection) + 7 highs; the remaining high chain (`decode-uri-component` ← `query-string` ← `expo-router`) has a dated exclusion (until 2027-01-08) with the reachability argument: on-device deep-link parsing only, fix is the expo-router SDK-major. Gate output: `[root] 0 high, 0 critical` + `[mobile] 3 high excluded (scoped)` → exit 0.
- **B-09 (P0) fixed in code**: the OCI compose notification sidecar sent an invented `x-jobs-secret` header (route accepts only `Authorization: Bearer ${JOBS_SECRET|CRON_SECRET}`) and swallowed every 401 with `|| true` — notifications queued forever while the container looked healthy. Now: correct Bearer header (same form `famex-notify.service` already used), every tick logs its HTTP status with UTC timestamp, failures log the response excerpt. Metrics/alerting on queue age stay Phase 6 (noted in the register).
- **B-18 code-ables**: `.github/dependabot.yml` (weekly; root npm, mobile npm, github-actions, docker ecosystems; grouped minor/patch, majors individual); **migrations separated from app boot** — new one-shot `migrate` compose service (`restart: "no"`, `prisma migrate deploy`), app waits on `service_completed_successfully` and boots with `MIGRATE_ON_BOOT=false` (`docker-entrypoint.sh` honours the flag; single-container hosts keep migrate-at-boot default); **digest pinning mechanism** — every compose image is now `${VAR:-default}`, new `deploy/oci/pin-image.sh` (`--all`, `--write`) resolves immutable `@sha256:` refs into `.env`, `deploy.sh` reports pinned-vs-mutable and prints migrate logs on failure. `docs/RELEASE-GOVERNANCE.md` records what is code vs the **owner steps** (protect `main` with the 7 named required checks, enable Dependabot alerts/code+secret scanning, `production` environment with reviewers, GHCR write restriction, B-12 DB role split, secrets rotation) — listed, not faked.
- **Guards**: `tests/lib/release-path.test.ts` (13 tests) — Bearer header/no `x-jobs-secret`/no `|| true` (comment-stripped), migrate one-shot + boot ordering, env-overridable images, executable pin-image.sh, dependabot ecosystems, pinned expo-doctor, dual-scope audit, exclusion hygiene shape, directory-check disable ↔ governance doc coupling. Register updated in place: B-01 → FIXED (#18), B-09 → PARTIALLY FIXED (code done, VM drill + metrics owed), B-18 → PARTIALLY FIXED (code done, owner steps listed).
- **Gates (local, this branch)**: tsc 0; vitest **110 files / 1394 tests**; lint 0 errors/126 warnings; prettier clean; `npm run build` exit 0; audit:deps exit 0 (root+mobile); modules/orphans(94)/dead-ui(102)/features(331)/boundary(171)/brand(72/38)/tenant(14)/audit(0 blockers) all exit 0; mobile typecheck exit 0; local expo-doctor exit 0 (17 checks). DB gates remain CI-authoritative.

## 4l. Vercel "UI not showing" — diagnosed; honest degraded rendering (2026-11-09, branch `arena/a6b381c5-famex-os`)

Founder report: **"the ui and frontend not showing on vercel"**. Diagnosed entirely through the
Vercel connector API (the sandbox has no network path to `*.vercel.app`): production deployment
`dpl_75A8U2tVi9T93uhoxi9BbKCGgXqF` (commit `c0a2fd9`) is `READY`/`PROMOTED`, aliased to
`famex-os.vercel.app` — the BUILD is fine (log: `npm ci` 55s, `prisma generate` ✔, all routes
emitted). The failure is runtime: `DATABASE_URL` (sensitive, unreadable via API) is the
deliberate `localhost` placeholder documented in `docs/HOSTING-DECISION-2K-USERS.md` §9 — no
staging Postgres has ever been provisioned. The root layout (`app/layout.tsx`) performs Prisma
reads on EVERY request (`resolveSchoolForRequest`, `getTenantBranding`, `school.findUnique`;
plus `getSession`→`verifyCurrentSession` for signed-in visitors) → ECONNREFUSED inside the Vercel
function → a root-layout crash takes down every route as a blank 500. Secondary wall: Vercel
Deployment Protection (`ssoProtection: all_except_custom_domains`, no custom domains) puts even
that crash behind Vercel Authentication for signed-out visitors — the correct default while the
DB is a placeholder, but it means outsiders see an auth wall, not the app.

**Code changes (this branch):**

- `lib/school-resolution.ts` — `isDatabaseInfrastructureError()` (ONLY
  `PrismaClientInitializationError` + known-request `P2021`/`P2022` = unreachable/unmigrated) and
  `resolveSchoolForRequestSafe()` returning `databaseError` (log-only diagnostic text, never
  rendered — it can contain connection details). Application errors still propagate: degradation
  must never hide bugs or fake an "empty" state over a broken write path.
- `app/layout.tsx` — catches infrastructure failures at all three DB touchpoints, and
  `IdentityCheckUnavailableError` from `getSession` (fail closed → treated as signed out;
  authenticated routes stay guarded). Degraded renders use the env brand tokens (`SCHOOL_*` are
  set on Vercel) and show `<SetupIncompleteBanner>`; `reason="school"` also covers a healthy DB
  with no configured school row (unseeded environment) — the layout already had the token
  fallback for `schoolId === null`, it just could never reach it when the DB threw first.
- `components/SetupIncompleteBanner.tsx` — new: server component, zero client JS, zero data
  reads; honest amber "Setup incomplete — database not connected" strip pointing administrators
  at `/api/health` + the §9 runbook. No brand literals (uses `PRODUCT_NAME`/tokens).
- `app/error.tsx` — removed the illegal nested `<html>/<body>` (a route error boundary renders
  INSIDE the root layout; only `app/global-error.tsx` may emit the document — latent bug fixed)
  and added the honest staging/DB hint with an `/api/health` link (production error messages are
  sanitized, so the boundary cannot inspect the cause).
- `tests/lib/school-resolution-degraded.test.ts` — 10 tests: healthy pass-through, single-school
  fallback, refuse-to-guess between two schools, degrade on P1001-style init error / P2021 /
  P2022, RETHROW on P2002 and non-Prisma errors, classifier matrix.
- `docs/HOSTING-DECISION-2K-USERS.md` §9 — dated update: symptom → mechanism → banner is
  truthful degradation, NOT a working school OS; owner steps 1–5 unchanged and still required.

**Gates (this branch):** tsc 0; vitest **111 files / 1404 tests**; lint 0 errors/126 warnings;
prettier clean; `npm run build` exit 0 **with a placeholder `DATABASE_URL` mirroring Vercel**;
all 8 static checkers exit 0 (brand baseline 72/38 unchanged, audit 0 blockers/16 warnings).
Sandbox limitation stated honestly: Prisma engine binaries are stubs (§6), so no local runtime
request was served; runtime proof = the unit tests against the exact error classes Vercel
produces + the successful build. The real verification is owner step 4 (`/api/health/ready`).

**Not agent-workable (owner):** provision staging Postgres, replace `DATABASE_URL` in the Vercel
dashboard (NEVER via chat/agent tooling — §8 secrets rule; the connector's `update_env_var`
would transit the secret through the conversation), migrate + seed from a trusted shell, decide
Deployment Protection policy for testers. Until then the Vercel deployment shows the banner —
by design.

## 4m. Vercel's second wall: boot-time env validation was fatal on staging (2026-11-09, branch `arena/a6b381c5-famex-os`)

After §4l/#37 the founder's screenshot STILL showed a bare page — but the copy ("This page
couldn't load / A server error occurred") was **not** our `global-error.tsx` (light theme,
"Something went wrong"): it was Next's built-in crash page, which only appears for failures
OUTSIDE React. Cause found: `instrumentation.ts` `register()` → `lib/env.ts` `assertEnv()` — the
old `productionSchema` made `NEXT_PUBLIC_SITE_URL`, `PAYSTACK_PUBLIC_KEY` and
`PAYSTACK_SECRET_KEY` fatal whenever `NODE_ENV=production`. Vercel staging has none of the three,
so **the server refused to start**: every route (and `/api/health`) answered with a bare error
before any application code ran. The placeholder `DATABASE_URL` (§4l) was the SECOND wall behind
this one — and together they were the original "UI not showing": a boot wall plus a render wall.

**Fix (this branch):**

- `lib/site-url.ts` (new) — `resolveSiteUrl()`: explicit `NEXT_PUBLIC_SITE_URL` → preview
  `VERCEL_URL` (the deployment's own hostname) → `NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL`
  (build-inlined) → runtime `VERCEL_URL` → `""`. Zero imports on purpose so middleware (edge)
  shares it without pulling zod into the edge bundle.
- `lib/env.ts` — a site URL is fatal only when NOTHING resolves (i.e. not on Vercel AND unset);
  missing Paystack keys demoted to a LOUD warning because `lib/paystack.ts` already throws
  "not configured" on every initiation and every webhook verification — an unkeyed deployment
  fails closed (payments off, never silently accepting money). A dead portal is worse than a
  closed payment window; the file's own history paragraph documents both outages.
- 11 consumers switched to the resolver (email ×3, notifications, apk lib + download route,
  cors, brand tokens, system-flags, middleware, mobile config route, calendar + staff-directory
  pages). Side-fix: password-reset/staff-activation emails sent from Vercel previously linked
  `http://localhost:3000` (the old per-call fallback).
- `tests/lib/env-validation.test.ts` — 13 guards: resolver chain, Vercel-staging prod boots,
  off-Vercel prod without a resolvable URL still refuses, Paystack warning matrix, base schema
  fatal everywhere, `assertEnv` throw/no-throw.

**Runtime proof (first in this project, sandbox):** `next start` with `NODE_ENV=production`,
`VERCEL_ENV=preview`, `VERCEL_URL` set and NO site URL / Paystack keys → `✓ Ready`; `/api/health`
→ `503 {"database":"down",…}`; `/` → **HTTP 200** branded shell + `role="status"` "Setup
incomplete — database not connected" banner. (The stub query-engine's load failure surfaces as
`PrismaClientInitializationError` — the same class Vercel's `ECONNREFUSED` produces — so the
degraded path exercised locally is the one Vercel runs.) Boot log shows the loud non-fatal
warnings (Paystack disabled, RESEND missing, Redis memory fallback, …) exactly as designed.

**Gates:** vitest **112 files / 1417 tests**; tsc 0; lint 0 errors/126 warnings; prettier clean;
build exit 0; modules/orphans/dead-ui/features/boundary/brand/audit exit 0. Gate-name correction
for future sessions: the tenant checker is **`check:tenant-coverage`** (`14 UNCOVERED` reviewed
baseline, exit 0) — a bare `check:tenant` script does not exist and earlier table rows citing it
were silently running nothing.

## 4n. Public home redesign — editorial paper palette, 12 sections, 4-image hero carousel (2026-11-10, branch `arena/2a7e132a-famex-os`)

Founder brief: *"the project still has the ykay project ui — redesign the ui to look exactly like
the image attached; home page should be 12 sections; home page banner image should be in carousel
of 4 images."* Reference: a warm cream editorial landing (display serif with italic accents,
rounded hero card, floating glass pill nav, floating stat card, filter-pill card grid, dark
stat band).

**What landed (`components/home/*`, 14 files):** `HomeHeader` (floating glass pill nav with real
destinations — `/login` "Student Portal", `/admissions` "Apply Now", anchor links);
`HeroCarousel` (FOUR real campus photographs, 6.5s crossfade, arrows + dots, first slide eager
and preloaded as the LCP element); `IntroStatement`; `TrioCards` + `CampusMiniCarousel` (dark
card's two-up photo cycle); `StageExplorer` (the six real advertised stages with filter pills and
a local-only shortlist heart — nothing tracked); `MarqueeStrip`; `AcademicsCards`;
`OutcomesBand` (structural facts only: 6 stages / 3 terms / 2 public exams / 5 years of alumni
records — no invented satisfaction metrics); `PeopleSection` (real staff ROLES, not invented
names or stranger photographs); `LifeGallery`; `AdmissionsSteps`; `NewsEvents` (server-fetched
REAL `/api/public/calendar`, honest empty state when the session is unconfigured); `VisitCta`
(env-token contacts + the shared `FindUs` island); `HomeFooter`; `theme.ts` palette tokens.

**Type:** Fraunces variable (normal + italic) SELF-HOSTED — `app/fonts/Fraunces-Variable*.woff2`
copied from `@fontsource-variable/fraunces` and loaded via `next/font/local` in `app/page.tsx`,
per the layout's documented convention; `next/font/google` fetches at build time and neither the
sandbox nor reproducible builds may depend on it.

**Deleted (Ykay-era home):** `Hero`, `HomeSections`, `ServiceInfo`, `AdmissionsBanner`,
`Services`, `Groups`, `MobileAppCTA`, `SchoolAddressLink` (git rm). `components/SchoolHome.tsx`
now composes exactly twelve sections between header and footer on the paper palette; the portal
and the other public pages keep their existing shell — **the portal reskin is a separate
workstream, not this slice.**

**E2E contract honoured** (`tests/e2e/00-home.spec.ts` unchanged): heading matches
/Excellence in Education/i (the new H1), "Apply Now" and "Student Portal" links visible, and
`section img[src*='hero-campus']` attached (slide 1 = `hero-campus-1200.webp`, kept light for
the Lighthouse budget).

**Gates:** tsc 0; vitest 112 files / 1417 tests; lint 0 errors / 119 warnings; prettier clean;
build exit 0; modules/orphans/dead-ui/features/boundary/tenant-coverage/audit exit 0;
`audit:brand` burned down one finding with the deleted legacy components → baseline legitimately
re-cut to **71 findings / 37 files**. Runtime smoke (`next start`, Vercel-shaped env, stub DB):
`/` → HTTP 200 with twelve sections, four carousel images, the honest setup banner still
rendering, and the journal's honest empty state.

## 5. Gates: commands + latest evidence + blockers

Run from repo root. The latest B-17 local and CI evidence is summarized in §4r. Historical CI outcomes below remain accurate for their named PRs. Older delivery-gate evidence (2026-10-21, §§4f–4g), the 2026-10-23 audit recheck (§4h), the B-01 session (§4j) and the Vercel-degradation session (§4l) are superseded by it.

| Gate | Command | Result (actual output) |
|---|---|---|
| typecheck | `npx tsc --noEmit` | exit 0 — no errors (on zod 4.6.7 / next 16.4.5 / sentry 10.78.0) |
| unit/integration | `npx vitest run` | B-17 latest local run: `Test Files 116 passed (116)` / `Tests 1597 passed (1597)`; includes mobile suites, RBAC guards, and lifecycle/promotion suites |
| lint | `npm run lint` | `✖ 119 problems (0 errors, 119 warnings)` — no errors |
| formatting | `npx prettier --check .` | `All matched files use Prettier code style!` |
| dep audit | `npm run audit:deps` | **PASS, dual scope (§4k):** `[root] 0 high, 0 critical, 14 moderate, 4 low` (EXCLUSIONS empty) + `[mobile] 3 high` all excluded via the dated `decode-uri-component` chain entry → `Dependency audit passed (root + mobile)`, exit 0. Closes B-01; adds the mobile gate |
| project audit | `npm run audit` | `No blockers. 16 warning(s).` |
| brand ratchet | `npm run audit:brand` | `Brand audit OK — 71 finding(s) across 37 file(s); baseline allows 71.` (re-cut 2026-11-10: the Ykay-era home components deleted in §4n carried one finding; remainder are confirmed live domains + frozen `eduos_` DB identifiers) |
| feature IDs | `npm run check:features` | OK — `Catalogue: 331 features parsed` / `§25 declares TOTAL 331 — matches.` |
| orphans | `npm run check:orphans` | `All 94 portal pages are reachable.` |
| dead UI | `npm run check:dead-ui` | `Checked 102 portal pages.` / `No dead UI found.` (student results page ALLOWED: "Assign" is a column header, not a button) |
| modules | `npm run check:modules` | `Modules: 23 declared, 23 used by nav/API. Admin API directories: 32 owned, 82 guard calls. Modules, nav and routes agree.` |
| client boundary | `npm run check:boundary` | `Checking 173 client component(s)…` / `No client component reaches a server-only module.` |
| prisma schema | `npx prisma validate` | `The schema at prisma/schema.prisma is valid 🚀` (needs a dummy `DATABASE_URL`) |
| production build | `npm run build` (with §6 stub-engine env) | exit 0 — compiles on next 16.4.5 / sentry 10.78.0 / zod 4.6.7 |
| school-scope coverage (legacy script name) | `npm run check:tenant-coverage` | 14 UNCOVERED = CI baseline (`--max-uncovered 14`), all pre-existing; the WhatsApp webhook is a reviewed provider-global exemption printed on every run (Meta callbacks carry a provider message id, not a school context). This is a `schoolId` integrity ratchet, not evidence of a multi-tenant product surface |
| ledger loop | `npm run verify:ledger` (`scripts/verify-ledger-loop.ts`) | **Blocked locally** (no Postgres). Runs in CI's `schema-drift` job on Postgres 17 — it is the only place the deferred balance trigger and the kobo reconciliation are proved for real |
| fee-payment replay loop (B-04) | `npm run verify:fee-replay` (`scripts/verify-fee-payment-replay.ts`) | **Blocked locally** (no Postgres). Runs in CI's `schema-drift` job on Postgres 17 (§4p): concurrent duplicate completions, binding-conflict matrix, attempt state machine, offline review lifecycle, provider reversals + providerEventId dedupe, ledger-to-document reconciliation to the kobo — driving the REAL service, not a mirror |
| finance lifecycle loop (B-16) | `npm run verify:finance` (`scripts/verify-finance-lifecycle.ts`) | Historical PR #42 CI verified against Postgres 17; see §4q and PR record comment `issuecomment-6777912198` |
| academic lifecycle loop (B-17) | `npm run verify:student-lifecycle` (`scripts/verify-student-lifecycle.ts`) | **PASS in GitHub CI run `43156704166`, Schema Drift job `130978206447`, against Postgres 17**; includes transfer, prior-session immutability, capacity, withdrawal/re-entry, promotion/repeat from compiled results, elective change and audit rows |
| DB gates + Browser E2E | `check:drift`, migration apply, `verify:rls` + `verify:rls:coverage`, `verify:admissions`, `verify:ledger`, `db:seed*`, `npx playwright test` | **Passed in GitHub CI on PR #14 (`8704113`) and again on merged `main` (`c586c4a`)**: Schema Drift applied `20261021120000_assignments_virtual_classes` to clean Postgres 17 with no drift and verified RLS/admissions/ledger; Browser E2E seeded FIS and passed the full CBT sit→submit→marked, JSS1A attendance lock, assignment create→submit→grade, and live-class join/launch journeys. Local sandbox still has no Postgres, but the Next production build compiled locally. `check:readiness` still needs a seeded school and has no CI step; run it on staging after migration/seed. |
| Lighthouse budgets | GitHub `Lighthouse budgets` workflow | Green since PR #12 (`4422fe9`, 2026-10-20): home performance 0.88, LCP 3845ms, TBT 53ms, accessibility 0.96 (medians). The §4n home redesign regressed home LCP to 7950ms on first submit; §4n.1 records the forensics and the fixes at this branch's head. Variance-prone — judge the exact PR head, never a single run. |

Re-cut brand baseline after de-branding: `npm run audit:brand -- --update` (only lowers; gate fails if it grows).

### 4n.1 LCP budget forensics — how the home regression was found and fixed (2026-11-10)

The `Lighthouse CI (budgets)` gate holds home `largest-contentful-paint` to ≤4000ms. The redesign's first
submit measured **7950ms**; four CI cycles and these fixes brought it back inside budget:

1. **In-viewport lazy slides.** The three non-first carousel JPEGs sit inside the initial viewport, so
   `loading="lazy"` still fetched them immediately (~865KB competing with the LCP image on simulated 4G).
   `HeroCarousel` now mounts slides 2-4 at 6s — past the observation window, just before the 6.5s
   auto-rotation. 7950ms → ~4280ms.
2. **The image preload was inert.** `metadata.other` renders `<meta>` tags; a `rel=preload` *meta* does
   nothing. React 19 hoists `<link rel="preload">` from JSX into the real `<head>`, so `app/page.tsx` now
   renders the tags directly. Run-to-run variance collapsed (the 5.8s tail disappeared).
3. **AVIF LCP slide.** `public/home/hero-campus-750.avif` (27.9KB) ships beside the WebP (48.3KB) through
   `<picture><source type="image/avif">`; the preload targets the AVIF with `type="image/avif"` so
   non-AVIF clients skip it. The E2E contract still matches the WebP `<img src*="hero-campus">`.
4. **The real LCP element was the serif H1, not the image.** `next/font/local` emitted *no* preload links
   in this setup (verified in the SSR head), so Fraunces was discovered only after the render-blocking CSS
   parsed and the H1 font-swapped at ~4.3s — over budget even with a preloaded 27KB image, while
   `/admissions` (preloaded image LCP, 3.6s) passed. Fraunces now lives at stable `public/fonts/` URLs with
   hand-written `@font-face` in `app/globals.css` (`--font-fraunces` on `:root`) and an explicit
   `<link rel="preload" as="font" crossorigin="anonymous">` for the upright face in `app/page.tsx`.
   The italic face stays CSS-discovered on purpose: preloading its 45.7KB too kept the first wave
   ~650ms heavier than the identical shell on `/admissions`, whose preloaded-image LCP passes at
   ~3.6s — the only above-the-fold italic is the H1 `<em>`, a smaller paint than the hero image.
5. **The decisive fix — initial layout scope.** With transfers all optimised the home still sat at
   ~4.25s while `/admissions` passed at ~3.6s; the remaining structural difference was document
   size (124KB / ~600 tags vs 72KB), whose full style+layout pass runs on the throttled CPU before
   the hero's paint frame. The nine below-fold sections and the footer now carry
   `.home-below-fold { content-visibility: auto; contain-intrinsic-size: auto 720px }`
   (app/globals.css), confining first layout to the visible viewport with zero SEO/no-JS impact.
   Home LCP landed at **3925ms median (3905-4008) against the 4000ms budget**, perf 0.88,
   `all assertions passed` (run 42615802263) — green board on PR #39.

Diagnostics worth keeping: `scripts/lighthouse-report-summary.mjs` annotates the LCP element audit
and (when a paired trace exists) the final LCP candidate; in LHCI 0.14 the `.lighthouseci/` dir holds
only `lhr-*.json` + `assertion-results.json` — no traces — so the `largest-contentful-paint-element`
audit's empty `details` in this setup remains unexplained and the annotations fall back to metrics.

Tooling: `scripts/lighthouse-report-summary.mjs` now annotates the LCP element (selector + snippet) and its
phase split, plus a truncated raw dump of the audit details when the shaped parse finds nothing — the next
regression is diagnosable from the check annotations alone. Sandbox traps logged while chasing this:
`fuser` does not exist here (kill servers by pid from `ss -ltnp`), and a stale `next start` left on a port
answers smoke-test curls with the previous build — verify the pid before trusting any local check.

### 4o. B-06 — the role × page × API entitlement matrix (2026-11-10)

The audit's P0 said leadership and operations roles had inconsistent page/API
authority: `middleware.ts` knew 8 of 13 roles (PROPRIETOR, PRINCIPAL,
VICE_PRINCIPAL, LIBRARIAN and NURSE fell through to `/student/dashboard`), its
`/admin` allowlist admitted only four, `app/login/page.tsx` carried its own
13-role destination map that disagreed with both, `lib/nav.ts` filtered the
sidebar against an 8-role type, the library API refused the LIBRARIAN and the
clinic API refused the NURSE (the two roles those arms exist for), and the
staff screen could create only six of eleven staff roles. A nurse signing in
was bounced login → `/admin/clinic` → denied → `/student/dashboard` → denied →
… forever: an unbreakable redirect loop.

What landed:

- **`lib/rbac/entitlements.ts`** — the matrix. One prisma-free table (edge-safe)
  of `home` (login destination AND middleware bounce target), `areas`
  (workspaces the role may enter) and `adminNav` per role, plus
  `canRoleEnterPath` / `areaOfPath` / `homeFor`. Segment-exact area matching:
  `/admin-admissions` is no longer swallowed by a `startsWith("/admin")`.
- **Middleware + login read the matrix.** `destinationFor` and the hand-written
  allow-list are gone; the login page builds its destinations from `homeFor`.
  Every role's `home` sits inside an area the role may enter, so a bounce
  always terminates — `tests/lib/rbac-entitlements.test.ts` asserts that
  property per role forever (the loop's regression test).
- **Named role groups replace inline lists (Rule 13):** `LIBRARY_ROLES`
  (includes LIBRARIAN), `CLINIC_ROLES` (includes NURSE; child health is
  need-to-know, so the proprietor stays out), `INVENTORY_ROLES`,
  `PEOPLE_ADMIN_ROLE_NAMES` (lib/people.ts maps them onto the Prisma enum),
  `PROVISIONABLE_STAFF_ROLES` (every staff role; PARENT/STUDENT are enrolment
  and linkage, never a staff form).
- **Provisioning:** the staff screen's `<select>` renders
  `PROVISIONABLE_STAFF_ROLES` with human `ROLE_LABELS` (the enum is never shown
  raw); `STAFF_ROLES` in lib/people.ts validates all eleven at the API.
- **Nav alignment:** `AdminNavRole` is now an alias of the one vocabulary;
  groups carry `roles` (Fees & Billing = ADMIN_WORKSPACE, mirroring its APIs)
  and items mirror their route's group (Library/Inventory/Clinic/Staff);
  `resolveNav` returns nothing at all for roles outside the admin workspace,
  and planned rows respect role gates too.
- **`scripts/check-modules.ts` carried its own stale 8-role copy** — the very
  drift that hid the blind spot — and now validates item AND group roles
  against `ALL_ROLES`.

Evidence: `tests/lib/rbac-entitlements.test.ts` parameterizes every assertion
over all 13 `UserRole`s (matrix row, area table, direct-URL access, login
destination, bounce termination, forged-role fallback, nav visibility) —
+101 tests, suite 113 files / 1518 tests green. Forged-cookie smoke against a
production build: NURSE `/student/dashboard` → 307 `/admin/clinic` (her home,
enterable), NURSE `/admin/clinic` → 200, STUDENT `/admin` → 307
`/student/dashboard`, LIBRARIAN `/teacher/dashboard` → 307 `/admin/library`,
no cookie → `/login?next=…`. Gates: tsc/lint(0 errors)/prettier/build/
check:modules/orphans/dead-ui/features/boundary/tenant-coverage/audit-brand
(71 findings / 37 files, baseline unchanged) all clean.

Judgement calls recorded in the matrix header: PROPRIETOR gets admin + staff
but not the teacher workspace (owner oversight, not classroom presence);
PRINCIPAL/VICE_PRINCIPAL get the teacher workspace; COORDINATOR homes on
admissions; BURSAR homes on `/admin/fees`; LIBRARIAN/NURSE enter `/admin`
because their arms live there while what they may DO inside stays the API's
call. Phase 3 finance integrity started immediately after: B-04 (fee-payment
replay binding) landed in §4p; next is B-16 (finance lifecycle).

---

### 4p. B-04 — fee-payment replay binding, offline review lifecycle, provider reversals (2026-11-10)

The audit's P0 money-integrity blocker (register §B-04): `postCompletedFeePayment`
used to find an existing payment **by reference alone** and report it as a
successful replay before validating school, invoice, student, amount, method or
the attempt — so a duplicate or conflicting reference could be reported as
success for the wrong financial context. The same review found three siblings:
offline `PENDING_REVIEW` cash entries were a dead end (nothing could ever
settle or reject them), a PAID attempt could be re-pointed at a different
document, and the webhook silently acked `refund.processed` /
`chargeback.success` — reversed money stayed a COMPLETED receipt forever.

**What landed (branch `arena/ab279367-famex-os`):**

1. **`lib/fee-payment-service.ts` rewritten as an explicit state machine**
   returning `posted | replay | conflict` with codes
   `REFERENCE_BOUND_ELSEWHERE` / `ATTEMPT_ALREADY_PAID` /
   `ATTEMPT_NOT_POSTABLE` / `ATTEMPT_FIELD_MISMATCH`. Order of operations:
   resolve + school-lock the attempt FIRST, compare its immutable fields
   against the caller, PAID attempts replay only their own exactly-bound
   payment, then a reference hit replays only on an exact five-field binding
   match (school/invoice/student/amount/method). Every conflict writes a
   `FEE_PAYMENT_REFERENCE_CONFLICT` audit row in the same transaction.
2. **Atomic attempt↔payment transition.** The attempt moves PENDING → PAID
   via guarded `updateMany` INSIDE the posting transaction (payment row,
   invoice draw-down, ledger journal, credit document). Two concurrent
   completions of one attempt (webhook + browser verify) cannot both commit:
   the loser's guard count is 0 and its whole posting throws → rolls back.
   The winner is the only receipt that exists.
3. **First-class offline review.** `completeOfflineReviewPayment` (guarded
   PENDING_REVIEW → COMPLETED + draw-down + journal in one tx; a balance that
   moved underneath leaves it queued) and `rejectOfflineReviewPayment`
   (→ FAILED, never deleted — Rule 9). Wired to new admin actions
   `APPROVE_OFFLINE_PAYMENT` / `REJECT_OFFLINE_PAYMENT`, a `queuedOffline`
   list on the review GET, and an offline-queue card on
   `/admin/fees/transfers` (page + nav label renamed "Payment Review").
4. **Provider reversals.** New `postPaymentReversal` handles Paystack
   `refund.processed` + `chargeback.success`: posts a FeeRefund document
   (APPROVED, `requestedByUserId` null = provider-initiated), flips FULL
   reversals COMPLETED → REFUNDED (guarded), books the `postFeeRefund`
   journal, audits `FEE_PAYMENT_REFUNDED` / `FEE_PAYMENT_CHARGED_BACK`.
   Partial reversals stay COMPLETED with the refund document carrying the
   part returned. **Idempotency (Rule 4):** new unique
   `FeeRefund.providerEventId` (migration
   `20261110120000_fee_refund_provider_reversal`, same migration makes
   `requestedByUserId` nullable) dedupes retried webhook deliveries —
   including partials, which status alone cannot dedupe; a P2002 race loser
   is reported as replay.
5. **Route semantics.** Webhook conflict → `logger.error` + audit + still
   `ok:true` 200 (acking stops provider retries of a payload that can never
   succeed; finance reconciles from the audit trail). Parent verify + admin
   RECORD_CASH / APPROVE_TRANSFER conflicts → 409 with the detail. Transfer
   review stamp now lands via guarded `updateMany` on PAID only.
6. **Two decisions worth keeping:**
   - *Reversals do NOT reopen the invoice* — the exact F5-13 convention
     `decideRefund` follows and `verify:ledger` step 10 pins (income nets
     through the refunds account; receivable ledger keeps reconciling with
     documents to the kobo). A family owing again after a chargeback is a
     bursary decision (re-invoice/adjust), never a webhook side effect.
   - *Money units:* fee documents (invoices, payments, attempts, refunds)
     store **whole-naira integers**; the ledger stores kobo (`nairaToKobo`
     inside `lib/ledger-postings`). Paystack speaks kobo — the webhook
     compares `payload.amount === attempt.amount * 100` and reversals divide
     by 100. While wiring the review UI I found and fixed a display bug: the
     transfers page divided whole-naira amounts by 100 (showed ₦250 for a
     ₦25,000 transfer).
7. **Evidence:** `scripts/verify-fee-payment-replay.ts`
   (`npm run verify:fee-replay`, wired into the CI schema-drift job on
   Postgres 17 with the same `::error::` re-emission as `verify:ledger`)
   drives the REAL service through the audit's regression list: concurrent
   duplicate webhook+browser verify, webhook-before-browser ordering,
   wrong-invoice/student/amount references, paid-attempt rebinding,
   FAILED-attempt posting, offline complete/reject/replay/double-decision,
   partial refund, full refund, chargeback, retried provider events, then
   reconciles ledger vs documents to the kobo (bank = net of receipts and
   reversals; refunds account = returned money; nothing deleted). Provider
   timeout behaviour is unchanged (non-definite verify failure → attempt
   stays PENDING → 503 → later retry lands in the replay/conflict machine)
   and stays covered by `tests/lib/paystack-verify.test.ts`.
8. **Unit suite:** `tests/lib/fee-payment-service.test.ts` rewritten +
   extended to **59 tests** (attempt-first state machine, binding-conflict
   matrix, guarded transitions incl. the concurrent loser, offline lifecycle,
   reversal full/partial/replay/conflict/dedupe). Suite totals: **113 files /
   1557 tests** (was 1518).

**Gates at PR time (actual output):** `npx tsc --noEmit` exit 0 · `npx vitest
run` 113 files / 1557 tests passed · `npm run lint` 0 errors / 119 warnings ·
`npx prettier --check .` clean · `npm run audit:brand` 71 findings / 37 files
(= baseline) · `npm run audit` no blockers, 16 warnings · `check:features`
OK · `check:orphans` 94 pages reachable · `check:dead-ui` clean (102 pages) ·
`check:modules` agree (31 owned / 81 guards) · `check:boundary` clean (173
client components) · `prisma validate` valid · `npm run build` exit 0 ·
`verify:fee-replay` + `check:drift` + migration apply run in CI (no local
Postgres — same standing as `verify:ledger`).

---

### 4q. B-16 — finance lifecycle controls: sequences, maker-checker, per-reference settlements, payout proof, receipts, due-date fee locks (2026-11-10)

The audit's P1 finance-controls blocker (register §B-16): "Database
sequences/unique retry-safe numbering, mandatory idempotency keys,
maker-checker thresholds, per-reference settlement ingestion, payout proof,
receipt issuance, and due-date-aware fee locks." Branch
`arena/7a059201-famex-os`, base `9eb558a` (B-04 merged). One migration:
`20261110140000_finance_lifecycle_controls` (forward-only; existing Expense
rows default APPROVED — no data rewrite).

1. **Retry-safe numbering — the DocumentSequence pivot.** The original plan
   (in-transaction P2002 retry loops re-drawing `count()+1`) is IMPOSSIBLE on
   Postgres: any error aborts the enclosing transaction and every later
   statement in it fails. Do not re-add retry loops or count-based numbering.
   Instead a `DocumentSequence` counter table (one row per school+kind,
   unique `(schoolId, kind)`, seeded by the migration from existing
   LedgerJournal rows per `journal:<year>` and FeeInvoice rows per
   `invoice:<termId>`) is incremented INSIDE the posting transaction via
   `lib/document-sequence.ts` `nextDocumentNumber()` — the row lock serialises
   concurrent draws, a rollback gives the number back, and collisions cannot
   occur. `lib/ledger.ts` (journal numbers, `journal:<UTC year of postedAt>` —
   matches the seed's `date_part('year', postedAt)` on a tz-naive column) and
   `lib/fee-structures.ts` (invoice numbers inside each per-student tx) both
   draw from it. `generateInvoices` also gained P2002 discrimination
   (`p2002Targets`): a unique violation on `(studentProfileId, termId)` still
   means "already billed" (skip), but an `invoiceNumber` collision now THROWS
   instead of silently dropping a billable student.
2. **Zero-total fee structures.** Refused at `upsertFeeStructure` ("must
   total more than ₦0"), surfaced as a dry-run plan blocker in
   `planInvoiceGeneration`, and skipped-with-count during generation
   (`zeroTotalSkipped` in the result; the generate route reports it) — the
   old behaviour aborted the whole billing run mid-school when the ledger's
   zero-leg guard met a ₦0 accrual.
3. **Cash references.** `lib/payment-reference.ts` (`cashReferenceProblem`):
   4–120 chars, `[A-Za-z0-9][A-Za-z0-9._-]*`, and the server's `YKC-`
   namespace is reserved (case-insensitive) so bursars cannot mint
   gateway-looking references. Enforced by the RECORD_CASH route schema.
4. **Expense maker-checker.** New `lib/expenses.ts`: `recordExpense` creates
   expenses ≥ `EXPENSE_APPROVAL_THRESHOLD_NAIRA` (₦100,000) as
   PENDING_APPROVAL with NO journal; `approveExpense` (approver roles
   ADMIN/DIRECTOR/PROPRIETOR/PRINCIPAL, never the recorder) flips a guarded
   `updateMany` (PENDING_APPROVAL → APPROVED) and posts the spend journal in
   the same tx — racing approvers post exactly once, the loser gets "decided
   by another approver". Below the threshold behaviour is unchanged (document
   + posting in one tx). The route grew an `action: "APPROVE"` branch (202 on
   pending create) and pending expenses are excluded from EVERY spend
   aggregate: expenses GET summary, `finances/overview`, `budgets` groupBy,
   and `scripts/backfill-ledger.ts`. Voiding a pending expense needs no
   reversal (there is no journal) — the existing DELETE already handled the
   journal-absent case. UI: approval badge + approve button + pending count
   on `/admin/expenses`.
5. **Credit-transfer idempotency.** `transferId` is now caller-mandatory in
   the credits route schema (the server's `?? randomUUID()` fallback made
   every retry a NEW transfer). While wiring the verify script a REAL latent
   bug surfaced: `transferFeeCredit` had no replay guard — a retried
   transferId moved the invoice balances a second time while the journal
   correctly replayed (documents and books drifting apart). Fixed with an
   in-tx `ledgerJournal.findFirst` on `fee-transfer:<transferId>` returning
   `{replay: true}` before any mutation. The ledger UI now generates one
   `crypto.randomUUID()` per transfer INTENT (state), reuses it across
   retries, and rotates it only after success.
6. **Per-reference settlement ingestion.** New `lib/settlements.ts`:
   `recordGatewaySettlement` takes `paymentReferences` from the gateway's own
   settlement report; every reference must exist, be COMPLETED, be non-CASH
   and be unclaimed (`SettlementClaimError` with structured issues → 409);
   the claim is ONE guarded `updateMany` (`settlementId: null` → this
   settlement) whose count must equal the claim list (a concurrent payout
   wins and this record rolls back); `matchedKobo` is the SUM OF THE CLAIMED
   PAYMENTS ×100 (fee docs are naira, GatewaySettlement is kobo) and may not
   exceed the gross; the charges journal (DR expense:gateway_charges / CR
   bank) still posts in the same tx; re-recording a reference is a replay.
   `listUnclaimedPayments` replaces the old ±5-day aggregate: the
   ledger-to-bank exception report is now a per-payment work list. Schema:
   `FeePayment.settlementId` (FK SetNull + `(schoolId, settlementId)` index).
   UI: settlements form grew a references textarea + clickable unclaimed
   chips on the ledger page.
7. **Refund payout proof.** `decideRefund` validates `proofReference`
   (3–120 chars, trimmed) BEFORE opening the tx on APPROVE — stored on
   `FeeRefund.proofReference` and in the `FEE_REFUND_APPROVED` audit
   metadata; rejection needs none (nothing moved). Route schema + ledger-page
   inline proof step ("Approve & pay out" now reveals a required proof input).
8. **Receipt issuance (admin side).** New `GET /api/admin/fees/receipt?
   paymentId=` builds the `ReceiptData` server-side from the payment/invoice/
   student/parent rows (COMPLETED only; Rule 3/10 — the document is a
   projection of stored facts). `/admin/fees` wires the existing
   `ReceiptModal` (printable PDF + verification QR via `lib/receipt.ts`) onto
   every recent-payment row and opens it automatically after recording cash —
   the methods that most often left without a paper document.
9. **Due-date-aware fee locks.** `lib/fee-lock.ts` rewritten: an invoice
   blocks only when `balanceDue > 0` AND status is blocking AND (status is
   OVERDUE OR `dueDate` is null — payable on issue, the conservative reading
   — OR `dueDate <= now`). A not-yet-due February instalment no longer locks
   a child out of CBT in November.
10. **Tests:** `tests/lib/finance-lifecycle-controls.test.ts` (24: zero-total
    ×3, maker-checker ×8, settlement claims ×7, refund proof ×3, cash
    references ×3), `tests/lib/document-sequence.test.ts` (5: draw
    arithmetic, bootstrap, create race, give-up bound, rethrow), fee-lock
    due-date pin, and `decideRefund` proof added to the existing
    fee-adjustments suite. `tests/setup.ts` grew `expense` +
    `documentSequence` mocks. Suite totals: **115 files / 1587 tests** (was
    113/1557).
11. **Verify script:** `scripts/verify-finance-lifecycle.ts`
    (`npm run verify:finance`, wired as the CI schema-drift job's next step
    with the same `::error::` re-emission): sections 1–8 per the register's
    evidence list — concurrency numbering (40 racing draws → 1..40 exactly
    once; 12 racing accruals → 12 distinct journal numbers), instalment
    fee-lock schedules, settlement-file reconciliation fixtures (claim,
    replay, re-claim, ghost, over-gross, partial → PARTIALLY_MATCHED),
    refund payout proof, expense maker-checker races, transferId replay,
    ledger-to-bank exception report, whole-ledger zero-kobo reconciliation.
    Throwaway school, self-cleaning, refuses production URLs.
12. **Cleanup folded in:** deleted unused `public/home/hero-campus-1200.webp`
    (only the 750 variants are referenced). NOTE: the earlier session note
    calling `scripts/lighthouse-report-summary.mjs` dead was WRONG —
    `.github/workflows/lighthouse.yml:65` uses it; it stays.

**Gates at PR time (actual output):** `npx tsc --noEmit` exit 0 · `npx vitest
run` 115 files / 1587 tests passed · `npm run lint` 0 errors / 119 warnings ·
`npx prettier --check .` clean · `npm run audit:brand` 71 findings / 37 files
(= baseline) · `npm run audit` no blockers, 16 warnings · `check:features`
OK (32 cited ids resolve) · `check:orphans` 94 pages reachable ·
`check:dead-ui` clean · `check:modules` agree · `check:boundary` clean ·
`prisma validate` valid · `npm run build` exit 0 · `verify:finance` +
`check:drift` + migration apply run in CI (no local Postgres — same standing
as `verify:ledger` / `verify:fee-replay`).



### 4r. B-17 — audited academic lifecycle transitions (2026-11-12, branch `arena/50d27962-famex-os`, base `f347f55`)

Implements F7-09 lifecycle reliability without claiming the wider catalogue feature is complete. `lib/student-lifecycle.ts` provides dry-run/commit operations, locked capacity checks, audit rows, lifecycle exception reporting, class transfer, withdrawal, re-entry, elective changes and guardian-contact synchronization. Promotion/repeat remain on the academic promotion service, now guarded for cohort capacity, class drift, per-student decision audit and caller idempotency. Legacy direct class/status mutations are rejected; direct elective writes were removed. Admin class-manager and teacher elective screens review plans before committing; writes require idempotency keys.

**Real-Postgres verification** (`scripts/verify-student-lifecycle.ts`, `npm run verify:student-lifecycle`, added to Schema Drift CI): fixtures span `2025/2026`, `2026/2027` and the next promotion target session; checks transfer without rewriting prior-session history, capacity overflow/refusal, withdrawal and re-entry with login-token revocation, promotion vs repeat decisions from compiled annual results, elective dry-run/commit, and decision/audit records. Script is destructive only to its uniquely named synthetic school and self-cleans. The local sandbox cannot fetch Prisma's native engine from `binaries.prisma.sh`; **the verifier passed against CI's real Postgres 17 service** in run `43156704166` (Schema Drift job `130978206447`).

**Local gates at this handoff edit:** typecheck 0; Vitest **116 files / 1,597 tests passed** (including two mobile suites after `npm ci --ignore-scripts --prefix mobile`); lint passes; Prettier clean; `check:modules` passes (23 declared/used modules; 32 owned admin API dirs, 82 guards); boundary/features/orphans/dead-ui/tenant coverage pass; brand audit remains at baseline **71 / 37**; project audit has zero blockers and 16 existing warnings; production build exits 0 with a stubbed Prisma engine (initialization warnings are expected; this is not runtime DB proof). Real lifecycle integration passed in CI; all 9 PR #43 checks passed: Lint & Type Check, Schema Drift, Mobile (Expo), Browser E2E, Build, Load test, Lighthouse CI, Vercel and Vercel Preview Comments. Run `43156704166` also ran all legacy DB verifiers green; Lighthouse run `43156704146` passed (home LCP median 3964ms, admissions 3617ms).

**Founder follow-up request (not completed by B-17):** audit and close the cross-role source-of-truth/UI-feedback gaps. Acceptance: admin, tutor, student progress, marks/scores, exam duration/questions/attempt scoring and report cards read/write only through authenticated, role-ordered server APIs; teacher-uploaded exam questions reach the correct students and scoring is server-authoritative; duration and question sets are server-derived; report-card displays use stored/released backend data; every mutation provides loading/disabled states and contextual success/error toasts. Preserve offline-first marks/exams and the existing E2E contracts. This is a separate, broad feature sweep — do not claim it is completed merely because routes exist or static UI audits pass. Current `check:tenant-coverage` reports the established 14-route uncovered baseline; review those routes during that sweep. Existing targeted foundations include F4-04/F4-12 question lifecycle, F6-01/F6-02 scoring, F7-01..F7-04 results/report cards, and `lib/exams.ts` duration rules.

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

- User impersonation remains stripped. Founder direction supersedes the F0-27 console strip: Super Admin is a distinct DevOps role for this single-school Famex deployment, with the same in-school ADMIN access as Director plus a separate operational dashboard. No EDUos surface, school switching, cross-school operations, or impersonation.
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

### Single-school + learning/deployment decisions (2026-10-21)

- **FIS is one personalised school, not a multi-tenant product.** Runtime code resolves only the configured school through `lib/school-resolution.ts`; hostnames/subdomains never switch schools and there is no platform school-signup/provisioning surface. `schoolId`/RLS remain internal integrity guardrails, not tenancy UX. If the configured slug is absent and multiple school rows exist, resolution returns no school rather than guessing.
- **OCI is production; Vercel is staging/preview.** Never point both at the same production database or treat both as live writers. Vercel gets a separate staging database, staging-only secrets, test payment keys, and seeded accounts only there. Write-heavy Playwright journeys run in CI or Vercel staging, never production.
- **Assignments:** teacher authority comes from an active class+subject teaching assignment; student authority comes from their current class. Published work accepts late submissions until closed and flags them late; graded work is locked unless explicitly returned. Attachment support in this slice is a credential-free HTTPS link, not binary upload.
- **Live classes:** the meeting URL is a secret until join. Student lists omit it; only the audited in-window join endpoint returns it. A `VirtualClassJoin` proves launch intent from FIS, never provider admission, attention, or duration — reports and UI must keep that wording.

## 8. Landmines & gotchas

- **Do not put `/*` inside a `//` line comment in `middleware.ts`** — `tests/lib/cors-response-headers.test.ts` strips comments naively and an unterminated `/*` swallows code, faking a CORS regression. (Bit us once; fixed by rewording.)
- `signup` rate-limit kind has zero consumers but is pinned by `tests/lib/rate-limit-fail-closed.test.ts` — don't remove without editing that test.
- **E2E login budget:** `/api/auth/login` stays at 10 attempts/15min/IP for tests on purpose — never weaken the limiter to make a spec convenient. Specs must use `useSession()`/`apiLogin()` (cached, and since 2026-11-08 persisted under `test-results/` so worker restarts cost zero logins); `loginViaForm` is for the login journey only; the limiter-burning spec must sort last (`zz-rate-limit.spec.ts`). `tests/lib/e2e-login-budget.test.ts` guards all three. Adding many new E2E specs? Check the real-login count first.
- **Mobile CI / expo-doctor:** pinned to `1.21.6` in ci.yml — never float it back to `@latest` (a floating third-party validator silently redefined the gate on 2026-10-23). The ReactNativeDirectoryCheck is disabled in `mobile/package.json` because its transport (`reactnative.directory/api`) fails from GitHub runners; the dataset itself was verified clean by hand (see `docs/RELEASE-GOVERNANCE.md` §3 for the re-enable step at the next Expo SDK upgrade — the same upgrade that fixes the `decode-uri-component` audit exclusion, dated 2027-01-08). `tests/lib/release-path.test.ts` guards the pairing.
- **OCI deploys:** migrations run in the one-shot `migrate` compose service, NOT at app boot (`MIGRATE_ON_BOOT=false`); pin digests with `deploy/oci/pin-image.sh --all --write` before `./deploy.sh` — a mutable-tag deploy is printed as `pinned: 0 (MUTABLE TAG)` on purpose. The notification sidecar must keep `Authorization: Bearer` (the route 401s anything else) and log every tick — `docker compose logs cron | grep FAILED` is the drill check.
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
- **W2 migration is unapplied locally** (`20261014090000_w2_school_stages_and_settings`): 2 enums, `SchoolClass.stage` + backfill, `School.settings`, `StageConfig`, `GradeBand`, and **RLS (`eduos_apply_tenant_rls`) on both new tables** — the 2026-08 policy backfill only covers tables that existed then, so every new `schoolId` table needs the explicit call or `verify:rls:coverage` fails the build (it caught this on the first CI run of the PR). Re-run `PRISMA_*` stub generate after any schema change (recipe in §6).
- **Deployment secrets never transit chat or Git.** OCI values live only in `/opt/famex/.env` on the VM; Vercel staging values live only in the Vercel project settings. If a session lacks OCI/Vercel tokens, prepare the repo/runbook and state the owner-console step plainly — do not invent a live URL or ask for credentials. This also bans "helpfully" setting a user-supplied `DATABASE_URL` through the Vercel connector (`update_env_var` would transit the secret through the conversation).
- **Degraded-DB rendering stays narrow on purpose (§4l):** `isDatabaseInfrastructureError` accepts ONLY `PrismaClientInitializationError` + `P2021`/`P2022`. Never widen it to "any Prisma error" — degradation must not mask application bugs or fake an empty state over a broken write path. `databaseError` text is for logs only, never rendered (may contain connection details). `app/error.tsx` must never emit `<html>/<body>` (route boundaries render inside the root layout; only `app/global-error.tsx` emits the document — a latent nested-`<html>` bug was fixed there in §4l).

---

## 9. Next session: backend-source-of-truth + UX sweep (B-17 complete)

**Current stop-point (2026-11-12, branch `arena/50d27962-famex-os`, base `f347f55`):** B-17 is committed (`46d7e2e`), pushed, PR #43 is open, and all 9 required PR checks are green. The real-Postgres verifier passed in CI; no deployment or merge has occurred. Next, continue with the founder-requested admin/tutor/student/exam/report-card backend synchronization and toast UX as a separate feature slice; acceptance is recorded in §4r. Preserve the current green PR record and do not merge without owner direction. The following older deployment notes remain operational context, not the current workstream.

**Historical Vercel degradation stop-point (2026-11-09, branch `arena/a6b381c5-famex-os`, base `c0a2fd9`):**
The founder's "UI not showing on Vercel" report had TWO stacked walls, both now fixed in code:
(§4l) the root layout crashed every route on the placeholder `DATABASE_URL` — fixed with honest
degraded rendering + banner; and (§4m) the server never even started, because boot-time env
validation treated `NEXT_PUBLIC_SITE_URL` + Paystack keys as fatal in `NODE_ENV=production`,
which Vercel staging is — fixed via `lib/site-url.ts` + the demoted Paystack requirement. After
this branch merges, Vercel production serves HTTP 200: branded shell + "Setup incomplete —
database not connected" banner until the real staging DB lands. Gates all green (vitest **112
files / 1417 tests**; first-ever local runtime proof via `next start` + curl, §4m). Committed,
pushed, PR'd to `main`. The previous session's release-path verification also closed out: main CI
run `42538162353` all-success; **Docker Publish run `42538539358` SUCCESS → `ghcr.io/teamthy/famex-os:main`
+ `:latest` published** (first ever; digest is resolved VM-side by `pin-image.sh` — the sandbox
token lacks `read:packages`). Evidence posted as PR #19 comments. **Do not deploy anything to
production yet** — the §4h certification is still NO-GO until the roadmap's remaining P0s close
and a successor commit is recertified.

**2026-11-10 addendum:** the public home redesign (§4n) landed on this branch lineage — twelve
sections, four-image hero carousel, editorial paper palette, Ykay-era home components deleted.
The **portal/admin reskin is a separate workstream** (founder to schedule); the other public
pages (about, academics, admissions…) keep the existing shell until then. Since then Phase 2 /
B-06 (role×page×API entitlement matrix) MERGED (PR #40, `e56c9a6`, §4o, Vercel production
READY), and Phase 3 finance integrity opened: **B-04** (fee-payment replay binding + offline
review lifecycle + provider reversals) MERGED as PR #41 → main `9eb558a` (Vercel production
READY/PROMOTED, `dpl_wsH3AAcwzc2TweMTmrQuw8sccLQf`), and B-16 (finance lifecycle controls —
DocumentSequence numbering, expense maker-checker, per-reference settlement claims, refund
payout proof, admin receipts, due-date fee locks) is merged in PR #42 at `f347f55`. B-17
academic lifecycle transitions are implemented and verified on the current branch; PR #43 is
open. The broad backend-source-of-truth and toast UX sweep follows as a separate slice.

**Owner actions — the ACTUAL Vercel fix (agent cannot and must not do these):**

1. Provision a staging Postgres near `iad1` and replace `DATABASE_URL` in the Vercel dashboard
   (Settings → Environment Variables → `famex-os`). **Never paste the URL into chat or let an
   agent set it** — §8 secrets rule; the Vercel connector's `update_env_var` would transit the
   secret through the conversation. Redeploy after changing it. (`NEXT_PUBLIC_SITE_URL` is NO
   longer required for boot — the platform supplies its own URL, §4m — but setting it remains
   recommended for a stable canonical URL; Paystack keys only when payments go live.)
2. From a trusted shell: `DATABASE_URL="$STAGING_DIRECT_URL" npx prisma migrate deploy` then
   `SEED_PASSWORD="…" npx tsx prisma/seed-all.ts` (full runbook: `docs/HOSTING-DECISION-2K-USERS.md` §9
   steps 3–5). Verify `/api/health/ready` reports `database: up`, `migrations.pending: 0`
   (`storage: down` on Vercel is expected — §3.1).
3. Deployment Protection (SSO wall on every `*.vercel.app` URL) is ON — the right default while
   the DB is a placeholder. Owner decision when testers/staff need access: keep it (they sign in
   with Vercel accounts) or adjust in the dashboard.
4. Until the DB exists: the banner on public pages is BY DESIGN, and the Vercel cron
   (`/api/jobs/dispatch-notifications`, daily 08:00) will report failures — expected noise, not
   a new bug.

**Dependabot triage (four PRs opened within a minute of the #19 merge):**

- **PR #36 `typescript` 5.9.3 → 7.0.2 (major): its Vercel preview build ERRORED**
  (`dpl_FDVNdFAstu5yJmB2189GBz1vfWRh`). TS 7 is the native-preview rewrite line — do NOT merge
  without a dedicated evaluation slice; recommend closing or holding.
- PR #35 `jose` 5.10.0 → 6.2.15 (major, auth-critical): preview built READY; review the
  breaking-change notes against `lib/session.ts`/`lib/mfa/*` in its own slice.
- Docker `node:20-alpine` → `26-alpine`: OCI-side decision; note Vercel builds use `engines`
  22.x regardless of the project's 26.x setting (build-log warning confirms).
- github-actions grouped PR: routine; merge when CI is green.

**Then the next slice (roadmap order):**

1. **Phase 2 (identity/RBAC/provisioning)** — ✅ DONE: B-06 role×page×API entitlement
   matrix merged as PR #40 (§4o): `lib/rbac/entitlements.ts` owns homes/groups/areas,
   middleware+login delegate, nav mirrors the API surface, 101 parameterized guards.
2. **Phase 3 (finance integrity)** — B-04 fee-payment replay binding ✅ MERGED (§4p, PR
   #41 → `9eb558a`): attempt-first state machine, exact-binding replay, guarded atomic
   transitions, offline review completion/rejection, provider refund/chargeback reversals
   with `providerEventId` idempotency, `verify:fee-replay` CI gate. B-16 finance lifecycle
   ✅ MERGED (§4q, PR #42 → `f347f55`): DocumentSequence numbering, zero-total guards, cash
   reference rules, expense maker-checker, mandatory + replay-guarded credit transfers,
   per-reference settlement claims, refund payout proof, admin receipt issuance, due-date
   fee locks, `verify:finance` CI gate. **B-17 academic lifecycle transitions are complete
   in PR #43** (audited service, dry-runs, capacity enforcement, promotion/repeat,
   transfer/withdrawal/re-entry/electives, real-Postgres CI verifier across sessions).
   Next: founder-requested backend-source-of-truth + toast UX sweep (§4r), scoped as a
   separate feature slice.
3. **Owner reminders (not agent work, listed in `docs/RELEASE-GOVERNANCE.md` §2):** protect
   `main` (7 named required checks), enable Dependabot alerts + code/secret scanning, create
   the `production` environment (then a one-line PR wires it into docker-publish), B-12 DB
   role split on the VM, secrets rotation — plus the Vercel staging database bring-up above
   (`docs/HOSTING-DECISION-2K-USERS.md` §9). B-09's VM drill (queue a notification, watch one
   tick, `logs cron | grep FAILED`) happens at first staging bring-up (B-10).

W3 close-out below stays parked behind the audit roadmap (founder-approved order: remediation
first).

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
5. Then the standing workstreams in board order (W5 depth, W7 item analysis @15k, W9 lesson
   notes/schemes + binary assignment uploads if the school requires files rather than HTTPS
   links, W10 payroll, W12 CMS/NDPA) — real backends, never stubs. Library/inventory/
   clinic still persist to JSON (`lib/module-store.ts`) and need real DB models before go-live claims.

Rules for whoever continues: post through `lib/ledger-postings.ts`, never `postJournal` directly
from a route; every new posting gets a deterministic idempotency key; corrections are counter-entries.
Cite feature IDs in commits and update §3/§4/§5/§7/§9 here in the same PR.

## 10. Reference nav & founder scope

Full grouped nav table, de-AI labels, virtual-class system, pre-school→SS3 breakage audit, and alumni 5-year rule live in **`docs/famex/10-scope-additions.md`**. Build pages in workstream order with real backends + tests; never stub.

---

## 11. Founder direction — Super Admin for single-school Famex (F0-03/F0-27)

The founder clarifies that Famex remains a **single-school deployment**; EDUos and multi-tenant school management are not part of the product. Director receives the complete ADMIN permission set within that school. Super Admin is a higher operator for the same school, with full in-school ADMIN access plus the separate DevOps workspace. Super Admin must never be available through school staff provisioning; MFA is expected. Both roles remain subject to module entitlements and existing financial/result controls. Do not add school switching, cross-tenant access, or impersonation.

Current tranche: the append-only `SUPER_ADMIN` enum migration, role/navigation entitlement, Director/Super Admin→ADMIN role matching, and single-school aggregate DevOps overview are implemented. Password-only Super Admin login is refused; bootstrap creates the first account out of band with an immediate TOTP enrollment, encrypted seed, one-time recovery-code hashes and forced password rotation. MFA cannot be disabled in the web settings for this role. The dashboard exposes only redacted operational metadata and offers a single-school failed-notification retry: it requires a reason, transitions only FAILED→PENDING with an optimistic concurrency guard, and records the action in AuditLog in the same transaction. This is not a general deployment-control plane; expand operations only with explicit threat review, server-side guards and audit coverage.

Full procedure and threat boundaries: [`SUPER-ADMIN-OPERATIONS.md`](SUPER-ADMIN-OPERATIONS.md).

**Bootstrap ceremony:** after applying migrations, an operator with secured database access runs `npm run db:bootstrap-super-admin` once with `SUPER_ADMIN_BOOTSTRAP_CONFIRM=CREATE_INITIAL_FAMEX_SUPER_ADMIN`, `SUPER_ADMIN_EMAIL`, `SUPER_ADMIN_NAME`, `SUPER_ADMIN_BOOTSTRAP_OUTPUT` (absolute path outside the repository), and a dedicated `MFA_ENCRYPTION_KEY` (32+ chars). The command refuses an unknown/inactive school, an existing Super Admin, and a duplicate account email; an advisory lock makes concurrent runs single-winner. It writes a one-time setup bundle with mode 0600 containing a random temporary password, TOTP enrollment secret/URI and recovery codes. Transfer it securely, have the operator replace the password on first login, store recovery codes offline, then delete the bundle. Never run this against a real deployment from CI or auto-run it at boot; CI invokes the same CLI only against its isolated disposable Postgres fixture. If the bootstrap does not complete, keep the output file private and inspect the CLI result before retrying; the transaction rolls back user, recovery-code and audit writes together. If a completed bundle is lost after account creation, do not rerun bootstrap or delete audit history: suspend the account and revoke its sessions through a separately reviewed operator recovery procedure. Do not expose a public bootstrap endpoint.

**Validation added:** unit tests cover the MFA-required login boundary and audited single-use retry transition; the Postgres CI job applies the enum migration, runs `verify:grading`, and runs `verify:super-admin` (which invokes the CLI and verifies the stored enum, encrypted TOTP seed, recovery hashes, audit, and one-time refusal). Browser E2E exercises password→TOTP→session, inability to disable MFA, privacy-redacted dashboard data, retry feedback/audit persistence, an offline CBT attempt/replay through server grading, and report-card API/print reads from stored data. Latest local evidence: `npx vitest run --exclude='tests/mobile/**'` passed **115 files / 1591 tests**; typecheck, feature/module/tenant-coverage/brand gates, Prettier and lint (0 errors, 119 warnings) passed. Refreshed CI `43285719993` on `27adec4` passed schema/migration, RLS, admissions, ledger, B-04/B-16/B-17 lifecycle, grading, lint/typecheck/tests, mobile, build and load, but the new Super Admin verifier failed. Follow-up CI `43287582954` on `62b0ce0` also failed that verifier; a synthetic MFA key was added to the verifier parent and the next patch wraps failures with GitHub annotations so the underlying Postgres diagnostic is visible. Its browser job ran 58 passing and exposed a missing default True/False option set in bulk-uploaded questions plus Super Admin login/consent interactions; the unrelated assignment journey was flaky under a cookie-consent overlay. The code now supplies True/False options, performs one real-browser password→MFA login (avoiding an extra rate-limited login), and accepts the consent prompt before privileged actions; the assignment E2E also acknowledges consent. Third refreshed CI `43288965907` on `5a54c12` passed lint/typecheck/tests, mobile, build, load and Lighthouse, but the Super Admin bootstrap child still failed. Browser E2E reached **60 passing**; the final auth test now reads the browser cookie jar, and the next CI run confirms its Super Admin browser journey passes. CI `43290194813` on `9db3417` passed Browser E2E (all 61 tests), lint/typecheck/tests, mobile, build and load; only the real-Postgres bootstrap verifier remains red. Its failure annotation truncates the child-process details before they are visible, so the verifier now emits a single-line, sanitized JSON summary of spawn error/status/stdout/stderr for the next run. Await that diagnostic and fix the root cause before claiming completion. This sandbox cannot run DB checks because its native Prisma engine is absent.

## 12. Rules pointer

The 17 rules + banned moves + per-screen acceptance + DoD are in `09-master-build-prompt-go.md` §4/§7/§6/§10. They are non-negotiable. This handoff never overrides them.
