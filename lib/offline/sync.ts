"use client";

import { getQueuedWrites, removeQueuedWrite, incrementRetry, getQueueCount } from "./db";

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
      } else if (res.status >= 400 && res.status < 500) {
        // Client error — don't retry (bad data), remove from queue
        await removeQueuedWrite(write.id);
        failed++;
      } else {
        // Server error — retry
        if (write.retries >= 5) {
          await removeQueuedWrite(write.id);
          failed++;
        } else {
          await incrementRetry(write.id);
          failed++;
          break; // Stop processing — likely server is down
        }
      }
    } catch {
      // Network error — still offline, stop processing
      if (write.retries >= 5) {
        await removeQueuedWrite(write.id);
        failed++;
      } else {
        await incrementRetry(write.id);
      }
      break;
    }
  }

  const remaining = await getQueueCount();
  emit(remaining > 0 ? "error" : "idle", remaining);
  return { succeeded, failed };
}

/**
 * Initialise the sync manager. Call once on app mount (in a provider).
 */
export function initSyncManager() {
  if (typeof window === "undefined") return;

  const handleOnline = () => {
    void flushQueue();
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
