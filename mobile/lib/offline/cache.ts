/**
 * Offline read-cache + write-queue + sync, with an inferred online flag.
 * Imports shared primitives from lib/http (NOT lib/api) to avoid a cycle.
 */
import { API_BASE, fetchOptions, authHeaders, notifyAuthExpired } from "@/lib/http";
import { addQueue, getCache, getQueue, removeQueue, setCache, queueCount } from "./db";

// ── Online state (inferred) ──────────────────────────────────────────────
let online = true;
let pending = 0;
const listeners = new Set<() => void>();

export function isOnline() {
  return online;
}
export function pendingWrites() {
  return pending;
}
export function subscribeOffline(fn: () => void) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}
function emit() {
  listeners.forEach((fn) => fn());
}
function setOnline(v: boolean) {
  if (online !== v) {
    online = v;
    emit();
  }
}
async function refreshPending() {
  pending = await queueCount();
  emit();
}

// ── Read-through cache ────────────────────────────────────────────────────
export async function cachedGet<T = unknown>(path: string): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, { ...fetchOptions, headers: await authHeaders() });
  } catch {
    setOnline(false);
    const cached = await getCache<T>(path);
    if (cached) return cached;
    throw new Error("You're offline and no saved data is available for this screen.");
  }

  setOnline(true);
  void flushQueue();

  const data = await res.json().catch(() => null);
  if (res.status === 401) void notifyAuthExpired();
  if (!res.ok) throw new Error((data as { error?: string } | null)?.error || "Request failed");
  await setCache(path, data);
  return data as T;
}

// ── Offline-safe write (queued when offline) ────────────────────────────
export async function queuedWrite<T = unknown>(
  path: string,
  method: string,
  body: unknown,
): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      ...fetchOptions,
      method,
      headers: await authHeaders(),
      body: JSON.stringify(body ?? {}),
    });
  } catch {
    setOnline(false);
    await addQueue(method, path, body);
    await refreshPending();
    return { offline: true, queued: true } as unknown as T;
  }

  setOnline(true);
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error((data as { error?: string } | null)?.error || "Request failed");

  void flushQueue();
  return data as T;
}

// ── Replay queued writes when connectivity returns ──────────────────────
let flushing = false;
export async function flushQueue(): Promise<void> {
  if (flushing) return;
  flushing = true;
  try {
    const items = await getQueue();
    for (const item of items) {
      try {
        const res = await fetch(`${API_BASE}${item.path}`, {
          ...fetchOptions,
          method: item.method,
          headers: await authHeaders(),
          body: item.body || undefined,
        });
        const payload = item.body ? JSON.parse(item.body) as { action?: string } : null;
        const isFinalSubmit = payload?.action === "SUBMIT";
        if (res.ok || (res.status === 409 && !isFinalSubmit)) {
          await removeQueue(item.id);
        } else if (res.status >= 400 && res.status < 500) {
          // Do not silently drop a queued final exam submit from old app builds.
          // Keep it pending so support can reconcile rather than pretending it
          // was submitted. New builds do not queue final submits at all.
          if (isFinalSubmit) break;
          await removeQueue(item.id);
        } else {
          break;
        }
      } catch {
        break;
      }
    }
    await refreshPending();
  } finally {
    flushing = false;
  }
}
