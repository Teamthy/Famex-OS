# 09 — Conditional release runbook for a future certified successor

## Warning

This runbook does **not** authorize deployment of `1163ebb` to production. It is the minimum procedure for a future patched release candidate after the P0 blockers in this audit are fixed and recertified.

## 1. Roles and sign-off

Assign named people before the release window:

| Role | Responsibility |
|---|---|
| Release manager | Freeze, schedule, go/no-go, rollback decision |
| Engineering lead | Build, migration, deployment, technical rollback |
| Infrastructure owner | OCI/Vercel/DNS/TLS/secrets/backup access |
| Bursar/finance lead | Payment test, reconciliation, finance sign-off |
| Admissions lead | Application/document/payment/review UAT |
| Exams/academic lead | CBT, gradebook, report/result UAT |
| Privacy/safeguarding lead | Child-data, consent, retention, access review |
| Support lead | Help desk, user communications, hypercare rota |

No launch proceeds with unnamed approvers or unrecorded accepted risks.

## 2. Release-candidate freeze

- Record full Git SHA, PR list, migration list, image digest, build provenance, and dependency/SAST/secret/container scan results.
- Confirm `main` protection, required checks, and environment approvals are active.
- Confirm no direct production seeding scripts or test credentials are present in the production plan.
- Freeze non-essential merges during staging validation.
- Prepare release notes, known issues, support scripts, and rollback trigger thresholds.

## 3. Staging deployment

Staging must be production-like but data-isolated:

- separate Postgres, object storage, Redis/rate-limit namespace, secrets, and provider test keys;
- synthetic or anonymized data only;
- same image digest intended for production;
- same migration path and reverse-proxy/TLS behavior where feasible;
- email/SMS/WhatsApp test recipients and Paystack test mode;
- malware-scan test files and provider webhook tunnels/endpoints.

Deploy the digest, run the explicit migration step, and record start/end time, migration output, image digest, environment-variable checklist (names only, never secret values), health outputs, and smoke results.

## 4. Staging validation checklist

### Identity and access

- Create/activate one user for every supported role.
- Verify login, MFA, password reset, suspension, revocation, logout, and shared-device offline clearing.
- Attempt direct-URL and API access outside each role/object boundary.

### Admissions

- Create/resume a draft after browser refresh and session expiry.
- Upload clean, oversized, renamed, MIME-spoofed, checksum-mismatched, and EICAR/test-malware files.
- Verify infected/pending files cannot reach payment, submission, approval, or enrolment.
- Complete test payment, duplicate webhook, review, approval, enrolment, student activation, and guardian link.

### Finance

- Generate invoices, instalments, discounts, credits, transfers, cash/offline review, online payment, duplicate verify/webhook, partial/full refund, chargeback/reversal, settlement import, receipt, and reconciliation.
- Run duplicate/concurrent payment attempts and confirm ledger/invoice/attempt agreement to the kobo.

### Academics and exams

- Create questions by UI/API/import; reject invalid semantics.
- Publish exams; verify cross-subject denial, timing, autosave, offline package/replay, duplicate replay, submission, marking lock, corrections, report regeneration, release, and public verification privacy.
- Run promotion/transfer dry-run and verify enrolments/subjects/capacity.

### Communications

- Queue email/SMS/WhatsApp/push/in-app messages.
- Prove dispatcher authentication, provider acceptance/receipts, retry/backoff, consent suppression, failure alert, and queue drain.

### Reliability

- Stop/restart app during non-destructive test journeys.
- Simulate DB/Redis/provider/storage degradation in staging.
- Verify readiness returns non-200 when not ready and alerts reach humans.
- Take a backup, restore it to an isolated target, verify counts/files/login/smoke, and record elapsed time.
- Roll back the application image and verify health/smoke; document migration compatibility.

### Performance/accessibility/devices

- Run agreed load/soak/stress scenarios on the target shape and data volume.
- Run authenticated accessibility checks and mobile viewport/device tests.
- Test low-end Android, iOS where supported, slow/offline networks, and shared-device logout.

## 5. Production preflight

- Confirm production image digest equals the certified staging digest or that promotion rules are documented.
- Confirm DNS, TLS, cookie domain, site URL, CORS origins, storage bucket/CORS, webhook URLs, and provider callback allowlists.
- Confirm secrets are unique to production and stored only in approved secret stores.
- Confirm DB roles are least-privilege and migration credentials are not left in the app runtime.
- Take and verify a production backup before migration.
- Confirm monitoring dashboards, alert recipients, status page/communication channel, and support rota.
- Confirm first admin creation path; never run demo `seed-all` in production.
- Confirm school profile, sessions/terms, classes, subjects, fee structures, templates, and role assignments are reviewed data—not seed placeholders.

## 6. Production deployment sequence

1. Announce maintenance window and freeze writes if the migration requires it.
2. Record current image digest/config version and backup identifier.
3. Run the single migration job; capture output.
4. Deploy the certified digest to one instance/canary where topology allows.
5. Verify liveness/readiness bodies and status codes.
6. Run internal smoke: public home, login, MFA, dashboards for each role, fee read, exam read, message queue, file download authorization, health/queue metrics.
7. Register/verify provider webhooks with test events or provider test mode before live traffic.
8. Enable internal staff cohort.
9. Monitor error rate, latency, DB pool, queue age, webhook failures, payment exceptions, disk/memory/CPU, and support reports.
10. Enable modules/cohorts in phases: read-only dashboards → communications → assignments/attendance → finance → admissions → exams/results, each with owner sign-off.

## 7. Rollback triggers

Roll back or disable the affected module immediately if any of the following occurs:

- payment posted to the wrong student/invoice or duplicate money movement;
- examination answers/results exposed or submissions lost;
- admissions files accepted without `CLEAN` verification;
- cross-user/child data exposure;
- sustained 5xx or readiness failure beyond the agreed threshold;
- notification queue growing without drain;
- migration/data corruption or unexplained record-count changes;
- backup failure after launch;
- privileged account lockout or unauthorized access indication.

Rollback steps:

1. Stop new writes for the affected module or place the site in maintenance.
2. Preserve logs, webhook payload metadata, queue state, and DB snapshots for forensics; do not delete financial records.
3. Redeploy the prior certified image digest if schema compatibility is confirmed.
4. If schema/data are incompatible, restore the pre-release backup to the approved target and follow the DR plan.
5. Reconcile payments/exams/messages created during the incident window with counter-entries or documented recovery—not silent deletion.
6. Notify affected users and regulators/school leadership where privacy/safeguarding duties require it.
7. Keep the module disabled until a new exact-commit certification is issued.

## 8. Hypercare

For at least the first 14 days or the first major school event (whichever is longer):

- daily finance reconciliation and payment-exception review;
- daily notification queue/provider-failure review;
- daily backup freshness and error/latency review;
- exam-day and results-day staffing;
- support ticket triage by safeguarding/money/data-loss severity;
- no unreviewed hotfixes directly to production;
- post-incident reviews for every rollback trigger or near miss.
