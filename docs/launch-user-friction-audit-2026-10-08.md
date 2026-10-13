# YKAY College EduPortal — Launch user-friction audit

**Date:** 2026-10-08 · **Branch:** `arena/8ce3ce03-ykay-eduport` (base `9ea05b6`)
**Scope:** YKAY College as the main product (EDUos treated as later; YKAY as a tenant).
**Method:** a production build run as a real user in a headless browser across every role, scripted user journeys (including the assessment, fee and messaging cycles), plus API probing of every route handler.

**Status (2026-10-09):** blockers B1–B7 are fixed in [PR #24](https://github.com/Teamthy/ykay_eduport-/pull/24). High, medium and low items are still open. See section 11.

---

## 1. Verdict

**Not ready for public launch as the code stands.** Most core paths now work when followed end to end:

- A teacher can create, publish and mark a paper; a student can sit it, see a score, and the result is released.
- A bursar can approve a bank transfer, which updates the invoice and lifts the student's exam fee lock.
- A parent can message the form teacher and receive a reply.
- A new teacher can be invited, activate the account from the one-time link and sign in (without email).
- The admissions form works up to the documents step.

Launch-critical paths still fail:

- IT students **cannot enrol** in any course (B1).
- The **contact form** discards every enquiry and tells the visitor "Enquiry Sent" (B2).
- Admissions **document uploads will be blocked** by the browser's Content Security Policy once storage is configured (B3).
- The **sign-in heading and fields are nearly invisible** on the first screen of every portal (B4).
- The **sign-in page can redirect to any external site** after login (B5, open redirect).
- **Student and admin ID cards send children's names to a third-party website** (B6).
- The **school address printed on receipts, ID cards and PDFs is an unconfirmed placeholder** (B7).

Four new high-severity items concern roles and money:

- The **bursar's menu leads to 19 pages that show "Unauthorized"**, and the coordinator's to 4 (H9).
- Teachers **cannot grade essays or release results from the pages the menu names**; grading exists only on the older "Classic" CBT page (H10).
- A parent who submits a **bank transfer sees nothing afterwards**, and a rejection is never reported back (H11).
- A platform owner using **"View As" sees no banner in the portal**, loses the exit after a reload, and signing out **signs the parent out on every device** (H12).

Seven blockers, twelve high-severity items, plus configuration prerequisites (section 6). Everything else is medium or low.

**Severity scale**

| Level | Meaning |
|---|---|
| **Blocker** | Must be fixed before public traffic. |
| **High** | Should be fixed before launch, or explicitly accepted with a mitigation. |
| **Medium** | Fix in week 1. |
| **Low** | Backlog / polish. |

**Evidence labels:** `[browser]` verified in a real Chromium session · `[API]` verified by HTTP calls · `[DB]` verified by reading the audit database after the action · `[code]` read from source · `[inferred]` strong but not run end to end.

---

## 2. What was tested

| Area | Coverage |
|---|---|
| Page routes | **144** page routes derived from `app/**/page.tsx`, each loaded as every persona the middleware allows: **650 desktop visits** across 15 signed-in accounts and anonymous, and **56 mobile visits** (anonymous and parent). |
| API routes | **202** HTTP method handlers across all `app/api/**/route.ts` files, probed anonymously, as one wrong-role account per area, as the owner (read-only GET only; mutating calls were never sent as an owner), and with malformed JSON. |
| Links | **737** internal link checks (685 desktop, 52 mobile), each made with the persona's session. |
| Redirects | Every redirect seen in the crawls (50 page-level redirects, all personas), the protected-route redirects, the sign-in `next` parameter (B5), `/download/apk`, `/signup` and `/cbt`. |
| Scripted user journeys | Anonymous visitor and public site · admissions family (through the documents step) · every sign-in path and first sign-in · teacher day (attendance, gradebook, announcements, messages) · teacher assessment cycle (create and publish a paper, import questions from a file, grade an essay, release results) · student (dashboard, fee lock, practice set, paper attempt, score) · parent (fees, bank-transfer claim and its visibility, messages) · bursar (approve and reject transfers) · IT student · school admin (students, staff invitation, news) · head of school · platform owner ("View As") · staff activation. |
| Targeted verifications | CSP for uploads and Sentry · rate limits (per-IP and spoofed) · open redirect · impersonation guards (API and UI) · fee lock on a live paper · QR third-party requests · computed contrast · role-gated data calls · the browser's error text for a blocked upload · database state after approvals, rejections and sign-outs. |

**Accounts used** (one per role, all from the UAT seed): platform super admin; school admin; head of school (first login, forced password change); director; bursar; coordinator; HOD; two teachers (one class teacher for SS2A Mathematics, one other); two students (one linked to a profile with a fee balance, one account with no linked profile); two parents (one with two children); IT student; anonymous visitor; and a teacher account created during the staff-activation test. **All 15 signed-in accounts were crawled on desktop.** The admin account no longer stands in for the director, bursar or coordinator.

**How the environment was built (sandbox only, never committed):**
- Production build (`next build`), run as the standalone bundle, same boot path as `npm start` and the Dockerfile. The server was restarted between phases to reset in-memory rate limiters.
- PostgreSQL 16 with all 29 migrations applied cleanly on an empty database.
- Seeded with the YKAY onboarding seed, the demo-persona seed, and the finance, attendance, report-card, gradebook, timetable, IT course, plan and CBT bank seeds (5,483 questions).
- Sandbox limits: Prisma's native query engine cannot be downloaded here, so the audit used Prisma's WASM engine with the `pg` driver adapter. Query semantics are the same; engine-level error text may differ. Chromium came from npm. The sandbox has no internet, so Paystack, email, object storage and Sentry were unreachable. Rate limiters are in memory, and all traffic came from one IP.

---

## 3. Findings at a glance

| ID | Level | Area | Who is hit | Finding |
|---|---|---|---|---|
| B1 | Blocker | IT portal | Digital student | No way to enrol in any IT course. |
| B2 | Blocker | Contact | Every visitor / parent | Contact form sends nothing and says "Enquiry Sent". |
| B3 | Blocker | Admissions | Applicant family | Document uploads blocked by CSP once storage is set up; the family sees "Failed to fetch". |
| B4 | Blocker | Sign-in | Everyone | Sign-in heading and inputs nearly invisible (contrast 1.10:1). |
| B5 | Blocker | Security | Everyone | Open redirect after sign-in (`?next=//host`). |
| B6 | Blocker | Privacy | Students, staff, parents | ID cards and QR codes send names and IDs to a third party. |
| B7 | Blocker | Content | Parents, staff | Unconfirmed school address printed on receipts, ID cards, PDFs and public pages. |
| H1 | High | Security | Everyone | Rate limits bypassable with a forged `X-Forwarded-For`. |
| H2 | High | Limits | Families on shared networks | Per-IP limits lock out a whole school network. |
| H3 | High | Exams / fees | Fee-locked students | Fee lock shows a "Fees outstanding" tag only: no amount, no pay link, and the explanation the server holds is not shown. |
| H4 | High | Fees | Parents, bursar | Two invoices carry another child's name (on the parent page and in the bursar's queue). |
| H5 | High | Payments | Parents | Raw "fetch failed" message when Paystack is unreachable; cookie banner covers the Pay button; receipt dates ambiguous. |
| H6 | High | Monitoring | Operators | Browser errors cannot reach Sentry (CSP). |
| H7 | High | CBT | Students / integrity | Public CBT API exposes the whole bank and answer keys. |
| H8 | High | Sign-in | Parents, YK-Virtual users | "Continue to YK-Virtual" link goes to a 404. |
| H9 | High | Roles | Bursar, coordinator | Menus lead to pages that show "Unauthorized" (19 and 4 links). |
| H10 | High | Exams | Teachers | Grading and result release are not where the menu says; "Review" ends at a read-only page. |
| H11 | High | Fees | Parents, bursar | A submitted bank transfer is invisible afterwards; a rejection is never reported to the parent. |
| H12 | High | Security / privacy | Platform owner, parents | "View As" has no banner in the portal; no exit after a reload; sign-out revokes the parent's sessions on every device. |
| M1 | Medium | Website | Visitors | News & Events empty on launch; four articles unused. WAEC practice is empty until teachers publish sets. |
| M2 | Medium | Teacher | Teachers | "undefined students/parents" text; analytics KPI missing. |
| M3 | Medium | Website / SEO | Visitors, search | Missing articles return HTTP 200 "Page not found". |
| M4 | Medium | Onboarding | Head of School | Forced password change lands on the portal chooser, not the dashboard. |
| M5 | Medium | Security | Staff, parents | Password rules differ between change and reset; reset errors are generic. |
| M6 | Medium | Reliability | Operators | Malformed requests return 500/503 and flood error logs. |
| M7 | Medium | SEO / UX | Visitors | Most pages share one generic `<title>`. |
| M8 | Medium | Brand / domain | Everyone | Two domains in use; logo artwork says "TRAINING COLLEGE". |
| M9 | Medium | Admissions | Families | Application fee not stated before starting. |
| M10 | Medium | Teacher | Teachers | Question bank shows no search or filter. |
| M11 | Medium | Staff onboarding | Admin, new staff | Activation link is shown once in the session; no email; no confirmation after activation. |
| M12 | Medium | Downloads | Parents | App download depends on env vars; redirect uses the site URL. |
| M13 | Medium | Parity | Parents | Parent timetable exists in the API and mobile app, not on the web. |
| M14 | Medium | Teacher | Teachers | Test and exam tools spread across overlapping pages, with inconsistent copy. |
| L1–L12 | Low | Various | — | Broken hero image and favicon, duplicate pages, role and policy questions, copy issues, two menu links that do not match their destination (section 5). |

---

## 4. Detailed findings

### B1 — IT students cannot enrol in any course (Blocker)
- `[browser]` On `/it-portal/dashboard`, catalogue cards are links to course pages. There is no enrol button. The course page says *"You are not enrolled yet. Enroll from your IT dashboard…"* (`app/it-portal/courses/[slug]/page.tsx:175-182`), which sends the student back to a dashboard with no enrol action. The dashboard summary stayed at `enrolledCourses: 0` in every run.
- `[code]` `app/api/it/enroll/route.ts` exists, but no UI file calls it (grep of `app` and `components` finds no caller).
- Consequence: "Mark as Complete" in the course player changes nothing and shows no message, because progress cannot be recorded without enrolment (`[browser]`, progress stayed at 0 of 6).
- **Fix:** add an Enrol action on the course page and on each dashboard card, calling `POST /api/it/enroll`; show a clear message in the player when a learner is not enrolled. Re-run the IT journey.

### B2 — The contact form discards enquiries and claims success (Blocker)
- `[code]` `app/contact/page.tsx:69-72`: `onSubmit` calls `e.preventDefault()` and then `alert("Enquiry Sent")`. Nothing is sent to any endpoint. The file has no `required` attributes and no `name` attributes on its inputs, so even a browser-level check would not catch an empty form. The `[browser]` journey confirmed that an empty submit raised no validation.
- Consequence: every parent enquiry is lost and the parent is told it was received.
- **Fix:** send the enquiry to a server endpoint that stores it and notifies the office (or use a verified `mailto`). Show success only after the request succeeds.

### B3 — Admissions document upload will be blocked by the browser (Blocker)
- `[code]` The form uploads each file straight from the browser to the presigned storage URL: `components/admissions/AdmissionApplicationForm.tsx:313` (`fetch(upload.uploadUrl, { method: "PUT" … })`). Any failure in that call, or in the step before it, is caught and shown with the error's own message (`setErrors({ form: error.message })`).
- `[code]` `next.config.ts:45` sets `connect-src 'self' https://api.paystack.co https://*.upstash.io https://*.neon.tech …`. The storage origin is not allowed.
- `[browser]` A test PUT to a storage host is refused by the browser before any network call: *"Connecting to 'https://…s3…' violates the following Content Security Policy directive: connect-src …"*. The same fetch throws `TypeError: "Failed to fetch"`.
- `[browser]` What a family sees today, on this build (no storage bucket configured): choosing a file gives *"We could not prepare a secure upload. Please try again."* (the upload-URL call returns 500). Continuing without the four required documents gives *"Upload all required documents before you continue."* — clear and correct.
- Consequence: once `S3_BUCKET` is configured, the upload fails on the CSP rule, and the family will see **"Failed to fetch"**, which they cannot act on. Families then cannot attach the four required documents (birth certificate, passport photo, report card, transfer certificate), so applications cannot be submitted.
- **Fix:** add the storage origin (S3 regional endpoint or R2 domain) to `connect-src`, or proxy uploads through the server. Replace the raw error with plain language ("We could not upload this file. Check your connection and try again."), and log the technical reason. Log the misconfiguration as an operator error (503 with a clear message) rather than a generic 500. Test with the real bucket on staging, including a malware-scanner path.

### B4 — Sign-in heading and fields are nearly invisible (Blocker)
- `[browser]` On `/login`, the "SIGN IN" heading computes to `rgb(241,245,249)` on a `rgb(255,255,255)` card: **contrast 1.10:1** (WCAG AA needs 3:1 even for large text). The subtitle is also very faint.
- `[browser]` The email and password inputs compute to a white background with `rgba(255,255,255,0.08)` borders, so the fields are barely visible. A first-time parent may not see where to type.
- `[inferred]` Dark-theme text and input tokens are applied on a card whose background stays white (`app/login/page.tsx`, card and form markup).
- **Fix:** give the card explicit light-theme colours (or make the card follow the theme), add a visible input border and background, and re-check contrast on every portal sign-in variant (`?portal=staff|student|parent|it`).

### B5 — Open redirect after sign-in (Blocker)
- `[code]` `app/login/page.tsx:73`: `router.replace(next && next.startsWith("/") ? next : …)`. A value such as `//example.com/phish` starts with `/` and is accepted.
- `[browser]` After signing in with `/login?next=//example.com/phish`, the browser issued a navigation to `http://example.com/phish`. The request failed only because the sandbox has no internet.
- **Fix:** accept only same-origin paths, for example `new URL(next, window.location.origin).origin === window.location.origin`, and reject values beginning with `//` or `/\`.

### B6 — ID cards and QR codes send names and IDs to a third party (Blocker)
- `[browser]` The student ID card requests `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=YKAY%7CYKC%2F2026%2F001%7CEmmanuel%20Adebayo`, which is the student's ID and full name.
- `[code]` The same pattern appears in:
  - `app/student/id-card/page.tsx:71` (student ID and name)
  - `app/admin/id-cards/page.tsx:87` (student ID, name and class)
  - `app/staff/attendance/page.tsx:36` and `app/admin/staff-attendance/page.tsx:58-59` (staff badge payload: `{kind: "STAFF_BADGE", schoolId, code: badgeCode}` from `lib/staff-attendance.ts:64-70`. The `badgeCode` is static, not rotating, so it works as a long-lived check-in credential, and the third party receives it)
  - `components/LiveReportCardPreview.tsx:205` (report numbers)
  - `lib/apk.ts:78` (download link)
- Impact: children's personal data and staff check-in payloads leave the school's control. Images break when the third party is slow or down; this happened throughout the sandbox run.
- **Fix:** generate QR codes locally (the `qrcode` package is already a dependency) and remove the third-party URLs. Confirm the data-processing position with the school.

### B7 — Unconfirmed school address on receipts, ID cards and public pages (Blocker)
- `[code]` "Sango Ota, Ogun State" / "Km 38, Lagos-Abeokuta Expressway" is hard-coded in `app/contact/page.tsx:44`, `lib/receipt.ts:39`, `lib/branded-pdf.ts:59,194,380`, `app/student/id-card/page.tsx:115`, `app/about/page.tsx:51`, and the page metadata and structured data in `app/layout.tsx:69-70` and the JSON-LD block.
- `[code]` The database seed uses a different placeholder, "Alishiba Junction, Nigeria" (`prisma/seed-ykay-college.ts:56`).
- `[code]` `docs/ONBOARDING-GAPS.md` says the Sango Ota address is "a guess from an earlier draft and is not confirmed by this form".
- Impact: receipts, report cards and ID cards may print an address the school has not confirmed. Changing the database row would not change the hard-coded PDFs.
- **Fix:** confirm the address, store it once in school settings, and read it everywhere (pages, receipts, PDFs, ID cards, structured data).

### H1 — Rate limits are bypassable with a forged `X-Forwarded-For` (High)
- `[code]` `lib/requests.ts:4-6` uses the first value of `x-forwarded-for` as the client IP.
- `[API]` After the real IP was blocked with 429 on `/api/cbt/check`, 20 requests with different spoofed `X-Forwarded-For` values all returned 400 (accepted) rather than 429.
- Affects every IP-keyed limiter: login (10 per 15 minutes), IT signup (5 per hour), admissions draft, payment and upload, password reset, and CBT (240 per hour).
- Production exposure depends on whether the edge proxy overwrites the header. That must be verified on staging. The application should not trust the client-supplied first value either way.
- **Fix:** read the address your trusted proxy appends (or the platform's verified client-IP header), and add a staging test that sends a spoofed header and expects no effect.

### H2 — Shared per-IP limits will lock out families on a shared network (High)
- `[code]` `lib/rate-limit.ts`: admissions draft 5/hour (`:82`), upload 40/hour (`:83`), payment 8/hour (`:84`), login 10 per 15 minutes (`:87`), per-account failures 3 per 15 minutes (`:88`), password reset 3/hour (`:98`), signup 5/hour (`:100`), CBT 240/hour (`:118`).
- `[API]` The sixth IT signup request from one IP returned 429 *"Too many sign-up attempts. Please wait and try again."* — and all six were invalid, because the limiter runs before validation.
- `[API]` The sixth draft request returned 429 *"Too many attempts. Please wait before trying again."*
- Each admissions application makes several draft writes (creation, each document, payment, submit), so one shared IP can complete roughly one application per hour. The messages give no wait time.
- Impact: on admissions day, IT enrolment or fees day, a school Wi-Fi or carrier NAT can lock out every family or student behind it.
- **Fix:** key budgets per account or application rather than per IP where possible; count only successful writes; raise shared-IP ceilings; show the wait time; and configure Upstash Redis in production (`.env.example` says security limiters fail closed without it).

### H3 — Fee-locked students get a tag, not a reason or a way to pay (High)
- `[browser]` With a published paper for SS2A, the fee-locked student's exam list shows the card with the tag **"Fees outstanding"** and the paper's details. There is no Start control, no amount, no explanation of what to do, and no link to the fee page (`app/student/exams/page.tsx`).
- `[API]` The start endpoint refuses with HTTP 402 and a clear sentence: *"School fees outstanding (₦45,000). Settle fees with the bursary or parent portal before starting CBT exams."* (`app/api/student/exams/[id]/attempt/route.ts`). **The list page does not show this sentence**, so the student never sees it.
- `[browser]` With no exams published, the page says *"No exams have been published for your class yet."* It does not mention the lock.
- **Fix:** show the server's message, the outstanding amount and a "View fees and pay" link on the page and on each locked card.

### H4 — Invoice titles can name a different child (High)
- `[browser]` The parent's fee page shows the card title **"Adeola Ogunlade School Fees"** for Emmanuel Adebayo's invoice (`YKC-INV-2026-001`), while the child selector shows Emmanuel Adebayo · SS2A. The invoice's student link is correct, but the stored `FeeInvoice.title` names another student.
- `[browser]` The bursar's transfer queue repeats this: the row for Emmanuel's invoice shows "Adeola Ogunlade School Fees", and the row for **Fatima Yusuf's** invoice (`YKC-INV-2026-002`) shows **"Emmanuel Adebayo School Fees"**.
- `[code]` `FeeInvoice.title` is a free-text stored string, displayed verbatim. The titles came from the UAT finance seed. I did not verify whether production invoice generation derives them from the student record.
- Impact: a parent can pay an invoice labelled for someone else, and a bursar approving a transfer sees the wrong name beside the right student.
- **Fix:** derive titles from the student record (or make them read-only), and add a check that the title matches the linked student when invoices are generated.

### H5 — Payment failure shows a raw error; the banner blocks Pay; receipt dates are ambiguous (High)
- `[browser]` Pressing *"Pay ₦45,000 with Paystack"* got a 502 from `POST /api/parent/fees/payment-intents`. The parent saw a red toast reading **"fetch failed"**, a technical message (`app/parent/fees/page.tsx:359` is the button).
- `[browser]` On a fresh session the cookie preferences bar (fixed to the bottom edge) covers the Pay button; the click times out until the bar is dismissed. At 1366×820 the same bar covers the centre of the transfer submit button.
- `[browser]` Receipt dates show as `10/1/2026` (`M/D/YYYY`), which Nigerian readers will take as 10 January.
- The bank-transfer confirmation is clear (see H11); the problems above are on the Paystack path.
- Not verified: an actual Paystack transaction, webhook or reconciliation (no internet here).
- **Fix:** map upstream errors to plain language ("We could not reach the payment provider. Your invoice has not changed. Please try again shortly."); make the banner non-blocking (bottom bar or sheet that does not cover actions); format dates as "1 Oct 2026".

### H6 — Browser errors cannot reach Sentry (High)
- `[browser]` With the production CSP, a request to `https://o0.ingest.sentry.io` is refused (*"violates … connect-src"*). `next.config.ts:45` has no Sentry origin.
- Consequence: when a DSN is configured, client-side errors are silently dropped. The go-live checklist requires a received test error.
- **Fix:** allow `https://*.ingest.sentry.io` (or add a tunnel route) and confirm with a forced error on staging.

### H7 — Public CBT API exposes the whole bank and every answer key (High)
- `[API]` `GET /api/cbt/quiz` answers anonymously with question stems and options for any subject (verified for `agricultural-science-bece`).
- `[API]` `POST /api/cbt/check` returns `correctIndex` and the explanation for any question after one call (verified live).
- With H1 the CBT limit is also bypassable, so the bank can be harvested in full.
- `[code]` The public runner `components/cbt/CbtRunner.tsx` is not imported anywhere, and `/cbt` redirects anonymous visitors to login. The public endpoints therefore serve no UI.
- Impact: if any school exam draws from this bank, its integrity is compromised.
- **Fix:** confirm that exam banks are separate; disable or authenticate the `/api/cbt/*` public endpoints until the practice product is ready; remove the dead component.

### H8 — The "Continue to YK-Virtual" link goes to a 404 (High)
- `[code]` `app/login/page.tsx:126` links to `/sso/virtual`, which does not exist. The page requests it on every load (Next.js prefetch), so it shows as a 404 in the network log (`[browser]` confirmed during the staff activation sign-in).
- The federated sign-in is also disabled here (`COLLEGE_SSO_SECRET` unset; the verify endpoints correctly return 503). Copy on the most-used page promises a path that does not exist.
- **Fix:** remove the link and copy, or finish the integration before launch.

### H9 — Menus lead to pages the role cannot use (High)
- `[browser]` The bursar's sidebar lists **30** links. **19** of them open a page whose data calls return 401 for the bursar. On several of those pages the red **"Unauthorized"** banner appears beside the normal heading:
  - *Student Records*: "Unauthorized", then "No student records found", with an active **Enrol student** button.
  - *Class Timetable*: "Unauthorized", with an active **Add a slot** button.
  - *Report Cards*: "Unauthorized".
  - The other failing links are Admissions Queue, Attendance analytics and corrections, Broadsheet, Class Manager, Gradebook lock, ID cards, News, Notifications, Promotion, Question bank, Sessions, Staff, Staff assignments, Staff QR attendance, Subjects and Timetable.
- `[browser]` The coordinator's sidebar has **4** failing links out of its 30: Fee generation, Fee structures (headed "Fee structures", with "Unauthorized" and a RETRY button), Promotion and Sessions & terms. The sessions page reads "Unauthorized" and then **"No current session — Create one so report cards and grades…"**, which reads as though no session exists.
- `[browser]` The director's sidebar has no failing links, but 34 teacher-portal pages the director can reach by URL show "Unauthorized" (see L4). The head of school and the admin account have no failing sidebar links.
- `[code]` The admin layout and sidebar are shared. The API handlers enforce role permissions correctly (the data is protected), but the menu does not mirror those permissions, so users see errors rather than missing links.
- Impact: on day one the bursar meets 19 dead links and an "Enrol student" button on a page that refuses them. Staff will conclude the system is broken, or try to work around it.
- **Fix:** build the sidebar from the same permission map the APIs use; hide routes the role cannot call; replace "Unauthorized" with a clear "This page is not part of your role" state. Confirm the intended permission matrix for DIRECTOR, BURSAR and COORDINATOR, and for HOD.

### H10 — Grading and result release are not where the menu says (High)
- `[browser]` **Grade Exams → Review N** opens `/teacher/test-results?exam=…`, a read-only table of counts. It has no grading inputs and no release control. (Observed: 0 score inputs, 0 Save buttons, 0 release controls.)
- `[browser]` **Exam Centre → Results** opens `/teacher/grade-exams?examId=…`, the same list as the sidebar page. The paper's id is ignored, and "Review" leads to the same read-only page.
- `[browser]` The only place that grades essays and releases results is **Quick Create (Classic)** (`/teacher/cbt-center`). There, *Results* opens the attempts; an essay's marks are entered with *Save Score*; *Release Results* then shows "Results released to students." The teacher had to know to go there.
- `[code]` The grade-exams empty state says *"No exams yet. Create one from the CBT center"*, while the Exam Centre is the page the sidebar calls the starting point. The sidebar comment keeps the Classic page because "removing a page teachers may have bookmarked mid-term is not worth the tidiness" (`components/TeacherSidebar.tsx`).
- Impact: a teacher who follows the menu cannot mark an essay or release a result, and may believe results are held back. Results can be delayed on the day they are due.
- **Fix:** one place for papers, questions, grading, results and release (for example, tabs from the Exam Centre card). Make "Grade Exams" and "Results" open the grading view for that paper, honour `examId`, and retire or clearly rename the Classic page.

### H11 — A bank-transfer claim disappears for the parent; a rejection is never reported (High)
- `[browser]` After *Submit for bursar review*, the parent sees the confirmation **"Transfer submitted. The bursar will verify it before your invoice is updated."** The reference box clears. The claim is recorded (`[DB]` `PENDING`).
- `[browser]` After a full reload, the fee page shows **no trace** of the claim: no reference, no "pending" text. The invoice still reads OUTSTANDING.
- `[browser]` The bursar rejected a second claim (₦93,000, Fatima's invoice): the toast reads "Transfer rejected." The claim leaves the queue (`[DB]` `FAILED`).
- `[browser]` Afterwards the parent's fee page still shows **₦93,000 outstanding**, with no rejection text and no new notification.
- `[code]` `app/api/parent/fees/route.ts` (around lines 54–56) returns only **COMPLETED** payments. `app/api/admin/fees/payments/route.ts` (the `REJECT_TRANSFER` branch, around lines 121–136) marks the claim FAILED and writes an audit entry. The file contains no notification call, and neither does the approval branch.
- Impact: a parent who cannot see a pending claim may pay again through Paystack or resubmit. A parent whose claim was rejected is never told why, so they call the school. The bursar has no way to send the reason back.
- **Fix:** show pending and rejected claims on the invoice (reference, date, status, and the bursar's note). Notify the parent when a claim is approved or rejected. Show the reason in the parent's notification.

### H12 — "View As" is invisible in the portal, has no exit after a reload, and sign-out signs the parent out everywhere (High)
- `[browser]` After *View As* on a parent account, the parent dashboard shows the parent's name ("Mrs. Chinwe Ogunlade") and **no impersonation banner**. The banner exists only on `/super-admin` (`app/super-admin/page.tsx`, around lines 494–508).
- `[browser]` **Reloading `/super-admin` removes the banner and the "End Session" control**, but the browser session is still the parent's. `[API]` `GET /api/auth/me` still returns the parent with an `impersonatedBy` claim. The cookie lasts 60 minutes (`app/api/super-admin/impersonate/route.ts`, around line 110). The state lives only in React memory, and there is no endpoint that reports it.
- `[DB]` **Signing out while impersonating** (`POST /api/auth/logout`, which returns 200) raised the **parent's** `tokenVersion` from 0 to 1, so every session for that parent on every device stopped working. The platform owner's own `tokenVersion` did not change. `[code]` The logout route calls `getSession()`, which during impersonation returns the impersonated parent, and then `revokeAllSessions(user.id)` (`app/api/auth/logout/route.ts`).
- Read-only protection: writes are refused with 403 while impersonating (verified through the API earlier). The UI check could not be repeated, because the chosen invoice was already paid.
- Impact: a support action can show a parent's records with no on-screen signal that the viewer is the platform owner; it can leave the operator inside a parent's session with no way to end it; and it can sign a real parent out of every device.
- **Fix:** show a persistent impersonation banner, with an End button, in every portal layout; add an endpoint that reports the current impersonation; make "End" clear impersonation only, without revoking the target's sessions. The start and end audit entries already exist; surface them to the school.

### M1 — News & Events and WAEC practice are empty on launch (Medium)
- `[code]` `app/news-events/page.tsx:13-15` reads only `prisma.newsPost`. The four markdown articles in `content/news/` are not referenced anywhere (grep finds no reader).
- `[browser]` The public page has no items. Publishing from the admin area works once a post exists ("Publish Now" → visible on the public page), so this is a content gap.
- `[browser]` **WAEC practice** shows *"No practice sets yet — Your teachers haven't published any practice exams for your class yet."* That empty state is clear, but on launch day students will see nothing until each teacher publishes sets for each class.
- **Fix:** publish two or three real news items, and a practice set for each subject and class, before launch, or delete the unused markdown.

### M2 — "undefined students / parents" and a missing analytics KPI (Medium)
- `[browser]` `/teacher/announcements` renders *"All My Students undefined students"* and *"All Parents undefined parents"* (`app/teacher/announcements/page.tsx:182,194`). The same text appears on `/teacher/class/announcements` and in the director's, head of school's, HOD's and second teacher's crawls.
- `[code]` `teacher.totalStudentsTaught` is read by that page and by `app/teacher/analytics/page.tsx:112`, but no API returns that field.

### M3 — Missing articles return HTTP 200 "Page not found" (Medium)
- `[browser]` `/news-events/2025-07-15-admissions-open` returns HTTP 200 with a not-found body. Search engines will index it as content.
- **Fix:** return 404 (`notFound()`) for unknown slugs.

### M4 — Forced password change ends on the portal chooser (Medium)
- `[browser]` After the Head of School sets a new password, the app lands on `/portal` (`app/change-password/page.tsx:29`, `router.replace("/portal")`), not the admin dashboard. The first-run experience needs an extra step.
- **Fix:** send the user to their role's destination, as the login route does.

### M5 — Password rules differ between paths; reset errors are generic (Medium)
- `[code]` Change password requires 12+ characters with upper case, lower case and a digit (`app/api/auth/change-password/route.ts:10`). Password reset requires 12+ characters only (`app/api/auth/password-reset/confirm/route.ts:10`). The staff activation page uses the stricter rule.
- `[API]` Every reset failure returns *"Unable to reset password."*, including an invalid token and a short password.
- **Fix:** use one password policy everywhere, with a specific message for each failure.

### M6 — Malformed requests cause server errors and noisy logs (Medium)
- `[API]` Malformed JSON to admissions draft, submit, upload, payment and document-confirm endpoints returns 500; to CBT attempt and check, 500; to login, 503 "temporarily unavailable". Each is logged as an error (captured in the server log).
- Browsers do not send malformed bodies, so this is not user-visible. It does drown real incidents in error tracking and misreports client errors as outages.
- **Fix:** parse bodies defensively and return 400.

### M7 — Most pages share one generic title (Medium)
- `[browser]` `/about`, `/academics`, `/admissions`, `/contact` and most others use "Ykay College & Leadership Academy — Excellence in Education". Tabs, bookmarks and search results all look the same.
- **Fix:** add per-page `metadata.title` and description.

### M8 — Domain and brand inconsistencies (Medium)
- `[code]` The site fallback is `https://ykaycollege.edu.ng` (`app/layout.tsx`, and about 20 files), while `.env.example`, emails and the sign-in copy use `ykaycollege.com`. Confirm the production domain: it drives canonical URLs, sitemap, OpenGraph, CORS and redirects.
- `[browser]` The logo artwork on the splash screen reads **"TRAINING COLLEGE & LEADERSHIP ACADEMY"**, while the official name in the onboarding form and the site is "Ykay College & Leadership Academy". Confirm with the brand owner.

### M9 — The application fee is not stated before a family starts (Medium)
- `[browser]` No ₦ or NGN amount appears on `/admissions` (text search). Families cannot plan before entering personal details.
- `[browser]` The admissions form has six steps (Student, Parent, Academic, Documents, Payment, Review). The page lists "Online fee payment" among its features but gives no amount.
- **Fix:** show the fee and what it covers on the landing page.

### M10 — The question bank shows no search or filter (Medium)
- `[browser]` `/teacher/question-bank` rendered no input or select controls, for a bank of 5,483 questions.
- Verify with a teacher on real subjects before treating this as final.

### M11 — Staff activation works, but the link lives only in the session (Medium)
- `[browser]` **Verified end to end without email:** the administrator invites a teacher; the one-time activation link appears in a notice on the page; the new teacher opens the link, sets a password and is taken to sign-in; the teacher signs in and reaches a working dashboard.
- `[code]` The server logs *"Staff invite email could not be sent — activation token still returned to admin"* (no `RESEND_API_KEY`). The token is shown in `app/admin/staff/page.tsx` ("The activation token is displayed once and expires after seven days.").
- `[browser]` Gaps: the admin must copy the link before leaving the page; there is no email fallback or resend-by-email; and after activation the teacher lands on sign-in with **no confirmation** that the account is ready.
- **Fix:** keep the copy button, add a "resend link" action and a "copy and mark sent" option, state clearly what to do if the email does not arrive, and show a confirmation after activation.

### M12 — The app download depends on configuration (Medium)
- `[API]` `/download/apk` answers `302 → /download?error=unavailable` while `NEXT_PUBLIC_APK_URL` is unset in this build. I did not confirm how the `/download` page presents that error, because my check selected the wrong link.
- `[code]` `app/download/apk/route.ts` builds that redirect from `NEXT_PUBLIC_SITE_URL`, which falls back to `localhost:3000`. In this build the redirect pointed at localhost. A misconfigured site URL sends parents to localhost.
- **Fix:** set the APK URL and the public site URL before launch, and test the download from a phone.

### M13 — Parent timetable is missing from the web portal (Medium)
- `[code]` `app/api/parent/timetable/route.ts` exists and the mobile app has a parent timetable, but there is no `app/parent/timetable` page and no link to one.
- **Fix:** add the page, or document the gap for parents.

### M14 — Test and exam tools are spread over overlapping pages (Medium)
- `[browser]` The teacher's dashboard and sidebar offer at least nine links for tests and exams: Exam Centre, Upload Questions, Question Bank, Edit Test Courses, Grade Exams, Send Results, Quick Create (Classic), plus Gradebook and Scores. A teacher has to know which page does what.
- `[code]` `components/TeacherSidebar.tsx` explains that the Exam Centre and the Classic builder "query the SAME endpoint", and keeps both.
- Copy: the grade-exams empty state points to the Classic builder; the form asks for "Objective minutes" and "Theory minutes (0 if none)" without explanation; the Results button leads elsewhere (H10).
- **Fix:** consolidate into the Exam Centre (papers, questions, grading, results and release), retire or rename the Classic builder, and align the copy.

---

## 5. Low-severity items

### 5.1 Broken or missing assets
- **L1** Hero background `/home/green-ribs.jpg` returns 404 (`components/Hero.tsx:17`). Decorative, but it is a request on every home visit.
- **L2** `/favicon.ico` returns 404 (the layout uses `/ykay-logo.png`). Browsers request it by default.

### 5.2 Duplicate or dead surfaces
- **L3** `/admissions/status` and `/application-status` are duplicate pages.
- **L4** Admin-family accounts can reach teacher pages that error, because they have no teacher profile. The middleware allows it, and the pages are not linked from the sidebar. `[browser]` On the director's account, `/teacher/gradebook` shows "Unauthorized". The crawls recorded error responses on 34 such pages for both the director and the head of school (typed-in URLs only).
- **L5** `components/cbt/CbtRunner.tsx` is unused; `/cbt` only redirects.
- **L11** The teacher sidebar's **"Class parents"** item opens Messages. `app/teacher/class/parents/page.tsx` redirects to `/teacher/messages` ("superseded"), but the label still promises a list of parents.
- **L12** The **super-admin Portal Hub** says *"Jump straight into any portal's key pages. As super-admin you have read access across all schools and roles."* (`app/super-admin/portals/page.tsx`). Its 19 portal links redirect back to the console, because the middleware limits the super admin to the console and change-password.

### 5.3 Policy questions and smaller UX gaps
- **L6** A student's profile is read-only (photo only). Phone and email corrections go through the school administrator. Confirm this is intended.
- **L7** School-student sessions can read and update the IT profile (own record only; no cross-user access seen). Confirm this is intended.
- **L8** IT course pages do not state the cost, while the public track page says "Start free".
- **L9** An unknown admissions application ID returns *"Enter a valid Application ID."* (422). That is misleading for a well-formed ID that does not exist.
- **L10** A student login with no linked profile shows an empty dashboard (dashboard API returns 404; the page shows empty tiles). The API's own message is "No student profile is linked to this account. Contact the school administrator." I did not confirm whether the page displays that message. This came from UAT seed collisions; check every student login at go-live.

---

## 6. Launch prerequisites (configuration)

These are not code defects. The server reports them at boot, and each one disables a feature that families will need. Treat them as launch items.

| Setting | Current state here | Consequence until fixed |
|---|---|---|
| `RESEND_API_KEY`, `EMAIL_FROM` | unset | Password reset, staff invitations and parent emails will not send. The reset page still says "you will receive a reset link shortly". |
| `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` | unset | Limits are per instance. With multiple instances, security limiters fail closed (503) unless `ALLOW_MEMORY_RATE_LIMITS` is set deliberately. |
| `S3_BUCKET` (+ fix B3) | unset | Admissions uploads fail. |
| `MALWARE_SCANNER_URL` | unset | Uploads are recorded as `SKIPPED`. Acceptable for testing, not for real parent documents. |
| `JOBS_SECRET` or `CRON_SECRET` | unset | The notification dispatcher cannot authenticate, so alerts will not go out. |
| `PAYSTACK_PUBLIC_KEY`, `PAYSTACK_SECRET_KEY` | test keys | Live keys required; the server warns about test keys in production. |
| `NEXT_PUBLIC_SITE_URL` | localhost in this run | Drives links, CORS and the download redirect (M12). |
| `NEXT_PUBLIC_APK_URL`, `ANDROID_CERT_SHA256` | unset | Download unavailable; app links not verified. |
| `NEXT_PUBLIC_SENTRY_DSN` / `SENTRY_DSN` | unset | Errors not reported (and H6 once set). |
| `COLLEGE_SSO_SECRET` | unset | YK-Virtual federated sign-in disabled (H8). |

**Data:** never load the demo seed (`prisma/seed-all.ts`, one shared password) into the production database. Run only the college onboarding seed, and verify with the go-live checklist that no demo or fixture accounts exist. The attendance seed also generates passwords for demo accounts; do not use it in production either.

---

## 7. Facts to confirm with the school before printing anything

1. Full postal address, LGA and state (B7).
2. Production domain: `ykaycollege.com` or `ykaycollege.edu.ng` (M8).
3. The logo's wording and the school's motto (M8, and the seed's "Raising Role Models" versus the env example's "Excellence in Education").
4. The application fee and what it covers (M9).
5. Which IT courses are free, and the policy for paid certification (L8).
6. Whether the public CBT bank is shared with school exams (H7).
7. Whether school students may use the IT portal (L7).
8. Whether students should see **question-by-question feedback** after results are released. Today they see a total only; practice sets show answers.
9. Which admin pages each role should see (H9): in particular, what a bursar and a coordinator should be able to open.
10. For "View As": should the portal show a banner for the whole session, and should "End" end impersonation rather than sign the parent out (H12)?
11. Should parents be notified when a bank transfer is approved or rejected, and what reason should they see (H11)?

---

## 8. What works (verified)

- **Public site:** 47 of 47 anonymous pages load; no horizontal overflow and no unlabelled icon buttons on the 47 mobile pages. All internal links resolve except `/sso/virtual`.
- **Access control:** protected pages redirect to sign-in; anonymous API calls to protected data return 401; the webhook rejects bad signatures; the internal security-event endpoint is forbidden to outsiders; platform self-signup is disabled. With one wrong-role probe per area, no wrong-role access to admin, teacher, student or parent records was found across the 202 handlers. The wrong-role problem is in the menus, not the data (H9); the IT endpoints are covered in L7.
- **Assessment cycle, end to end:** a teacher pastes questions (multiple choice, fill-in, essay), publishes a CA paper, and the student sees it only after the fee lock is cleared. The student answers, autosaves (confirmed in the database), and submits with a confirmation dialog. The paper auto-scored 7 of 12 on the objective questions, the teacher graded the essay (4 of 5), results were released, and the student sees **92% · 11/12 marks**.
- **Practice sets:** a teacher-published practice set is not fee-locked, the student can start it, it scores immediately, and "Best" and "Last" update on the list.
- **Question import:** a plain-text file was parsed into three valid questions (1 MCQ, 1 fill-in, 1 essay) with a preview and a single sync to the draft paper.
- **Fee approval:** approving a bank transfer marks the claim PAID and the invoice PAID (balance ₦0), and the student's paper becomes startable. Rejecting a claim removes it from the queue.
- **Messaging:** a parent writes to the child's form teacher; the teacher sees the thread, replies, and the parent sees the reply.
- **Staff onboarding:** invitation, one-time link, password activation and sign-in all work (see M11 for the gaps).
- **First sign-in:** the forced password change works; the complexity message is specific; a wrong current password is reported clearly.
- **Lockout:** three failures on one account lock it (429) as designed.
- **Impersonation (API):** writes are refused (403 *"Writes are not permitted while impersonating…"*) and reads succeed. The UI gaps are in H12.
- **Sessions:** cookies are `httpOnly`, `secure` in production and `sameSite=lax`. Sign-out bumps the account's token version (`app/api/auth/logout/route.ts`), so every session for that account stops working. This is a design choice to confirm: signing out on a shared lab computer also signs the account out on every other device. While impersonating, the same mechanism reaches the impersonated account (H12).
- **Database:** all 29 migrations apply cleanly on an empty PostgreSQL 16 database.
- **Build:** the production build (including type checks) succeeds.
- **Admissions:** step-1 messages are specific ("First name is required", "Enter a valid date of birth"); the academic step asks for the previous class; the documents step refuses to continue without all four documents, with a clear message.
- **Teacher:** class attendance submits and locks the session; report-card statuses are visible; all 22 sidebar links resolve (the grading links are in H10).
- **Student:** released report card with PDF and print; full weekly timetable; attendance; the fee lock is enforced server-side (H3 covers what the student sees).
- **Parent:** child list and invoices show; report-card download is present; messaging works both ways; the success message after a bank-transfer submission is clear (H11 covers what happens next).
- **Admin:** student search works; report cards show RELEASED and DRAFT; news publishing works end to end.
- **Headers:** CSP, HSTS, `X-Frame-Options: DENY`, `nosniff`, and a restrictive `Permissions-Policy` (camera allowed only on the admin QR scanner route).

---

## 9. Not verified in this audit

- Live Paystack payments, webhooks, reconciliation and the Paystack failure path beyond the 502 message (no internet here).
- Email delivery (no provider configured); object-storage uploads and malware scanning end to end (no bucket configured).
- **Admissions submission and payment:** the Continue button on the documents step needs all four uploads, which cannot succeed here (see B3). The application fee step and the final submit were therefore not reached through the UI.
- The native Android/iOS app (Expo), offline sync and push notifications.
- Parent-to-school notifications of any kind (none are created for transfer approvals or rejections; see H11).
- Exam-day load (for example 60 concurrent starts at the deadline), concurrent grading by several teachers, backups and restore, alerting, DNS and TLS on the real domain.
- Real devices, real networks and other browsers (headless Chromium only). Assistive technology was not tested; contrast and labels were checked programmatically.
- Tenant isolation. `docs/TENANCY_RLS_STATUS.md` documents that row-level security is fail-open and that application-level filtering is the only control. This is not a blocker for one school, but it must be fixed before EDUos onboards a second school.

---

## 10. Test artifacts and how to reproduce

**Sandbox database changes** (these affect only the audit database, never production; delete or reset before reusing it):
- A published paper "Audit test: First Term CA1" for SS2A, inserted directly into the database, to test the fee lock.
- A published CA paper **"UI audit CA1 …"** for SS2A Mathematics, created through the Exam Centre, with one submitted and graded attempt (11/12) and results released.
- A published practice set **"UI audit practice …"** with one attempt (100%).
- A draft paper **"Upload test …"** with three questions from the text-file import.
- Bank-transfer claims: **AUDIT-TRF-…** approved (Emmanuel's invoice YKC-INV-2026-001 is now PAID, so the fee-lock scenario must be reseeded before H3 is re-tested); **AUDIT-REJ-…** rejected (Fatima's invoice YKC-INV-2026-002 is still ₦93,000 outstanding); two further pending claims named **AUDIT-TOAST-…** and **AUDIT-TOAST2-…** remain pending on Fatima's invoice unless rejected.
- A teacher account created by staff activation (an invitation for an `audit.teacher.…@example.com` address); the activated account remains in the audit database.
- A messages thread "Audit: Emmanuel's Mathematics CA …" between the parent and the form teacher.
- A news article from the admin screen ("Launch audit …"), one published and one draft.
- Audit log entries for impersonation (start and end), sign-in attempts and the fee approvals.
- The parent test account's sessions were revoked by the sign-out test (H12), so the parent's session was re-issued through the normal sign-in for the rest of the audit.

**Reproduction kit** (outside the repository, in the workspace): `/home/user/audit/sim/` holds the crawler (`crawl.mjs`, with `run-crawls-2.sh`), the API matrix, the journeys and the verification scripts. The new journeys are `j-exam-cycle.mjs` (phases: teacher-create, student-before, parent-claim, bursar-approve, student-sit, teacher-grade, student-result), `j-fees-reject.mjs`, `j-admissions3.mjs`, `j-staff-activate.mjs`, `j-messages.mjs`, `j-upload-questions.mjs` and `j-superadmin-ui.mjs`. `/home/user/audit/results/` holds the raw JSON (`run1/`, `run2/`, `journeys/`, `api/`); `/home/user/audit/shots/` holds the screenshots. The sandbox-only Prisma harness is in `/home/user/audit/harness/`. Nothing from these folders is part of the product, and no credentials are stored in the repository.

**Suggested order of work before launch:**
1. B4 and B5 (under an hour each).
2. H12 (a persistent impersonation banner with an End control; sign-out that does not revoke the target's sessions) and H11 (show pending and rejected claims; notify the parent).
3. B2 (contact form), then B6 (generate QR codes locally) and B7 (confirm the address).
4. H10 and H9 (one place to grade and release; a role-aware menu), before the first CA of the term.
5. B1 (IT enrolment) and B3 (CSP for storage, plus plain error copy).
6. H1 and H2 (limiter keys and shared-IP budgets).
7. H3–H8 (show the fee-lock reason, invoice titles, payment messages, Sentry, the public CBT API, the YK-Virtual link).

Re-run the journeys after each group (for example `j-exam-cycle.mjs`, `j-fees-reject.mjs`, `j-superadmin-ui.mjs` and `j-admissions3.mjs`).

---

## 11. Blocker status (2026-10-09)

**Pull request:** [PR #24](https://github.com/Teamthy/ykay_eduport-/pull/24), branch `arena/8ce3ce03-ykay-eduport`, fix commit `94e38b0`.

| ID | Blocker | Status | Where the fix is | Verified |
|---|---|---|---|---|
| B1 | IT students cannot enrol | Fixed | `components/it/EnrolButton.tsx`, used on the course page, dashboard and learn page | `[browser]` enrol returns 200; the learn page updates after enrolling from its banner; Mark as Complete is enabled; progress is refused with a readable message until enrolment |
| B2 | Contact form discards enquiries | Fixed | `app/api/contact/route.ts`, `ContactEnquiry` model, migration `20261009120000_add_contact_enquiry`, `app/contact/page.tsx` | `[browser]` success shown only after 201; office alerted in-app. `[DB]` RLS checked as a non-superuser role |
| B3 | Upload blocked by the CSP | Fixed. Production needs storage configured | `lib/csp.ts`, `middleware.ts`, `next.config.ts`; upload routes return 503 when storage is unset | `[browser]` storage unset: 503 with plain text. Storage configured: exact origin allowed, PUT attempted, no CSP violation |
| B4 | Sign-in heading and fields nearly invisible | Fixed | `app/login/page.tsx`, `.login-field` in `app/globals.css` | `[browser]` four portal variants: heading 17.9:1, field border 4.76:1 |
| B5 | Open redirect after sign-in | Fixed | `lib/safe-redirect.ts`, `app/login/page.tsx` | `[browser]` external, protocol-relative and backslash values land on the role home page |
| B6 | QR codes sent to a third party | Fixed | `lib/qr.ts`, `components/QrImage.tsx`, `lib/apk.ts`. The qrserver URLs are removed | `[browser]` QR images are local `data:` URLs; no QR request leaves the site |
| B7 | Unconfirmed school address printed | Fixed. Owner decision open | `lib/school-address.ts`, `/admin/school-profile`, migration `20261009130000_clear_unconfirmed_school_address` | `[browser]` address absent until set, shown everywhere once set, removed when cleared |

**Open decisions**

- **B7, who may set the address.** The PR allows ADMIN, DIRECTOR and SUPER_ADMIN. The school has not yet confirmed this.
- **B3, production configuration.** Uploads need `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY` and the bucket CORS rule in `docs/S3_ADMISSIONS_CORS.json`. Without them, an admissions application cannot be submitted.
- **B2, delivery.** The office is always alerted in-app. Email is sent only when `RESEND_API_KEY` is set. Without Redis, the contact limit is per instance.

**Found while verifying B1–B7, not fixed in this PR** (admissions form; severity to be assigned)

- Step 1 silently refuses to continue. `bloodGroup` and `genotype` start as `undefined`, and `admissionDraftSchema` rejects that, but the errors are not rendered. Workaround: pick the blank option in both selects.
- Step 2: the optional WhatsApp field fails with "Required" when left untouched (`whatsappPhone`). The form cannot continue until a number is entered.
- The documents step needs all four uploads, so the payment step cannot be reached while storage is unavailable.

**Verification of the fixes**

- Production build, Prettier, lint (no errors), typecheck, unit tests (736 pass; the two `tests/mobile` suites need `mobile/node_modules`), Playwright E2E (53 of 53 pass), dead-UI, orphan-page, client-boundary and tenant-coverage checks, `verify:admissions` (14 of 14), and RLS coverage (42 of 42 tenant tables).
- Not run in the sandbox: `check:drift`, `verify:rls` and `verify:rls:coverage`, because the sandbox cannot run the Prisma schema engine or the datasource override these scripts use. CI runs them.

**Still open:** High items H1–H12, Medium items M1–M14 and the low items in sections 4 and 5.
