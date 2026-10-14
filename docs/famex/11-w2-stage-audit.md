# W2 — Stage & settings audit (Pre-school → SS3)

> Deliverable of **W2** (F0-17, F0-18, F0-22, F0-25) and the written record of
> the audit `docs/famex/10-scope-additions.md` §4 asks for: *"audit these six in
> W2 before any results work; add a `stage` concept to the schema in one
> forward-only migration."*

## 1. What was wrong

The base is a **secondary school** system. Famex runs **pre-school →
kindergarten → nursery → primary → junior secondary → senior secondary**, so six
places were generalised in W2. Each entry: what the base assumed, whether it is
now fixed, and what deliberately remains for W6.

| # | Area | Base assumption | W2 position | Remaining |
|---|---|---|---|---|
| 1 | Class / level model | `SchoolClass.level` is a free string; progression (`LEVEL_PROGRESSION`) knew JSS1→SS3 only, so a KG pupil had no next rung and a Primary 6 pupil "graduated" | **Fixed.** `SchoolStage` enum + `SchoolClass.stage` (backfilled from `level`), a single ordered ladder (`lib/stages.ts`: CRE 0 … SS3 15), and ladder walks (`nextLevelOnLadder`, tested for KG→PRI1 / PRI6→JSS1 / SS3→terminal) now exist | **W5** wires the promotion endpoint onto `nextLevelOnLadder`: today `lib/academic-session.ts` still promotes through the secondary-only `LEVEL_PROGRESSION` map |
| 2 | Grading scheme | `waecGrade()` hard-codes A1–F9 over 100 for every class; nothing per-stage | **Fixed for configuration.** `StageConfig` (grading mode, scale, pass mark, positions, CBT) + `GradeBand` per stage, seeded with WAEC / primary letters / early-years descriptors; bands are validated to cover the scale with no gaps | W6 consumes the bands in report computation (today only `waecGrade` runs) |
| 3 | Report cards / broadsheet | One subject-per-secondary layout; positions always numeric | **Prepared.** `usesPositions` and `gradingMode` per stage exist and are editable in Result Settings | **W6** must branch templates by stage (narrative + domains for early years) — explicitly not attempted here |
| 4 | Admissions & fees | Entry points, age rules and fee lines assume JSS/SS entry | **Partially prepared.** Classes carry a stage, so fee structures and admission settings can key by stage | **W5/W3**: entry-age validation per stage, stage-specific fee lines |
| 5 | Timetable / attendance | Periodised grids assume secondary periods | **Prepared.** `timetable` module is suggested OFF for an early-years-only school; stages carry a "no CBT" default | **W5** must tolerate half-day / nap schedules |
| 6 | CBT | Item bank is secondary-aligned and every school gets it | **Fixed as entitlement.** `StageConfig.usesCbt` defaults off for early years; the wizard switches the `exams` module off for an early-years-only school | **W7** loads the 15,000-item bank with `schoolId` and per-stage blueprints |

## 2. The one migration

`prisma/migrations/20261014090000_w2_school_stages_and_settings/migration.sql`
(forward-only, rollback note in the file):

1. `SchoolStage` + `GradingMode` enums.
2. `SchoolClass.stage`, **backfilled from `level`** (`CRE/NUR/KG` → early years,
   `PRI[1-6]` → primary, `JSS[1-3]` → junior, `SS[1-3]` → senior; anything else
   keeps the junior-secondary default the base already behaved as) + an index.
3. `School.settings` JSON — the typed settings framework (F0-18).
4. `StageConfig` — one row per stage a school runs.
5. `GradeBand` — per-stage grade bands.
6. **RLS for both new tables** (`eduos_apply_tenant_rls`): the policy backfill
   loops over the tables that existed when it ran, so a table added later is
   uncovered — `verify:rls:coverage` caught exactly that on this PR's first CI
   run, which is the guard working.

No existing school is given stage rows by the migration: defaults are seeded on
first read of a settings screen (`lib/settings.ensureStageConfig`), so a
migration cannot silently configure a school that never opened the screen.

## 3. What W2 shipped against each feature id

| Feature | Where |
|---|---|
| F0-17 — module registry drives nav, routes, entitlements | `lib/module-registry.ts` (pure, 22 keys), `lib/modules.ts` (server reads), `lib/nav.ts` (20 grouped nav groups, 35 live + 77 planned rows), `components/AdminSidebar.tsx` (renders the registry), `scripts/check-modules.ts` (`npm run check:modules`) |
| F0-18 — settings framework | `School.settings` + `lib/settings.ts`, `/admin/settings`, `/admin/settings/academic`, `/admin/settings/results` and their APIs |
| F0-22 — first-run provisioning wizard | `/onboarding` (7 resumable steps) + `POST /api/onboarding/provision` (idempotent per step) |
| F0-25 — feature switches surfaced in Licence & Usage | module switches are editable on `/admin/licence`; the PATCH is audited and refuses unknown keys |
| Rule 13 — auth → role → module | `lib/module-guard.ts`; wired through **36 admin API route files / 56 guard calls across 26 owned API directories** (`npm run check:modules` fails if an owner directory loses its guard) |

## 4. Module keys (the switchboard)

Base kept: `admissions, attendance, fees, gradebook, exams, report_cards, news,
staff_attendance, notifications, expenses, budgets`.
Added in W2 to cover the grouped reference nav: `users, communication,
documents, timetable, learning_hub, studio, hr, parents, front_desk, help_desk,
website`.

Three semantics that are now tested rather than assumed
(`tests/lib/module-registry.test.ts`):

- a key that is **absent** is enabled (a school that never touched the switches
  gets the product, not an empty shell);
- a stored config that names **no** known key is treated as unconfigured, not as
  "everything off";
- an explicit all-off config stays **all off** — the base re-enabled everything,
  so a school could not actually disable CBT.

## 5. Deliberate non-goals (recorded so W6+ does not re-litigate)

- Early-years narrative report templates are **not** built here (W6).
- `GradeBand` rows are written from defaults; the results pipeline still calls
  `waecGrade()`. W6 switches the computation onto the configured bands and
  keeps `waecGrade` as the secondary default.
- Fee structures are not yet stage-keyed (W3), admissions entry-age rules are
  not yet stage-aware (W5).
