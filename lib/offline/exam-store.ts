"use client";

/**
 * Device-side storage for offline exams.
 *
 * Kept in its own IndexedDB database, separate from the general API cache in
 * `lib/offline/db.ts`, because `cacheClear()` runs on sign-out and a school
 * switch. An exam paper and a student's answers must not be wiped by that —
 * until they sync, the device holds the only copy. Sign-out uses
 * `planSignOut()` (lib/offline/session.ts) to pick which papers are safe to
 * delete; AWAITING_SYNC and IN_PROGRESS papers are never among them.
 *
 * Everything here degrades to a no-op rather than throwing when IndexedDB is
 * unavailable (private mode on some browsers, a locked-down kiosk). The runner
 * treats an empty store as "no papers downloaded" and falls back to online
 * behaviour, which is what should happen.
 */
import { openDB, type IDBPDatabase } from "idb";
import {
  OFFLINE_DB_NAME,
  OFFLINE_DB_VERSION,
  PAPERS_STORE,
  SUBMISSIONS_STORE,
  type StoredPaper,
  type StoredSubmission,
} from "@/lib/offline-exam";
import { ownsPaper } from "@/lib/offline/session";

let dbPromise: Promise<IDBPDatabase> | null = null;

function available(): boolean {
  return typeof window !== "undefined" && typeof indexedDB !== "undefined";
}

function getDB(): Promise<IDBPDatabase> {
  if (!dbPromise) {
    dbPromise = openDB(OFFLINE_DB_NAME, OFFLINE_DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(PAPERS_STORE)) {
          db.createObjectStore(PAPERS_STORE, { keyPath: "id" });
        }
        if (!db.objectStoreNames.contains(SUBMISSIONS_STORE)) {
          db.createObjectStore(SUBMISSIONS_STORE, { keyPath: "id" });
        }
      },
    });
  }
  return dbPromise;
}

/* ------------------------------------------------------------------
   Papers
   ------------------------------------------------------------------ */

export async function savePaper(paper: StoredPaper): Promise<void> {
  if (!available()) return;
  try {
    await (await getDB()).put(PAPERS_STORE, paper);
  } catch {
    // Storage full or blocked. The runner keeps working from memory for this
    // session; the student sees "not available offline" next time.
  }
}

export async function getPaper(examId: string): Promise<StoredPaper | null> {
  if (!available()) return null;
  try {
    return ((await (await getDB()).get(PAPERS_STORE, examId)) as StoredPaper | undefined) ?? null;
  } catch {
    return null;
  }
}

/**
 * The paper, but only if it belongs to this user.
 *
 * `getPaper` returns whatever is in the browser's store. On a shared device
 * that is the previous student's paper, and the runner opening it would hand
 * one child another child's exam. Every reader that acts on behalf of a
 * signed-in user goes through here.
 */
export async function getOwnPaper(
  examId: string,
  user: { id: string } | null,
): Promise<StoredPaper | null> {
  const paper = await getPaper(examId);
  if (!paper) return null;
  return ownsPaper(paper, user) ? paper : null;
}

/** Papers this user may see. Another account's papers are omitted entirely. */
export async function listOwnPapers(user: { id: string } | null): Promise<StoredPaper[]> {
  const rows = await listPapers();
  return rows.filter((paper) => ownsPaper(paper, user));
}

/**
 * Delete the papers named by a sign-out plan, plus every pending submission.
 *
 * Called on sign-out. Only papers that are safe to lose are named by
 * `planSignOut()` — a submission the server has not accepted is never listed —
 * so this cannot destroy the only copy of a sitting.
 */
export async function purgePapers(examIds: readonly string[]): Promise<void> {
  if (!available()) return;
  try {
    const db = await getDB();
    await Promise.all(examIds.map((id) => db.delete(PAPERS_STORE, id)));
    // A submission whose answers were kept would otherwise be sent by the next
    // account to sign in on this device.
    const keep = new Set(examIds);
    const pending = (await db.getAll(SUBMISSIONS_STORE)) as StoredSubmission[];
    await Promise.all(
      pending
        .filter((submission) => keep.has(submission.examId))
        .map((submission) => db.delete(SUBMISSIONS_STORE, submission.id)),
    );
  } catch {
    // The cache and queue are cleared regardless; a stale paper is deleted on
    // the next sign-out.
  }
}

export async function listPapers(): Promise<StoredPaper[]> {
  if (!available()) return [];
  try {
    const rows = (await (await getDB()).getAll(PAPERS_STORE)) as StoredPaper[];
    return rows.sort((a, b) => a.downloadedAt.localeCompare(b.downloadedAt));
  } catch {
    return [];
  }
}

export async function deletePaper(examId: string): Promise<void> {
  if (!available()) return;
  try {
    await (await getDB()).delete(PAPERS_STORE, examId);
  } catch {
    // A stale paper is deleted again on the next sign-in.
  }
}

/**
 * Patch a paper in place.
 *
 * Read-modify-write rather than a targeted update: the only fields ever patched
 * (status, startedAt, deadlineAt, serverAttemptId) are always written together,
 * and a lost update here means a clock that restarts.
 */
export async function patchPaper(
  examId: string,
  patch: Partial<Omit<StoredPaper, "id" | "examId">>,
): Promise<StoredPaper | null> {
  const existing = await getPaper(examId);
  if (!existing) return null;
  const next = { ...existing, ...patch };
  await savePaper(next);
  return next;
}

/* ------------------------------------------------------------------
   Pending submissions
   ------------------------------------------------------------------ */

export async function queueSubmission(submission: StoredSubmission): Promise<void> {
  if (!available()) return;
  try {
    await (await getDB()).put(SUBMISSIONS_STORE, submission);
  } catch {
    // The caller checks `listPendingSubmissions` and tells the student honestly
    // if the answer could not be stored.
  }
}

export async function getSubmission(id: string): Promise<StoredSubmission | null> {
  if (!available()) return null;
  try {
    return (
      ((await (await getDB()).get(SUBMISSIONS_STORE, id)) as StoredSubmission | undefined) ?? null
    );
  } catch {
    return null;
  }
}

export async function listPendingSubmissions(): Promise<StoredSubmission[]> {
  if (!available()) return [];
  try {
    const rows = (await (await getDB()).getAll(SUBMISSIONS_STORE)) as StoredSubmission[];
    return rows
      .filter((row) => row.status === "PENDING" || row.status === "FAILED")
      .sort((a, b) => a.queuedAt.localeCompare(b.queuedAt));
  } catch {
    return [];
  }
}

export async function patchSubmission(
  id: string,
  patch: Partial<Omit<StoredSubmission, "id">>,
): Promise<void> {
  const existing = await getSubmission(id);
  if (!existing) return;
  await queueSubmission({ ...existing, ...patch });
}

export async function removeSubmission(id: string): Promise<void> {
  if (!available()) return;
  try {
    await (await getDB()).delete(SUBMISSIONS_STORE, id);
  } catch {
    // A synced submission that cannot be deleted is harmless: it is filtered
    // out by status.
  }
}

/** Count for the "N exams ready to submit" banner. */
export async function pendingSubmissionCount(): Promise<number> {
  return (await listPendingSubmissions()).length;
}
