/**
 * Offline exam sync engine.
 *
 * Called whenever connectivity returns (or on app foreground). Walks all
 * offline attempts that haven't yet reached SYNCED:
 *
 *   1. LOCAL attempts (student started offline): replay them with all saved
 *      answers to /offline-replay. If the attempt is not yet submitted,
 *      finalize=false so the server is aware but the paper stays IN_PROGRESS
 *      and later SAVEs go direct. If it's been submitted, finalize=true.
 *
 *   2. SYNCING attempts (server already knows about them): flush any locally
 *      saved answers that aren't yet on the server (handled transparently by
 *      the normal api() autosave path, so we just nudge a SAVE with the full
 *      answer set).
 *
 *   3. SUBMITTED attempts: send finalize=true replay/SUBMIT.
 *
 *   4. FAILED attempts: leave them; expose via getPendingAttempts() so the
 *      UI can show "Tap to retry".
 *
 * Idempotent: safe to call repeatedly; the server rejects duplicate
 * replays via the IdempotencyRecord key.
 */
import { studentApi } from "@/lib/api";
import {
  autoSubmitExpired,
  getOfflineAnswers,
  getOfflineExam,
  listPendingAttempts,
  updateAttemptSync,
} from "@/lib/offline/exams";
import { type ExamAnswer } from "@/lib/api";

export type SyncProgress = {
  examId: string;
  examTitle: string;
  attemptId: string;
  syncStatus: string;
  savedCount: number;
  error?: string;
};

export async function syncOfflineExams(onProgress?: (p: SyncProgress) => void): Promise<{
  synced: number;
  submitted: number;
  failed: number;
}> {
  // First, auto-submit any attempts whose deadline has passed since we were
  // last foregrounded (student killed the app mid-exam).
  await autoSubmitExpired();

  let synced = 0;
  let submitted = 0;
  let failed = 0;

  const pending = await listPendingAttempts();
  for (const attempt of pending) {
    try {
      const pkg = await getOfflineExam(attempt.examId);
      if (!pkg) continue;

      const answers: ExamAnswer[] = Object.entries(
        await getOfflineAnswers(attempt.attemptId),
      ).map(([questionId, response]) => ({ questionId, response }));

      onProgress?.({
        examId: attempt.examId,
        examTitle: pkg.exam.title,
        attemptId: attempt.attemptId,
        syncStatus: "syncing",
        savedCount: answers.length,
      });

      if (attempt.syncStatus === "LOCAL") {
        // Create server-side attempt via offline-replay.
        const res = await studentApi.replayOffline(attempt.examId, {
          clientAttemptId: attempt.attemptId,
          startedAt: new Date(attempt.startedAt).toISOString(),
          submittedAt: attempt.submitted ? new Date(attempt.submittedAt!).toISOString() : null,
          durationMinutes: pkg.exam.durationMinutes,
          answers: answers.map((a) => ({ questionId: a.questionId, response: a.response })),
          finalize: attempt.submitted,
        });
        if (res?.attemptId) {
          await updateAttemptSync(attempt.attemptId, {
            serverAttemptId: res.attemptId,
            syncStatus: res.submitted ? "SYNCED" : "SYNCING",
            lastError: null,
          });
          if (res.submitted) submitted++;
          else synced++;
          onProgress?.({
            examId: attempt.examId,
            examTitle: pkg.exam.title,
            attemptId: attempt.attemptId,
            syncStatus: res.submitted ? "synced" : "syncing",
            savedCount: answers.length,
          });
        }
      } else if (attempt.syncStatus === "SYNCING") {
        // Server already has the attempt; autosave will flow through the
        // normal path. Force a save of the current answer set.
        if (answers.length) {
          await studentApi.saveExam(attempt.examId, attempt.serverAttemptId ?? attempt.attemptId, answers);
        }
        synced++;
      } else if (attempt.syncStatus === "SUBMITTED") {
        const targetAttemptId = attempt.serverAttemptId;
        if (!targetAttemptId) {
          // Still need to create the server attempt first. Re-run the LOCAL flow.
          const res = await studentApi.replayOffline(attempt.examId, {
            clientAttemptId: attempt.attemptId,
            startedAt: new Date(attempt.startedAt).toISOString(),
            submittedAt: attempt.submittedAt ? new Date(attempt.submittedAt).toISOString() : new Date().toISOString(),
            durationMinutes: pkg.exam.durationMinutes,
            answers: answers.map((a) => ({ questionId: a.questionId, response: a.response })),
            finalize: true,
          });
          if (res?.submitted || res?.ok) {
            await updateAttemptSync(attempt.attemptId, {
              serverAttemptId: res.attemptId ?? null,
              syncStatus: res.lateForReview ? "FAILED" : "SYNCED",
              lastError: res.lateForReview ? "Late for review" : null,
            });
            submitted++;
          }
        } else {
          // Server knows about it, issue final SUBMIT.
          await studentApi.submitExam(attempt.examId, targetAttemptId, answers);
          await updateAttemptSync(attempt.attemptId, { syncStatus: "SYNCED", lastError: null });
          submitted++;
        }
        onProgress?.({
          examId: attempt.examId,
          examTitle: pkg.exam.title,
          attemptId: attempt.attemptId,
          syncStatus: "synced",
          savedCount: answers.length,
        });
      }
    } catch (err: any) {
      failed++;
      await updateAttemptSync(attempt.attemptId, {
        syncStatus: "FAILED",
        lastError: err?.message ?? "Sync failed",
      }).catch(() => {});
      onProgress?.({
        examId: attempt.examId,
        examTitle: "(exam)",
        attemptId: attempt.attemptId,
        syncStatus: "failed",
        savedCount: 0,
        error: err?.message,
      });
    }
  }
  return { synced, submitted, failed };
}
