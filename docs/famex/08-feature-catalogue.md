# Complete feature catalogue

Every feature Famex OS will have, as a single referenceable list. Use the IDs in
tickets, PR titles and QA scripts (`F5-04` = module 5, feature 4).

**Tags** — what has to happen for each feature:

| Tag | Meaning |
|---|---|
| ✅ | **In the base today** — works; rebrand/wire only |
| 🔧 | **Extend** — base exists, real new work needed |
| 🆕 | **New build** |
| ✂️ | **Strip** — exists in the base but is EDUos / Ykay-specific; removed |
| ⏸ | **Out of scope** for now (v2 candidates) |

Counts at the end (§25). Scope boundary (Ykay College, *not* EDUos) —
`09-master-build-prompt-go.md` §2.

---

## 0. Foundations — the platform underneath everything

| ID | Feature | Tag | Notes |
|---|---|---|---|
| F0-01 | Email + password login with timing-safe comparison | ✅ | lib/session.ts |
| F0-02 | JWT sessions in httpOnly cookies (web) + Bearer tokens (mobile/API) | ✅ | one session, two transports |
| F0-03 | Role-based access control across 6 roles + sub-roles | ✅ | ADMIN, DIRECTOR, COORDINATOR, BURSAR, TEACHER, HOD, STUDENT, PARENT, IT |
| F0-04 | Password reset by email token, single-use, expiring | ✅ | PasswordResetToken |
| F0-05 | Forced password change on first login | ✅ | mustChangePassword |
| F0-06 | Rate limiting on auth and money endpoints | ✅ | fails closed |
| F0-07 | Session revocation + security-event forensics | ✅ | lib/forensics.ts |
| F0-08 | Audit log for every privileged action | ✅ | who, what, when, from where |
| F0-09 | Idempotency keys on money and enrolment writes | ✅ | lib/idempotency.ts |
| F0-10 | Health endpoint + uptime probe | ✅ | /api/health |
| F0-11 | Environment validation at boot | ✅ | lib/env.ts — refuses to start misconfigured |
| F0-12 | Prisma schema with 67 models and migration history | ✅ | forward-only migrations |
| F0-13 | Money stored as integer kobo, never floats | ✅ | no exceptions |
| F0-14 | Offline-first PWA shell with sync queue | ✅ | lib/offline/* |
| F0-15 | schoolId on business tables + route coverage guard | ✅ | hygiene kept for a future second campus |
| F0-16 | System flags in the database (not env-only) | ✅ | lib/system-flags.ts |
| F0-17 | Module registry: School.modules drives nav, routes and entitlements | 🔧 | base has a first cut; must own every screen |
| F0-18 | Settings framework: school profile, academic session, terms, grading | 🔧 | one source of truth, no scattered config |
| F0-19 | Notification spine: queue, retries, per-channel dispatch | 🔧 | currently 25 jobs per run on a daily 08:00 cron |
| F0-20 | Custom roles and sub-role permissions beyond the six defaults | 🔧 | BURSAR ≠ ADMIN; HOD scoped to a department |
| F0-21 | Design tokens + rebrand pipeline (one place for logo, colour, name) | 🆕 | the rebrand ratchet; no brand literals in code |
| F0-22 | First-run provisioning wizard for a new school | 🆕 | session, terms, classes, subjects, grading, staff |
| F0-23 | Single-school install with clean multi-school seams | 🆕 | schoolId everywhere; tenancy plumbing frozen, not deleted |
| F0-24 | Brand-asset registry (logo, favicon, PWA icons, report-card crest) | 🆕 | upload once, used by web, mobile, PDF, email |
| F0-25 | Feature switches per school surfaced in Licence & Usage | 🆕 | what the school has paid for, visible and enforced |
| F0-26 | Platform landing page + PLATFORM_MODE branch | ✂️ | **EDUos artefact** — components/PlatformLanding.tsx, app/page.tsx |
| F0-27 | Super-admin console (app/super-admin/**, 10 API routes) | ✂️ | **EDUos artefact** — schools, impersonation, cross-tenant forensics |
| F0-28 | Self-serve signup + plan seeding (Plan, PlanTier, Subscription) | ✂️ | **EDUos artefact** — app/signup/**, prisma/seed-plans.ts |
| F0-29 | Tenant resolution by hostname / subdomain | ✂️ | **EDUos artefact** — one school, one domain |
| F0-30 | Row-level-security enforcement + policy migrations | ✂️ | **EDUos artefact** — app-level filtering stays, RLS work is frozen |

## 1. Home

| ID | Feature | Tag | Notes |
|---|---|---|---|
| F1-01 | Role-aware portal home with tiles per permitted module | ✅ | app/*/dashboard |
| F1-02 | Global command search across records and pages | ✅ | components/CommandSearch.tsx |
| F1-03 | Home layout driven by the module registry and role | 🔧 | a school that did not buy HR sees no HR tile |
| F1-04 | Live home widgets: today's timetable, fee status, announcements, tasks | 🔧 | one query per widget, cached |
| F1-05 | "Ask Famex" assistant card on every home screen | 🆕 | AI, scoped to what that role may see |
| F1-06 | Student/parent live-class card with the next class and its join link | 🔧 | student next-class + gated join delivered 2026-10-21; parent card remains — see F2-05 |

## 2. AI Learning Hub

| ID | Feature | Tag | Notes |
|---|---|---|---|
| F2-01 | Hub landing: course catalogue, enrolment, progress at a glance | 🆕 | student, teacher and parent views |
| F2-02 | Course & lesson player: video, notes, attachments, transcript | 🆕 | resumable position per learner |
| F2-03 | Assignments: set, submit, mark, return with feedback | 🔧 | text + HTTPS attachment link, late flag, grading/return delivered 2026-10-21; binary file/photo upload remains |
| F2-04 | Per-lesson quizzes, auto-marked, feeding the gradebook | 🆕 | teacher chooses whether to post to CA |
| F2-05 | **Live virtual classes with an assigned join URL** | ✅ | teacher assigns an HTTPS URL per session; student lists omit it and the audited in-window join records the launch (2026-10-21) |
| F2-06 | Class recording library and replay links | 🆕 | for learners who missed it |
| F2-07 | AI tutor: ask a question about the current lesson | 🆕 | grounded in the lesson material, age-appropriate, logged |
| F2-08 | Study plan, streaks and revision reminders | 🆕 | pushes a learner toward weak topics |
| F2-09 | Offline lesson download and sync | 🆕 | Nigerian bandwidth reality; text + audio first |
| F2-10 | Teacher course builder: modules, lessons, resources, release dates | 🆕 | draft → publish, versioned |

## 3. AI Studio

| ID | Feature | Tag | Notes |
|---|---|---|---|
| F3-01 | Prompt registry: 34 versioned templates, reviewed before release | 🆕 | every AI action in the product is a registered prompt |
| F3-02 | Provider router with failover (cost, latency, availability) | 🆕 | one vendor outage must not stop the school |
| F3-03 | Credit metering, caps and throttles per role and per module | 🆕 | a runaway script must not produce a five-figure bill |
| F3-04 | AI lesson-plan and scheme-of-work generator | 🆕 | teacher edits and owns the output |
| F3-05 | AI question generator that drafts into the CBT bank | 🆕 | **drafts only** — a teacher approves before a question is live |
| F3-06 | AI report-card remark drafting | 🆕 | teacher-approved; never auto-published |
| F3-07 | AI message composer for parents (WhatsApp / SMS / email) | 🆕 | tone and length variants, cost shown before sending |
| F3-08 | AI website and newsletter copywriting | 🆕 | CMS-ready output |
| F3-09 | AI rewrite tools: simplify, expand, formalise, shorten | 🆕 | for staff writing to parents |
| F3-10 | AI document summariser for uploaded files | 🆕 | meeting minutes, policies, circulars |
| F3-11 | AI HR letter drafting (offers, warnings, references) | 🆕 | from templates with placeholders filled |
| F3-12 | AI insight reports: arrears, attendance risk, performance dips | 🆕 | numbers computed in code, prose written by AI |
| F3-13 | Template library UI: browse, preview, clone, restrict by role | 🆕 | who may use which prompt |
| F3-14 | Usage dashboard: spend, credits, by user, by module | 🆕 | the school sees where its AI budget went |
| F3-15 | Redaction and child-data guardrails on every call | 🆕 | no unnecessary personal data leaves the school boundary |
| F3-16 | AI drafts queue: nothing reaches a parent or a pupil unreviewed | 🆕 | human approval is a feature, not a formality |

## 4. AI CBT

| ID | Feature | Tag | Notes |
|---|---|---|---|
| F4-01 | CBT engine: attempts, timing, auto-marking, resume | ✅ | lib/cbt.ts |
| F4-02 | Practice exams (WAEC-style) with instant feedback | ✅ | app/student/waec-practice |
| F4-03 | Timed e-exams with sitting windows and invigilation | ✅ | app/student/e-exams |
| F4-04 | Question bank CRUD with subject/topic taxonomy | ✅ | app/teacher/question-bank |
| F4-05 | Bulk question import (CSV/DOCX parser) | ✅ | lib/question-parser.ts |
| F4-06 | Exam integrity basics: shuffling, one attempt, retake rules | ✅ | lib/exams.ts |
| F4-07 | CBT at 15,000-item scale: indexing, search, pagination | 🔧 | the bank is 5,483 today; the plan is 3× that |
| F4-08 | schoolId + school tagging on CBT tables | 🔧 | CBT tables currently lack it — portability risk |
| F4-09 | **Offline exam centre**: LAN server, local marking, later sync | 🆕 | frees the internet connection as a single point of failure |
| F4-10 | AI question drafting with teacher approval workflow | 🆕 | feeds F3-05 |
| F4-11 | AI distractor check and difficulty estimation | 🆕 | flags questions with no discrimination |
| F4-12 | Question lifecycle: draft → reviewed → live → retired | 🆕 | with reviewers recorded |
| F4-13 | Blueprint exam assembly (topic × difficulty quotas) | 🆕 | a paper that matches the syllabus, not a random draw |
| F4-14 | Randomised paper per candidate from a blueprint | 🆕 | same blueprint, different paper |
| F4-15 | Item analysis: facility and discrimination indices | 🆕 | which questions actually work |
| F4-16 | Candidate result release workflow with windows | 🆕 | nothing visible before the release time |
| F4-17 | Retake and remark rules per exam | 🆕 | audited, capped, never silent |
| F4-18 | Question media: images, diagrams, audio | 🆕 | and alt text |
| F4-19 | Maths/chemistry notation rendering | 🆕 | the bank contains formulas |
| F4-20 | CBT analytics by class, subject, topic, cohort | 🆕 | where teaching needs to go next |
| F4-21 | Full-length mock WAEC/NECO papers | 🆕 | timed, with grading |
| F4-22 | Exam lab device and licence management | 🆕 | which machine, which candidate, which session |
| F4-23 | Paper printing with answer keys and marking schemes | 🆕 | for exams that stay on paper |
| F4-24 | CBT audit trail: who changed what question, when | 🆕 | integrity of the bank itself |
| F4-25 | Accessibility and keyboard-only exam mode | 🆕 | extra time, larger text, screen-reader friendly |

## 5. Fees & Billing

| ID | Feature | Tag | Notes |
|---|---|---|---|
| F5-01 | Fee structures per class, term and category | ✅ | app/admin/fees/structures |
| F5-02 | Bulk invoice generation per term | ✅ | app/admin/fees/generate |
| F5-03 | Paystack collection with verified webhooks | ✅ | lib/paystack.ts |
| F5-04 | Printable receipts | ✅ | components/ReceiptModal.tsx |
| F5-05 | Parent fee view and payment intents | ✅ | app/parent/fees |
| F5-06 | Fee reminders over email and SMS | ✅ | ⚠️ must move off marketing templates — see W4 |
| F5-07 | Expenses and budgets pages | ✅ | app/admin/expenses, app/admin/budgets |
| F5-08 | **Double-entry ledger: accounts, journals, trial balance** | 🔧 | W3 stage A: `lib/ledger.ts` + `LedgerAccount`/`LedgerJournal`/`LedgerLine` + a DB constraint trigger that refuses an unbalanced journal. Wired: invoice accrual, fee payments, expenditures. Remaining: discounts/refunds/transfers postings |
| F5-09 | General-ledger UI and posting rules | 🔧 | W3 stage A: `/admin/finances/ledger` (trial balance, postings, account statement); posting rules in `lib/ledger-postings.ts`. Remaining: manual-adjustment flow with approval |
| F5-10 | Payment plans and instalments | 🔧 | term fees in three parts, tracked |
| F5-11 | Partial payments, overpayments and credit balance | 🔧 | a credit is a liability, not a rounding error |
| F5-12 | Discounts, scholarships and bursaries with approval | 🔧 | who authorised it, and why, forever |
| F5-13 | Refunds and reversals routed through the ledger | 🔧 | never a delete; always a counter-entry |
| F5-14 | Fee transfers between students and classes | 🔧 | app/admin/fees/transfers |
| F5-15 | Cashbook and bank reconciliation | 🆕 | what the bank says vs what the books say |
| F5-16 | Gateway settlement reconciliation | 🆕 | Paystack payouts matched to invoices |
| F5-17 | Arrears aging and a collection workflow | 🆕 | 30/60/90 buckets with a follow-up owner |
| F5-18 | Financial statements: income, position, cashflow | 🆕 | from the ledger, not from a spreadsheet |
| F5-19 | Bursar dashboard | 🆕 | W3 stage A: the finance dashboard now reads cash/bank/receivable/surplus from the ledger and says whether the books balance. Remaining: committed spend, ageing, drill-downs |
| F5-20 | Fee price-change audit trail | 🆕 | why a term cost more than the last one |
| F5-21 | Multi-channel collection: transfer, POS, USSD | 🆕 | cash still walks through the door; record it properly |
| F5-22 | Invoice templates with school branding | 🆕 | and a QR code that verifies the invoice |
| F5-23 | Statutory remittance: PAYE, pension, NHF | 🆕 | schedules prepared for the school's accountant |
| F5-24 | Scholarship and sponsorship register | 🆕 | donor, beneficiary, conditions, expiry |
| F5-25 | Petty cash and imprest | 🆕 | small spends, properly receipted |
| F5-26 | Payment verification for parents (receipt QR lookup) | 🆕 | a parent can prove what they paid |

## 6. Marks Entry

| ID | Feature | Tag | Notes |
|---|---|---|---|
| F6-01 | Gradebook grid per class and subject | ✅ | app/teacher/gradebook |
| F6-02 | CA + exam score entry with configurable weights | ✅ | lib/gradebook.ts |
| F6-03 | Staff assignments → subject and class teachers | ✅ | app/admin/staff-assignments |
| F6-04 | Gradebook locking per term | ✅ | app/admin/gradebook-lock |
| F6-05 | Broadsheet of all subjects × all students | ✅ | app/admin/broadsheet |
| F6-06 | Offline marks entry with a sync queue | ✅ | lib/offline/sync.ts |
| F6-07 | Bulk marks import from Excel/CSV with validation | 🔧 | and a dry-run preview before anything is written |
| F6-08 | Mark correction workflow with audit and approval | 🔧 | after a gradebook is locked, corrections are requests |
| F6-09 | AI anomaly detection on scores (outliers, missing marks) | 🆕 | flags what a human would miss at 3,000 students |
| F6-10 | Competency and behaviour scoring alongside grades | 🆕 | skills, conduct, participation |
| F6-11 | Conflict-free offline mark entry on mobile | 🆕 | two teachers, one class, no lost data |

## 7. Result Generation

| ID | Feature | Tag | Notes |
|---|---|---|---|
| F7-01 | Term report-card generation | ✅ | app/admin/report-cards |
| F7-02 | Automatic grades, totals, averages and positions | ✅ | lib/report-cards.ts |
| F7-03 | Result release control | ✅ | app/api/admin/report-cards/release |
| F7-04 | Parent and student result view | ✅ | app/parent/report-cards |
| F7-05 | Print-ready PDF output | ✅ | lib/branded-pdf.ts |
| F7-06 | Broadsheet → results pipeline | ✅ | one source of truth for marks |
| F7-07 | Custom report-card templates per school | 🔧 | layout, crest, comments block, subject ordering |
| F7-08 | Configurable position and ranking rules | 🔧 | rank a class, a stream or the whole year group |
| F7-09 | Cumulative records and promotion decisions | 🔧 | app/admin/promotion |
| F7-10 | Remark/comment banks for teachers | 🔧 | pick, edit, personalise |
| F7-11 | Public verification pages with QR codes | 🔧 | app/verify/report/[reportNumber] |
| F7-12 | AI remark drafting, teacher-approved | 🆕 | the point of F3-06, inside the workflow |
| F7-13 | Class and subject performance analysis | 🆕 | for the head teacher and the board |
| F7-14 | Cumulative academic transcript | 🆕 | a pupil's whole time at the school, one document |
| F7-15 | Testimonials and attestation letters | 🆕 | generated from the record, signed and verifiable |
| F7-16 | Post-release amendment with full audit | 🆕 | who changed a published result, and why |
| F7-17 | End-of-year promotion letters and next-session packs | 🆕 | for every parent, at once |

## 8. Admissions

| ID | Feature | Tag | Notes |
|---|---|---|---|
| F8-01 | Public application form with autosave drafts | ✅ | components/admissions/AdmissionApplicationForm.tsx |
| F8-02 | Application status lookup | ✅ | app/application-status |
| F8-03 | Document upload with malware scanning | ✅ | lib/malware.ts |
| F8-04 | Application fee payment | ✅ | app/api/admissions/payments/start |
| F8-05 | Admin admissions review queue | ✅ | app/admin-admissions |
| F8-06 | Enrol an applicant into student records | ✅ | app/api/admin/admissions/enroll |
| F8-07 | Paper application intake | ✅ | app/admin-admissions/paper |
| F8-08 | Entrance test and interview scheduling with scoring | 🔧 | slots, panels, results attached to the application |
| F8-09 | Seat capacity, offers, acceptance and waitlist | 🔧 | a stream with five places should not over-offer |
| F8-10 | AI application summariser for reviewers | 🆕 | read 200 applications in the time it took to read 50 |
| F8-11 | Admissions funnel analytics | 🆕 | enquiries → applications → offers → enrolments |
| F8-12 | Sibling and legacy priority rules | 🆕 | applied consistently and visibly |

## 9. Front Desk

| ID | Feature | Tag | Notes |
|---|---|---|---|
| F9-01 | Front desk dashboard (today's visitors, appointments, parcels, open issues) | 🆕 | |
| F9-02 | Visitors: sign-in/out, badge, host, purpose, photo (optional) | 🆕 | |
| F9-03 | Appointments: slots with staff, status, reminders | 🆕 | |
| F9-04 | **Gate Pass**: student exit with who collected them, ID check, authoriser | 🆕 | child-safety record — never deleted |
| F9-05 | Admission inquiries (from the website contact form) | ✅ | ContactEnquiry |
| F9-06 | Call logs: direction, party, summary, follow-up | 🆕 | |
| F9-07 | Complaints & Help Desk queue (shared with F17-*) | 🆕 | |
| F9-08 | Postal & parcels: in/out, recipient, collected-by | 🆕 | |
| F9-09 | Lost & found register | 🆕 | |
| F9-10 | Visitor badge printing | 🆕 | optional |

## 10. Attendance

| ID | Feature | Tag | Notes |
|---|---|---|---|
| F10-01 | Student daily attendance register | ✅ | app/teacher/class/attendance |
| F10-02 | Staff attendance with QR badge check-in | ✅ | lib/staff-attendance.ts |
| F10-03 | Attendance analytics and trends | ✅ | app/admin/attendance-analytics |
| F10-04 | Attendance corrections with audit | ✅ | app/admin/attendance-corrections |
| F10-05 | Parent and student attendance views | ✅ | app/parent/attendance |
| F10-06 | **GPS clock in/out for all users**, with geofence | 🔧 | base is staff-QR only; geolocation is denied by CSP today |
| F10-07 | Offline attendance capture and sync | 🆕 | and a printable fallback register |
| F10-08 | Timetable-linked expected attendance with truancy alerts | 🆕 | a pupil missing period 3 twice in a week is a signal |
| F10-09 | Lateness, overtime and shift rules | 🆕 | for the school's own staff rota |
| F10-10 | Leave and permission requests with approval | 🆕 | planned absence is not the same as absence |
| F10-11 | Automatic absence alerts to parents | 🆕 | before the day is over, over the cheapest channel |
| F10-12 | Exam and event attendance registers | 🆕 | separate from class registers |
| F10-13 | Biometric and gate-hardware integration | ⏸ | v2 — needs hardware and its own budget |
| F10-14 | Transport bus attendance | ⏸ | v2 — tied to the transport module |

## 11. HR Management

| ID | Feature | Tag | Notes |
|---|---|---|---|
| F11-01 | Staff directory and records | 🔧 | app/admin/staff — extend into a full staff file |
| F11-02 | Staff invitations, activation and onboarding | 🔧 | app/staff/activate |
| F11-03 | Contracts, appointment and confirmation letters | 🆕 | from templates, filed against the staff record |
| F11-04 | Leave management: entitlement, application, approval, balance | 🆕 | one calendar the school can actually plan with |
| F11-05 | Payroll runs, payslips and payroll history | 🆕 | after one settled term of clean attendance and ledger data |
| F11-06 | Statutory remittance: PAYE, pension, NHF, ITF | 🆕 | schedules and returns, not just deductions |
| F11-07 | Appraisals, KPIs and lesson observation | 🆕 | extends the existing evaluation pages |
| F11-08 | Training records and certification expiry | 🆕 | know before the certificate lapses |
| F11-09 | Disciplinary and grievance records | 🆕 | confidential, access-controlled, retained |
| F11-10 | Recruitment pipeline: vacancy → applicant → interview → offer | 🆕 | |
| F11-11 | Exit, clearance and final settlement | 🆕 | hand back the laptop, sign the clearance, get paid |

## 12. Parent PRM (relationship management)

| ID | Feature | Tag | Notes |
|---|---|---|---|
| F12-01 | Parent dashboard across children | ✅ | app/parent/dashboard |
| F12-02 | Parent–teacher messaging | ✅ | app/api/parent/messages |
| F12-03 | Parent view of events and calendar | ✅ | app/parent/events |
| F12-04 | 360° parent/household profile with sibling links | 🆕 | one family, one conversation |
| F12-05 | Communication preference centre (channel per topic) | 🆕 | WhatsApp for fees, email for reports, and so on |
| F12-06 | Engagement scoring and at-risk flags | 🆕 | a parent who never opens anything is a risk to the child |
| F12-07 | Parent–teacher meeting booking | 🆕 | slots, reminders, no queue on the day |
| F12-08 | Complaints and suggestions tracking | 🆕 | with a visible status to the parent |
| F12-09 | Consent management (media, trips, medical, NDPA) | 🆕 | collect once, honour always, prove on request |
| F12-10 | PTA levies and voluntary contributions | 🆕 | collected and receipted like any other money |
| F12-11 | Surveys and polls | 🆕 | ask, and actually report the answer |
| F12-12 | Guardian access control (who may see which child) | 🆕 | including separation and custody arrangements |

## 13. Users

| ID | Feature | Tag | Notes |
|---|---|---|---|
| F13-01 | User list and CRUD | ✅ | app/admin/students, app/admin/staff |
| F13-02 | Role and permission assignment | ✅ | |
| F13-03 | Student profiles with guardians and medical notes | ✅ | app/admin/students/[id] |
| F13-04 | Staff profiles | ✅ | |
| F13-05 | ID card generation with photos and QR | ✅ | app/admin/id-cards |
| F13-06 | Bulk import of students and staff (Excel/CSV) | 🔧 | validate, preview, then write |
| F13-07 | Class, stream and arm management | 🔧 | app/admin/class-manager |
| F13-08 | Alumni conversion and alumni records | 🔧 | app/alumni exists; make it a real register |
| F13-09 | Profile completeness and document expiry alerts | 🆕 | missing guardian phone, expiring permit |
| F13-10 | Duplicate detection and record merge | 🆕 | two records for one child is a data-integrity bug |

## 14. Communication

| ID | Feature | Tag | Notes |
|---|---|---|---|
| F14-01 | In-app messaging with threads | ✅ | lib/messaging.ts |
| F14-02 | Email notification pipeline | ✅ | lib/email.ts |
| F14-03 | Mobile push notifications | ✅ | lib/push.ts |
| F14-04 | Class and year-group announcements | ✅ | app/api/teacher/announcements |
| F14-05 | Branded, template-driven emails | 🔧 | school name, crest, colours, footer, unsubscribe |
| F14-06 | Notification preference centre | 🔧 | lib/notification-prefs.ts — extend to every channel |
| F14-07 | **WhatsApp Business API** (utility templates) | 🆕 | registered Nigerian WABA; fees, results, attendance |
| F14-08 | SMS gateway with delivery reports | 🆕 | the fallback when a parent has no smartphone |
| F14-09 | Segmented broadcasts (class, house, bus route, debtor list) | 🆕 | send to the right 40 parents, not all 1,500 |
| F14-10 | Delivery and read receipts with automatic fallback | 🆕 | undelivered WhatsApp → SMS → voice, with cost known |
| F14-11 | Scheduled and drip campaigns | 🆕 | reminders before the deadline, not after |
| F14-12 | Two-way WhatsApp replies routed into the school inbox | 🆕 | a parent's reply must land somewhere a human sees |
| F14-13 | Newsletter builder | 🆕 | monthly bulletin without a designer |
| F14-14 | Emergency broadcast (closure, security, exam-day change) | 🆕 | one button, every channel, audited |
| F14-15 | Meeting and event invitations with RSVP | 🆕 | attendance tracked |
| F14-16 | Per-message cost metering | 🆕 | the school sees what each campaign cost |

## 15. Documents

| ID | Feature | Tag | Notes |
|---|---|---|---|
| F15-01 | Branded PDF generation | ✅ | lib/branded-pdf.ts |
| F15-02 | S3-compatible file storage with signed URLs | ✅ | lib/storage.ts |
| F15-03 | Document vault per student and per staff member | 🆕 | birth certificates, results, contracts, in one place |
| F15-04 | Template library: letters, certificates, forms, notices | 🆕 | editable, with placeholders resolved from records |
| F15-05 | E-signature and acknowledgement tracking | 🆕 | who has seen and signed the policy |
| F15-06 | Document expiry and renewal alerts | 🆕 | permits, licences, medicals |
| F15-07 | Bulk document generation | 🆕 | 300 offer letters, one action |
| F15-08 | Versioning and access log | 🆕 | which version, downloaded by whom |
| F15-09 | Scan/photo intake with OCR | 🆕 | paper in, searchable record out |
| F15-10 | Retention and disposal policy engine | 🆕 | keep what the law requires, delete what it does not |

## 16. Timetable

| ID | Feature | Tag | Notes |
|---|---|---|---|
| F16-01 | Timetable slots and administrative editor | ✅ | app/admin/timetable |
| F16-02 | Teacher and student timetable views | ✅ | app/student/timetable |
| F16-03 | Automatic generation with clash detection | 🔧 | constraints: teacher, room, subject load, double periods |
| F16-04 | Room and resource allocation | 🆕 | the lab can only hold one class at a time |
| F16-05 | Exam timetables | 🆕 | separate from the teaching timetable, with seating |
| F16-06 | Substitute teacher scheduling | 🆕 | absent teacher, next lesson covered |
| F16-07 | Timetable change notifications | 🆕 | push to the people affected, nobody else |

## 17. Help Desk

| ID | Feature | Tag | Notes |
|---|---|---|---|
| F17-01 | Ticket intake from portal, website and WhatsApp | 🆕 | one queue, three doors |
| F17-02 | Assignment, priority and SLA escalation | 🆕 | an unanswered ticket escalates itself |
| F17-03 | Ticket threads with attachments and internal notes | 🆕 | the parent sees one view, the staff another |
| F17-04 | Knowledge base and FAQ articles | 🆕 | the answer that saves the ticket |
| F17-05 | Satisfaction surveys and reporting | 🆕 | did we actually solve it |
| F17-06 | Maintenance and facilities requests | 🆕 | the broken tap has an owner and a deadline |

## 18. School Website

| ID | Feature | Tag | Notes |
|---|---|---|---|
| F18-01 | Public site pages: home, about, academics, campus life, contact | ✅ | ~30 public routes exist |
| F18-02 | News and events with markdown content | ✅ | content/news/* |
| F18-03 | Gallery | ✅ | app/gallery |
| F18-04 | Contact form and enquiry capture | ✅ | app/api/contact |
| F18-05 | SEO: metadata, sitemap, robots, OpenGraph images | ✅ | lib/og.tsx |
| F18-06 | PWA manifest and install prompt | ✅ | public/manifest.json |
| F18-07 | Editing content without a developer | 🔧 | a head teacher must be able to post results day news |
| F18-08 | Media library with image optimisation | 🔧 | upload, crop, alt text, WebP |
| F18-09 | Admissions pages aligned with the live funnel | 🔧 | what the site promises is what the system does |
| F18-10 | Fees and requirements pages per class | 🔧 | published fee schedules, kept current |
| F18-11 | Themeable templates (colours, typography, layout) | 🆕 | the rebrand, applied to the website |
| F18-12 | Custom domain with automatic SSL | 🆕 | the school's own name on the door |
| F18-13 | Event calendar with registration | 🆕 | open days, speech day, PTA meetings |
| F18-14 | Website chat/WhatsApp entry point | 🆕 | into the Help Desk queue |
| F18-15 | Site-wide search | 🆕 | including news archive |

## 19. Settings

| ID | Feature | Tag | Notes |
|---|---|---|---|
| F19-01 | School profile (name, address, contacts, crest) | ✅ | app/admin/school-profile |
| F19-02 | Academic sessions and terms | ✅ | app/admin/sessions |
| F19-03 | Subjects and class-subject mapping | ✅ | app/admin/subjects |
| F19-04 | Grade scales and pass marks | ✅ | |
| F19-05 | Notification settings per role | ✅ | app/settings/notifications |
| F19-06 | Grading, remark and promotion rule editor | 🔧 | configurable without a deployment |
| F19-07 | Module switches (what this school uses) | 🔧 | School.modules |
| F19-08 | Branding uploads: logo, colours, favicon, letterhead | 🔧 | one place, applied everywhere |
| F19-09 | Backup and restore interface | 🆕 | with a tested restore drill, not just a dump |
| F19-10 | Integrations hub (Paystack, WhatsApp, SMS, email, storage) | 🆕 | keys entered with validation and a live test |
| F19-11 | API keys and webhooks for the school's own tools | 🆕 | scoped, revocable, logged |
| F19-12 | Data export and retention controls | 🆕 | a school can leave with its data |

## 20. Licence & Usage *(was: Subscriptions)*

| ID | Feature | Tag | Notes |
|---|---|---|---|
| F20-01 | Licence status, plan name and renewal date | 🆕 | single school, one licence |
| F20-02 | Usage dashboard: storage, messages, AI credits, SMS | 🆕 | against the allowance, with trend |
| F20-03 | Fair-use limits and threshold alerts | 🆕 | warn at 80%, not after the fact |
| F20-04 | Support and maintenance agreement records | 🆕 | what is covered, until when |
| F20-05 | Add-on purchases (extra AI credits, extra SMS bundles) | 🆕 | |
| F20-06 | Plan tiers, self-serve upgrade/downgrade and SaaS billing | ✂️ | **EDUos artefact** — this is a school system, not a SaaS |
| F20-07 | Cross-school billing invoices and dunning | ✂️ | **EDUos artefact** |

## 21. Mobile app (Android)

| ID | Feature | Tag | Notes |
|---|---|---|---|
| F21-01 | Expo app shell, auth and session | ✅ | mobile/ |
| F21-02 | Student screens: dashboard, exams, timetable, results | ✅ | |
| F21-03 | Parent screens: fees, attendance, results, messages | ✅ | |
| F21-04 | Teacher screens: gradebook, attendance, students | ✅ | |
| F21-05 | Admin essentials | ✅ | |
| F21-06 | Offline cache and practice bank | ✅ | mobile/lib/offline/* |
| F21-07 | Push notifications and in-app updates | ✅ | EAS update channel |
| F21-08 | Parity guard: every new web screen has a mobile decision | 🔧 | scripts/check-mobile-parity.ts |
| F21-09 | Live class join from the app | 🆕 | deep link into the assigned URL |
| F21-10 | AI assistant in the app | 🆕 | the top three prompts, not all 34 |
| F21-11 | Fee payment in the app | 🆕 | with the same ledger guarantees as the web |
| F21-12 | iOS build and App Store release | ⏸ | v2 — Apple ID and the developer programme come later |

## 22. Cross-cutting technical capabilities

| ID | Feature | Tag | Notes |
|---|---|---|---|
| F22-01 | Response caching layer | ✅ | lib/cache.ts |
| F22-02 | Pagination and large-list handling | ✅ | lib/pagination.ts |
| F22-03 | Structured logging and error tracking | ✅ | lib/logger.ts |
| F22-04 | Security headers, CSP and CORS policy | ✅ | lib/csp.ts, lib/cors.ts |
| F22-05 | Rate-limit hardening across every public route | 🔧 | including the CDN/WAF layer |
| F22-06 | CORS for multiple first-party origins | 🔧 | web, mobile deep links, LAN exam centre |
| F22-07 | Observability: dashboards, uptime and error alerts | 🆕 | know before the school calls |
| F22-08 | Load testing at 3,000 users / peak enrolment day | 🆕 | prove the promise, do not assume it |
| F22-09 | Automated backup, restore drill and off-site copy | 🆕 | a backup nobody has restored is a hope |
| F22-10 | Design system component library | 🆕 | one button, one table, one modal, everywhere |
| F22-11 | Multi-campus / multi-branch operation | ⏸ | v2 |
| F22-12 | Library management | ⏸ | v2 |
| F22-13 | Hostel and boarding management | ⏸ | v2 |
| F22-14 | Transport routes and bus tracking | ⏸ | v2 |
| F22-15 | Canteen and meal accounts | ⏸ | v2 |
| F22-16 | Alumni fundraising and donations | ⏸ | v2 |
| F22-17 | WAEC/NECO/JAMB registration filing | ⏸ | v2 — external portals own this |
| F22-18 | Self-hosted video and CDN for live classes | ⏸ | v2 — start with hosted links |
| F22-19 | Fully conversational AI tutor with voice | ⏸ | v2 |
| F22-20 | CCTV and hardware integration | ⏸ | v2 |
| F22-21 | Full multi-language localisation (i18n) | ⏸ | v2 |

## 23. Operations & compliance (deliverables, not screens)

| ID | Feature | Tag | Notes |
|---|---|---|---|
| F23-01 | Deployment, backup and hosting documentation | ✅ | docs/deployment.md, docs/backup-restore.md |
| F23-02 | Go-live checklist and cutover runbook | 🔧 | update for the new school |
| F23-03 | Monitoring and incident runbook | 🔧 | who is called, when, and what they do |
| F23-04 | Release and rollback process | 🔧 | every deploy reversible |
| F23-05 | NDPA compliance pack and NDPC registration | 🆕 | MDP-EHL ₦100,000 at 3,000 data subjects |
| F23-06 | Child-data protection policy and DPIA | 🆕 | written, signed, followed |
| F23-07 | Data subject request handling (access, correction, erasure) | 🆕 | a request with a deadline attached |
| F23-08 | Incident response and breach notification | 🆕 | NDPC within the statutory window |
| F23-09 | Five-year capacity plan and annual cost review | 🆕 | the school stays affordable in year four |
| F23-10 | Staff training and handover pack | 🆕 | the school must run this without us |
| F23-11 | UAT pack and acceptance sign-off | 🆕 | test scripts the school runs itself |
| F23-12 | Warranty and support plan | 🆕 | 6 months, with response times in writing |

## 24. Cost model & quotation

| ID | Feature | Tag | Notes |
|---|---|---|---|
| F24-01 | Runnable cost model calculator | ✅ | npx tsx scripts/cost-model.ts --breakdown |
| F24-02 | Quotation FMX-2026-001 with payment schedule | ✅ | 06-quotation.md |
| F24-03 | Re-costing tool for a different school profile | 🆕 | 800 students is not 2,300 students |

---

## 25. Counts

| Group | Total | ✅ In base | 🔧 Extend | 🆕 New | ✂️ Strip | ⏸ Deferred |
|---|---|---|---|---|---|---|
| Foundations — the platform underneath everything | 30 | 16 | 4 | 5 | 5 | 0 |
| Home | 6 | 2 | 3 | 1 | 0 | 0 |
| AI Learning Hub | 10 | 1 | 1 | 8 | 0 | 0 |
| AI Studio | 16 | 0 | 0 | 16 | 0 | 0 |
| AI CBT | 25 | 6 | 2 | 17 | 0 | 0 |
| Fees & Billing | 26 | 7 | 7 | 12 | 0 | 0 |
| Marks Entry | 11 | 6 | 2 | 3 | 0 | 0 |
| Result Generation | 17 | 6 | 5 | 6 | 0 | 0 |
| Admissions | 12 | 7 | 2 | 3 | 0 | 0 |
| Front Desk | 10 | 1 | 0 | 9 | 0 | 0 |
| Attendance | 14 | 5 | 1 | 6 | 0 | 2 |
| HR Management | 11 | 0 | 2 | 9 | 0 | 0 |
| Parent PRM (relationship management) | 12 | 3 | 0 | 9 | 0 | 0 |
| Users | 10 | 5 | 3 | 2 | 0 | 0 |
| Communication | 16 | 4 | 2 | 10 | 0 | 0 |
| Documents | 10 | 2 | 0 | 8 | 0 | 0 |
| Timetable | 7 | 2 | 1 | 4 | 0 | 0 |
| Help Desk | 6 | 0 | 0 | 6 | 0 | 0 |
| School Website | 15 | 6 | 4 | 5 | 0 | 0 |
| Settings | 12 | 5 | 3 | 4 | 0 | 0 |
| Licence & Usage | 7 | 0 | 0 | 5 | 2 | 0 |
| Mobile app (Android) | 12 | 7 | 1 | 3 | 0 | 1 |
| Cross-cutting technical capabilities | 21 | 4 | 2 | 4 | 0 | 11 |
| Operations & compliance (deliverables, not screens) | 12 | 1 | 3 | 8 | 0 | 0 |
| Cost model & quotation | 3 | 2 | 0 | 1 | 0 | 0 |
| **TOTAL** | **331** | **98** | **48** | **164** | **7** | **14** |

*(Counted by primary tag: a few rows carry two tags — e.g. ✂️→🔧 or ✅/🆕 —
and are counted once. The table is generated from the rows above and verified by
`npm run check:features`, so it cannot drift.)*

**Read it like this:** **98 features already work** in the base and mostly
need rebranding and wiring; **48 need real extension** (money, results,
attendance, users, communication); **164 are genuinely new**. The new work
concentrates in the AI layer (26), CBT depth and the offline exam centre, the
teaching/learning stack, Front Desk, HR, Parent PRM, Help Desk and the Documents
suite. 14 items are deliberately deferred.

The seven ✂️ items are the EDUos platform layer plus Ykay-specific arms
(`09-master-build-prompt-go.md` §2) — removing them is workstream W1.

*(⏸ items in F22 are listed but not counted as deliverables; a handful of rows
carry two tags and are counted once, by primary intent.)*
