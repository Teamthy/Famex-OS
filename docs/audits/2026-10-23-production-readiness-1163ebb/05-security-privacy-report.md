# 05 — Security & privacy report

## Overall verdict

**FAIL.** The codebase contains meaningful security controls, but the public CBT oracle, admissions-file state gaps, incomplete authorization matrix, dependency gate failure, database privilege model, provisioning weaknesses, and child-data privacy gaps prevent a production security pass.

This was a source and configuration audit with exact-commit CI evidence. It was not a penetration test against a live staging or production environment. Dynamic application security testing, container scanning, infrastructure scanning, and provider-side verification remain **NOT VERIFIED** unless explicitly stated.

## Positive controls observed

- Password login uses bcrypt hashes through the application auth flow.
- API session resolution rechecks database state such as active/suspended status and `tokenVersion`; middleware alone is not the only API defense.
- TOTP MFA exists with encrypted secrets and hashed single-use recovery codes.
- Paystack webhook handling includes HMAC verification; payment verification checks provider success, exact amount, currency, and email at the verification layer.
- CORS uses resolved allowed origins rather than a universal credentialed wildcard in the inspected middleware.
- Security headers and CSP are applied through Next configuration/middleware.
- Money postings use integer minor units and transactional ledger functions.
- Notification dispatch uses an atomic claim pattern and backoff rather than naïve repeated sends.
- The codebase contains rate limiting for sensitive public/auth endpoints.

## OWASP-oriented findings

| Area | Status | Finding |
|---|---|---|
| Broken access control | FAIL | Exam attempt/package/replay checks do not consistently prove subject entitlement; clinic access is over-broad; newer roles have inconsistent page/API authority |
| Cryptographic failures | FAIL | `AUTH_SECRET` is reused for session signing, middleware's `x-internal-secret`, and potentially MFA encryption fallback; long-lived JWT design lacks issuer/audience/JTI evidence |
| Injection | NOT VERIFIED | Prisma parameterization is the dominant pattern and no live DAST/SAST proof was available; raw-query and rich-text/PDF paths require dedicated scanning before PASS |
| Insecure design | FAIL | Public CBT answer oracle, type-only admissions document completeness, reference-only payment replay, deterministic report verification |
| Security misconfiguration | FAIL | App DB user defaults to owner in OCI Compose; mutable container tags; degraded readiness returns HTTP 200; unprotected GitHub `main` |
| Vulnerable components | FAIL | Root dependency gate exits 1 on 2026-10-23; mobile lockfile reports 1 critical/27 high/8 moderate, with incomplete runtime-reachability triage |
| Authentication failures | FAIL | Broken student provisioning script, staff-visible temporary passwords, MFA expected but not universally forced for privileged roles, 30-day sessions |
| Software/data integrity | FAIL | GHCR digest/signature not verified; upload content not bound strongly enough to stored object; report snapshots can go stale after correction |
| Logging/monitoring failures | FAIL | Sentry depends on DSN configuration; job failure can be masked; live alert routing/paging not verified |
| SSRF | NOT VERIFIED | External URL/provider/storage surfaces need dedicated tests; no production-like SSRF exercise was executed |

## Authentication and session findings

### Actual student login model

The implemented login is ordinary school-scoped email + bcrypt password. No shared-password or display-name login mechanism was found in `app/api/auth/login/route.ts`. Therefore, the output of `scripts/seed-students.ts` is materially misleading: it creates random password hashes while telling operators to use a hard-coded shared password (redacted). That script must be removed, quarantined, or rewritten before onboarding.

### Session lifetime and revocation

Sessions are long-lived HS256 JWTs. API routes that use the session helpers recheck DB user state, which is good. Page middleware, however, primarily verifies signature/expiry and coarse role claims. A revoked/suspended user may still receive a page shell or cached client data until an API rejects them. Shared-device offline stores make this more serious.

### MFA

MFA is implemented, but expected-role enrolment is an operational policy rather than a universally forced launch gate in the inspected flow. Proprietor/principal/director/admin/bursar accounts should not be activated for production until MFA enrolment and recovery procedures are proven.

### CSRF

Cookie-based state-changing APIs rely heavily on browser cookie behavior, CORS, and application patterns. No explicit CSRF token or consistent Origin/Referer enforcement was found across the API surface. This requires a route-by-route review, especially for JSON endpoints callable with simple requests, form posts, and any endpoints accepting non-JSON content types.

## Authorization and object-level access

The application has many route guards and school-scoped queries, but launch requires proof, not pattern confidence. The following matrix must be generated and tested for every role:

- page access;
- API method access;
- module entitlement;
- school scope;
- class/subject ownership;
- student/parent relationship;
- object state (draft, published, locked, released, paid, refunded);
- bulk/list/export visibility.

Known failures or high-risk areas include exam subject entitlement, clinic access, teacher access to guardian contact data, large admin list projections, public staff exposure, and inconsistent newer-role handling.

## File upload and download security

Admissions files are the highest-risk file surface because they involve untrusted public uploads and sensitive child/family documents. Required properties are:

1. server-issued upload reservation bound to applicant, document type, size, checksum, and expiry;
2. object-store confirmation that reads back metadata and content hash;
3. MIME and magic-byte verification independent of filename/content-type claims;
4. malware scan with explicit `PENDING`, `CLEAN`, `INFECTED`, and `ERROR` states;
5. quarantine and deletion/retention handling for infected or replaced objects;
6. reviewer UI that displays scan state and blocks approval when not `CLEAN`;
7. short-lived, audited download URLs;
8. content-disposition and content-type hardening to prevent active-content execution.

At `1163ebb`, the chain is incomplete, and type-only completeness is launch-blocking.

## Privacy and child-data protection

### Data minimization

Admissions collects religion, blood group, genotype, and extensive family information before a child is admitted. The school must establish why each field is needed at that stage, who can see it, how long unsuccessful applications are retained, and whether health information should be collected only after admission by authorized health staff.

### Public staff directory

The inspected public staff endpoint automatically exposes active teachers' names, photos, roles, subjects, and class assignments without a specific public-directory opt-in/publication flag. Even without phone/email, this is personal-data publication and should be governed by explicit staff publication controls.

### Consent and analytics

Cookie consent is recorded in local storage, but analytics rendering is not governed by that choice in the inspected component composition. Communication consent exists in backend policy, but a complete self-service consent/withdrawal experience and evidence across channels were not verified.

### Retention, deletion, and rights

`assertDeletionAllowed` exists in `lib/retention.ts` but has no production callers in the inspected code. A policy function that is not wired into deletion paths is not an operational control. The launch package still needs:

- retention schedule by record class;
- unsuccessful-applicant purge;
- leaver/alumni access expiry;
- guardian access changes and court-order handling;
- subject-access/export and correction workflows;
- deletion exceptions for finance/academic records;
- processor inventory and contracts;
- breach-response and notification procedures.

### Offline/shared-device privacy

Web IndexedDB and mobile SQLite stores can retain personal and examination data after logout. For a school where siblings, classmates, cybercafés, staff devices, and shared tablets are realistic, per-user storage isolation and logout clearing are launch controls, not cosmetic preferences.

## Secrets and supply chain

- Separate `AUTH_SECRET`, internal-event secrets, MFA encryption keys, job secrets, webhook secrets, and provider credentials by purpose and environment.
- Verify no production secrets exist in Git history using an approved scanner; available GitHub secret-scanning APIs returned 403, so enablement remains **NOT VERIFIED**.
- Protect `main`, require reviews/status checks, and enable Dependabot/code/secret scanning.
- Pin production images by digest and record provenance/SBOM where the platform supports it.
- Patch the root critical advisories and triage mobile advisories by runtime reachability rather than ignoring raw counts.

## Security testing still required

Before a successor can receive a security PASS, run and retain:

- SAST and dependency scanning for root and mobile;
- secret scanning over the full Git history;
- container/image vulnerability scanning;
- authenticated DAST against staging;
- role × route × object authorization tests;
- CSRF/CORS/session-fixation/token-revocation tests;
- upload malware/MIME/archive/polyglot tests;
- webhook signature/replay/idempotency tests;
- rate-limit and account-enumeration tests;
- backup/restore access-control checks;
- privacy/retention workflow tests.
