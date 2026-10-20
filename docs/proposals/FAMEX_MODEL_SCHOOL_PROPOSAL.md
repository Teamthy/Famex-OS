# PROPOSAL

## School Website and Computer-Based Testing (CBT) Software

**Prepared for:** The Proprietor and Management, FAMEX Model School

**Prepared by:** Adewuyi Adeyemi Reuben

**Date:** October 17, 2026

---

## 1. Executive Summary

FAMEX Model School is built on academic excellence, disciplined teaching, and a modern learning environment. This proposal outlines the design, development, and deployment of two connected digital systems that will turn that standard into something visible and operational for parents, staff, and students:

1. **A professional, mobile-first school website** that presents FAMEX Model School to prospective parents, education regulators, and the public, and acts as the school's permanent communication hub.
2. **A Computer-Based Testing (CBT) platform** — covering class tests, terminal examinations, and JAMB/WAEC/NECO-format mocks — with secure question banking, automatic and teacher-aided marking, offline/LAN capability for exam halls, and management reporting.

When delivered, the systems will:

- Give FAMEX a credible, findable online presence that drives admissions enquiries 24 hours a day.
- Cut per-term paper, printing, and marking overhead, and remove calculation errors from result compilation.
- Let teachers build and reuse question banks across terms, including objective **and** theory sections with partial-mark support.
- Let students sit exams reliably even when internet service is unstable, using a fully offline-capable runner that saves answers locally and syncs automatically on reconnection.
- Give proprietor and management a real-time view of performance by class, subject, student, and question — the data needed to intervene early and celebrate progress.
- Position FAMEX students for external CBT examinations (JAMB UTME, WAEC CBT, NECO NCEE/BECE) by making computer-based sittings routine, not a novelty.

The systems are delivered as one integrated platform with shared login, so the website and CBT are not separate products but parts of one digital front door for the school.

---

## 2. Background and Need

Parents today begin their school search online. A school without a credible website is filtered out before the first visit; a school with outdated information or broken contact forms loses enquiries to the next school on the list. Prospective parents expect to find admissions requirements, school fees guidance, recent news, photos of facilities, and a working phone or WhatsApp channel in one place — and they expect it to load cleanly on a phone.

Internally, paper-based examination administration is increasingly difficult to sustain:

- **Recurring cost**: every test and exam cycle demands fresh printing, answer booklets, and collation materials — costs that scale with student population and never decrease.
- **Marking workload**: teachers spend evenings and weekends marking scripts that a computer can grade in seconds; theory scripts still need the teacher's judgment, but the system can present them one question at a time for faster, more consistent marking.
- **Human error**: transposition mistakes in score sheets, lost scripts, and incorrect totals in broadsheets affect both students and the integrity of terminal reports.
- **Limited insight**: on paper, it is difficult to see *which* question 70% of a class failed, or how a topic performs across three arms, until long after the exam.
- **External-exam readiness**: JAMB, WAEC, and NECO now run core papers as CBT. Students who only ever write on paper enter those halls at a real disadvantage — slower on the interface, unfamiliar with flag/navigate/auto-submit behaviour, more anxious on exam day.
- **Malpractice pressure**: paper scripts pass through many hands; question leakage, copying, and after-exam alterations are harder to detect and prevent without randomisation and access logs.

A well-built website and CBT system directly address each of these — not as technology for its own sake, but as operational tools that reduce friction, raise quality, and protect the school's reputation.

---

## 3. Project Objectives

The engagement succeeds when, by launch, FAMEX Model School can point to the following measurable outcomes:

1. A responsive, SEO-ready public website that works on phones, tablets, and desktops, with all sections (About, Admissions, Academics, News, Gallery, Contact) populated and an admin panel that lets designated staff update content without calling a developer.
2. A working online admissions enquiry channel, with every enquiry delivered to a designated school email and/or WhatsApp number.
3. A secure CBT platform deployed for at least one pilot class during the engagement, covering class tests, a mid-term test, and one full mock exam cycle before handover.
4. Automatic marking for all objective questions (multiple choice, true/false) with scores computed instantly and accurately, eliminating arithmetic errors.
5. A teacher theory-marking interface that presents essay and fill-in answers one question at a time across all scripts, with one-touch partial marks, comment support, and a finalise step that totals objective + theory and publishes grades.
6. A reusable question bank per subject, class, and topic, supporting images, tables, and mathematical/accounting notation, with bulk upload from Word/Excel templates.
7. Management dashboards showing class performance, subject performance, question-level item analysis, and individual student reports, exportable to PDF and Excel.
8. Offline/LAN exam capability: students can start, sit, and submit exams on the school network without internet; answers auto-save locally and the system resumes from the exact question if a device restarts.
9. A documented anti-malpractice configuration: shuffled questions and options, one active session per student, login and submission logs, and optional LAN-only enforcement during sittings.
10. Familiarity: every teacher and a sample of students will have been trained hands-on, and the school will have printed/emailed quick-start guides for each role.

---

## 4. Scope of Work

### 4.1 School Website

| **Section** | **Description** |
|---|---|
| **Home** | Hero banner with school motto/crest, highlights (results, facilities, upcoming events), latest announcements, quick links to Admissions, Portal, and Contact. |
| **About Us** | School history, vision, mission, core values, proprietor's welcome message, school anthem/crest, and accreditation/affiliation information. |
| **Academics** | Curriculum overview (Junior and Senior Secondary), class levels (JSS 1–3, SS 1–3), subjects offered per class, academic calendar downloadable as PDF, and examination policy summary. |
| **Admissions** | Admission requirements by class, step-by-step application process, fees overview (with a clear "contact the school for current schedule" note), and an online enquiry/application form that captures parent name, phone, email, child's current class, and desired entry class. |
| **Staff / Leadership** | Profiles of the proprietor, principal, head teachers, and teaching staff (with optional photos and qualifications, as provided by the school). |
| **News & Events** | Announcements, event calendar, PTA notices, end-of-term programmes, holiday schedules — updateable by school staff from the admin panel. |
| **Gallery** | Photos and (where available) short videos of school life, facilities, inter-house sports, speech days, excursions, and classroom activities, organised by album. |
| **Contact** | School address with embedded Google Map, official phone lines, email address(es), WhatsApp click-to-chat button, and an enquiry form. |
| **Portal Links** | Prominent buttons linking to the CBT platform (and, in future phases, other school services such as the parent portal or result checker). |
| **Prospectus Download** | Optional downloadable school prospectus/brochure in PDF for prospective parents. |

**Technical features**

- Fully responsive layout (phones, tablets, desktops) with fast load times.
- Search-engine optimisation (SEO) — correct page titles, meta descriptions, Open Graph tags for sharing on WhatsApp/Facebook.
- Social media integration (links to the school's Facebook/Instagram/WhatsApp channels).
- Floating WhatsApp contact button visible on every page.
- Secure HTTPS hosting with SSL certificate.
- Content management (CMS) admin panel: authorised staff can post news, upload gallery photos, update the academic calendar, and edit contact details without writing code.
- Basic accessibility: readable contrast, keyboard-navigable forms, descriptive image captions where provided.
- Analytics overview (number of visitors, top pages, enquiry submissions) visible to admin.

### 4.2 CBT Software

The CBT is built around three role-based modules — Administrator (Management), Teacher, and Student — with security and reporting as shared foundations.

**Administrator (Management) module**

- Create and manage **classes**, **arms**, **subjects**, **sessions**, **terms**, **students**, and **teacher accounts** from one dashboard.
- Bulk import of students/teachers from Excel/CSV templates (provided).
- Schedule tests and exams with: start date/time, closing window, duration, shuffle rules, whether results are shown immediately or on release, and whether the exam is restricted to school LAN.
- Approve, publish, or retract exams before students see them.
- View, filter, and export results by **student**, **class**, **subject**, **term**, or **question**.
- Performance dashboards: class average, subject strength/weakness, top and bottom performers, pass/fail rates against pass-mark.
- Item analysis: for every question, see percentage of students who chose each option — to identify badly-worded questions or topics that need re-teaching.
- Broadsheet generation (one class, one subject, one term) exportable to Excel and printable PDF.
- User activity log (logins, exam starts/submissions, result views) for audit.
- Account controls: reset passwords, disable accounts, enforce one active session per student during exams.

**Teacher module**

- Build and maintain **question banks** organised by subject, class, and topic.
- Supported question types:
  - **Multiple choice (single-best answer)** with 2–6 options.
  - **True/False**.
  - **Fill-in-the-blank / short answer** (auto-matched against acceptable answers, with teacher override for partial marks).
  - **Essay / theory** (student types free-text; teacher marks from a dedicated carousel interface with one-touch 0 / ¼ / ½ / ¾ / full-mark buttons and a numeric input for partial marks).
- Images, tables, and basic mathematical/accounting notation support in question text and options (for accounts formats, T-accounts, timelines, diagrams).
- Shuffle question order and shuffle option order per student to reduce copying.
- **Bulk upload** of questions from Word or Excel templates (templates provided as part of deliverables).
- Exam builder: pick questions from the bank by topic/difficulty, set duration and marks, preview exactly what the student sees.
- Live marking queue for theory questions: per-question progress bar, "pending only" filter, one-click finalise-and-publish when all scripts are marked.
- Release or withhold results per exam (students only see results when released by management/teacher).

**Student module**

- Secure login with unique student credentials (student ID + password; optional PIN for exam sittings).
- Clean exam interface:
  - Large countdown timer that turns red in the final minutes.
  - Question navigation panel with "answered / unanswered / flagged" states.
  - Flag-for-review button so students can return to difficult questions.
  - Auto-save of every answer as it is typed or selected.
  - Auto-submit when time expires (no student can stay in past the allotted duration).
  - Resume-from-interruption: if the device restarts, the browser closes, or the network drops, returning to the exam restores the student's exact position, answers, and remaining time.
- "Your sittings" status view: students can see which exams are available, in progress, submitted (waiting to sync if offline), submitted-and-synced, or marked/released.
- Instant result view for objective-only exams *where the school permits* (toggleable per exam); theory results appear once the teacher has finalised marking.
- **Practice mode** for self-study: students can take past-question quizzes by subject/topic, with immediate feedback, outside of formal exam settings.
- Result history: every past exam result, with question-by-question breakdown, is retained and revisable (useful for revision before WAEC/JAMB).

**Offline/LAN capability (a core feature, not an afterthought)**

- Teachers/admins can pre-download exam packages to student devices ahead of the sitting (e.g., the night before) — without starting the countdown timer on the server.
- Students can start, answer, and submit the exam while completely offline (airplane mode safe); answers are encrypted and stored locally.
- When connectivity returns — whether on the school LAN or after returning home — answers sync automatically. Duplicate or replayed submissions are rejected idempotently so a student cannot accidentally submit twice.
- Late submissions (after the scheduled window closes) are clearly flagged for teacher/management review rather than silently accepted or rejected.
- Failed syncs are surfaced to the student with a one-tap Retry button, so no paper is lost.
- Answer keys are **never** sent to the student device, even in the offline package, so a compromised device cannot leak the paper.

**Security and integrity**

- Role-based access control: Administrator, Teacher, Student (with future-proofing for Parent and Bursar roles).
- One active session per student during exam windows; login and submission logs retained per sitting.
- Optional LAN-only enforcement: an exam can be set so it is only reachable from the school network during sitting hours.
- Encrypted password storage; CSRF and common web-attack protections.
- No answer keys on the client; all objective scoring happens server-side at submission time.
- Regular automated database backups (daily retained for 30 days; weekly retained longer).

**Reporting**

- Individual result slips (student name, class, subject, score, percentage, grade, remark, teacher comment).
- Class broadsheets (students × questions or students × subjects).
- Item analysis: facility index and discrimination index per question to show which questions the class found hardest.
- Termly/annual performance summaries by class and subject.
- Export to Excel (.xlsx) and PDF for printing and filing.

### 4.3 Out of Scope (available as future phases)

The following are explicitly **not** included in this engagement to keep delivery focused. They can be added under a separate quotation once the website and CBT are live and bedded in:

- Full school ERP / management system (end-to-end fees ledger, payroll, statutory deductions, comprehensive attendance).
- Dedicated parent mobile application (a parent-facing web portal can be added as Phase 2).
- Online payment gateway integration (card, bank transfer, USSD).
- Live / virtual / hybrid classroom tools (video streaming, live whiteboards).
- Biometric or AI proctoring (face recognition, eye-tracking).
- Multi-campus / multi-branch support.

---

## 5. Proposed Approach and Technology

The platform is built with modern, widely supported web technologies, chosen for reliability, low maintenance cost, and ease of handover. The stack is deliberately standard — not tied to any one developer — so future developers (including internal IT staff as the school grows) can extend it.

**Deployment modes** (the school will be advised on the best fit during Phase 1):

- **Online (cloud-hosted) mode**: accessible from any approved internet-connected device; best for parents viewing the website and for students taking practice tests or homework quizzes from home.
- **Offline/LAN mode**: the same platform installed on a school server or a dedicated lab machine and accessed over the school's local network. Examinations run without dependence on public internet; results sync to the cloud when connectivity is available.
- **Hybrid (recommended)**: the public website lives online; CBT examinations run on the LAN during sittings but sync with the cloud dashboard for management reporting.

**Design principles**

- Mobile-first: over 60% of parents visit school websites on a phone; every page is designed there first.
- Accessibility: readable fonts, clear contrast, labelled forms.
- Teacher-first UX for marking: the theory-marking flow is modelled on how teachers actually grade papers — question-by-question across all scripts, not script-by-script — to speed it up.
- Student-first exam UX: large buttons, no intrusive animations, obvious flag/next/previous controls, no surprises on auto-submit.
- Fail-safe networking: the offline exam runner tolerates dropped Wi-Fi, force-quit apps, and device restarts without losing answers.
- Ownership: the school owns its data; exports are always available without lock-in.

---

## 6. Project Phases and Timeline

The overall engagement is **approximately 10 weeks** from approval to go-live, followed by 3 months of post-launch support. Timelines assume timely feedback (≤ 3 working days per review) and prompt supply of content and sample data by the school.

| **Phase** | **Activities** | **Duration** |
|---|---|---|
| **1. Discovery & Planning** | Kickoff meeting with proprietor/management; confirm classes/arms/subjects for pilot; collect logo, school colours, existing photos, prospectus; agree deployment mode (online / LAN / hybrid); identify pilot class and teachers; finalise design direction; sign-off on requirements document. | **Week 1** |
| **2. Design** | Website wireframes and visual mock-ups (homepage, one inner page); CBT student runner mock-up (exam screen, results screen); teacher marking screen mock-up; management dashboard mock-up; review and revision cycle until approval. | **Weeks 2–3** |
| **3. Development** | Build and integrate the website (all sections, CMS admin panel); build CBT core — user accounts, classes/subjects/terms, question bank, exam builder, student runner (online + offline), auto-scoring, theory marking carousel, results release, broadsheets and item analysis reports. | **Weeks 3–8** |
| **4. Content Entry & Setup** | Upload provided school content (about text, photos, news, academic calendar PDF); seed pilot class, subjects, and at least one full question bank per pilot subject; create teacher and student accounts for the pilot class; run an internal smoke test. | **Weeks 7–8** |
| **5. Testing & Pilot** | Functional testing across phones and lab computers; security review; load simulation for a full-class sitting; run a pilot exam with the sample class under realistic conditions; fix issues; UAT sign-off with management. | **Weeks 8–9** |
| **6. Training & Launch** | Two hands-on training sessions: (a) for teachers/admins — content updates, question authoring, exam scheduling, theory marking, report export; (b) for students — login, sitting, flag/review, auto-submit, viewing results; provide printed quick-start guides; soft launch the website; go-live for real examinations at the next approved test window. | **Weeks 9–10** |
| **7. Post-Launch Support** | Bug fixes, incident response, minor content/configuration adjustments, phone/WhatsApp support for the designated school contact; mid-support review meeting at week 6. | **3 months after launch** |

**Optional on-going support** after the 3-month period is available as a separate annual or termly retainer (hosting/domain renewal + maintenance) — see Section 9.

---

## 7. Deliverables

At handover, the school will receive:

1. **Fully functional, responsive school website**, live on the agreed domain, with all sections in Section 4.1 populated.
2. **Fully functional CBT platform** with Administrator, Teacher, and Student modules, including offline/LAN exam support, theory marking with partial marks, and reporting (broadsheets, item analysis, individual result slips).
3. **Website content-management admin panel** so authorised staff can post news, upload gallery photos, update calendar, and edit contact information after handover.
4. **Question-bank templates** (Excel and Word) for bulk upload, with sample questions to illustrate format.
5. **Bulk-import templates** for student and staff accounts (Excel/CSV), with the pilot accounts already loaded.
6. **User manuals**:
   - Administrator / Management quick-start guide (print and PDF).
   - Teacher guide: creating questions, setting exams, marking theory, releasing results.
   - Student guide: logging in, sitting an exam, reviewing answers, viewing results.
7. **Two hands-on training sessions** (staff/administrators and students) during launch week, plus one follow-up Q&A session during the support period.
8. **Pilot exam cycle completed** with the agreed pilot class before sign-off, so the school has seen the system operate end-to-end under real conditions.
9. **Credentials and access handover**: admin login, domain/DNS access, hosting dashboard access (or documented contact with the host), and source-code/escrow arrangements as agreed in the final contract.
10. **Three months of post-launch technical support** (bug fixes, minor adjustments, incident response by phone/WhatsApp/email during school hours).

---

## 8. Roles and Responsibilities

**Developer (Adewuyi Adeyemi Reuben)**

- Design, develop, test, deploy, and document the website and CBT platform as described.
- Provide agreed hosting/domain/infrastructure setup for the first year, as itemised in Section 9.
- Configure backups, monitoring, and transactional email/WhatsApp messaging for the platform.
- Deliver training sessions and user manuals.
- Provide post-launch support for 3 months from go-live.
- Treat all school data (student records, results, staff details) as confidential.

**FAMEX Model School**

- Provide school logo, photographs, text content (history, vision/mission, proprietor message, academic calendar, admissions text, staff profiles as available), and any existing prospectus/brochure materials in electronic form.
- Nominate **one designated point of contact** (e.g., the principal or an assigned staff member) authorised to give approvals, provide content, and coordinate training.
- Provide student and staff lists (names, classes, subjects assigned) in Excel/CSV or the provided template at the start of Phase 4.
- Make the computer lab or a set of student devices available for pilot testing and training.
- Provide domain preference (e.g., famexmodelschool.edu.ng or famexmodel.sch.ng) and the official school email/WhatsApp line to be used on the website.
- Provide timely feedback and sign-off at each phase milestone (target: ≤ 3 working days per review) to keep the project on schedule.
- Assign a staff member to be trained as the internal "super-user" who can handle day-to-day content updates and be the first line of support for simple teacher/student questions.

---

## 9. Investment

**Item**

**Cost (₦)**

Render (Backend hosting)

#400,000

Watsap business message credit

#200,000

**Domain registration**

#150,000

DB back up &file storage

#150,000

Monitoring transaction email

#100,000

Workmanship

#750,000

TOTAL.                                              =# 1,750,000:00                                                                                    

**Optional recurring costs after the support period:** annual hosting and domain renewal, and a maintenance and support plan (monthly or termly).

**Suggested payment schedule:** 50% on approval of the proposal; 30% on completion of development and testing; 20% on launch and handover.

---

## 10. Benefits to the School

**To the Proprietor and Management**

- A professional online identity that builds trust with parents, supports admission drives, and presents the school the way management wants it seen.
- Direct visibility into academic performance — by class, subject, and question — without waiting for paper collation.
- A defensible audit trail: every exam sitting, every answer, every mark, every login is logged and retrievable.
- A platform that can grow with the school; future phases (parent portal, online fees payments, attendance, result checking) extend the same system rather than replacing it.
- Reduced reliance on any single staff member's personal spreadsheet or paper record.

**To Teachers**

- Dramatically reduced marking load for objective papers — scripts that would take an evening to mark are graded at submission time.
- Faster, more consistent theory marking: one question at a time across every script, with partial-mark shortcuts and a finalise step that totals automatically.
- Reusable question bank — a good question set once and used for multiple terms/mocks with shuffle.
- Bulk upload from Word/Excel means teachers do not have to retype existing questions.
- Item analysis highlights questions that are too easy, too hard, or ambiguous — feedback that improves teaching and question setting in future.

**To Students**

- Early, repeated exposure to a CBT interface reduces anxiety and builds competence for JAMB, WAEC, and NECO.
- Fairer sittings: randomised questions/options reduce copying; auto-submit removes disputes about "I needed one more minute."
- No lost answers: auto-save and resume behaviour means a power cut or app crash does not cost a student their paper.
- Faster feedback: objective results available immediately where the school allows, and theory results returned sooner because marking is faster.
- Practice mode supports self-directed revision using questions the school has already set.

**To Parents**

- A website they can proudly share with relatives and that gives them confidence in their choice of school.
- Clear public information about admissions, calendar, and contact channels — fewer calls to the front desk for basic questions.
- (Future phase) A parent-facing portal for viewing their child's results and school announcements, built on the same platform.

**Financially**

- Elimination of per-exam printing, answer booklet, and collation costs, which recur every term across every class.
- Reduced staff overtime spent on manual marking and result compilation.
- Lower risk of result errors that can damage the school's reputation and require costly re-issuance.
- A platform paid for once (plus modest recurring hosting) rather than a per-student, per-term SaaS fee that grows with the school.

---

## 11. Risk Management

| **Risk** | **Impact** | **Mitigation** |
|---|---|---|
| **Unreliable or slow internet during exam sittings** | Students cannot start or submit; disruption | Offline/LAN deployment mode; student runner works fully offline with local auto-save and automatic sync on reconnection; exam packages pre-downloadable before the sitting begins. |
| **Power interruption mid-exam** | Device shutdown; potential loss of answers | Answers auto-save on every selection; resume-where-you-stopped restores question position, answers, and remaining time; school is advised to have a backup UPS or generator for the lab during major sittings. |
| **Device or browser crash** | Student ejected from exam | Same resume behaviour as above; one-active-session rule allows the student to log back in on the same device and continue without admin intervention. |
| **Data loss** | Loss of student records or results | Scheduled automated database backups (daily retained for 30 days); database and file storage backed up to a separate storage location from the application server; one-click export of results to Excel/PDF at any time. |
| **Staff unfamiliarity with the system** | Slow adoption; under-use of features | Hands-on training for teachers, admins, and students before launch; printed quick-start guides for each role; a designated internal "super-user"; 3 months of phone/WhatsApp/email support after go-live. |
| **Delays in content or data supply** | Timeline slip | Agreed content deadlines shared in Phase 1; a single school point of contact; templates provided so the school knows exactly what is needed and in what format. |
| **Examination malpractice** | Compromised results; reputational damage | Shuffled questions and options per student; one active session per account; login and submission audit logs; optional LAN-only restriction during sittings; answer keys never sent to client devices; late submissions flagged for review instead of being silently accepted. |
| **Security breach / unauthorised access** | Data leak or altered results | Role-based access; encrypted passwords; HTTPS everywhere; standard web attack protections (CSRF, injection); no answer keys on client devices; activity logs for admin actions. |
| **Developer unavailability after handover** | Platform stuck if changes are needed | Built on standard, widely documented web technologies so other competent developers can maintain it; full source code and credentials handed over at launch; documentation and manuals provided; optional annual maintenance retainer. |
| **Scope creep (new demands during build)** | Delays and budget pressure | Written scope in this proposal; changes outside agreed scope are quoted and approved separately as a change request, with timeline impact stated in writing. |

---

## 12. About the Developer

Adewuyi Adeyemi Reuben is an educator with a Higher National Diploma (HND) in Accounting and direct classroom experience teaching Financial Accounting, Economics, Government, Civic Education, and Business Studies across JSS 1 to SS 3. That teaching background is central to this proposal: the CBT is designed around how teachers actually set questions (subject-by-subject, topic-by-topic, with images and tabular material for accounts and economics) and how students actually experience an exam hall (anxiety, the need for a clear timer, the consequences of a device dying mid-paper).

The design priorities — offline reliability, one-question-at-a-time theory marking, resume-after-interruption, no answer keys on student devices, item analysis for teachers — all come from classroom observation of what goes wrong during paper exams and what makes teachers resist or embrace a digital system. The website is designed with the same practical bias: parents find the information they need in under a minute; school staff can update news and gallery photos without calling a developer; enquiries actually reach someone responsible.

References from schools currently using the platform (or earlier deployments) are available on request.

---

## 13. Terms and Conditions

1. This proposal is valid for **30 days** from the date stated on the cover.
2. Work commences on **written approval** (signed proposal or formal email approval) and **receipt of the first payment** as set out in Section 9.
3. All intellectual property in the school's content (logo, photos, text, prospectus, questions, student data) remains with FAMEX Model School at all times.
4. All student and staff data will be treated as confidential, stored securely, used only for purposes connected with school operations, and never shared with third parties except where required by law or with written school approval.
5. The developer will provide credentials and access to all systems (hosting, domain, admin accounts) as part of handover.
6. Changes requested by the school that fall outside the scope in Section 4 will be quoted separately in writing (cost + timeline impact) and commenced only on written approval.
7. Timelines assume timely feedback and supply of content by the school, as described in Section 6. Delays caused by the school awaiting content or sign-off extend the timeline commensurately.
8. The 3-month support period covers bug fixes and minor adjustments only; new features or major changes are scoped separately.
9. Hosting, domain, WhatsApp credit, backup, monitoring, and email costs in Section 9 cover the first year of operation as specified; renewal terms will be communicated ahead of renewal date.
10. A formal contract / letter of engagement will be signed between the developer and FAMEX Model School before commencement, incorporating this proposal as the statement of work.
11. Either party may terminate the engagement for material breach with 14 days' written notice, with payment for work completed up to the date of termination.
12. The school may use the platform for its own educational purposes without restriction; resale or commercial licensing to other schools requires a separate agreement with the developer.

---

## 14. Approval

By signing below, FAMEX Model School accepts this proposal and authorises the work to begin on the terms set out above.

**For FAMEX Model School**

Name: ______________________________

Position: ___________________________

Signature: __________________________

Date: ______________________________

**Developer**

Name: Adewuyi Adeyemi Reuben

Signature: __________________________

Date: ______________________________

---

*Thank you for considering this proposal. I would welcome the opportunity to meet with the proprietor and management of FAMEX Model School to walk through the platform, answer questions, and agree the next steps.*
