# Offline CBT chaos test script

Run these 10 scenarios against a staging build (device on school Wi-Fi, then
toggled to airplane mode) before every exam-period release. Every scenario
must produce the expected result; any failure blocks deployment.

## Automated runner

A server-side automator covering the contract-level scenarios is checked in at
`scripts/chaos-offline-cbt.ts`. Run it against any live instance:

```
BASE_URL=https://staging.famex.os SEED_PASSWORD="..." npm run test:chaos:cbt
```

It exits non-zero on any failure and prints a per-scenario pass/fail table. What
it asserts:

1. a downloaded package carries questions, a manifest and a signature;
2. it carries no answer key (the device records, the server marks);
3. a double-submit resolves to exactly one attempt;
4. an answer whose question no longer exists is counted, not silently dropped;
5. a manifest altered after signing is reported, not trusted;
6. a sitting past the paper's duration is held for a teacher, not auto-scored;
7. a non-student cannot replay an attempt;
8. a malformed replay is a 4xx, never a 500;
9. `/api/health` is ok;
10. the teacher marking queue is mounted.

The manual scenarios below cover device-level UX (airplane-mode start, hard
quit, app-restore) that the API-level runner cannot drive.

## Replay contract

The endpoints the runner exercises, exactly as they parse:

```
GET  /api/student/exams/:id/offline-package
     → { canStart, refusal, attemptId, savedAnswers,
         exam: { id, title, durationMinutes, ... },
         manifest: { examId, packetId, fingerprint, questionCount, totalMarks,
                     durationMinutes, sessionLabel, termIndex, downloadedAt },
         signature,
         questions: [{ id, type, questionText, marks, options }] }

POST /api/student/exams/:id/attempt/offline-replay
     { clientAttemptId, startedAt, submittedAt, durationMinutes,
       answers: [{ questionId, response }], finalize,
       manifest, signature }
     → { ok, attemptId, acceptedAnswers, orphanedAnswers, missingAnswers,
         packetMismatch, lateForReview }
```

`durationMinutes` — not milliseconds. The route rejects a payload whose duration
differs from the paper's by more than two minutes, because a sitting cannot be
mapped onto a paper of a different length.

`answers` is an ARRAY of `{questionId, response}`, and the response must be for a
question that exists on the current paper. Anything else is reported back in
`orphanedAnswers` rather than being silently accepted or silently discarded.

`packetMismatch` is `NO_SIGNATURE`, `BAD_SIGNATURE` or `FINGERPRINT_MISMATCH`.
None of them rejects the sitting: a paper that really was sat must not be thrown
away because a teacher fixed a typo overnight. They are recorded on the attempt
so a teacher can see the sitting arrived against a different version.

`lateForReview` is true when the reported start and submit times exceed the
paper's duration plus a five-minute grace. Those sittings are held at
`SUBMITTED` for a human rather than scored.

## Setup

- One student account enrolled in a 10-question, 10-minute mock CBT exam.
- A second device logged in as the same student (for duplicate-submit test).
- Admin logged in on a laptop to view attempts.
- `BYPASS_NETWORK=1` proxy to drop traffic on demand, **or** airplane mode.

## Scenarios

| # | Test | Expected result |
|---|---|---|
| 1 | **Pre-download overnight**: download the paper while on Wi-Fi the night before; force-kill the app; do NOT open the paper yet. | Exam appears under "Downloaded" on the offline-exams screen; `deadlineAt` has NOT started ticking (i.e. no server attempt was created yet) — confirm via the admin "Attempts" view: zero attempts. |
| 2 | **Start offline**: enable airplane mode, tap Start on the downloaded exam. | Runner opens immediately; question 1 loads; timer counts down from 10:00; answers save locally (no spinner hanging on network). |
| 3 | **Hard quit mid-exam**: answer 3 questions, force-swipe-kill the app, reopen 1 minute later. | Runner resumes at the same question with all 3 answers preserved; timer reflects the real elapsed time (not reset to 10:00). |
| 4 | **Network drop during exam**: start on Wi-Fi, turn on airplane mode after 2 minutes, answer remaining questions. | Answers continue to save; no crash; no "you are offline" modal interrupts the exam. |
| 5 | **Submit while offline**: with airplane mode still on, tap Submit. | "Exam finished" screen appears ("Your answers are locked and saved on this device…"); back on the offline-exams list, a green "1 exam ready to submit" banner is visible; force-quit and reopen — the paper remains in this state (not lost). |
| 6 | **Reconnect sync**: turn Wi-Fi back on. | Within ~5 seconds the banner disappears; in the admin view, an attempt appears with all 10 answers recorded; the student's exam list shows the paper as submitted (not downloadable). |
| 7 | **Auto-submit at deadline**: start an exam, leave the app in the background past the deadline (add a 2-minute exam for faster testing). | On next app open the attempt is force-submitted locally with `forceSubmitted=1`; answers sync to server; admin sees the auto-submitted attempt with correct `deadlineAt`. |
| 8 | **Double-tap Submit**: rapidly tap Submit twice (or press Submit, immediately background the app, reopen). | Server receives exactly one submission; no duplicate attempt, no duplicate answers; `IdempotencyRecord` has one row; the student sees "already submitted" if they retry. |
| 9 | **Late submission detection**: set device clock 20 minutes ahead (or use a 2-minute exam, wait 25 min after start, then reconnect). | The offline-replay endpoint flags `lateForReview: true`; attempt remains IN_PROGRESS on the server with `metadata.lateOffline = true` so a teacher can adjudicate; the student gets an honest "Your teacher will review it" message, not a fake "submitted successfully." |
| 10 | **Answer-key safety**: pull the offline package SQLite file from the device (or inspect network traffic during download). | The response contains **no** `correctKey` or `correctText` fields for any question — only the question text and options. Students cannot cheat by inspecting the bundle. |

## Server invariants to verify after every scenario

- `SELECT COUNT(*) FROM "ExamAnswer" WHERE "attemptId" = '…'` equals the number of answered questions (no duplicates).
- `SELECT COUNT(*) FROM "ExamAttempt" WHERE "studentProfileId" = '…' AND "examId" = '…'` is exactly 1 per replay (idempotency held).
- For submitted papers: `status = 'SUBMITTED'`, `submittedAt` is set, no further upserts change answers after the fact.
- `metadata.offlineReplay = true` and `metadata.clientAttemptId` are present on offline-originated attempts, so exams officers can distinguish them from live sittings when investigating irregularities.

## Load test (exam-day simulation)

- 200 simulated clients all starting and submitting within the same 2-minute window using the queued-write path.
- Success criteria: p95 submission < 800 ms, zero 5xx responses, zero duplicate attempts, zero lost answers.
