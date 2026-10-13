# YKAY GO-LIVE CHECKLIST (both systems)

Use as the launch gate. Every item needs an owner, evidence, and a date.
No production DNS until **every** Critical item is green.

Legend: 🔴 critical (blocks) · 🟠 required before public traffic · 🟢 verify within week 1

---

## 0. Environments & ownership

- [ ] 🔴 Staging exists on OCI with staging hosts (`api-staging.*`) and staging Vercel projects; production deployed by the **same** scripts/workflows.
- [ ] 🔴 `.env` on OCI is `chmod 600`, owned by the deploy user, and contains **no** `CHANGE_ME`/`sk_test`.
- [ ] 🔴 Virtual API boots in `ENVIRONMENT=production` (it refuses dev defaults — fix every fatal before launch).
- [ ] 🟠 On-call owner named for each system; runbooks (`docs/OPS_MANUAL.md`, `DR_RUNBOOK.md`) accessible.
- [ ] 🟠 Every secret that ever touched Render/Vercel preview is rotated before cutover.

## 1. Secrets & platform accounts

- [ ] 🔴 EduPortal: `AUTH_SECRET` ≥32 random; Virtual: `CBT_ATTEMPT_SECRET` ≥32; `COLLEGE_SSO_SECRET` ≥32 **and identical on both systems**, distinct from AUTH_SECRET.
- [ ] 🔴 Paystack **live** keys both sides; webhook URLs set in Paystack dashboard; webhook secret = Paystack secret key.
- [ ] 🟠 Flutterwave keys if used; `PAYMENT_REFUNDS_ENABLED` set deliberately after the refund drill.
- [ ] 🔴 S3/R2 buckets: public/private/quarantine; credentials scoped (no admin keys); bucket CORS allows exactly the Vercel origin(s) for presigned PUT/GET.
- [ ] 🟠 Resend/SMTP verified sending domains; Termii/WhatsApp where used; Google OAuth client redirect URLs on prod.
- [ ] 🟠 Sentry DSN(s) set; sample rates sensible; a test error was received.
- [ ] 🟠 EAS/Expo project + OTA channel; `EXPO_PUBLIC_API_URL` baked into mobile builds points at prod.

## 2. Network & TLS (OCI)

- [ ] 🔴 NSG/UFW allows only 22 (admin IPs), 80, 443; Postgres/Redis have **no** host port.
- [ ] 🔴 Caddy issued valid LE certs for the API host; `curl https://$API_HOST/health/live` and `/health/ready` are 200.
- [ ] 🔴 Vercel → API: BFF proxy `API_PROXY_TARGET=https://...` works from a deployed preview (login round-trip, cookie set).
- [ ] 🔴 EduPortal DB reachable from Vercel: Neon pooled URL + `DIRECT_URL` (preferred), or an audited TLS/tunnel path — never 5432 open to the internet.
- [ ] 🟠 `TRUST_PROXY=true` on the Virtual API so client IPs/rate limits work; `ALLOWED_ORIGINS` lists exact Vercel origins (no wildcard).
- [ ] 🟠 HSTS/CSP/X-Frame headers verified with securityheaders.com / curl.

## 3. Rate limiting & abuse

- [ ] 🔴 EduPortal Upstash Redis configured in Vercel: login burst returns **429, never 503**.
- [ ] 🔴 IT self-signup is throttled (post-fix `enforceRateLimit("signup")`); confirm 6th attempt is 429.
- [ ] 🔴 Public CBT practice endpoints return 429 after sustained hammering; key harvesting is bounded.
- [ ] 🟠 Virtual auth limiter verified (20/min default) and global limiter sane for Nigerian NAT shared IPs.

## 4. Background work & cron

- [ ] 🔴 EduPortal notification dispatcher runs every 60s: systemd timer on OCI (deploy/oci/eduportal-notify.timer) and a test alert is delivered within ~2 min. (Vercel Hobby daily cron is NOT sufficient.)
- [ ] 🔴 Virtual worker running; Redis `ykvirtual:jobs:dead` empty/monitored; crons (escrow expiry, enrollment expiry, plus renewal, payouts) fire with leader lock.
- [ ] 🟠 Queue-depth and cron-success Prometheus metrics exist and have alerts.

## 5. Payments end-to-end (live or staged live keys)

- [ ] 🔴 Real fee payment → invoice settled; receipt issued; duplicate webhook sent 50× → exactly one FeePayment.
- [ ] 🔴 Virtual cohort order → paid → escrow HOLD → completion → payout (and OTP transfer path where required).
- [ ] 🔴 Under/over-amount and wrong-currency webhooks rejected; no settlement.
- [ ] 🔴 Client cannot self-mark success: tampering with callback/verify calls confirmed.
- [ ] 🔴 Refund drill completed and result recorded; `PAYMENT_REFUNDS_ENABLED` decision logged.
- [ ] 🟠 Manual/cash fee + admission record-fee path tested (EduPortal bursary).
- [ ] 🟠 Reconciliation: orders vs Paystack dashboard vs payouts for the test day.

## 6. Admissions, exams, documents

- [ ] 🔴 Full admissions journey: draft → docs → fee → submit → review → enroll; orphan/duplicate applications behave.
- [ ] 🔴 Document upload: EICAR rejected/quarantined; oversize and wrong MIME rejected; expired presign fails; private objects not directly enumerable.
- [ ] 🔴 Exam day rehearsal: 60 concurrent starts/submits at deadline; late resume auto-submits; answers never visible in network tab before grading; retake consumed once.
- [ ] 🟠 Practice CBT answer-key exposure test (only revealed per answered question).

## 7. Auth / RBAC / tenancy

- [ ] 🔴 Suspended user blocked on the next request both systems; password reset revokes sessions; logout everywhere works.
- [ ] 🔴 Role matrix spot-check: student cannot hit admin/teacher/bursar API routes; tutor cannot approve self; institution admin is not platform admin.
- [ ] 🔴 IDOR checks: other-parent invoice/receipt/messages/conversations → 403/404.
- [ ] 🔴 No demo/fixture accounts in the migrated prod DB:
  - Virtual query: active users with ids `…00a1..a4`/`…00b1..b4` or emails admin/parent/tutor/student@ykaycollege.com must be zero.
- [ ] 🔴 Multi-tenancy: `PLATFORM_MODE` stays off and **no second school onboarded** until RLS fail-open is closed (tracked as EDU-01).
- [ ] 🟠 College SSO: login works; College suspension blocks new sessions; College outage shows 503/retry message; secret rotation procedure documented.

## 8. Data & recovery

- [ ] 🔴 Automated backups enabled both databases; ≥3 consecutive successful backups observed.
- [ ] 🔴 A restore has been **performed** into a scratch DB with checksum/deep verification (CI DR drill covers Virtual; do an OCI-level drill too). RPO/RTO written down.
- [ ] 🟠 Backups copied off the OCI box (object storage); backup-failure alerting.
- [ ] 🟠 Migration plan rehearsed: `migrate --cmd=up` / `prisma migrate deploy`; rollback/forward decision documented.

## 9. Observability & incident readiness

- [ ] 🔴 Dashboards/alerts: 5xx rate, p95/p99, queue/DLQ depth, cron success, escrow stale-holds, payment/webhook failures, disk/RAM/CPU, backup age, auth 429/503.
- [ ] 🔴 "Why did it fail at 2 am" drill: trace a synthetic error from Sentry/Grafana to logs with correlation id.
- [ ] 🟠 `/metrics` requires token externally; Caddy does not expose prometheus/grafana ports publicly.
- [ ] 🟠 SSE validation: EventSource stays open >60s with pings (post VRT-01 fix).

## 10. Mobile

- [ ] 🔴 Signed Android build installs over prior build (consistent keystore); iOS path decided (TestFlight/enterprise).
- [ ] 🟠 Airplane mode: screens render from cache, writes queue, replay on reconnect; SecureStore holds only the token.
- [ ] 🟠 Deep links verified (`ykvirtual://`, `ykaycollege://` + assetlinks/AASA).
- [ ] 🟠 Token expiry / logout / password reset behavior on device verified.

## 11. Deployment mechanics

- [ ] 🔴 Virtual: `Deploy OCI` workflow green end-to-end on staging; failed deploy **auto-rolled back** (force a bad tag in staging).
- [ ] 🔴 EduPortal: Vercel deploy from main gated by CI; instant rollback practiced.
- [ ] 🟠 GHCR pull auth on VM working; images pinned by sha tag; old images pruned.
- [ ] 🟠 Load test against staging at the 1k profile (`scripts/loadtest.sh`, EduPortal load job); p95/error budget recorded.

## 12. Launch-day

- [ ] 🟠 Feature flags/quieter moments for: chatbot, refunds, payouts, OTA rollout percentage.
- [ ] 🟠 Support contact/escalation paths in-app; Paystack dispute contact known.
- [ ] 🟠 Announce/monitor first results day and first fee deadline (highest concurrency events).
