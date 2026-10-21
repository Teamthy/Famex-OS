# Famex OS — Scope Additions & Reference Navigation (W1 addendum)

Captured 2026-10-14 from the founder's reference screenshots + notes. This file is
the build target for the admin shell and the record of scope that arrives AFTER
the base strip (W1). Workstreams still run in the order set by
`09-master-build-prompt-go.md` §5; this file only says WHAT each workstream must
ship and HOW the UI must present it.

---

## 1. Reference admin navigation (grouped, module-driven)

The founder's reference shows a **grouped sidebar** (not the flat list the base
shipped). From W2 the module registry (`School.modules`, F0-17/F0-25) drives this
nav: a group appears only if its module is enabled for the school.

Target groups and sub-items (→ owning workstream). "de-AI label" is the name the
UI will actually show (see §2):

| Group (reference) | de-AI label | Sub-items (→ workstream) |
|---|---|---|
| Home | Home | dashboard (base) |
| AI Learning Hub | Learning Hub | Dashboard, Lessons, Assignments, Students, Reports & Insights (W9) |
| AI Studio | Studio | My Creations, Builder (Academic), Builder (Administrative), Chat Assistant, Usage & Statistics (W8) |
| AI CBT | CBT & Exams | Overview, Examinations & Questions, Exam Computers (offline), Results & Marking, Desktop Application (W7) |
| Fees & Billing | Fees & Billing | Collect Fee, Expenditures, Track Payments, Payment Records, Invoices, Scholarships, Budget Planner, Financial Report, Fee Settings (W3) |
| Marks Entry | Marks Entry | Progress & Reports, Continuous Assessments, Bulk Marks Entry, Gradebook, Early Years (Pre-School), Socio-emotional (W6 + §4) |
| Result Generation | Results | Reports, Term Report, Session Report, Mid-session Report, Student Report, Subject Performance, Broadsheet, Cumulative Broadsheet, Mid-term Report, Early Years Report, Manual Comments, Publish Results, Lock Result, Result Settings, Promotion Preferences (W6) |
| Admissions | Admissions | Overview, Applications, Form Fees, Admitted List, Admission Settings (W5) |
| Front Desk | Front Desk | Dashboard, Visitors, Appointments, Gate Pass, Admission Inquiries, Call Logs, Complaints & Help Desk, Postal & Parcels, Lost & Found (W11) |
| Attendance | Attendance | Student Attendance, Staff Attendance (W5) |
| HR Management | Staff & HR | HR Overview, Employee Directory, Payroll & Salary, Leave Management, Disciplinary Records, Promotions & Career, HR Settings (W10) |
| Parent PRM | Parents | PRM Dashboard, Parent 360 Directory, Complaints & Issues, My Follow-ups, Communication Hub, Parent Feedback, Retention & Reports (W11) |
| Users | Users | Students, Staff, Parents, Alumni, Bulk Update Students (W5/W11 + §5) |
| Communication | Communication | SMS, WhatsApp, Newsletters (W4) |
| Documents | Documents | ID Cards, Answer Booklet (OBJ), Answer Booklet (Essay), Offline Score sheet, Offline Attendance Sheet, Credentials Generator (W6/W7) |
| Timetable | Timetable | Class Timetable, Exam Timetable (W5) |
| Help Desk | Help Desk | (W11) |
| School Website | Website | Overview, Site Settings, Content & AI, News & Articles, Our Team, Gallery (W12) |
| Settings | Settings | School Settings, Academic Settings, Result Settings, Fee Settings (W2) |
| Subscriptions | **Licence & Usage** | repurposed in W1 → `/admin/licence` (F20) |

Every sub-item above must map to a real page + server-authoritative backend in
its workstream. Items not yet built render as a disabled row labelled with the
target release — never as a dead link (Rule: no dead UI).

---

## 2. De-AI naming rule (UI must not scream "AI")

The founder: *"I don't want AI AI AI to be obviously littering the UI."*

Adopted convention for ALL nav, headers and buttons:
- Drop the `AI` prefix from group and item names (Learning Hub, Studio, CBT &
  Exams, Results — not "AI Learning Hub", "AI Studio", "AI CBT", "AI Reports").
- Name the capability by what it DOES (Builder, Chat Assistant, Reports), not by
  the technology. The AI provenance lives in the detail screen's footer/badge
  ("generated draft — approve before use", model + cost per Rule 6/§9), not in
  the primary navigation.
- AI output is always a DRAFT awaiting a named human approver (Rule 6); the UI
  shows the approver, never auto-publishes.

---

## 3. Virtual class system (weekend / special sessions) — W9

Real requirement: a teacher can **schedule a virtual class** and assign its
HTTPS meeting URL; students in that class join through FIS. The meeting URL is
omitted from student lists and returned only by the audited in-window join
action (F2-05). **Delivered 2026-10-21:** schedule creation, cancel/end,
gated join, and launch capture. Recordings and offline lesson download remain
separate W9 items. A launch record proves the student opened the meeting from
FIS, not provider admission or duration. NOT the removed `app/virtual` bridge
(that was the retired YK-Virtual SSO arm) — this is an in-product scheduler.

---

## 4. Full school range: Pre-school → SS3 (not secondary-only)

Famex serves **pre-school / kindergarten / nursery / primary / junior secondary /
senior secondary**. The base is secondary-only; W2 (settings/registry) and W6
(results) must generalise the class + grading model. "Most likely to break":

1. **Class/level model** — `Class`/`ClassLevel` enums assume JSS1–SS3. Need an
   ordered level ladder (EYFS→Primary→JSS→SSS) with stage grouping; migration is
   forward-only (Rule 11).
2. **Grading scheme** — secondary uses numeric/letter grades; EYFS/primary use
   developmental / socio-emotional descriptors (reference shows "Early Years
   (Pre-School)" + "Socio-emotional" marks). Grading must be per-stage, not global.
3. **Report cards / broadsheet** — templates, positions and cumulatives assume a
   subject-per-secondary layout; EYFS reports are narrative + domains. W6 must
   branch report template by stage.
4. **Admissions & fees** — entry points, fee structures and age rules differ per
   stage; fee structures already key by class, but entry-age validation and
   stage-specific fee lines must be added (W5/W3).
5. **Timetable / attendance** — period grids differ (EYFS has no periodised
   timetable); attendance must tolerate half-day / nap schedules.
6. **CBT** — item bank is secondary-aligned (W7); primary/EYFS assessment is
   largely non-CBT, so CBT entitlement should default OFF for early stages.

Audit these six in W2 before any results work; add a `stage` concept to the
schema in one forward-only migration.

---

## 5. Alumni data access — 5-year window after graduation

Former students must be able to retrieve **all their data (results, reports,
documents)** for **five years after graduation**, then it is retired per the
retention schedule (NDPA, §9 children/domain). Ships with Users→Alumni + PRM
(W11): an alumni portal role scoped to their own records, a computed
`dataAvailableUntil = graduationDate + 5y`, and automatic access cut-off +
retention afterwards. Verification (transcript/report requests) stays public via
`/verify` but the self-serve alumni portal is authenticated.

---

## 6. Gate impact

- New nav/groups are gated by `npm run check:modules` (W2) and must keep
  `check:orphans` + `check:dead-ui` green (every item linked or explicitly disabled).
- De-AI renames must not worsen `npm run audit:brand` (they remove literals).
- Every page above cites its feature ID in its PR (enforced by `check:features`).
