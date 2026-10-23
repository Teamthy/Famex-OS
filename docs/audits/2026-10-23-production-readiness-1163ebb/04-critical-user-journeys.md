# 04 — Critical user-journey report

## Interpretation

A journey is not PASS merely because a seeded happy path works in CI. For launch, it must also handle authorization failure, duplicate calls, timeouts, expired sessions, provider failure, concurrency, recovery, and auditability.

## Journey verdicts

| Journey | Status | Evidence and principal gap |
|---|---|---|
| Login → MFA → session → logout/revocation | FAIL | Core email/password and MFA code exists and CI covers selected logins. Newer roles can dead-end, student provisioning is incomplete, sessions are long-lived, and offline stores survive logout |
| Staff onboarding → role assignment → first login | FAIL | Role vocabulary is broader than middleware/login/nav support; normal provisioning for several roles was not found |
| Student creation/enrolment → login activation | FAIL | No complete in-product activation/reset flow; `scripts/seed-students.ts` creates accounts that cannot use the advertised shared password |
| Parent creation/link → child access → unlink/revocation | FAIL | Parent accounts can be created/reused from unverified email and temporary passwords returned to staff; no complete guardian removal/scope-expiry workflow was found |
| Admissions draft → documents → payment → submit | FAIL | Draft/payment access is fragile across refresh; document completeness checks type only, not clean verified stored content; public status identifier has low entropy |
| Admissions review → decision → enrolment | FAIL | Review does not expose scan verdicts in the inspected projection, transitions are too permissive, and enrolment does not reliably create login/subjects/current enrolment |
| Fee structure → invoice generation | FAIL | Ledger/invoice model is substantial, but zero-total structures, count-based numbering, and lifecycle exceptions create operational failure modes |
| Parent fee payment → Paystack verify/webhook → ledger | FAIL | HMAC and exact verification exist, but `postCompletedFeePayment()` replay is reference-only and not bound to attempt/invoice/student/amount/method |
| Offline/cash fee entry → review → posting | FAIL | `PENDING_REVIEW` can occupy a reference without a complete completion workflow; arbitrary cash references weaken reconciliation |
| Refund/chargeback → reversal → parent balance | FAIL | Refund/chargeback provider events and payout-proof handling are incomplete; partial-refund state can misrepresent the original payment |
| Settlement import → reconciliation → exception clearance | FAIL | Aggregate/window matching can recount overlaps; per-reference settlement matching remains follow-up work |
| Student attendance register → lock → parent visibility | FAIL | CI proves a seeded register journey, but correction, transfer, elective/class-history, and adversarial cases are not launch-proven |
| Staff GPS/QR attendance | FAIL | GPS and static/weak QR patterns are spoofable/replayable; suitable only as supervised convenience evidence, not high-assurance proof |
| Teacher assignment → student submission → grading | FAIL | CI proves the seeded happy path. Elective scoping, notifications, mobile screens, mutable external links, version history, retroactive due/max-score changes, and submit/grade/close races remain |
| Teacher virtual class → student join | FAIL | CI proves launch in a seeded environment and list responses hide the URL. Any HTTPS host can be supplied, join returns a shareable raw URL, attendance is click-based, and notifications/overlap/subject checks are incomplete |
| Teacher question creation/import → exam publish | FAIL | Bulk question validation permits invalid MCQ/fill-blank semantics; publication and marking locks/audit are inconsistent |
| Student CBT start → autosave → timer → submit | FAIL | Subject entitlement is not consistently enforced on attempt/package/replay; theory time and deadline calculations diverge |
| Offline CBT download → sit offline → replay/sync | FAIL | Client timing/replay trust is too broad; duplicate/altered replay and device-loss cases are not proven |
| Marking → moderation → result release | FAIL | Missing/exempt handling, unlocked/unaudited changes, and teacher send-results paths can bypass a single authoritative moderation pipeline |
| Report-card generation → release → parent view/verification | FAIL | Incomplete/incomparable data can be ranked; corrections can leave snapshots stale; deterministic public verification exposes child results |
| Promotion/session rollover | FAIL | Enrolment/subject/account state does not roll over as one proven lifecycle transaction with dry-run exceptions |
| Messaging → notification queue → email/SMS/WhatsApp/push | FAIL | Queue mechanics exist, but OCI Compose dispatch authentication is wrong/masked and live provider receipts were not verified |
| Mobile login → cached work → offline sync → logout | FAIL | Device behavior not verified; preview can target production API; logout leaves offline stores; assignments lack mobile parity |
| Clinic visit/medication record | FAIL | JSON-file persistence and broad/incorrect role access are incompatible with child health records |
| Library/inventory operations | FAIL | JSON whole-file persistence lacks transactions, referential integrity, and multi-instance safety |
| Public website → news/contact/calendar/staff | FAIL | Public staff data is automatically exposed without publication consent flag; contact queue/retention was not discovered; calendar semantics are questionable |
| Backup → restore → application smoke | BLOCKED | Scripts/docs exist; no rehearsal evidence |
| Deploy → smoke → rollback | BLOCKED | No live environment or rollback rehearsal evidence |
| YK-Virtual tutor booking → escrow → session → payout/dispute | NOT APPLICABLE | System not present in this repository |

## Journey notes

### Admissions is a launch-stopping journey, not a minor UX issue

The admissions journey combines child identity data, family data, health-related fields, uploaded documents, and money. A type-only document check is therefore not a small validation omission. The safe state machine must be:

`draft → file reserved → object verified → malware CLEAN → requirements satisfied → payment verified → submitted → reviewed → approved → enrolled → accounts activated`

At `1163ebb`, the inspected implementation does not prove that chain. Real admissions must remain closed until the state machine is enforced server-side and tested with malicious/spoofed files.

### Finance has a strong ledger core but unsafe edges

The ledger design is one of the strongest parts of the codebase: integer money, balanced postings, deterministic posting rules, and transactional invoice updates. The launch failure is at the boundary where external payment references, offline entries, refunds, chargebacks, settlements, and human corrections enter that core. Those edges are precisely where money is lost or double-counted, so they must be treated as P0/P1 rather than polish.

### Learning journeys are pilotable only in a narrow sense

Assignments and virtual classes have real implementations and seeded E2E coverage. They are suitable for synthetic staging and teacher feedback. They are not yet safe to present as complete school-wide systems because elective scoping, notifications, mobile parity, race handling, external-link governance, and attendance meaning remain incomplete.

### Examination integrity requires a separate hardening release

The combination of a public answer oracle, class-centered attempt authorization, timing divergence, and offline replay trust means CBT results from this commit should not be used for promotion, admission, discipline, scholarships, or other consequential decisions. Low-stakes synthetic practice in a closed staging environment is the maximum supportable use.
