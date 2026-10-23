# 07 — Performance & capacity report

## Overall verdict

**BLOCKED.** The evidence is sufficient to say the seeded application survived a small CI smoke load. It is not sufficient to certify 1,000+ daily active users, a school-wide examination burst, results-day traffic, payment/webhook concurrency, or any 5K/10K/50K/100K DAU claim.

No production-like load test was executed during this audit because no authorized staging environment, representative data volume, provider sandbox, or target OCI shape was available.

## Evidence that exists

| Evidence | Scope | Status |
|---|---|---|
| GitHub CI load job on exact commit | Workflow completed successfully as part of CI run `39561208778` | PASS for its narrow configured scenario |
| Load script configuration | `scripts/load-test.ts`; CI runs 40 users for 30 seconds; five seeded accounts; read-heavy dashboards/fees/results/exams/gradebook/admin paths; fails on any 5xx/network error or p95 >3000 ms | PASS as a smoke gate |
| Lighthouse | `lighthouserc.json` tests `/` and `/admissions`, 3 runs; performance ≥0.70, accessibility ≥0.90, LCP ≤4s, CLS ≤0.1 | PASS for those two public pages in exact-commit workflow |
| Schema indexing | 147 `@@index` declarations counted | PASS as a static design signal only |
| Production-like capacity | No target-host test, representative data, exam burst, long soak, provider concurrency, or cost model | BLOCKED |

## Why 40 users for 30 seconds cannot be extrapolated

- Five accounts reused across workers create unusually warm, narrow query patterns.
- Page GETs dominate; writes, locks, transactions, uploads, report generation, autosave, and webhook races are mostly absent.
- Seeded data volume is far below years of students, invoices, ledger lines, messages, attempts, audit logs, and files.
- CI hardware is not the OCI production shape.
- Thirty seconds cannot expose memory leaks, connection-pool exhaustion, queue backlog, disk growth, provider throttling, or backup interference.
- A p95 budget of 3000 ms is a smoke threshold, not a school-day user-experience SLO.
- DAU is not concurrency. A 1,000-DAU school can still produce severe peaks at login, exam start, submission deadline, fee deadline, and results release.

## Likely bottlenecks to test first

These are hypotheses from source topology, not measured conclusions:

1. **Single Next.js process/container** serving SSR, APIs, image optimization, PDF/report work, and provider calls.
2. **Postgres connection pool and hot rows** during login bursts, exam attempt creation/autosave/submission, fee posting, and report generation.
3. **Count-based numbering and transactional contention** in finance paths.
4. **Whole-file JSON operations** for clinic/library/inventory, which serialize poorly and cannot scale across instances.
5. **Report/broadsheet generation loops** over classes, students, subjects, and historical terms.
6. **Notification queue throughput** and provider rate limits during whole-school announcements/results release.
7. **Object-storage and malware-scan throughput** during admissions peaks.
8. **Image optimization CPU** on a small OCI shape, especially if untrusted or uncached image variants are requested.
9. **Large list/export endpoints** returning up to thousands of full records without proven pagination/cursor behavior under real data volume.
10. **Mobile sync storms** when many devices reconnect after an outage or examination.

## Required capacity model

Before load testing, school leadership and engineering must agree on measurable targets, for example:

| Dimension | Required definition |
|---|---|
| Population | Students, parents/guardians, teachers, staff, applicants |
| DAU | Normal day, admissions peak, fee deadline, examination day, results day |
| Peak concurrency | Simultaneous authenticated sessions and requests/second by journey |
| Exam burst | Number starting within 1/5/15 minutes; autosave interval; simultaneous submissions |
| Payment burst | Payment starts, webhook deliveries, duplicate callbacks, settlement file size |
| Messaging burst | Recipients, channels, provider limits, acceptable queue drain time |
| Data volume | Years of students/results/invoices/ledger lines/messages/files/audit logs |
| SLOs | p50/p95/p99 latency, error rate, queue age, recovery time, data-loss tolerance |
| Infrastructure | Exact OCI shape, Postgres sizing, storage/IOPS, network, backup window |
| Cost ceiling | Monthly infrastructure/provider budget at each growth tier |

## Required test program

### Baseline and profiling

- Seed production-like volumes: multiple sessions/terms, full class/subject matrices, historical results, invoices/ledger lines, messages, documents, and audit logs.
- Capture slow-query logs, Prisma query counts, DB pool wait, CPU/memory, event-loop lag, image/PDF CPU, and provider latency.
- Add pagination/cursor and query-plan review for the largest list/report/export endpoints.

### Load scenarios

1. Morning login burst for students/teachers/parents.
2. Results release: many parents/students reading reports simultaneously.
3. Examination start: hundreds/thousands starting, autosaving, and submitting inside a narrow window.
4. Offline examination reconnect/replay storm.
5. Fee deadline: invoice reads, payment intent creation, provider verify, duplicate webhooks, receipt reads.
6. Admissions peak: draft creation, presigned uploads, scan confirmation, status checks, admin review lists.
7. Whole-school notification: queue creation and provider-sandbox dispatch/drain.
8. Report generation/release for full classes and broadsheets.
9. Mixed read/write school day for at least several hours.
10. Soak test long enough to expose leaks, pool exhaustion, disk/log growth, and backup interference.
11. Stress-to-failure test to identify saturation point and graceful-degradation behavior.
12. Dependency-degradation tests: slow DB, Redis down, provider timeout, object-storage latency, process restart.

### Acceptance gates

The successor release should not pass capacity until it demonstrates, on the target shape and data volume:

- agreed p95/p99 latency and error budgets by journey;
- no lost/duplicated payments, exam submissions, attendance records, or notifications;
- bounded queue drain time;
- stable memory/CPU/DB connections during soak;
- graceful rate limiting/backpressure rather than cascading 5xx;
- backup completion without unacceptable user impact;
- cost per active user and per peak event within the approved budget.

## Scaling path assessment

| Target | Current evidence | Audit position |
|---|---|---|
| Single-school pilot, synthetic data | CI smoke and functional implementation | Feasible after containment; not production certification |
| ~1,000 DAU single school | No representative load/soak | NOT VERIFIED |
| 5K DAU | No capacity model, multi-instance data safety gaps | BLOCKED |
| 10K DAU | JSON modules, single-app topology, queue/provider limits unmeasured | BLOCKED |
| 50K–100K+ DAU | Requires deliberate horizontal architecture, caching/queue/CDN, DB scaling, observability, and cost engineering | NOT APPLICABLE to current single-school release claim |

The current monolith can be appropriate for one school. It should not be marketed as proven for 50K–100K DAU without a separate architecture and capacity program.
