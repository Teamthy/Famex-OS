/**
 * Offline CBT exam store for the Famex mobile app.
 *
 * Persists downloaded exam packages (questions without answer keys) and
 * in-progress answers to expo-sqlite so students can sit exams without
 * connectivity. Answers and submission are queued through the same
 * write-queue used by the rest of the app; submission is final only once
 * the server 2xx's.
 */
import * as SQLite from "expo-sqlite";

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

function getDb() {
  if (!dbPromise) {
    dbPromise = (async () => {
      const db = await SQLite.openDatabaseAsync("famex_offline.db");
      await db.execAsync(`
        PRAGMA journal_mode = 'WAL';

        -- Downloaded exam headers (one row per downloaded exam).
        CREATE TABLE IF NOT EXISTS offline_exams (
          examId        TEXT PRIMARY KEY,
          payloadJson   TEXT NOT NULL,
          downloadedAt  INTEGER NOT NULL
        );

        -- Per-question list for a downloaded exam (kept separate so we don't
        -- have to parse the whole JSON blob just to know which exams are cached).
        CREATE TABLE IF NOT EXISTS offline_questions (
          examId       TEXT NOT NULL,
          questionId   TEXT NOT NULL,
          payloadJson  TEXT NOT NULL,
          sortOrder    INTEGER NOT NULL DEFAULT 0,
          PRIMARY KEY (examId, questionId)
        );

        -- Local answer drafts. Survive app restarts.
        CREATE TABLE IF NOT EXISTS offline_answers (
          attemptId    TEXT NOT NULL,
          questionId   TEXT NOT NULL,
          response     TEXT,
          updatedAt    INTEGER NOT NULL,
          PRIMARY KEY (attemptId, questionId)
        );

        -- Attempt session state: examId, attemptId, deadline, startedAt,
        -- submitted status and server-sync state.
        --   syncStatus:
        --     'LOCAL'        - attempt created locally, server hasn't seen it
        --     'SYNCING'      - server-aware (SAVEs flowing) but not yet submitted
        --     'SUBMITTED'    - student pressed submit locally; SUBMIT queued
        --     'SYNCED'       - server accepted the SUBMIT (paper finalized)
        --     'FAILED'       - server rejected (e.g. time expired); show retry
        CREATE TABLE IF NOT EXISTS offline_attempts (
          attemptId       TEXT PRIMARY KEY,
          examId          TEXT NOT NULL,
          serverAttemptId TEXT,
          startedAt       INTEGER NOT NULL,
          deadlineAt      INTEGER NOT NULL,
          submitted       INTEGER NOT NULL DEFAULT 0,
          submittedAt     INTEGER,
          syncStatus      TEXT NOT NULL DEFAULT 'LOCAL',
          lastError       TEXT,
          forceSubmitted  INTEGER NOT NULL DEFAULT 0
        );
      `);
      // Idempotent column additions (for users upgrading from the older schema).
      const cols = await db.getAllAsync<{ name: string }>(`PRAGMA table_info(offline_attempts)`);
      const have = new Set(cols.map((c) => c.name));
      const addCol = async (name: string, def: string) => {
        if (!have.has(name)) await db.execAsync(`ALTER TABLE offline_attempts ADD COLUMN ${name} ${def}`);
      };
      await addCol("serverAttemptId", "TEXT");
      await addCol("syncStatus", "TEXT NOT NULL DEFAULT 'LOCAL'");
      await addCol("lastError", "TEXT");
      await addCol("forceSubmitted", "INTEGER NOT NULL DEFAULT 0");
      `);
      return db;
    })();
  }
  return dbPromise;
}

export interface OfflineExam {
  id: string;
  title: string;
  subjectName: string;
  examType: string;
  durationMinutes: number;
  instructions?: string | null;
  totalMarks: number;
  passMark: number;
  scheduledFor?: string | null;
  availableUntil?: string | null;
  shuffleQuestions: boolean;
}

export interface OfflineQuestion {
  id: string;
  type: string;
  questionText: string;
  options: { key: string; text: string }[] | null;
  marks: number;
}

export interface OfflinePackage {
  exam: OfflineExam;
  /** Server-provisioned attempt if ?createAttempt=true; null for pre-downloads. */
  attempt: { id: string; startedAt: string; deadlineAt: string; secondsLeft: number } | null;
  questions: OfflineQuestion[];
}

export async function saveOfflinePackage(pkg: OfflinePackage): Promise<{ alreadyStarted: boolean; attemptId: string | null }> {
  const db = await getDb();
  let attemptRow: { attemptId: string } | null = null;
  await db.withTransactionAsync(async () => {
    await db.runAsync(
      `INSERT OR REPLACE INTO offline_exams (examId, payloadJson, downloadedAt) VALUES (?, ?, ?)`,
      pkg.exam.id,
      JSON.stringify(pkg.exam),
      Date.now(),
    );
    await db.runAsync(`DELETE FROM offline_questions WHERE examId = ?`, pkg.exam.id);
    for (const q of pkg.questions) {
      await db.runAsync(
        `INSERT INTO offline_questions (examId, questionId, payloadJson, sortOrder) VALUES (?, ?, ?, ?)`,
        pkg.exam.id,
        q.id,
        JSON.stringify(q),
        0,
      );
    }
    if (pkg.attempt) {
      await db.runAsync(
        `INSERT OR IGNORE INTO offline_attempts (attemptId, examId, serverAttemptId, startedAt, deadlineAt, submitted, syncStatus)
         VALUES (?, ?, ?, ?, ?, 0, 'SYNCING')`,
        pkg.attempt.id,
        pkg.exam.id,
        pkg.attempt.id,
        new Date(pkg.attempt.startedAt).getTime(),
        new Date(pkg.attempt.deadlineAt).getTime(),
      );
      attemptRow = { attemptId: pkg.attempt.id };
    }
  });
  return {
    alreadyStarted: !!pkg.attempt,
    attemptId: attemptRow?.attemptId ?? null,
  };
}


export async function listDownloadedExams(): Promise<OfflineExam[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<{ payloadJson: string }>(
    `SELECT payloadJson FROM offline_exams ORDER BY downloadedAt DESC`,
  );
  return rows.map((r) => JSON.parse(r.payloadJson) as OfflineExam);
}

export async function getOfflineExam(examId: string): Promise<OfflinePackage | null> {
  const db = await getDb();
  const examRow = await db.getFirstAsync<{ payloadJson: string }>(
    `SELECT payloadJson FROM offline_exams WHERE examId = ?`,
    examId,
  );
  if (!examRow) return null;
  const exam = JSON.parse(examRow.payloadJson) as OfflineExam;
  const qRows = await db.getAllAsync<{ payloadJson: string }>(
    `SELECT payloadJson FROM offline_questions WHERE examId = ? ORDER BY sortOrder ASC`,
    examId,
  );
  const questions = qRows.map((r) => JSON.parse(r.payloadJson) as OfflineQuestion);
  const attemptRow = await db.getFirstAsync<{
    attemptId: string;
    startedAt: number;
    deadlineAt: number;
    submitted: number;
  }>(
    `SELECT attemptId, startedAt, deadlineAt, submitted FROM offline_attempts WHERE examId = ? ORDER BY startedAt DESC LIMIT 1`,
    examId,
  );
  return {
    exam,
    questions,
    attempt: attemptRow
      ? {
          id: attemptRow.attemptId,
          startedAt: new Date(attemptRow.startedAt).toISOString(),
          deadlineAt: new Date(attemptRow.deadlineAt).toISOString(),
          secondsLeft: Math.max(0, Math.floor((attemptRow.deadlineAt - Date.now()) / 1000)),
        }
      : null,
  };
}

/** Get the most recent active attempt for an exam (one that hasn't been submitted), or null. */
export async function getActiveAttempt(examId: string): Promise<{
  attemptId: string;
  serverAttemptId: string | null;
  deadlineAt: number;
  syncStatus: string;
} | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<any>(
    `SELECT attemptId, serverAttemptId, deadlineAt, syncStatus FROM offline_attempts
     WHERE examId = ? AND submitted = 0 ORDER BY startedAt DESC LIMIT 1`,
    examId,
  );
  return row
    ? { attemptId: row.attemptId, serverAttemptId: row.serverAttemptId, deadlineAt: row.deadlineAt, syncStatus: row.syncStatus }
    : null;
}

export async function getOfflineAnswers(attemptId: string): Promise<Record<string, string>> {
  const db = await getDb();
  const rows = await db.getAllAsync<{ questionId: string; response: string | null }>(
    `SELECT questionId, response FROM offline_answers WHERE attemptId = ?`,
    attemptId,
  );
  const out: Record<string, string> = {};
  for (const r of rows) if (r.response != null) out[r.questionId] = r.response;
  return out;
}

export async function saveOfflineAnswer(
  attemptId: string,
  questionId: string,
  response: string | null,
): Promise<void> {
  const db = await getDb();
  if (response == null) {
    await db.runAsync(
      `DELETE FROM offline_answers WHERE attemptId = ? AND questionId = ?`,
      attemptId,
      questionId,
    );
  } else {
    await db.runAsync(
      `INSERT OR REPLACE INTO offline_answers (attemptId, questionId, response, updatedAt) VALUES (?, ?, ?, ?)`,
      attemptId,
      questionId,
      response,
      Date.now(),
    );
  }
}

export async function markAttemptSubmitted(attemptId: string): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `UPDATE offline_attempts SET submitted = 1, submittedAt = ?, syncStatus = 'SUBMITTED' WHERE attemptId = ?`,
    Date.now(),
    attemptId,
  );
}

/**
 * Create an entirely local attempt (no server round-trip). Used when the
 * student taps "Start" while offline. Returns the new attemptId and a
 * deadline computed from the exam's durationMinutes.
 */
export async function createLocalAttempt(examId: string): Promise<{
  attemptId: string;
  startedAt: number;
  deadlineAt: number;
}> {
  const db = await getDb();
  const examRow = await db.getFirstAsync<{ payloadJson: string }>(
    `SELECT payloadJson FROM offline_exams WHERE examId = ?`,
    examId,
  );
  if (!examRow) throw new Error("Exam is not downloaded offline.");
  const exam = JSON.parse(examRow.payloadJson) as OfflineExam;
  const attemptId = `offline_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  const now = Date.now();
  const deadlineAt = now + exam.durationMinutes * 60 * 1000;
  await db.runAsync(
    `INSERT OR REPLACE INTO offline_attempts
       (attemptId, examId, startedAt, deadlineAt, submitted, syncStatus, forceSubmitted)
     VALUES (?, ?, ?, ?, 0, 'LOCAL', 0)`,
    attemptId,
    examId,
    now,
    deadlineAt,
  );
  return { attemptId, startedAt: now, deadlineAt };
}

export type AttemptStatus = {
  attemptId: string;
  examId: string;
  serverAttemptId: string | null;
  startedAt: number;
  deadlineAt: number;
  submitted: boolean;
  submittedAt: number | null;
  syncStatus: "LOCAL" | "SYNCING" | "SUBMITTED" | "SYNCED" | "FAILED";
  lastError: string | null;
  forceSubmitted: boolean;
};

export async function getAttempt(attemptId: string): Promise<AttemptStatus | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<any>(
    `SELECT attemptId, examId, serverAttemptId, startedAt, deadlineAt, submitted,
            submittedAt, syncStatus, lastError, forceSubmitted
     FROM offline_attempts WHERE attemptId = ?`,
    attemptId,
  );
  return row
    ? {
        attemptId: row.attemptId,
        examId: row.examId,
        serverAttemptId: row.serverAttemptId,
        startedAt: row.startedAt,
        deadlineAt: row.deadlineAt,
        submitted: !!row.submitted,
        submittedAt: row.submittedAt ?? null,
        syncStatus: row.syncStatus,
        lastError: row.lastError ?? null,
        forceSubmitted: !!row.forceSubmitted,
      }
    : null;
}

export async function updateAttemptSync(
  attemptId: string,
  patch: Partial<Pick<AttemptStatus, "serverAttemptId" | "syncStatus" | "lastError" | "forceSubmitted">>,
): Promise<void> {
  const db = await getDb();
  const sets: string[] = [];
  const vals: (string | number | null)[] = [];
  if (patch.serverAttemptId !== undefined) {
    sets.push("serverAttemptId = ?");
    vals.push(patch.serverAttemptId);
  }
  if (patch.syncStatus !== undefined) {
    sets.push("syncStatus = ?");
    vals.push(patch.syncStatus);
  }
  if (patch.lastError !== undefined) {
    sets.push("lastError = ?");
    vals.push(patch.lastError);
  }
  if (patch.forceSubmitted !== undefined) {
    sets.push("forceSubmitted = ?");
    vals.push(patch.forceSubmitted ? 1 : 0);
  }
  if (!sets.length) return;
  vals.push(attemptId);
  await db.runAsync(`UPDATE offline_attempts SET ${sets.join(", ")} WHERE attemptId = ?`, ...vals);
}

/** List attempts that still need to sync (i.e. SUBMITTED but not yet SYNCED). */
export async function listPendingAttempts(): Promise<AttemptStatus[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<any>(
    `SELECT attemptId, examId, serverAttemptId, startedAt, deadlineAt, submitted,
            submittedAt, syncStatus, lastError, forceSubmitted
     FROM offline_attempts WHERE syncStatus IN ('LOCAL','SYNCING','SUBMITTED','FAILED')
     ORDER BY startedAt ASC`,
  );
  return rows.map((r) => ({
    attemptId: r.attemptId,
    examId: r.examId,
    serverAttemptId: r.serverAttemptId,
    startedAt: r.startedAt,
    deadlineAt: r.deadlineAt,
    submitted: !!r.submitted,
    submittedAt: r.submittedAt ?? null,
    syncStatus: r.syncStatus,
    lastError: r.lastError ?? null,
    forceSubmitted: !!r.forceSubmitted,
  }));
}

/**
 * Force-submit any in-progress attempt whose deadline has passed (auto-submit
 * on app-open when the student let the timer expire on a closed phone).
 * Returns array of attemptIds that were auto-submitted.
 */
export async function autoSubmitExpired(): Promise<string[]> {
  const db = await getDb();
  const now = Date.now();
  const expired = await db.getAllAsync<{ attemptId: string }>(
    `SELECT attemptId FROM offline_attempts
     WHERE submitted = 0 AND deadlineAt < ? AND syncStatus NOT IN ('SYNCED','FAILED')`,
    now,
  );
  const out: string[] = [];
  for (const row of expired) {
    await db.runAsync(
      `UPDATE offline_attempts SET submitted = 1, submittedAt = ?, syncStatus = 'SUBMITTED', forceSubmitted = 1
       WHERE attemptId = ?`,
      now,
      row.attemptId,
    );
    out.push(row.attemptId);
  }
  return out;
}

export async function deleteOfflineExam(examId: string): Promise<void> {
  const db = await getDb();
  await db.withTransactionAsync(async () => {
    await db.runAsync(`DELETE FROM offline_exams WHERE examId = ?`, examId);
    await db.runAsync(`DELETE FROM offline_questions WHERE examId = ?`, examId);
    // Only wipe attempts that are already synced, so submitted-not-synced
    // papers survive re-downloads.
    const synced = await db.getAllAsync<{ attemptId: string }>(
      `SELECT attemptId FROM offline_attempts WHERE examId = ? AND syncStatus = 'SYNCED'`,
      examId,
    );
    for (const row of synced) {
      await db.runAsync(`DELETE FROM offline_answers WHERE attemptId = ?`, row.attemptId);
      await db.runAsync(`DELETE FROM offline_attempts WHERE attemptId = ?`, row.attemptId);
    }
  });
}

/** Reset a FAILED attempt back to SUBMITTED so the next sync pass retries it. */
export async function retryAttempt(attemptId: string): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `UPDATE offline_attempts SET syncStatus = 'SUBMITTED', lastError = NULL WHERE attemptId = ?`,
    attemptId,
  );
}

export async function offlineAttemptCount(): Promise<number> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ c: number }>(
    `SELECT COUNT(*) AS c FROM offline_attempts WHERE submitted = 0`,
  );
  return row?.c ?? 0;
}

/** Attempts that have been submitted but not yet confirmed synced to server. */
export async function pendingSubmittedCount(): Promise<number> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ c: number }>(
    `SELECT COUNT(*) AS c FROM offline_attempts
     WHERE submitted = 1 AND syncStatus IN ('LOCAL','SYNCING','SUBMITTED','FAILED')`,
  );
  return row?.c ?? 0;
}

export type AttemptListItem = {
  attemptId: string;
  examId: string;
  examTitle: string;
  subjectName: string;
  startedAt: number;
  submittedAt: number | null;
  deadlineAt: number;
  submitted: boolean;
  syncStatus: "LOCAL" | "SYNCING" | "SUBMITTED" | "SYNCED" | "FAILED";
  lastError: string | null;
  answerCount: number;
};

export async function listAttemptsWithExam(): Promise<AttemptListItem[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<any>(
    `SELECT a.attemptId, a.examId, a.startedAt, a.submittedAt, a.deadlineAt,
            a.submitted, a.syncStatus, a.lastError, e.payloadJson AS examJson,
            (SELECT COUNT(*) FROM offline_answers ans WHERE ans.attemptId = a.attemptId) AS answerCount
     FROM offline_attempts a
     LEFT JOIN offline_exams e ON e.examId = a.examId
     ORDER BY a.startedAt DESC`,
  );
  return rows.map((r) => {
    let title = "(downloaded exam)";
    let subject = "";
    try {
      if (r.examJson) {
        const ex = JSON.parse(r.examJson);
        title = ex.title ?? title;
        subject = ex.subjectName ?? "";
      }
    } catch { /* ignore */ }
    return {
      attemptId: r.attemptId,
      examId: r.examId,
      examTitle: title,
      subjectName: subject,
      startedAt: r.startedAt,
      submittedAt: r.submittedAt ?? null,
      deadlineAt: r.deadlineAt,
      submitted: !!r.submitted,
      syncStatus: r.syncStatus,
      lastError: r.lastError ?? null,
      answerCount: r.answerCount ?? 0,
    };
  });
}
