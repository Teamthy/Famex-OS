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
        -- submitted status.
        CREATE TABLE IF NOT EXISTS offline_attempts (
          attemptId   TEXT PRIMARY KEY,
          examId      TEXT NOT NULL,
          startedAt   INTEGER NOT NULL,
          deadlineAt  INTEGER NOT NULL,
          submitted   INTEGER NOT NULL DEFAULT 0,
          submittedAt INTEGER
        );
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
  attempt: { id: string; startedAt: string; deadlineAt: string; secondsLeft: number };
  questions: OfflineQuestion[];
}

export async function saveOfflinePackage(pkg: OfflinePackage): Promise<void> {
  const db = await getDb();
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
    await db.runAsync(
      `INSERT OR IGNORE INTO offline_attempts (attemptId, examId, startedAt, deadlineAt, submitted)
       VALUES (?, ?, ?, ?, 0)`,
      pkg.attempt.id,
      pkg.exam.id,
      new Date(pkg.attempt.startedAt).getTime(),
      new Date(pkg.attempt.deadlineAt).getTime(),
    );
  });
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
  if (!attemptRow) return null;
  return {
    exam,
    questions,
    attempt: {
      id: attemptRow.attemptId,
      startedAt: new Date(attemptRow.startedAt).toISOString(),
      deadlineAt: new Date(attemptRow.deadlineAt).toISOString(),
      secondsLeft: Math.max(0, Math.floor((attemptRow.deadlineAt - Date.now()) / 1000)),
    },
  };
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
    `UPDATE offline_attempts SET submitted = 1, submittedAt = ? WHERE attemptId = ?`,
    Date.now(),
    attemptId,
  );
}

export async function deleteOfflineExam(examId: string): Promise<void> {
  const db = await getDb();
  await db.withTransactionAsync(async () => {
    await db.runAsync(`DELETE FROM offline_exams WHERE examId = ?`, examId);
    await db.runAsync(`DELETE FROM offline_questions WHERE examId = ?`, examId);
    const attempt = await db.getFirstAsync<{ attemptId: string }>(
      `SELECT attemptId FROM offline_attempts WHERE examId = ? AND submitted = 1`,
      examId,
    );
    if (attempt) {
      await db.runAsync(`DELETE FROM offline_answers WHERE attemptId = ?`, attempt.attemptId);
      await db.runAsync(`DELETE FROM offline_attempts WHERE attemptId = ?`, attempt.attemptId);
    }
  });
}

export async function offlineAttemptCount(): Promise<number> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ c: number }>(
    `SELECT COUNT(*) AS c FROM offline_attempts WHERE submitted = 0`,
  );
  return row?.c ?? 0;
}
