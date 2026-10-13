"use client";

import { openDB, type IDBPDatabase } from "idb";

/**
 * Offline IndexedDB store for the Ykay EduPortal.
 *
 * Two object stores:
 * 1. `cache` — cached API responses (keyed by URL) for offline reads.
 * 2. `queue` — pending writes (POST/PUT/PATCH) to replay when back online.
 *
 * Universal: works on Chrome, Firefox, Safari (incl. iOS), Edge.
 * No external service needed — just the `idb` package (~1KB).
 */

const DB_NAME = "ykay-offline";
const DB_VERSION = 1;

let dbPromise: Promise<IDBPDatabase> | null = null;

function getDB() {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains("cache")) {
          db.createObjectStore("cache", { keyPath: "url" });
        }
        if (!db.objectStoreNames.contains("queue")) {
          db.createObjectStore("queue", { keyPath: "id", autoIncrement: true });
        }
      },
    });
  }
  return dbPromise;
}

// ── Cache (offline reads) ─────────────────────────────────────

export interface CacheEntry<T = unknown> {
  url: string;
  data: T;
  cachedAt: number;
  schoolId?: string;
}

export async function cacheGet<T>(url: string): Promise<CacheEntry<T> | null> {
  const db = await getDB();
  return (await db.get("cache", url)) as CacheEntry<T> | null;
}

export async function cacheSet<T>(url: string, data: T, schoolId?: string): Promise<void> {
  const db = await getDB();
  await db.put("cache", { url, data, cachedAt: Date.now(), schoolId });
}

export async function cacheClear(schoolId?: string): Promise<void> {
  const db = await getDB();
  if (schoolId) {
    const all = await db.getAll("cache");
    await Promise.all(
      all.filter((e: CacheEntry) => e.schoolId === schoolId).map((e) => db.delete("cache", e.url)),
    );
  } else {
    await db.clear("cache");
  }
}

// ── Queue (offline writes) ────────────────────────────────────

export interface QueuedWrite {
  id?: number;
  url: string;
  method: "POST" | "PUT" | "PATCH" | "DELETE";
  body: unknown;
  queuedAt: number;
  retries: number;
}

export async function queueWrite(
  write: Omit<QueuedWrite, "id" | "queuedAt" | "retries">,
): Promise<void> {
  const db = await getDB();
  await db.add("queue", { ...write, queuedAt: Date.now(), retries: 0 });
}

export async function getQueuedWrites(): Promise<QueuedWrite[]> {
  const db = await getDB();
  return (await db.getAll("queue")) as QueuedWrite[];
}

export async function removeQueuedWrite(id: number): Promise<void> {
  const db = await getDB();
  await db.delete("queue", id);
}

export async function incrementRetry(id: number): Promise<void> {
  const db = await getDB();
  const entry = (await db.get("queue", id)) as QueuedWrite | null;
  if (entry) {
    entry.retries++;
    await db.put("queue", entry);
  }
}

export async function getQueueCount(): Promise<number> {
  const db = await getDB();
  return db.count("queue");
}
