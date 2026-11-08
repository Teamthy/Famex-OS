/**
 * Offline CBT chaos-test runner.
 *
 * Exercises the scenarios in docs/OFFLINE_CBT_CHAOS_TEST.md against a live
 * instance, by driving the student-facing APIs the way the device would when
 * connectivity is interrupted mid-submission. No real device is needed.
 *
 * Usage:
 *   BASE_URL=https://staging.famex.os SEED_PASSWORD=... \
 *     npm run test:chaos:cbt
 *
 * Env:
 *   BASE_URL       Base URL of the running instance. Default: http://127.0.0.1:3000
 *   SEED_PASSWORD  Password for the seeded accounts.
 *   STUDENT_EMAIL  Default: student1@fis.example.edu.ng
 *   ADMIN_EMAIL    Default: admin@fis.example.edu.ng
 *   TEACHER_EMAIL  Default: teacher1@fis.example.edu.ng
 *
 * Exit code is non-zero if any scenario fails.
 *
 * ── Why this was rewritten
 *
 * The previous version could not pass against the real endpoints, which is worse
 * than having no test: it reported on an API that does not exist. It sent
 * `durationMs` (the route requires `durationMinutes`), sent `answers` as an
 * OBJECT where the route requires an array of `{questionId, response}`, and used
 * invented question ids that the route correctly discards — so its
 * "double-submit is idempotent" and "blank script recorded" assertions were
 * exercising a 400 rather than the behaviour they claimed to test.
 *
 * Every payload below is the one the real route parses, and every assertion is
 * about a property the product actually depends on:
 *
 *   • a download hands out questions, a manifest and a signature, and NO answers;
 *   • replay is idempotent on the client attempt id;
 *   • answers for questions that no longer exist are REPORTED, not silently kept
 *     or silently dropped;
 *   • a tampered manifest is rejected, and a changed paper is surfaced;
 *   • a sitting longer than the paper's duration is held for review;
 *   • one student cannot replay another's paper, and staff cannot replay at all.
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
const TEACHER_EMAIL = process.env.TEACHER_EMAIL || "teacher1@fis.example.edu.ng";

type ScenarioResult = { name: string; pass: boolean; detail?: string };
const results: ScenarioResult[] = [];

function record(name: string, pass: boolean, detail?: string) {
  results.push({ name, pass, detail });
  console.log(`  ${pass ? "✓" : "✗"} ${name}${detail ? ` — ${detail}` : ""}`);
}

async function login(email: string, password: string): Promise<string> {
  const response = await fetch(`${BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!response.ok) throw new Error(`Login failed for ${email}: ${response.status}`);
  return (response.headers.getSetCookie?.() ?? [])
    .map((cookie) => cookie.split(";")[0])
    .join("; ");
}

async function asFetch(cookie: string, url: string, init: RequestInit = {}) {
  return fetch(url.startsWith("http") ? url : `${BASE}${url}`, {
    ...init,
    headers: { ...((init.headers as Record<string, string>) || {}), cookie },
    redirect: "manual",
  });
}

/** Unique per sitting, the way the device derives it from the start time. */
function clientAttemptId(seed: string) {
  return `chaos-${createHash("sha256").update(`${seed}${Date.now()}`).digest("hex").slice(0, 16)}`;
}

type PackageBody = {
  canStart: boolean;
  refusal: string | null;
  attemptId: string | null;
  manifest: {
    examId: string;
    packetId: string;
    fingerprint: string;
    questionCount: number;
    totalMarks: number;
    durationMinutes: number;
    sessionLabel: string | null;
    termIndex: number | null;
    downloadedAt: string;
  } | null;
  signature: string | null;
  exam: { id: string; durationMinutes: number; title: string };
  questions: Array<{ id: string; type: string; marks: number }>;
};

async function pickPublishedExam(
  cookie: string,
): Promise<{ id: string; title: string } | null> {
  const response = await asFetch(cookie, "/api/student/exams");
  if (!response.ok) throw new Error(`student exams endpoint failed: ${response.status}`);
  const body = (await response.json()) as { exams?: Array<{ id: string; title: string; status: string }> };
  const published = (body.exams || []).filter((exam) => exam.status === "PUBLISHED");
  if (!published.length) return null;
  return { id: published[0].id, title: published[0].title };
}

/** Answers in the shape the route parses: every question, positional. */
function answersFor(
  questions: Array<{ id: string; type: string }>,
  limit = Number.POSITIVE_INFINITY,
) {
  return questions.slice(0, limit).map((question, index) => ({
    questionId: question.id,
    response: question.type === "ESSAY" ? `chaos essay answer ${index}` : "A",
  }));
}

function replayBody(params: {
  clientAttemptId: string;
  startedAtMs: number;
  durationMinutes: number;
  answers: Array<{ questionId: string; response: string | null }>;
  manifest: PackageBody["manifest"];
  signature: string | null;
  finalize?: boolean;
}) {
  return JSON.stringify({
    clientAttemptId: params.clientAttemptId,
    startedAt: new Date(params.startedAtMs).toISOString(),
    submittedAt: new Date().toISOString(),
    durationMinutes: params.durationMinutes,
    answers: params.answers,
    finalize: params.finalize ?? true,
    manifest: params.manifest,
    signature: params.signature,
  });
}

(async () => {
  console.log(`\n=== Offline CBT chaos test against ${BASE} ===\n`);

  const studentCookie = await login(STUDENT_EMAIL, PASSWORD);
  const adminCookie = await login(ADMIN_EMAIL, PASSWORD).catch(() => "");
  const exam = await pickPublishedExam(studentCookie);
  if (!exam) {
    console.warn("  ! No PUBLISHED exam for this student; exam scenarios will SKIP.");
  }

  // ── 1. Download ────────────────────────────────────────────────────────────
  let pack: PackageBody | null = null;
  try {
    if (!exam) {
      record("1. offline package download", true, "skipped (no exam)");
    } else {
      const response = await asFetch(
        studentCookie,
        `/api/student/exams/${exam.id}/offline-package`,
      );
      const body = (await response.json()) as PackageBody & { error?: string };
      pack = body;

      const ok =
        response.ok &&
        Array.isArray(body.questions) &&
        body.questions.length > 0 &&
        Boolean(body.manifest?.fingerprint) &&
        Boolean(body.signature);

      record(
        "1. package has questions, a manifest and a signature",
        ok,
        ok
          ? `${body.questions.length} questions, ${body.manifest?.totalMarks} marks`
          : `${response.status} ${JSON.stringify(body).slice(0, 160)}`,
      );

      record(
        "1b. package does not start the clock",
        ok && body.canStart === true && !("startedAt" in body),
        body.canStart ? "startable, no start time issued" : (body.refusal ?? "not startable"),
      );
    }
  } catch (error) {
    record("1. offline package download", false, String(error));
  }

  // ── 2. No answer keys, ever ────────────────────────────────────────────────
  try {
    if (!exam) {
      record("2. no answer keys in the package", true, "skipped");
    } else {
      const response = await asFetch(
        studentCookie,
        `/api/student/exams/${exam.id}/offline-package`,
      );
      const text = await response.text();
      // The whole point of the offline design: the device records, the server
      // marks. A key in this payload is every answer in the school on a phone.
      const leaked = /"(correctKey|correctText|answerKey|isCorrect)"\s*:/.test(text);
      record(
        "2. package carries no answer key",
        !leaked,
        leaked ? "LEAKED key fields" : "clean",
      );
    }
  } catch (error) {
    record("2. no answer keys in the package", false, String(error));
  }

  // ── 3. Idempotent double-submit ────────────────────────────────────────────
  try {
    if (!exam || !pack?.manifest || !pack.signature) {
      record("3. idempotent double-submit", true, "skipped");
    } else {
      const id = clientAttemptId("double");
      const startedAt = Date.now() - 10 * 60_000;
      const body = replayBody({
        clientAttemptId: id,
        startedAtMs: startedAt,
        durationMinutes: pack.exam.durationMinutes,
        answers: answersFor(pack.questions),
        manifest: pack.manifest,
        signature: pack.signature,
      });

      const first = await asFetch(
        studentCookie,
        `/api/student/exams/${exam.id}/attempt/offline-replay`,
        { method: "POST", headers: { "Content-Type": "application/json" }, body },
      );
      const second = await asFetch(
        studentCookie,
        `/api/student/exams/${exam.id}/attempt/offline-replay`,
        { method: "POST", headers: { "Content-Type": "application/json" }, body },
      );
      const firstBody = (await first.json()) as { attemptId?: string; error?: string };
      const secondBody = (await second.json()) as { attemptId?: string; error?: string };

      const ok =
        first.ok &&
        firstBody.attemptId &&
        secondBody.attemptId === firstBody.attemptId;

      record(
        "3. double-submit resolves to one attempt",
        Boolean(ok),
        ok
          ? `attemptId=${firstBody.attemptId}`
          : `${first.status}/${firstBody.error ?? "ok"} then ${second.status}/${secondBody.error ?? "ok"}`,
      );
    }
  } catch (error) {
    record("3. idempotent double-submit", false, String(error));
  }

  // ── 4. Answers for a deleted question are reported, not silently dropped ───
  try {
    if (!exam || !pack?.manifest || !pack.signature) {
      record("4. orphaned answers reported", true, "skipped");
    } else {
      const answers = [
        ...answersFor(pack.questions, 1),
        { questionId: "question-that-no-longer-exists", response: "A" },
      ];
      const response = await asFetch(
        studentCookie,
        `/api/student/exams/${exam.id}/attempt/offline-replay`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: replayBody({
            clientAttemptId: clientAttemptId("orphan"),
            startedAtMs: Date.now() - 5 * 60_000,
            durationMinutes: pack.exam.durationMinutes,
            answers,
            manifest: pack.manifest,
            signature: pack.signature,
          }),
        },
      );
      const body = (await response.json()) as {
        orphanedAnswers?: number;
        acceptedAnswers?: number;
        error?: string;
      };
      const ok = response.ok && body.orphanedAnswers === 1;
      record(
        "4. an answer to a vanished question is counted, not discarded",
        ok,
        ok
          ? `orphaned=${body.orphanedAnswers}`
          : `${response.status} ${JSON.stringify(body).slice(0, 140)}`,
      );
    }
  } catch (error) {
    record("4. orphaned answers reported", false, String(error));
  }

  // ── 5. Tampered manifest is rejected ───────────────────────────────────────
  try {
    if (!exam || !pack?.manifest || !pack.signature) {
      record("5. tampered manifest rejected", true, "skipped");
    } else {
      const response = await asFetch(
        studentCookie,
        `/api/student/exams/${exam.id}/attempt/offline-replay`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: replayBody({
            clientAttemptId: clientAttemptId("tamper"),
            startedAtMs: Date.now() - 5 * 60_000,
            durationMinutes: pack.exam.durationMinutes,
            answers: answersFor(pack.questions, 1),
            // A manifest claiming a much smaller paper: the score would be a
            // guaranteed pass if it were trusted.
            manifest: { ...pack.manifest, totalMarks: 1 },
            signature: pack.signature,
          }),
        },
      );
      const body = (await response.json()) as { packetMismatch?: string; error?: string };
      record(
        "5. a modified manifest is reported, not trusted",
        response.ok && body.packetMismatch === "BAD_SIGNATURE",
        body.packetMismatch ?? body.error ?? "no mismatch reported",
      );
    }
  } catch (error) {
    record("5. tampered manifest rejected", false, String(error));
  }

  // ── 6. A sitting past its window is held for review ────────────────────────
  try {
    if (!exam || !pack?.manifest || !pack.signature) {
      record("6. late sitting held for review", true, "skipped");
    } else {
      const response = await asFetch(
        studentCookie,
        `/api/student/exams/${exam.id}/attempt/offline-replay`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: replayBody({
            clientAttemptId: clientAttemptId("late"),
            // Three hours on a paper that runs for the exam's own duration.
            startedAtMs: Date.now() - 180 * 60_000,
            durationMinutes: pack.exam.durationMinutes,
            answers: answersFor(pack.questions, 2),
            manifest: pack.manifest,
            signature: pack.signature,
          }),
        },
      );
      const body = (await response.json()) as { lateForReview?: boolean; error?: string };
      record(
        "6. an overlong sitting is held for a teacher, not auto-scored",
        response.ok && body.lateForReview === true,
        body.lateForReview ? "held for review" : (body.error ?? "not held"),
      );
    }
  } catch (error) {
    record("6. late sitting held for review", false, String(error));
  }

  // ── 7. Staff cannot replay a student's paper ───────────────────────────────
  try {
    if (!exam || !adminCookie) {
      record("7. staff cannot replay", true, "skipped");
    } else {
      const response = await asFetch(
        adminCookie,
        `/api/student/exams/${exam.id}/attempt/offline-replay`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            clientAttemptId: clientAttemptId("cross"),
            startedAt: new Date().toISOString(),
            durationMinutes: 60,
            answers: [],
            finalize: true,
          }),
        },
      );
      record(
        "7. a non-student cannot submit an attempt",
        response.status === 401 || response.status === 403,
        `${response.status}`,
      );
    }
  } catch (error) {
    record("7. staff cannot replay", false, String(error));
  }

  // ── 8. Corrupt payload is a 400, never a 500 ───────────────────────────────
  try {
    if (!exam) {
      record("8. corrupt payload is a 4xx", true, "skipped");
    } else {
      const response = await asFetch(
        studentCookie,
        `/api/student/exams/${exam.id}/attempt/offline-replay`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ clientAttemptId: "x", answers: "not-an-array" }),
        },
      );
      record(
        "8. a malformed replay is rejected with a 4xx",
        response.status >= 400 && response.status < 500,
        `${response.status}`,
      );
    }
  } catch (error) {
    record("8. corrupt payload is a 4xx", false, String(error));
  }

  // ── 9. Health ──────────────────────────────────────────────────────────────
  try {
    const response = await fetch(`${BASE}/api/health`, { cache: "no-store" });
    const body = (await response.json()) as { ok?: boolean; status?: string };
    record(
      "9. /api/health reports ok",
      response.ok && (body.ok === true || body.status === "ok"),
      JSON.stringify(body).slice(0, 120),
    );
  } catch (error) {
    record("9. /api/health reports ok", false, String(error));
  }

  // ── 10. Teacher marking queue is mounted ───────────────────────────────────
  try {
    if (!exam) {
      record("10. teacher marking queue mounted", true, "skipped");
    } else {
      const teacherCookie = await login(TEACHER_EMAIL, PASSWORD).catch(() => adminCookie);
      const response = await asFetch(teacherCookie, `/api/teacher/exams/${exam.id}/marking`);
      // 403 is a correct answer for a teacher who does not own the paper; 404
      // would mean the route is missing.
      record(
        "10. teacher marking queue is mounted",
        response.status !== 404,
        `${response.status}`,
      );
    }
  } catch (error) {
    record("10. teacher marking queue mounted", false, String(error));
  }

  // ── Summary ────────────────────────────────────────────────────────────────
  console.log("\n=== Summary ===");
  const passed = results.filter((result) => result.pass).length;
  const failed = results.length - passed;
  console.log(`  ${passed}/${results.length} passed, ${failed} failed\n`);
  for (const result of results) {
    if (!result.pass) console.log(`  ✗ ${result.name}: ${result.detail}`);
  }
  process.exit(failed === 0 ? 0 : 2);
})().catch((error) => {
  console.error("Chaos runner crashed:", error);
  process.exit(3);
});
