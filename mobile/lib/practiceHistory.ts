/**
 * On-device practice history + streak tracking.
 *
 * Each completed practice session is recorded in the local SQLite store, so a
 * student keeps a persistent record of their effort even when offline. From
 * those rows we derive a few motivating numbers:
 *   - total questions attempted & answered correctly
 *   - sessions completed
 *   - current streak (consecutive days with ≥1 practice session)
 *   - best-ever percentage
 *
 * Streaks are calculated from calendar days (local time), not rolling 24h
 * windows, so "practise every day" reads naturally to a student.
 */
import * as SQLite from "expo-sqlite";

export interface PracticeSession {
  id: number;
  /** ISO date (YYYY-MM-DD) the session was completed, in local time. */
  day: string;
  subjectId: string;
  total: number;
  correct: number;
  pct: number;
  completedAt: number; // epoch ms
}

export interface PracticeStats {
  sessions: number;
  questionsAttempted: number;
  correct: number;
  bestPct: number;
  currentStreak: number;
  lastSessionDay: string | null;
}

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

function getDb() {
  if (!dbPromise) {
    dbPromise = (async () => {
      const db = await SQLite.openDatabaseAsync("ykay_offline.db");
      await db.execAsync(`
        CREATE TABLE IF NOT EXISTS practice_history (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          day TEXT NOT NULL,
          subjectId TEXT NOT NULL,
          total INTEGER NOT NULL,
          correct INTEGER NOT NULL,
          pct REAL NOT NULL,
          completedAt INTEGER NOT NULL
        );
      `);
      return db;
    })();
  }
  return dbPromise;
}

/** Local calendar day as YYYY-MM-DD. */
export function localDay(d = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Number of calendar days between two YYYY-MM-DD dates. */
function daysBetween(a: string, b: string): number {
  const [ay, am, ad] = a.split("-").map(Number);
  const [by, bm, bd] = b.split("-").map(Number);
  const da = new Date(ay, am - 1, ad);
  const db = new Date(by, bm - 1, bd);
  return Math.round((db.getTime() - da.getTime()) / 86_400_000);
}

export async function recordPracticeSession(input: {
  subjectId: string;
  total: number;
  correct: number;
  pct: number;
}): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    "INSERT INTO practice_history (day, subjectId, total, correct, pct, completedAt) VALUES (?, ?, ?, ?, ?, ?)",
    localDay(),
    input.subjectId,
    input.total,
    input.correct,
    input.pct,
    Date.now(),
  );
}

export async function getPracticeHistory(limit = 20): Promise<PracticeSession[]> {
  const db = await getDb();
  return db.getAllAsync<PracticeSession>(
    "SELECT * FROM practice_history ORDER BY completedAt DESC LIMIT ?",
    limit,
  );
}

export async function getPracticeStats(): Promise<PracticeStats> {
  const db = await getDb();
  const rows = await db.getAllAsync<PracticeSession>(
    "SELECT * FROM practice_history ORDER BY completedAt ASC",
  );

  const stats: PracticeStats = {
    sessions: rows.length,
    questionsAttempted: 0,
    correct: 0,
    bestPct: 0,
    currentStreak: 0,
    lastSessionDay: null,
  };

  if (rows.length === 0) return stats;

  for (const r of rows) {
    stats.questionsAttempted += r.total;
    stats.correct += r.correct;
    stats.bestPct = Math.max(stats.bestPct, r.pct);
  }

  // Current streak = consecutive days up to & including the most recent session.
  const days = [...new Set(rows.map((r) => r.day))].sort();
  stats.lastSessionDay = days[days.length - 1];
  let streak = 1;
  let k = days.length - 1;
  while (k > 0 && daysBetween(days[k - 1], days[k]) === 1) {
    streak++;
    k--;
  }
  stats.currentStreak = streak;
  return stats;
}
