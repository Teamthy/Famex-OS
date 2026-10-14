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

- Repo: `Teamthy/Famex-OS` (origin). W3 base commit: `ca1c10886f50b5c699dd0f0327f3d90606ed7c1f` (main, W1 + W2 merged).
- **Session branch (fixed): `arena/ce3a9b67-famex-os` for W3.** Always work/commit/push here; open PRs from here to `main`. Never create/switch/push other branches. (W1 used `arena/7f29531d-famex-os` → PR #1; W2 used `arena/9abf8aef-famex-os` → PR #2, merge `74f236c`.)
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
| **W3** | Double-entry ledger → Fees & Billing; bursar dashboard; gateway reconciliation | 🟡 **IN PROGRESS (stage A)** — ledger core + posting rules + accrual/settlement/expenditure wiring + trial-balance UI + bursar ledger figures + `verify:ledger` gate. Remaining: discounts, refunds, transfers, plans, cashbook, gateway settlement, ageing, statements, receipts re-brand (see §9) |
| W4 | Notification spine + WhatsApp Business (categories, receipts, cost) | pending |
| W5 | Admissions funnel, classes/streams, timetable, attendance, GPS clock-in | pending |
| W6 | Marks → broadsheet → report cards → release; post-lock corrections | pending |
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

## 5. Gates: commands + latest evidence + blockers

Run from repo root. Latest (**W3 stage A, 2026-10-14**, branch `arena/ce3a9b67-famex-os`):

| Gate | Command | Result (actual output) |
|---|---|---|
| typecheck | `npx tsc --noEmit` | exit 0 — no errors |
| unit/integration | `npx vitest run` | `Test Files 76 passed (76)` / `Tests 898 passed (898)` (W2: 72 / 843; W1: 66 / 779) |
| lint | `npm run lint` | `✖ 96 problems (0 errors, 96 warnings)` — the new ones are `react-hooks/set-state-in-effect` on fetch-on-mount pages, the same pattern as the other ~40 portal pages |
| formatting | `npx prettier --check .` | `All matched files use Prettier code style!` (main: 9 files failing) |
| dep audit | `npm run audit:deps` | `Dependency audit passed.` (4 scoped, dated exclusions unchanged) |
| project audit | `npm run audit` | `No blockers. 14 warning(s).` (main: 1 blocker — `/api/cbt/topics`, `/api/contact`) |
| brand ratchet | `npm run audit:brand` | `Brand audit OK — 464 finding(s) across 148 file(s); baseline allows 464.` |
| feature IDs | `npm run check:features` | OK — `Catalogue: 331 features parsed` / `§25 declares TOTAL 331 — matches.` |
| orphans | `npm run check:orphans` | `All 80 portal pages are reachable.` (scans `lib/` too — the sidebar renders from `lib/nav.ts`) |
| dead UI | `npm run check:dead-ui` | `Checked 87 portal pages.` / `No dead UI found.` |
| modules | `npm run check:modules` | `Nav registry: 20 groups, 36 live items, 77 planned.` / `Modules: 22 declared, 22 used by nav/API.` / `Admin pages: 37 found, 36 linked.` / `Admin API directories: 26 owned, 57 guard calls.` / `Modules, nav and routes agree.` |
| client boundary | `npm run check:boundary` | `Checking 153 client component(s)…` / `No client component reaches a server-only module.` |
| prisma schema | `npx prisma validate` | `The schema at prisma/schema.prisma is valid 🚀` (needs a dummy `DATABASE_URL`) |
| tenant coverage | `npm run check:tenant-coverage` | exit 0 — 13 UNCOVERED, all pre-existing teacher/auth routes; CI's `--max-uncovered 18` still satisfied |
| ledger loop | `npm run verify:ledger` (`scripts/verify-ledger-loop.ts`) | **Blocked locally** (no Postgres). Runs in CI's `schema-drift` job on Postgres 17 — it is the only place the deferred balance trigger and the kobo reconciliation are proved for real |
| DB gates | `check:drift`, migration apply, `verify:rls` + `verify:rls:coverage`, `verify:admissions`, `verify:ledger`, `db:seed*`, `npx playwright test` | **Blocked in the local sandbox** (no Postgres, Prisma engines stubbed → `check:drift` prints `DATABASE_URL is required`). **Run for real by CI on the W3 PR** (Postgres 17 service): "Apply migrations to a clean database", "Assert no schema drift", "Verify RLS tenant isolation", "Verify RLS coverage", "Verify admissions operations loop", "Verify the ledger (money loop)" (new), Build, Browser E2E, Load test, Mobile. W2's CI was green on all of these. `check:readiness` needs a *seeded* school and still has no CI step; apply the migration and seed on deploy before opening a term. |
| Lighthouse budgets | GitHub `Lighthouse budgets` workflow | Red on `main`, on W1's PR and on W2's PR (`Run Lighthouse CI` exits 1, no `.lighthouseci/` report) — pre-existing, not a W2/W3 regression. |

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

## 9. Next session: W3 continued (exact stop-point)

**Where stage A stopped (2026-10-14, PR from `arena/ce3a9b67-famex-os`):** the ledger core, the
posting rules, the accrual/settlement/expenditure wiring, the trial-balance screen, the bursar
ledger figures, the DB trigger and the `verify:ledger` CI gate all landed. What is NOT done is
the rest of F5: nothing yet handles a discount, a refund, a transfer, an instalment plan, a
cashbook, a Paystack settlement, arrears ageing or the financial statements, and receipts are
still branded with the old literals.

**Ledger-posted today:** fee invoices (accrual), completed fee payments (cash/bank settlement:
Paystack, parent card, bank transfer approval, bursar cash), expenditures (spend), opening
balances (helper only — no screen). **Not posted:** everything in the paragraph above.

### The very next edits, in order

1. **Discounts, scholarships and bursaries (F5-12).** Add `FeeDiscount` (schoolId, invoiceId,
   studentProfileId, kind, amountNaira, reason, approvedByUserId, approvedAt) + a posting rule
   DR `discounts` / CR `fees_receivable` with key `fee-discount:<id>`, an approval route
   (`requireModule("fees", [ADMIN, DIRECTOR, BURSAR])`, audited), and invoice re-computation that
   keeps `balanceDue` == `totalAmount − amountPaid − discounts` (assert it in `verify:ledger`).
   The receivable reconciliation in `scripts/verify-ledger-loop.ts` is the test to extend — it
   already compares the ledger against the documents to the kobo.
2. **Refunds and reversals (F5-13).** Refund request → approval → DR `refunds` / CR `cash|bank`,
   key `fee-refund:<id>`; a `FeePayment` that is refunded must be settled by its own counter-entry
   rather than by deleting the payment. Exposure: `FeePayment.status = REFUNDED` exists already.
3. **Overpayments and credit balance (F5-11).** A payment larger than the invoice posts the excess
   to `student_credit` (a LIABILITY — the chart already has 2000). The parent intent route caps at
   `balanceDue` today, so this needs a deliberate "pay extra / carry forward" path, and the credit
   must be spendable against the next term's invoice.
4. **Fee transfers (F5-14)** between pupils/classes: counter-entry on the source invoice, accrual
   onto the target, both under one idempotency key. `/admin/fees/transfers` is live UI today.
5. **Cashbook + bank reconciliation (F5-15)** and **gateway settlement (F5-16)**: a settlement
   posting (DR `bank` / CR `suspense`-style clearing) matched to Paystack payouts, with an
   `unmatched` list. This is where `GATEWAY_SETTLEMENT` gets its first poster.
6. **Arrears ageing (F5-17)** and **financial statements (F5-18)** — both are `trialBalance` +
   `accountStatement` projections (`lib/ledger.ts` already returns per-student lines via
   `LedgerLine.studentProfileId`). Do not compute them from the documents.
7. **Bursar dashboard completeness (F5-19):** committed spend, ageing buckets, drill-downs from
   the ledger cards already on `/admin/finances`.
8. **Receipts (F5-04/F5-22):** re-brand `lib/receipt.ts` (it is in the brand baseline, §7) and add
   the invoice/receipt QR verification route (F5-26) — the QR helper (`lib/qr.ts`) exists.
9. **Go-live data:** `npm run ledger:backfill -- --apply` then opening balances via
   `postOpeningBalance`, then `npm run verify:ledger` against a copy of the seeded database.

Rules for whoever continues: post through `lib/ledger-postings.ts`, never `postJournal` directly
from a route; every new posting gets a deterministic idempotency key; corrections are counter-entries.
Cite feature IDs in commits and update §3/§4c/§5/§7/§9 here in the same PR.

## 10. Reference nav & founder scope

Full grouped nav table, de-AI labels, virtual-class system, pre-school→SS3 breakage audit, and alumni 5-year rule live in **`docs/famex/10-scope-additions.md`**. Build pages in workstream order with real backends + tests; never stub.

---

## 11. Rules pointer

The 17 rules + banned moves + per-screen acceptance + DoD are in `09-master-build-prompt-go.md` §4/§7/§6/§10. They are non-negotiable. This handoff never overrides them.
