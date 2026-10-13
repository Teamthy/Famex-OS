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

- Repo: `Teamthy/Famex-OS` (origin). Base commit: `dd583ed44b619a8bd2ef7ec083206450abd54fd4` (main).
- **Session branch (fixed): `arena/7f29531d-famex-os`.** Always work/commit/push here; open PRs from here to `main`. Never create/switch/push other branches.
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
| **W1** | Strip EDUos platform + Ykay arms; single-school boot; brand tokens; Licence & Usage; re-cut audit | ✅ **DONE** — commit `a9451cd`, **PR #1 OPEN** (not merged) |
| **W2** | Module registry drives nav/routes/entitlements; settings framework; first-run wizard; `check:modules` | ⬅️ **NEXT** |
| W3 | Double-entry ledger → Fees & Billing; bursar dashboard; gateway reconciliation | pending |
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

## 4. What W1 delivered (commit `a9451cd`, PR #1)

- **Platform strip (F0-26/27/28/30):** deleted `app/super-admin/**` + its 10 API routes (impersonation, broadcast, cross-school console), `app/signup/**` + `/api/platform/signup`, `Plan/PlanTier/Subscription` models + `seed-plans.ts`. Boot no longer seeds a super-admin; first ADMIN comes from `npm run db:seed` (`prisma/seed-all.ts`), then the W2 wizard. `app/page.tsx` boots to the school home (PlatformLanding + PLATFORM_MODE gone).
- **Ykay arms retired (F0-29):** deleted `app/it-portal/**`, `app/it-education/**`, `lib/it-education.ts`, IT API routes, IT cert PDF, `it_education` module key, IT seeds/nav/stats; deleted `app/virtual/**` + `VirtualBridge` (YK-Virtual SSO bridge).
- **Single-school identity (F0-21/23):** `lib/brand.ts` tokens (`PRODUCT_NAME="Famex OS"`, `getSchoolBrandTokens()`) drive name/colour/logo/site across `app/layout.tsx` (generateMetadata + JSON-LD), `Header`, `Footer`, `AdminSidebar`, student/admin ID cards, report-card PDF. `SchoolProfileContext` now carries `{name, address, phone, email}`. Neutral assets `public/logo.png` + `logo-280.webp` (old `ykay-logo*`, `logo-ykay.svg`, `it-education-hero.jpg` git-removed). Token-driven `app/manifest.ts`, `app/sitemap.ts`, `app/robots.ts` replaced brand-hardcoded statics (statics git-removed). `.env.example` re-cut (dead platform vars removed).
- **Tenant freeze (F0-15 kept):** `lib/tenant.ts` + RLS untouched (schoolId hygiene retained); `lib/modules.ts` cleaned of `it_education`.
- **Subscriptions → Licence & Usage (F20-01):** `app/admin/licence/page.tsx` (client) + role-guarded `app/api/admin/licence/route.ts` (ADMIN/DIRECTOR) show licence identity, `School.modules` switches, honest unmetered usage, integration config.
- **New gates:** `scripts/audit-brand.ts` (+ `scripts/brand-baseline.json` ratchet) → `npm run audit:brand`; `scripts/check-features.ts` → `npm run check:features`.
- **Docs:** `docs/famex/10-scope-additions.md` (founder scope), README retitled to Famex OS.

---

## 5. Gates: commands + latest evidence + blockers

Run from repo root. Latest (W1 close, 2026-10-14):

| Gate | Command | Result |
|---|---|---|
| typecheck | `npm run typecheck` | exit 0 |
| unit/integration | `npx vitest run --exclude "tests/e2e/**"` | 66 files / 779 tests, 0 failed |
| lint | `npm run lint` | 0 errors (90 pre-existing warnings) |
| brand ratchet | `npm run audit:brand` | OK — 474 findings / 152 files (= baseline) |
| feature IDs | `npm run check:features` | OK — 331 features; §25 totals match; cited IDs resolve |
| orphans | `npm run check:orphans` | All 76 portal pages reachable |
| dead UI | `npm run check:dead-ui` | clean |
| modules | `npm run check:modules` | **does not exist yet — created in W2** |
| DB gates | `check:readiness`, `check:tenant-coverage`, `npx playwright test`, migration apply | **environment-blocked** (no Postgres; Prisma engines stubbed). State this in every PR. |

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

---

## 8. Landmines & gotchas

- **Do not put `/*` inside a `//` line comment in `middleware.ts`** — `tests/lib/cors-response-headers.test.ts` strips comments naively and an unterminated `/*` swallows code, faking a CORS regression. (Bit us once; fixed by rewording.)
- `signup` rate-limit kind has zero consumers but is pinned by `tests/lib/rate-limit-fail-closed.test.ts` — don't remove without editing that test.
- New pages must be linked somewhere or `check:orphans` fails; non-functional nav rows must be disabled/labelled, never dead links (`check:dead-ui`).
- Money = integer kobo, no floats/parseFloat (Rule 2). Server-authoritative for money/marks/results/attendance (Rule 3). Idempotency keys on money+enrolment writes (Rule 4). No random sampling for assessable things (Rule 5).
- Every route: auth → role → module entitlement, in that order (Rule 13). Tests ship with money/CBT/attendance/results logic (Rule 14). No `any` in new code (Rule 12).
- `check:features` citation regex requires **two-digit feature numbers** (`F5-04`); hex classes like `[A-F0-9]` must not false-match.

---

## 9. Next session: W2 kickoff (concrete first steps)

Goal: `School.modules` drives nav + route guards + entitlements; settings framework; first-run provisioning wizard; `npm run check:modules` passes.

1. **Extend `lib/modules.ts`** into the full registry: keep `MODULE_KEYS`/`getEnabledModules`/`isModuleEnabled`; add a NAV map keyed by module → the grouped structure in `10-scope-additions.md` §1 (de-AI labels). Each group lists sub-items with `{label, href, moduleKey, release}`.
2. **Rebuild `components/AdminSidebar.tsx`** to render groups from the registry: show a group only if its module is enabled; link sub-items whose page exists; render not-yet-built sub-items as **disabled rows with the target release** (never dead links). Map every EXISTING admin page into a group first so nothing becomes an orphan.
3. **Route-guard helper**: a server-side `requireModule(moduleKey)` used by admin API routes (auth → role → module, Rule 13).
4. **Settings framework (F0-18)**: single source for school profile / academic session / terms / grading; add a `stage` concept (EYFS→Primary→JSS→SSS) in ONE forward-only migration (10-scope-additions §4) before any results work.
5. **First-run wizard (F0-22)**: build on `/onboarding`; provision first ADMIN + school profile + modules.
6. **Add `scripts/check-modules.ts`** → `npm run check:modules`: every nav href resolves to a page or is marked future; every module key used by a route exists in the registry.
7. Gates green → **update this handoff** → commit → push → update/open PR.

Stop-points to record if mid-way: which groups are migrated, which guard is wired, migration name created.

---

## 10. Reference nav & founder scope

Full grouped nav table, de-AI labels, virtual-class system, pre-school→SS3 breakage audit, and alumni 5-year rule live in **`docs/famex/10-scope-additions.md`**. Build pages in workstream order with real backends + tests; never stub.

---

## 11. Rules pointer

The 17 rules + banned moves + per-screen acceptance + DoD are in `09-master-build-prompt-go.md` §4/§7/§6/§10. They are non-negotiable. This handoff never overrides them.
