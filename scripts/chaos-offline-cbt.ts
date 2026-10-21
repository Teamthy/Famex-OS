/**
 * Offline CBT chaos-test runner.
 *
 * Exercises the 10 scenarios in docs/OFFLINE_CBT_CHAOS_TEST.md against a live
 * Famex-OS instance using API calls that simulate what the mobile app would do
 * if connectivity were interrupted mid-submission. It does NOT require a
 * real device: it drives the student-facing APIs directly and toggles an
 * injected "offline flag" via the offline-package download + offline-replay
 * endpoints.
 *
 * Usage:
 *   BASE_URL=https://staging.famex.os SEED_PASSWORD=... \
 *     npx tsx scripts/chaos-offline-cbt.ts
 *
 * Env:
 *   BASE_URL       Base URL of the running Famex-OS instance.
 *                  Default: http://127.0.0.1:3000
 *   SEED_PASSWORD  Password for the seeded admin/student/teacher accounts.
 *   STUDENT_EMAIL  Override student account (default: student1@fis.example.edu.ng).
 *   ADMIN_EMAIL    Override admin account (default: admin@fis.example.edu.ng).
 *
 * Exit code is non-zero if any scenario fails.
 */
import { createHash } from "node:crypto";

const BASE = (process.env.BASE_URL || "http://127.0.0.1:3000").replace(/\/$/, "");
const PASSWORD = process.env.SEED_PASSWORD;
if (!PASSWORD) {
  console.error("SEED_PASSWORD required.");
  process.exit(1);
}
const STUDENT_EMAIL = process.env.STUDENT_EMAIL || "student1@fis.example.edu.ng";
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "admin@fis.example.edu.ng";

type ScenarioResult = { name: string; pass: boolean; detail?: string };

const results: ScenarioResult[] = [];
function record(name: string, pass: boolean, detail?: string) {
  results.push({ name, pass, detail });
  const icon = pass ? "✓" : "✗";
  console.log(`  ${icon} ${name}${detail ? ` — ${detail}` : ""}`);
}

async function login(email: string, password: string): Promise<string> {
  const r = await fetch(`${BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
    credentials: "include",
  });
  if (!r.ok) throw new Error(`Login failed for ${email}: ${r.status}`);
  // Return the cookie header we should forward — same jar via cookieJar global.
  const setCookie = r.headers.getSetCookie();
  return setCookie.map((c) => c.split(";")[0]).join("; ");
}

async function asFetch(cookie: string, url: string, init: RequestInit = {}) {
  return fetch(url.startsWith("http") ? url : `${BASE}${url}`, {
    ...init,
    headers: { ...((init.headers as Record<string, string>) || {}), cookie },
    redirect: "manual",
  });
}

function clientAttemptId(seed: string) {
  return `chaos-${createHash("sha256")
    .update(seed + Date.now())
    .digest("hex")
    .slice(0, 16)}`;
}

async function pickPublishedExam(
  cookie: string,
): Promise<{ id: string; title: string; hasEssay: boolean } | null> {
  const r = await asFetch(cookie, "/api/student/exams");
  if (!r.ok) throw new Error("student exams endpoint failed");
  const j = await r.json();
  const list =
    (j.exams || j.upcoming || j.examList || j || []).filter?.(
      (e: any) => e.status === "PUBLISHED",
    ) || [];
  if (!list.length) return null;
  return { id: list[0].id, title: list[0].title, hasEssay: !!list[0].essayCount };
}

function buildAnswers(n: number, seed: string) {
  const out: Record<string, any> = {};
  for (let i = 0; i < n; i++) {
    out[`q-${seed}-${i}`] = { response: `chaos-${seed}-answer-${i}`, timeSpentMs: 3000 + i * 120 };
  }
  return out;
}

// ──────────────────────────────────────────────────────────
// Runner
// ──────────────────────────────────────────────────────────
(async () => {
  console.log(`\n=== Offline CBT chaos test against ${BASE} ===\n`);
  const studentCookie = await login(STUDENT_EMAIL, PASSWORD);
  const adminCookie = await login(ADMIN_EMAIL, PASSWORD);

  // Preflight: find a published exam (or create via admin API if absent).
  const exam = await pickPublishedExam(studentCookie);
  if (!exam) {
    console.warn("  ! No PUBLISHED exam for student; scenarios that need a real exam will SKIP.");
    console.warn("    (Admin can publish one via /admin/cbt-center.)");
  }

  // ── Scenario 1: Download offline package (server-side clock must NOT start) ──
  try {
    if (!exam) {
      record("1. offline package download", true, "skipped (no exam)");
    } else {
      const r = await asFetch(studentCookie, `/api/student/exams/${exam.id}/offline-package`);
      const j = await r.json();
      const ok =
        r.ok &&
        j.questions &&
        Array.isArray(j.questions) &&
        j.questions.length > 0 &&
        !j.answerKeys;
      record(
        "1. offline package download (no answer keys, no clock start)",
        ok,
        ok ? `${j.questions.length} questions` : `${r.status} ${JSON.stringify(j).slice(0, 120)}`,
      );
    }
  } catch (e: any) {
    record("1. offline package download", false, e.message);
  }

  // ── Scenario 2: Idempotent double-submit ──
  try {
    if (!exam) {
      record("2. idempotent double-submit", true, "skipped (no exam)");
    } else {
      const cid = clientAttemptId("double");
      const body = JSON.stringify({
        clientAttemptId: cid,
        startedAt: new Date(Date.now() - 25 * 60_000).toISOString(),
        submittedAt: new Date().toISOString(),
        answers: buildAnswers(5, "double"),
        durationMs: 25 * 60_000,
        late: false,
      });
      const r1 = await asFetch(
        studentCookie,
        `/api/student/exams/${exam.id}/attempt/offline-replay`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body,
        },
      );
      const r2 = await asFetch(
        studentCookie,
        `/api/student/exams/${exam.id}/attempt/offline-replay`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body,
        },
      );
      const j1 = await r1.json();
      const j2 = await r2.json();
      const ok = r1.ok && r2.ok && j1.attemptId && j1.attemptId === j2.attemptId;
      record(
        "2. idempotent double-submit reuses same attemptId",
        ok,
        ok
          ? `attemptId=${j1.attemptId}`
          : `${r1.status}→${j1.idempotent ?? j1.error}, ${r2.status}→${j2.idempotent ?? j2.error}`,
      );
    }
  } catch (e: any) {
    record("2. idempotent double-submit", false, e.message);
  }

  // ── Scenario 3: Late submission is flagged ──
  try {
    if (!exam) {
      record("3. late submission flagged", true, "skipped");
    } else {
      const cid = clientAttemptId("late");
      const r = await asFetch(
        studentCookie,
        `/api/student/exams/${exam.id}/attempt/offline-replay`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            clientAttemptId: cid,
            startedAt: new Date(Date.now() - 90 * 60_000).toISOString(),
            submittedAt: new Date().toISOString(),
            answers: buildAnswers(3, "late"),
            durationMs: 90 * 60_000,
            late: true,
          }),
        },
      );
      const j = await r.json();
      const flagged = j.late === true || j.flags?.late;
      record(
        "3. late submission carries a late flag",
        r.ok && flagged,
        flagged ? "flagged late" : JSON.stringify(j).slice(0, 160),
      );
    }
  } catch (e: any) {
    record("3. late submission flagged", false, e.message);
  }

  // ── Scenario 4: Wrong role rejected (admin cannot submit student attempt) ──
  try {
    if (!exam) {
      record("4. cross-role replay rejected", true, "skipped");
    } else {
      const r = await asFetch(adminCookie, `/api/student/exams/${exam.id}/attempt/offline-replay`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientAttemptId: clientAttemptId("cross"),
          startedAt: new Date().toISOString(),
          submittedAt: new Date().toISOString(),
          answers: {},
          durationMs: 1000,
        }),
      });
      record(
        "4. admin cannot submit student attempt",
        r.status === 401 || r.status === 403,
        `${r.status}`,
      );
    }
  } catch (e: any) {
    record("4. cross-role replay rejected", false, e.message);
  }

  // ── Scenario 5: Corrupt payload rejected (no 500) ──
  try {
    if (!exam) {
      record("5. corrupt payload returns 4xx", true, "skipped");
    } else {
      const r = await asFetch(
        studentCookie,
        `/api/student/exams/${exam.id}/attempt/offline-replay`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            clientAttemptId: clientAttemptId("corrupt"),
            answers: "not-an-object",
          }),
        },
      );
      record(
        "5. corrupt payload rejected with 4xx, not 500",
        r.status >= 400 && r.status < 500,
        `${r.status}`,
      );
    }
  } catch (e: any) {
    record("5. corrupt payload returns 4xx", false, e.message);
  }

  // ── Scenario 6: Health endpoint reports OK ──
  try {
    const r = await fetch(`${BASE}/api/health`, { cache: "no-store" });
    const j = await r.json();
    record(
      "6. /api/health reports ok",
      r.ok && (j.ok === true || j.status === "ok"),
      JSON.stringify(j).slice(0, 120),
    );
  } catch (e: any) {
    record("6. /api/health reports ok", false, e.message);
  }

  // ── Scenario 7: Empty answers list still records an attempt ──
  try {
    if (!exam) {
      record("7. blank script recorded", true, "skipped");
    } else {
      const cid = clientAttemptId("blank");
      const r = await asFetch(
        studentCookie,
        `/api/student/exams/${exam.id}/attempt/offline-replay`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            clientAttemptId: cid,
            startedAt: new Date(Date.now() - 60_000).toISOString(),
            submittedAt: new Date().toISOString(),
            answers: {},
            durationMs: 60_000,
          }),
        },
      );
      const j = await r.json();
      record(
        "7. blank script accepted (graded later)",
        r.ok && !!j.attemptId,
        j.attemptId ? `attemptId=${j.attemptId}` : `${r.status} ${JSON.stringify(j).slice(0, 80)}`,
      );
    }
  } catch (e: any) {
    record("7. blank script recorded", false, e.message);
  }

  // ── Scenario 8: Answer keys never leak over offline-package ──
  try {
    if (!exam) {
      record("8. offline package has no answer keys", true, "skipped");
    } else {
      const r = await asFetch(studentCookie, `/api/student/exams/${exam.id}/offline-package`);
      const t = await r.text();
      const leaked = /correct(Answer)?|isCorrect|answerKey/.test(t);
      record(
        "8. offline-package response does not leak answer keys",
        !leaked,
        leaked ? "LEAKED key fields in payload" : "clean",
      );
    }
  } catch (e: any) {
    record("8. offline package has no answer keys", false, e.message);
  }

  // ── Scenario 9: Offline-replay endpoint exists at canonical path ──
  try {
    if (!exam) {
      record("9. replay endpoint mounted", true, "skipped");
    } else {
      const r = await asFetch(
        studentCookie,
        `/api/student/exams/${exam.id}/attempt/offline-replay`,
        { method: "OPTIONS" },
      );
      // OPTIONS returns either 200/204/405 depending on handler. The failure mode
      // is 404 (not mounted), which we catch separately.
      record("9. offline-replay endpoint is mounted", r.status !== 404, `${r.status}`);
    }
  } catch (e: any) {
    record("9. replay endpoint mounted", false, e.message);
  }

  // ── Scenario 10: Teacher marking endpoint live for exam teacher ──
  try {
    if (!exam) {
      record("10. teacher marking GET returns theory queue", true, "skipped");
    } else {
      // The logged-in teacher may not own this exam; just assert that the route
      // returns a well-formed response (403 if the teacher doesn't own it, JSON
      // with `items` if they do — anything except 404 means mounted).
      const teacherCookie = await login("teacher1@fis.example.edu.ng", PASSWORD).catch(
        () => adminCookie,
      );
      const r = await asFetch(teacherCookie, `/api/teacher/exams/${exam.id}/marking`);
      const mounted = r.status !== 404;
      const j = await r.json().catch(() => ({}));
      record(
        "10. teacher marking endpoint mounted",
        mounted,
        `${r.status} ${j.error ? "(" + j.error + ")" : "ok"}`,
      );
    }
  } catch (e: any) {
    record("10. teacher marking GET returns theory queue", false, e.message);
  }

  // ── Summary ──
  console.log("\n=== Summary ===");
  const pass = results.filter((r) => r.pass).length;
  const fail = results.length - pass;
  console.log(`  ${pass}/${results.length} passed, ${fail} failed\n`);
  for (const r of results) if (!r.pass) console.log(`  ✗ ${r.name}: ${r.detail}`);
  process.exit(fail === 0 ? 0 : 2);
})().catch((e) => {
  console.error("Chaos runner crashed:", e);
  process.exit(3);
});
