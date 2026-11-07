/**
 * Offline exam client state — pure, testable, no React and no IndexedDB.
 *
 * The browser runner has to survive three things a normal React page does not:
 * the tab being force-killed mid-answer, the device losing power with no chance
 * to flush, and the student reopening the app a day later with the paper still
 * unfinished.
 *
 * The rules that make that safe live here rather than inside the component,
 * because they are the ones that lose marks when they are wrong and the ones a
 * test can pin down:
 *
 *   • the deadline is an ABSOLUTE timestamp, stored once when the paper was
 *     opened, never a countdown that restarts on reload;
 *   • a submitted paper is terminal — reopening must not resurrect it;
 *   • elapsed time is computed from the clock, never from the number of ticks a
 *     component received (a backgrounded tab throttles timers).
 */
import type { OfflinePacketManifest } from "@/lib/offline-packet";

/*
 * Storage is split across two IndexedDB databases on purpose.
 *
 *   famex-offline        — the general API response cache (lib/offline/db.ts),
 *                          wiped on sign-out and on a school switch.
 *   famex-offline-exams  — downloaded papers and unsynced answers (this file).
 *
 * An exam paper and a student's answers must NOT be wiped by a sign-out or a
 * cache bug: until they sync, the device holds the only copy.
 */
export const OFFLINE_DB_NAME = "famex-offline-exams";
export const OFFLINE_DB_VERSION = 1;
export const PAPERS_STORE = "papers";
export const SUBMISSIONS_STORE = "submissions";

export type StoredQuestion = {
  id: string;
  type: "MCQ" | "TRUE_FALSE" | "FILL_BLANK" | "ESSAY";
  questionText: string;
  options: Array<{ key: string; text: string }> | null;
  marks: number;
};

/** One downloaded paper, as it lives on the device. */
export type StoredPaper = {
  /** Primary key — the exam id, so a re-download replaces the old copy. */
  id: string;
  examId: string;
  manifest: OfflinePacketManifest;
  signature: string;
  title: string;
  subjectName: string;
  className: string;
  examType: string;
  instructions: string | null;
  passMark: number;
  /** Seat returned by the server when the paper was started online. */
  serverAttemptId: string | null;
  /** Device-side clock start. Null until the student taps Start. */
  startedAt: string | null;
  /** Absolute deadline. Computed once, from startedAt + duration. */
  deadlineAt: string | null;
  status: "DOWNLOADED" | "IN_PROGRESS" | "AWAITING_SYNC" | "SYNCED";
  downloadedAt: string;
  questions: StoredQuestion[];
  /**
   * The answers as typed, keyed by question id.
   *
   * Stored on the paper so a reload restores the student's work even when the
   * server was never reachable. This is the copy that must never be lost: the
   * server's copy is an optimisation, this one is the record.
   */
  answers?: Record<string, string>;
  /**
   * The user who downloaded this paper.
   *
   * IndexedDB belongs to the BROWSER, not the account, so on a shared device
   * the next student to sign in could open a paper the previous one left
   * behind. Storage is not a security boundary here; this field is, and
   * `ownsPaper()` in lib/offline/session.ts enforces it.
   *
   * Nullable: papers downloaded before this field existed have no owner. They
   * are treated as the current user's rather than being refused — stranding
   * them mid exam-period would be worse than the gap they represent.
   */
  ownerUserId?: string | null;
  /** The school the owner belonged to, for cache scoping. */
  ownerSchoolId?: string | null;
};

/** A finished sitting waiting for connectivity. */
export type StoredSubmission = {
  /** Primary key — the clientAttemptId the server uses for idempotency. */
  id: string;
  examId: string;
  title: string;
  subjectName: string;
  clientAttemptId: string;
  answers: Array<{ questionId: string; response: string | null }>;
  startedAt: string;
  submittedAt: string;
  durationMinutes: number;
  manifest: OfflinePacketManifest;
  signature: string;
  /** Server attempt id when the paper was started while online. */
  serverAttemptId: string | null;
  status: "PENDING" | "SYNCED" | "FAILED";
  /** Last server error, kept so the student sees why it has not gone through. */
  lastError: string | null;
  attempts: number;
  queuedAt: string;
};

/* ------------------------------------------------------------------
   Answer bookkeeping
   ------------------------------------------------------------------ */

export type AnswerMap = Record<string, string>;

/**
 * How many questions have a non-empty answer.
 *
 * Whitespace-only is unanswered: a student who leaned on the space bar has not
 * answered, and counting it would tell them they had finished a paper they had
 * not.
 */
export function answeredCount(questions: Array<{ id: string }>, answers: AnswerMap): number {
  return questions.filter((question) => (answers[question.id] ?? "").trim().length > 0).length;
}

/** The payload shape the replay endpoint expects. */
export function answersForReplay(
  questions: Array<{ id: string }>,
  answers: AnswerMap,
): Array<{ questionId: string; response: string | null }> {
  return questions.map((question) => {
    const value = answers[question.id] ?? "";
    return { questionId: question.id, response: value.trim().length ? value : null };
  });
}

/* ------------------------------------------------------------------
   Timing
   ------------------------------------------------------------------ */

/**
 * Start the clock. Called ONCE, when the student taps Start.
 *
 * Returns the absolute deadline. Everything downstream — the countdown, the
 * auto-submit, the replay payload — reads this value, so closing the tab,
 * reloading, or the device sleeping cannot restart the paper.
 */
export function startClock(params: { now?: Date; durationMinutes: number }): {
  startedAt: string;
  deadlineAt: string;
} {
  const now = params.now ?? new Date();
  return {
    startedAt: now.toISOString(),
    deadlineAt: new Date(now.getTime() + params.durationMinutes * 60_000).toISOString(),
  };
}

/**
 * Seconds left, computed from two absolute timestamps.
 *
 * Never decremented in state: a backgrounded tab throttles timers to once a
 * minute, and a countdown driven by ticks would hand a student in a background
 * tab a longer paper than one watching the screen.
 */
export function secondsLeft(deadlineAt: string | null, now: Date = new Date()): number {
  if (!deadlineAt) return 0;
  const deadline = new Date(deadlineAt).getTime();
  if (!Number.isFinite(deadline)) return 0;
  return Math.max(0, Math.floor((deadline - now.getTime()) / 1000));
}

export function isExpired(deadlineAt: string | null, now: Date = new Date()): boolean {
  if (!deadlineAt) return false;
  return secondsLeft(deadlineAt, now) === 0;
}

export function formatClock(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const minutes = Math.floor(safe / 60);
  const seconds = safe % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

/* ------------------------------------------------------------------
   Paper state machine
   ------------------------------------------------------------------ */

/**
 * What the student may do with a downloaded paper right now.
 *
 *   DOWNLOAD  — on the device but not opened; Start is available.
 *   RESUME    — opened, time remains.
 *   EXPIRED   — opened, time ran out, not yet submitted. Must be submitted now
 *               with whatever was answered rather than silently dropped.
 *   SUBMITTED — done; only a sync action remains.
 */
export type PaperAction = "DOWNLOAD" | "RESUME" | "EXPIRED" | "SUBMITTED";

export function paperAction(paper: StoredPaper, now: Date = new Date()): PaperAction {
  if (paper.status === "AWAITING_SYNC" || paper.status === "SYNCED") return "SUBMITTED";
  if (!paper.startedAt || !paper.deadlineAt) return "DOWNLOAD";
  return isExpired(paper.deadlineAt, now) ? "EXPIRED" : "RESUME";
}

/**
 * A human reason the paper cannot be started, or null.
 *
 * The sitting window can close while a paper sits downloaded on a device. The
 * runner must say so plainly — a student staring at a Start button that answers
 * 409 with no explanation is the most common exam-day support call.
 */
export function startRefusal(paper: StoredPaper, now: Date = new Date()): string | null {
  if (paper.status === "AWAITING_SYNC" || paper.status === "SYNCED") {
    return "This paper has already been submitted and is waiting to sync.";
  }
  if (paper.startedAt && paper.deadlineAt && isExpired(paper.deadlineAt, now)) {
    return "Time for this paper has run out. Submit now to save your answers.";
  }
  return null;
}

/* ------------------------------------------------------------------
   Submission idempotency
   ------------------------------------------------------------------ */

/**
 * The client attempt id for a paper.
 *
 * Stable per exam AND per opening, so a double-tap on Submit, a retry after a
 * dropped connection, and a replay after a force-quit all present the SAME id —
 * which is what makes the server's replay idempotent instead of creating a
 * second attempt. Derived from the start time rather than random: two different
 * openings (after a retake) must differ, and the same opening must always
 * produce the same value.
 */
export function clientAttemptIdFor(params: { examId: string; startedAt: string }): string {
  const started = new Date(params.startedAt).getTime();
  return `${params.examId}-${Number.isFinite(started) ? started : 0}`;
}

/**
 * Whether a queued submission should be retried.
 *
 * A 4xx that is not about connectivity (bad payload, wrong student) will never
 * succeed on retry and must not spin forever on the device — that is how an
 * exam-day queue grows until storage is full. Everything else — offline, 5xx,
 * gateway timeouts — is retried.
 */
export function shouldRetrySubmission(status: number | null): boolean {
  if (status === null || status === 0) return true;
  // The session is gone; a retry cannot fix that, a re-login can.
  if (status === 401 || status === 403) return false;
  if (status === 408 || status === 429) return true;
  if (status >= 500) return true;
  // Anything below 400 succeeded (or was a redirect already followed): there is
  // nothing to retry, and re-posting a success would queue a duplicate.
  return false;
}

/**
 * Backoff for a retrying submission, in milliseconds.
 *
 * Capped at two minutes: a whole class reconnects at once when the school's
 * Wi-Fi returns, and a queue that hammers the server instantly is how the replay
 * endpoint falls over on exam day.
 */
export function retryDelayMs(attempts: number, random: () => number = Math.random): number {
  const base = Math.min(120_000, 2_000 * Math.pow(2, Math.max(0, attempts)));
  // ±20% jitter so a class does not retry in lockstep.
  const jitter = 0.8 + random() * 0.4;
  return Math.round(base * jitter);
}
