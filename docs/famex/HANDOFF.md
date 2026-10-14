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

- Repo: `Teamthy/Famex-OS` (origin). W2 base commit: `72820191a24c1183ac600ed504b3e149da574217` (main, W1 merged).
- **Session branch (fixed): `arena/9abf8aef-famex-os`.** Always work/commit/push here; open PRs from here to `main`. Never create/switch/push other branches. (W1 used `arena/7f29531d-famex-os`, merged as PR #1.)
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
| **W2** | Module registry drives nav/routes/entitlements; settings framework; first-run wizard; `check:modules` | ✅ **implemented — PR open** (branch `arena/9abf8aef-famex-os`, 2026-10-14). Gates green; DB gates environment-blocked and stated in the PR. |
| W3 | Double-entry ledger → Fees & Billing; bursar dashboard; gateway reconciliation | ⬅️ **NEXT** |
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

## 5. Gates: commands + latest evidence + blockers

Run from repo root. Latest (**W2 close, 2026-10-14**, branch `arena/9abf8aef-famex-os`):

| Gate | Command | Result (actual output) |
|---|---|---|
| typecheck | `npx tsc --noEmit` | exit 0 — no errors |
| unit/integration | `npx vitest run` | `Test Files 72 passed (72)` / `Tests 843 passed (843)` (W1: 66 / 779) |
| lint | `npm run lint` | `✖ 95 problems (0 errors, 95 warnings)` — 90 pre-existing; the 5 new ones are `react-hooks/set-state-in-effect` on fetch-on-mount settings pages, the same pattern as the other ~40 portal pages |
| formatting | `npx prettier --check .` | `All matched files use Prettier code style!` (main: 9 files failing) |
| dep audit | `npm run audit:deps` | `Dependency audit passed.` (4 scoped, dated exclusions unchanged) |
| project audit | `npm run audit` | `No blockers. 14 warning(s).` (main: 1 blocker — `/api/cbt/topics`, `/api/contact`) |
| brand ratchet | `npm run audit:brand` | `Brand audit OK — 464 finding(s) across 148 file(s); baseline allows 464.` |
| feature IDs | `npm run check:features` | OK — `Catalogue: 331 features parsed` / `§25 declares TOTAL 331 — matches.` |
| orphans | `npm run check:orphans` | `All 79 portal pages are reachable.` (scans `lib/` too — the sidebar renders from `lib/nav.ts`) |
| dead UI | `npm run check:dead-ui` | `No dead UI found.` |
| modules | `npm run check:modules` | `Nav registry: 20 groups, 35 live items, 77 planned.` / `Modules: 22 declared, 22 used by nav/API.` / `Admin pages: 36 found, 35 linked.` / `Admin API directories: 26 owned, 56 guard calls.` / `Modules, nav and routes agree.` |
| client boundary | `npm run check:boundary` | `Checking 152 client component(s)…` / `No client component reaches a server-only module.` |
| prisma schema | `npx prisma validate` | `The schema at prisma/schema.prisma is valid 🚀` (needs a dummy `DATABASE_URL`) |
| tenant coverage | `npm run check:tenant-coverage` | exit 0 — 13 UNCOVERED, all pre-existing teacher/auth routes; CI's `--max-uncovered 18` still satisfied |
| DB gates | `check:drift`, `check:readiness`, migration apply, seeds, `npx playwright test`, `verify:rls:coverage`, `verify:admissions` | **environment-blocked**: no Postgres in the sandbox and the Prisma engines are stubbed (`check:drift` prints `DATABASE_URL is required`). The W2 migration is **committed, not applied** — apply it on deploy before seeding. |

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
- **`lib/module-registry.ts` must stay prisma-free** and `lib/stages.ts`/`lib/stage-types.ts` must stay `@prisma/client`-free — client components import them; `check:boundary` fails otherwise.
- **W2 migration is unapplied locally** (`20261014090000_w2_school_stages_and_settings`): 2 enums, `SchoolClass.stage` + backfill, `School.settings`, `StageConfig`, `GradeBand`, and **RLS (`eduos_apply_tenant_rls`) on both new tables** — the 2026-08 policy backfill only covers tables that existed then, so a new tenant table needs the explicit call or `verify:rls:coverage` fails the build (it caught this on the first CI run of the PR). Re-run `PRISMA_*` stub generate after any schema change (recipe in §6).

---

## 9. Next session: W3 kickoff (concrete first steps)

Goal: **the ledger first, then Fees & Billing** (09-master-prompt §5 W3): every naira posted
as a double-entry transaction; invoices, partial payments, credits, discounts, refunds,
transfers and statements reconcile to the ledger; bursar dashboard; gateway reconciliation
matches settlement to invoices (F5-08…F5-26).

1. **Read** §2 + this file, then `08-feature-catalogue.md` F5 rows and the §4 money rules
   (`docs/famex/09-master-build-prompt-go.md`: money = integer kobo, Rule 2/3/4/9/10).
2. **Schema (one forward-only migration):** ledger accounts, journals + journal lines
   (amounts in integer kobo, debit/credit legs sum to zero), and a source-document link
   on every posting. Keep `FeeInvoice`/`FeePayment` as documents that POST into the
   ledger — never as the truth (Rule 10).
3. **`lib/ledger.ts`:** `postJournal`, `reverseJournal` (counter-entry only — never delete),
   `accountBalance`, and a reconciling statement builder. Tests ship with it (Rule 14):
   debits = credits, reversal nets to zero, no float arithmetic.
4. **Wire existing money paths into the ledger** — fee payment service
   (`lib/fee-payment-service.ts`), cash/transfer review
   (`app/api/admin/fees/payments/route.ts`), expenses (`app/api/admin/expenses/route.ts`),
   budgets stay projections only. Keep the idempotency keys intact (Rule 4).
5. **Bursar dashboard** (F5) + `requireModule("fees", [ADMIN, DIRECTOR, BURSAR])` on the new
   routes; add any new admin API dir to `API_OWNERS`, any new page to `lib/nav.ts`
   (`Marks`-style `planned` rows get their release badges updated as they ship).
6. **Receipts are money documents** — re-brand `lib/receipt.ts` in this workstream (it is in
   the brand baseline today, see §7).
7. **Gate block (§8) + paste output**, update §3/§4/§5/§7/§9 here, commit on
   `arena/<this session>` and open the PR.

Stop-points to record if mid-way: migration name, which money paths are ledger-posted,
which reconcile test exists.

## 10. Reference nav & founder scope

Full grouped nav table, de-AI labels, virtual-class system, pre-school→SS3 breakage audit, and alumni 5-year rule live in **`docs/famex/10-scope-additions.md`**. Build pages in workstream order with real backends + tests; never stub.

---

## 11. Rules pointer

The 17 rules + banned moves + per-screen acceptance + DoD are in `09-master-build-prompt-go.md` §4/§7/§6/§10. They are non-negotiable. This handoff never overrides them.
