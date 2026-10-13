# Famex OS — master build prompt (GO)

This is the operating document: paste §0 into a new agent session or hand this
whole file to a developer, and the work is unambiguous.

---

## §0 — Kickoff (paste-ready)

> You are building **Famex OS**, a school operating system, inside the
> `Teamthy/Famex-OS` repository. It was seeded from the Ykay College EduPortal
> (read-only `upstream`), and it is a **separate product**: Famex, one school,
> one campus, one licence.
>
> Read, in order: `docs/famex/08-feature-catalogue.md` (what gets built — cite
> feature IDs in every commit), this file §2 (what to strip), §3 (verified repo
> facts — do not re-derive them), §4 (the seventeen rules), the workstream you
> are on in §5, then `docs/rebuild/*` for the Ykay-era engineering pack.
>
> Work one workstream at a time, in the order given. Before you say a task is
> done, run the gate block in §8 and paste the actual output. If a gate cannot
> run in your environment, say so explicitly and state what you verified
> instead. Never edit the Ykay repository.

---

## §1 — Mission and product truths

Famex OS runs a Nigerian secondary school of ~3,000 users for five years
without a rewrite. The base gives us authentication, roles, attendance,
gradebook, report cards, Paystack, CBT, a notification spine and an Expo app.
The build adds what the school actually asked for:

1. **A real financial system** — a ledger, not invoices bolted together.
2. **AI where it saves teacher time** — drafting, never deciding.
3. **CBT at national scale** — 15,000 items, blueprint papers, item analysis,
   and an exam centre that survives a dead internet connection.
4. **A student learning space** — courses, assignments, and live classes joined
   from an assigned URL.
5. **A front office** — admissions, front desk, HR, Parent PRM, help desk.
6. **Reach on WhatsApp Business**, with delivery evidence and a known cost.

Product truths that shape almost every decision:

- The connection drops. Power drops. Design for it.
- A parent's phone is usually a ₦-budget Android on 3G.
- Every naira that moves has to be explicable a year later.
- A pupil's data is the most sensitive data in the building.
- The school must be able to run this without us after handover.

---

## §2 — Scope boundary: Ykay College yes, EDUos no

The base repository contains **two products**. We rebuild the school system.

| Artefact | Action | Why |
|---|---|---|
| `components/PlatformLanding.tsx`, `PLATFORM_MODE` branch in `app/page.tsx` | **Strip** | EDUos platform marketing page |
| `app/super-admin/**` + `app/api/super-admin/**` (10 routes) | **Strip** | cross-tenant console: schools, impersonation, forensics |
| `app/signup/**`, `app/api/platform/signup/route.ts`, `prisma/seed-plans.ts`, `Plan`/`PlanTier`/`Subscription` | **Strip** | self-serve tenant signup and SaaS plans |
| `lib/tenant.ts` host/subdomain resolution | **Freeze** | one school, one domain |
| RLS enforcement migrations + `lib/db-rls.ts` policy work | **Freeze** | keep `schoolId` columns and the coverage check as hygiene; add no new policy work |
| `app/it-portal/**`, `app/it-education/**`, `lib/it-education.ts`, IT API routes | **Retire** | Ykay's IT academy — replaced by the AI Learning Hub (F2) |
| `app/virtual/**`, `components/VirtualBridge.tsx` | **Retire** | Ykay Virtual — replaced by in-portal live classes (F2-05) |
| `School.modules` feature switches | **Keep and extend** | how a school's modules drive nav and entitlements (F0-17, F0-25) |
| `Subscriptions` nav item | **Repurpose** | becomes **Licence & Usage** (F20) |

Removing the platform layer saves ≈5 developer-weeks. That time is **held as
schedule contingency**, not re-spent on scope: the planning number stays 67
developer-weeks.

---

## §3 — Verified repo facts (use these; don't re-derive)

| Fact | Value |
|---|---|
| API routes | 142 |
| Pages | 145 (admin 33, teacher ~40, parent 7, student 14, plus portal, staff, cbt, admissions and ~30 public) |
| Prisma models / enums | 67 / 29 |
| Migrations | 32 (forward-only) |
| Test files | 67 |
| CBT bank | 5,483 items (3.1 MB) — the plan is 15,000 |
| Brand literals | 550 findings in 153 files (`npm run audit:brand` baseline) |
| Notification cron | drains 25 jobs per run, **once daily at 08:00** |
| CBT tables | **lack `schoolId`** — a portability gap (F4-08) |
| Geolocation | denied by CSP and pinned by tests (`next.config.ts:22,49`) — GPS clock-in is real work (F10-06) |
| Money | integer kobo everywhere |
| `lib/finance.ts` | 128 lines, invoice-shaped only — the ledger is new (F5-08) |

---

## §4 — The seventeen rules

1. **No brand literals.** Logo, colours, school name and contacts come from
   settings and tokens. `npm run audit:brand` must not get worse.
2. **Money is integer kobo.** No floats, no `parseFloat`, no rounding drift.
3. **Server authority.** Money, marks, results, attendance and release state are
   validated and computed on the server. The client may only ask.
4. **Idempotency on every money and enrolment write.** A double-tap on a slow
   3G connection must charge once.
5. **No random sampling for anything assessable.** Papers come from blueprints;
   questions are never drawn at random in production paths.
6. **AI drafts; humans decide.** No AI output reaches a parent, pupil or
   published result without a named approver recorded.
7. **Minimise and redact child data before any provider call.** The task gets
   the least personal data it can work with.
8. **Offline-first for marks entry, attendance and the exam centre.** A dead
   connection must not lose a lesson's work.
9. **Audit privileged actions; never delete records that matter.** Financial,
   result, attendance and child-safety records are corrected by counter-entry or
   amendment, never removed.
10. **The ledger is the source of truth for money.** Invoices, statements and
    dashboards are projections of it.
11. **Migrations are forward-only**, one per change, with a rollback note.
12. **No `any` in new code.** Strict TypeScript; `unknown` and narrow.
13. **Every route enforces auth, role and module entitlement** — in that order.
14. **Tests come with the change** for money, CBT, attendance and results logic.
15. **The Ykay repository is out of bounds.** `upstream` is read-only; never
    push to it.
16. **WhatsApp template categories are a reviewed decision**, not a developer's
    convenience — see §7.
17. **Performance budget.** Every screen must be usable on 3G and a low-end
    Android; paginate, cache, and never block render on analytics.

---

## §5 — Workstreams in order (entry → exit)

Mid-point estimates total **67 developer-weeks**.

### W1 — Strip EDUos, go single-school, rebrand (1.5 wk)
**Entry:** fresh Famex-OS repo, base imported.
**Exit:** no EDUos surface remains (§2); `Subscriptions` nav shows Licence &
Usage; brand tokens drive name/colour/logo; `audit:brand` baseline re-cut for
Famex; the app boots as a single-school install.

### W2 — Foundations: registry, settings, tokens, provisioning (2 wk)
**Entry:** W1 done.
**Exit:** a new school can be provisioned end to end (session, terms, classes,
subjects, fee structures, staff, grading) via the first-run wizard (F0-22);
`School.modules` drives nav and entitlements (F0-17, F0-25); `npm run
check:modules` passes.

### W3 — Finance: ledger first, then Fees & Billing (7 wk)
**Entry:** W2 done.
**Exit:** every naira posted as a double-entry transaction; invoices, partial
payments, credits, discounts, refunds, transfers and statements all reconcile to
the ledger; bursar dashboard shows collected/outstanding/committed; gateway
reconciliation matches settlement to invoices (F5-08…F5-26).

### W4 — Notification spine + WhatsApp Business (3.5 wk)
**Entry:** W3 done (templates reference money).
**Exit:** WABA registered in Nigeria; utility/marketing/service categories
enforced and reviewed; delivery receipts with automatic fallback to SMS; two-way
replies land in the school inbox; per-message cost visible (F14-05…F14-16).

### W5 — People, admissions, timetable, attendance (4.5 wk)
**Entry:** W2 done.
**Exit:** admissions funnel through offer and enrolment; bulk import; class and
stream management; timetable editor with clash detection; attendance registers
online and offline; **GPS clock in/out live for all users** with a reviewed
CSP change (F10-06) (F8, F9, F13, F16, F10).

### W6 — Academics: marks and results (7 wk)
**Entry:** W5 done.
**Exit:** a full term runs marks → broadsheet → report cards → release, with
configurable templates, positions, cumulatives and transcripts; corrections
after locking are requests with audit; parents see results only after release
(F6, F7).

### W7 — CBT at scale + offline exam centre (7.5 wk)
**Entry:** W6 done.
**Exit:** 15,000 items loaded with `schoolId`, review workflow and audit;
blueprint assembly with per-candidate papers; item analysis; sitting windows;
retake rules; an offline exam centre (LAN) that marks locally and syncs later;
exam-lab device management (F4-07…F4-25).

### W8 — AI layer (6 wk)
**Entry:** W3 and W6 done (money and results data exist to ground the prompts).
**Exit:** 34 templates in the registry; provider router with failover; metering
and caps enforced per role; every AI action lands in the drafts queue for human
approval; redaction active; usage dashboard live (F3, F1-05, F7-12, F6-09).

### W9 — E-learning and live classes (7 wk)
**Entry:** W8 done for the AI tutor; W5 for timetables.
**Exit:** courses, lessons, assignments and quizzes run in-portal; **live
classes join from an assigned URL, host link never exposed**; attendance
recorded automatically; recordings available; offline lesson download works;
quiz results can post to the gradebook (F2).

### W10 — HR and payroll (7 wk)
**Entry:** W3 ledger and W5 attendance done; **payroll starts only after one
settled term** of clean attendance and ledger data.
**Exit:** staff files, contracts, leave, appraisal, training, disciplinary and
recruitment run in-portal; payroll runs produce payslips and statutory schedules
(F11).

### W11 — Parent PRM, Front Desk, Help Desk (7 wk)
**Entry:** W4 messaging and W5 admissions done.
**Exit:** household profiles, preference centre, engagement flags, meeting
booking, consent management; front desk visitors, appointments, gate pass with
child-safety retention; help desk tickets with SLAs and a knowledge base
(F12, F9, F17).

### W12 — Website CMS, Licence & Usage, hardening, go-live (7 wk)
**Entry:** all above.
**Exit:** the website is editable without a developer, with a custom domain;
licence and usage visible; load test at 3,000 users passes; backup and restore
rehearsed; NDPA pack and DPIA signed; staff trained; UAT signed off (F18, F20,
F22, F23).

---

## §6 — Per-screen acceptance criteria

Every screen in `08-feature-catalogue.md` must satisfy all of these before it
counts as delivered:

1. **Role-correct.** A user sees only what their role and module entitlement
   allow — verified by loading it as the wrong role.
2. **Empty, loading, error and offline states** exist and say something useful.
3. **Mobile usable** at 360px wide, on a slow connection.
4. **Server-authoritative** for anything that changes money, marks, results or
   attendance.
5. **Audited** if privileged, with a test asserting the audit row.
6. **Rebrand-clean**: no hard-coded school name, colour or logo.
7. **Accessible**: keyboard reachable, labelled controls, contrast checked.
8. **Documented** with its feature ID in the PR description.

---

## §7 — Anti-patterns: banned moves

| Banned | Why |
|---|---|
| Sending fee reminders as **marketing** WhatsApp templates | 7.7× the cost ($0.0516 vs $0.0067) — roughly ₦390,000/year burned at this volume |
| Calculating money in floats, or "fixing it in the view" | the ledger stops reconciling, and nobody trusts it again |
| Auto-publishing AI remarks, results or messages | a child's record must have a human accountable for the words in it |
| Drawing exam questions at random in production | unreproducible papers, no blueprint, no defensibility |
| Deleting a financial or result record to "correct" it | audit trail lost; use counter-entry or amendment |
| Trusting the client's total, position or fee balance | the fastest route to a fraud incident |
| Adding a new module without a `School.modules` entry | nav, entitlement and licence drift apart |
| Blocking a page render on analytics or AI | teachers on 3G will abandon the screen |
| Pushing to `upstream` (Ykay) | it is a read-only reference; the products are separate |

---

## §8 — Verification gates (run before every PR is merged)

```bash
npm run typecheck                # strict TS, no `any` in new code
npm test                         # Vitest — unit/integration
npm run lint                     # ESLint (warnings reviewed, not ignored)
npm run audit:brand              # no NEW brand literals (burns to --strict)
npm run check:orphans            # no unreachable pages
npm run check:modules            # (once W2 lands) nav ↔ route ↔ entitlement agree
npm run check:tenant-coverage    # app-level schoolId filtering intact
npm run check:features           # docs/famex/08 totals still match its rows
npm run check:readiness          # term-boundary readiness (before each term)
npm run cost:model -- --breakdown   # when touching cost-affecting code
npx playwright test              # e2e for the flows you touched
```

Rule: **paste the actual output in the PR description.** "Tests pass" without
output is not evidence. If a gate cannot run in your environment (e.g. Prisma
engine download blocked), say so explicitly and state what you verified instead.

---

## §9 — The four sensitive domains

**Money.** The ledger is the truth. Every posting has a source document, an
actor and a timestamp. Reversals are counter-entries. A bursar must be able to
explain any balance a year later, from the system alone.

**Children.** Photographs, medical notes, addresses, custody arrangements and
gate-pass records are accessible to the minimum number of roles, retained for a
defined period, and never sent to an AI provider beyond the task's needs.
Consent is captured once (F12-09) and honoured everywhere.

**Exams.** Bank integrity (who drafted, reviewed, approved, retired), paper
reproducibility from blueprints, sitting windows, and an audit trail for every
change. A result, once released, changes only by amendment with a recorded
reason.

**AI and messaging.** Every message the school sends has a category, a price and
a delivery record. Every AI output has a prompt version, a model, a cost, and a
human approver. Nothing goes to a parent that a staff member has not seen.

---

## §10 — Definition of done

1. Every feature in `08-feature-catalogue.md` is delivered or deferred in
   writing, with the deferral noted against its ID.
2. `npm run check:features`, `npm test` and the §8 gates pass in CI.
3. A full term runs end to end with no manual database edits.
4. The money path reconciles to the bank.
5. 15,000 CBT items are loaded, blueprinted and analysable.
6. Parents are reachable on WhatsApp with delivery evidence and a known cost.
7. Live classes run from assigned links with attendance recorded.
8. The load test at 3,000 users passes; backup and restore has been rehearsed.
9. NDPA compliance pack and DPIA are signed; staff are trained.
10. The school holds its own data, its domain and its WhatsApp account — and can
    run the system without us.
