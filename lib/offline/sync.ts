"use client";

import {
  getQueuedWrites,
  removeQueuedWrite,
  incrementRetry,
  getQueueCount,
  type QueuedWrite,
} from "./db";
import {
  listPendingSubmissions,
  patchSubmission,
  pendingSubmissionCount,
  removeSubmission,
} from "./exam-store";
import { retryDelayMs, shouldRetrySubmission } from "@/lib/offline-exam";

/**
 * Offline sync manager.
 *
 * Detects online/offline state and replays queued writes when connectivity
 * returns. Uses the browser's `online`/`offline` events + a polling fallback
 * for unreliable connections.
 *
 * Write strategy: FIFO replay, last-write-wins (the server already handles
 * idempotency for attendance and gradebook via unique constraints).
 */

export type SyncStatus = "idle" | "syncing" | "error" | "offline";

const listeners = new Set<(_status: SyncStatus, _pending: number) => void>();
let currentStatus: SyncStatus =
  typeof navigator !== "undefined" && !navigator.onLine ? "offline" : "idle";
let currentPending = 0;

export type QueueWriteResult = {
  write: QueuedWrite;
  success: boolean;
  statusCode: number | null;
  willRetry: boolean;
};
const queueWriteResultListeners = new Set<(_result: QueueWriteResult) => void>();

export function onQueueWriteResult(listener: (_result: QueueWriteResult) => void): () => void {
  queueWriteResultListeners.add(listener);
  return () => queueWriteResultListeners.delete(listener);
}

function reportQueueWriteResult(result: QueueWriteResult) {
  queueWriteResultListeners.forEach((listener) => {
    try {
      listener(result);
    } catch {
      // A screen-level notification must not interrupt durable queue replay.
    }
  });
}

export function getSyncStatus(): { status: SyncStatus; pending: number } {
  return { status: currentStatus, pending: currentPending };
}

export function onSyncChange(fn: (_status: SyncStatus, _pending: number) => void): () => void {
  listeners.add(fn);
  fn(currentStatus, currentPending);
  return () => listeners.delete(fn);
}

function emit(status: SyncStatus, pending: number) {
  currentStatus = status;
  currentPending = pending;
  listeners.forEach((fn) => fn(status, pending));
}

/**
 * Process all queued writes. Called on `online` event and on app focus.
 * Each write is replayed to its original URL; failures are retried (up to 5x).
 */
export async function flushQueue(): Promise<{ succeeded: number; failed: number }> {
  const queue = await getQueuedWrites();
  if (queue.length === 0) {
    emit("idle", 0);
    return { succeeded: 0, failed: 0 };
  }

  emit("syncing", queue.length);
  let succeeded = 0;
  let failed = 0;

  for (const write of queue) {
    if (!write.id) continue;
    try {
      const res = await fetch(write.url, {
        method: write.method,
        headers: { "Content-Type": "application/json" },
        body: write.body ? JSON.stringify(write.body) : undefined,
      });
      if (res.ok) {
        await removeQueuedWrite(write.id);
        succeeded++;
        reportQueueWriteResult({ write, success: true, statusCode: res.status, willRetry: false });
      } else if (res.status >= 400 && res.status < 500) {
        // Client error — don't retry (bad data), remove from queue
        await removeQueuedWrite(write.id);
        failed++;
        reportQueueWriteResult({ write, success: false, statusCode: res.status, willRetry: false });
      } else {
        // Server error — retry
        if (write.retries >= 5) {
          await removeQueuedWrite(write.id);
          failed++;
          reportQueueWriteResult({
            write,
            success: false,
            statusCode: res.status,
            willRetry: false,
          });
        } else {
          await incrementRetry(write.id);
          failed++;
          reportQueueWriteResult({
            write,
            success: false,
            statusCode: res.status,
            willRetry: true,
          });
          break; // Stop processing — likely server is down
        }
      }
    } catch {
      // Network error — still offline, stop processing
      if (write.retries >= 5) {
        await removeQueuedWrite(write.id);
        failed++;
        reportQueueWriteResult({ write, success: false, statusCode: null, willRetry: false });
      } else {
        await incrementRetry(write.id);
        reportQueueWriteResult({ write, success: false, statusCode: null, willRetry: true });
      }
      break;
    }
  }

  const remaining = await getQueueCount();
  emit(remaining > 0 ? "error" : "idle", remaining);
  return { succeeded, failed };
}

/* ------------------------------------------------------------------
   Exam submissions
   ------------------------------------------------------------------

   A finished paper is queued in its own store (`lib/offline/exam-store.ts`),
   not in the generic write queue, for one reason: replaying a paper needs the
   manifest and signature it was sat with, and the generic queue only carries a
   URL and a body. Losing that provenance would mean the sitting could not be
   verified against the paper at all.

   The flush is deliberately different from `flushQueue` in three ways:

     • a submission is removed from the queue ONLY on a definite success. The
       generic queue deletes on any 4xx, which for an exam means throwing away
       a child's paper because of a validation bug.
     • a terminal failure is retained and surfaced, so the student sees "this
       needs your teacher" rather than a paper that silently vanished.
     • retries back off with jitter instead of hammering, because a whole class
       reconnects at the same moment when the school's Wi-Fi returns.
*/
export type ExamSyncResult = { sent: number; pending: number; failed: number };

export async function flushExamSubmissions(): Promise<ExamSyncResult> {
  const queue = await listPendingSubmissions();
  if (!queue.length) return { sent: 0, pending: 0, failed: 0 };

  let sent = 0;
  let failed = 0;

  for (const submission of queue) {
    // A submission that already used up its retry budget is offered again only
    // on an explicit user action; do not spin on it in the background.
    if (submission.status === "FAILED" && submission.attempts >= 8) {
      failed += 1;
      continue;
    }

    try {
      const response = await fetch(
        `/api/student/exams/${encodeURIComponent(submission.examId)}/attempt/offline-replay`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            clientAttemptId: submission.clientAttemptId,
            startedAt: submission.startedAt,
            submittedAt: submission.submittedAt,
            durationMinutes: submission.durationMinutes,
            answers: submission.answers,
            finalize: true,
            manifest: submission.manifest,
            signature: submission.signature,
          }),
        },
      );

      const body = (await response.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
        message?: string;
        acceptedAnswers?: number;
      };

      if (response.ok && body.ok !== false) {
        // Definite success: the paper is on the server and graded.
        await removeSubmission(submission.id);
        sent += 1;
        continue;
      }

      const retryable = shouldRetrySubmission(response.status);
      await patchSubmission(submission.id, {
        status: retryable ? "PENDING" : "FAILED",
        attempts: submission.attempts + 1,
        lastError:
          body.error ||
          (response.status === 401
            ? "Your session expired. Sign in again to send this paper."
            : `The server rejected this paper (${response.status}).`),
      });
      failed += 1;

      if (retryable) {
        // Stop the sweep: the likely cause is that we are still effectively
        // offline, and the next entries would fail the same way.
        break;
      }
    } catch {
      // Still no connectivity. Leave it queued, count the attempt, and stop.
      await patchSubmission(submission.id, {
        status: "PENDING",
        attempts: submission.attempts + 1,
        lastError: "Waiting for a connection.",
      });
      failed += 1;
      break;
    }
  }

  return { sent, pending: await pendingSubmissionCount(), failed };
}

/**
 * Send one submission now — used when a student taps "Retry" on the banner.
 *
 * Returns whether it went through, and the server's message, so the runner can
 * either navigate away or explain the one failure the student must act on.
 */
export async function submitQueuedExam(clientAttemptId: string): Promise<{
  sent: boolean;
  message: string;
}> {
  const before = await listPendingSubmissions();
  const target = before.find((entry) => entry.clientAttemptId === clientAttemptId);
  if (!target) return { sent: false, message: "This paper is no longer waiting to send." };

  // Force one attempt even if it is marked FAILED.
  await patchSubmission(target.id, { status: "PENDING" });
  const result = await flushExamSubmissions();
  if (result.sent > 0) return { sent: true, message: "Paper sent." };

  const after = (await listPendingSubmissions()).find(
    (entry) => entry.clientAttemptId === clientAttemptId,
  );
  return {
    sent: false,
    message: after?.lastError ?? "Still no connection. Your answers are safe on this device.",
  };
}

/** Wait before the next background retry, jittered so a class does not stampede. */
export function nextExamRetryDelay(attempts: number): number {
  return retryDelayMs(attempts);
}

/**
 * Initialise the sync manager. Call once on app mount (in a provider).
 */
export function initSyncManager() {
  if (typeof window === "undefined") return;

  const handleOnline = () => {
    void flushQueue();
    // Papers first: a queued exam sitting is more urgent than a cached read,
    // and it is the one thing on the device that exists nowhere else.
    void flushExamSubmissions();
  };
  const handleOffline = () => {
    getQueueCount().then((count) => emit("offline", count));
  };

  window.addEventListener("online", handleOnline);
  window.addEventListener("offline", handleOffline);

  // Poll for connectivity every 30s (for unreliable networks that don't fire events)
  const pollInterval = setInterval(async () => {
    if (navigator.onLine) {
      const count = await getQueueCount();
      if (count > 0 && currentStatus !== "syncing") {
        void flushQueue();
      }
      // Unsent papers are retried on every poll, independently of the generic
      // queue: an exam answer is the only data on the device that exists
      // nowhere else, so it must not wait behind a stuck attendance write.
      if ((await pendingSubmissionCount()) > 0) {
        void flushExamSubmissions();
      }
    }
  }, 30_000);

  // Initial state
  if (!navigator.onLine) {
    getQueueCount().then((count) => emit("offline", count));
  }

  return () => {
    window.removeEventListener("online", handleOnline);
    window.removeEventListener("offline", handleOffline);
    clearInterval(pollInterval);
  };
}
