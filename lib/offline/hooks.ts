"use client";

import { useState, useEffect, useCallback } from "react";
import { cacheGet, cacheSet, queueWrite } from "./db";
import { onSyncChange, type SyncStatus } from "./sync";

/**
 * Offline-aware data hook.
 *
 * Replaces useApi for routes that should work offline. Strategy:
 * 1. On mount, immediately show cached data from IndexedDB (instant load).
 * 2. Then fetch fresh data from the server (if online).
 * 3. On success, update the cache.
 * 4. If offline, keep showing cached data.
 *
 * Usage (same interface as useApi):
 *   const { data, loading, error, isStale, refetch } = useOfflineApi("/api/teacher/students");
 */
export function useOfflineApi<T>(
  url: string,
  deps: unknown[] = [],
): {
  data: T | null;
  loading: boolean;
  error: string;
  isStale: boolean;
  refetch: () => Promise<void>;
} {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [isStale, setIsStale] = useState(false);

  const fetcher = useCallback(async () => {
    // 1. Show cached data immediately
    const cached = await cacheGet<T>(url);
    if (cached) {
      setData(cached.data);
      setIsStale(true);
      setLoading(false);
    }

    // 2. Try fresh fetch (if online)
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      // Offline — keep cached data
      return;
    }

    setLoading(!cached); // Only show loading spinner if no cached data
    setError("");
    try {
      const r = await fetch(url, { cache: "no-store" });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "Failed to load data.");
      setData(j as T);
      setIsStale(false);
      await cacheSet(url, j);
    } catch (e) {
      if (!cached) {
        setError(e instanceof Error ? e.message : "Failed to load data.");
      }
      // If we have cached data, keep showing it with stale flag
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url, ...deps]);

  useEffect(() => {
    void fetcher();
  }, [fetcher]);

  return { data, loading, error, isStale, refetch: fetcher };
}

/**
 * Offline-aware mutation hook.
 *
 * For writes that should work offline (attendance, gradebook):
 * 1. If online → POST immediately (normal behaviour).
 * 2. If offline → queue in IndexedDB, show "saved offline" indicator.
 * 3. The sync manager replays the queue when connectivity returns.
 *
 * Usage:
 *   const { submit, pendingSync } = useOfflineMutation("/api/teacher/attendance/register");
 *   await submit({ classId, entries: [...] });
 */
export function useOfflineMutation(url: string, method: "POST" | "PUT" | "PATCH" = "POST") {
  const [submitting, setSubmitting] = useState(false);
  const [pendingSync, setPendingSync] = useState(0);

  // Track pending writes count
  useEffect(() => {
    return onSyncChange((_status, pending) => setPendingSync(pending));
  }, []);

  const submit = useCallback(
    async (
      body: unknown,
    ): Promise<{ ok: boolean; queued: boolean; data?: unknown; error?: string }> => {
      setSubmitting(true);

      // Check if online
      const isOnline = typeof navigator !== "undefined" && navigator.onLine;

      if (!isOnline) {
        // Queue for later sync
        await queueWrite({ url, method, body });
        const { getQueueCount } = await import("./db");
        setPendingSync(await getQueueCount());
        setSubmitting(false);
        return { ok: true, queued: true };
      }

      // Online — POST immediately
      try {
        const res = await fetch(url, {
          method,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const data = await res.json();
        if (!res.ok) {
          setSubmitting(false);
          return { ok: false, queued: false, error: data.error || "Request failed." };
        }
        setSubmitting(false);
        return { ok: true, queued: false, data };
      } catch {
        // Network dropped mid-request — queue it
        await queueWrite({ url, method, body });
        const { getQueueCount } = await import("./db");
        setPendingSync(await getQueueCount());
        setSubmitting(false);
        return { ok: true, queued: true };
      }
    },
    [url, method],
  );

  return { submit, submitting, pendingSync };
}

/**
 * Sync status hook — shows "syncing...", "X pending", or "all synced".
 */
export function useSyncStatus(): { status: SyncStatus; pending: number } {
  const [state, setState] = useState<{ status: SyncStatus; pending: number }>({
    status: "idle",
    pending: 0,
  });

  useEffect(() => {
    return onSyncChange((status, pending) => setState({ status, pending }));
  }, []);

  return state;
}
