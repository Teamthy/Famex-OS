# Backend Development Document

## 1. Overview

The backend for Ykay College EduPortal is implemented as a Next.js App Router application with Prisma and PostgreSQL. It is no longer only a website backend; it now serves a multi-role school platform with admissions, authentication, portals, finance, attendance, report cards, IT learning, CBT workflows, notifications, and audit logging.

The system currently has a solid architectural foundation and several modules are already wired to database-backed services. The main remaining work is hardening, completion of operational workflows, and production-grade reliability rather than introducing entirely new architecture.

---

## 2. Core Backend Areas

### A. Authentication and authorization
The backend provides:

- login and logout endpoints,
- password reset request/confirm flows,
- session cookie issuance,
- role-aware middleware enforcement,
- and security-event recording for failed or denied access.

The login route validates credentials against Prisma-stored user records, applies rate limiting, records audit events, and issues secure session cookies. Middleware enforces portal access by role and redirects users to the appropriate destination.

### B. Admissions workflow
The admissions backend includes:

- draft creation,
- upload token creation and document confirmation,
- payment initiation and verification,
- application submission,
- status lookup,
- and audit logging.

The implementation uses a dedicated admissions service layer plus Prisma models for applications, documents, and payment transactions. It also includes payment verification and idempotency-oriented enforcement patterns.

### C. School operations APIs
The backend exposes portal APIs for:

- admin dashboards and management routes,
- teacher dashboards, attendance, gradebooks, exams, question banks, and class features,
- student dashboards, attendance, grades, exams, profile, timetable, and announcements,
- parent dashboards, fees, attendance, report cards, and messages,
- super-admin oversight, impersonation, system monitoring, broadcast, and health routes.

These APIs are backed by Prisma queries and are designed for role-restricted access through a shared session-based auth layer.

### D. Finance and records
The backend includes finance-related data models and API routes for:

- fee invoices,
- fee payments,
- payment attempts,
- report cards,
- and notification jobs.

The schema supports invoice lifecycle states, payment methods, receipts, and financial records tied to students and parents.

### E. IT education and CBT
The backend includes support for:

- IT course catalog and course detail data,
- learner enrollment and module progress,
- course certificates,
- exam creation, question storage, exam attempts, and retakes.

These parts are implemented structurally and are already surfaced in the UI, although some operational workflows still need deeper completion.

---

## 3. Current Backend Architecture

### Framework and runtime
- Next.js App Router
- TypeScript
- Node.js runtime for API routes
- Prisma ORM for database access

### Primary persistence model
The Prisma schema includes entities for:

- School
- User
- TeacherProfile
- ParentProfile
- StudentProfile
- SchoolClass
- AttendanceSession and AttendanceEntry
- FeeInvoice, FeePayment, FeePaymentAttempt
- ReportCard and ReportCardSubject
- ItCourse, ItModule, ItEnrollment, ItCertificate
- Exam, ExamQuestion, ExamAttempt, ExamAnswer, ExamRetake
- NotificationJob and UserNotification
- AuditLog, StaffInvite, SecurityEvent, and system flags

### Security model
The backend uses:

- bcrypt for password hashing,
- signed session cookies via jose,
- middleware-based route protection,
- role checks in route handlers,
- and security event logging for access failures and privilege events.

### Integration model
The system is prepared for external integrations such as:

- Paystack for payments,
- Resend for email,
- S3-compatible storage for documents,
- Redis/Upstash for rate limiting and operational tooling.

---

## 4. Current Backend Maturity

### Implemented and working
- authentication and role-aware routing,
- admissions submission and payment verification,
- admin and student dashboard data endpoints,
- teacher and parent portal APIs,
- attendance and report-card data structures,
- IT catalog, course, and enrollment schemas,
- audit logging and security-event infrastructure.

### Partially implemented
- admissions approval/decline/waitlist workflow,
- full onboarding and school-setup workflow,
- notification delivery automation and retry logic,
- finance reconciliation and invoice lifecycle management,
- exam moderation and result delivery experience,
- archival and retention automation.

### Not yet production-ready
- full disaster recovery and backup orchestration,
- formal retention policy automation,
- advanced monitoring and alerting,
- comprehensive operational runbooks,
- full workflow completion for all portal modules.

---

## 5. Backend Requirements and Standards

### Functional requirements already covered
- secure sign-in and portal routing,
- admissions submission and status tracking,
- dashboard data access by role,
- academic and attendance record persistence,
- fee and payment record support,
- IT course and certificate support,
- exam and report-card data management.

### Non-functional requirements still needing stronger delivery
- consistent validation and error handling across all modules,
- stronger observability and monitoring,
- better idempotency enforcement for finance flows,
- formal backup and archive operations,
- stricter audit compliance and data retention automation.

---

## 6. Key Risks and Gaps

- Some flows are structurally implemented but not fully operational end to end.
- The backend is feature-rich, but operational reliability still needs hardening.
- Finance and admissions workflows need stronger safeguards around idempotency and auditability.
- Notification and archival systems need more mature automation.
- The platform would benefit from a formal onboarding and school-setup process before wider rollout.

---

## 7. Recommended Backend Priorities

### Priority 1 — Harden the core platform
Improve validation, error handling, logging, and resilience around authentication, admissions, and portal APIs.

### Priority 2 — Complete the school operations loop
Bring admissions review, enrollment handoff, parent/student account provisioning, and staff onboarding to full operational completion.

### Priority 3 — Strengthen finance and retention
Make fee, payment, receipt, and archival workflows more robust and auditable.

### Priority 4 — Mature IT and CBT features
Complete certificate flow, progress tracking, exam moderation, and result delivery experience.

### Priority 5 — Prepare for deployment
Document backup, restore, monitoring, and operational procedures so the platform can be run reliably in production.

---

## 8. Backend Summary

The backend has moved beyond a simple website API layer and now forms the operational foundation of a school platform. The most important next step is not to add more features blindly, but to complete existing workflows, harden the system for real use, and make the data model and operations reliable enough for production deployment.
