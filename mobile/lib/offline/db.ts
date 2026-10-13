/**
 * Offline persistence (expo-sqlite).
 * Two tables: response cache (reads) + write queue (pending mutations).
 *
 * The cache previously grew without bound and never expired: every GET response
 * was stored forever and served stale on a later offline read. To keep the app
 * usable offline without it turning into a leaking store of stale data, the
 * cache now has a TTL and a size cap:
 *   - entries older than CACHE_TTL_MS are treated as a miss and pruned
 *   - setCache enforces a max row count and evicts oldest entries past the cap
 */
import * as SQLite from "expo-sqlite";

/** How long a cached response stays valid before it is treated as stale. */
export const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

/** Hard cap on cached response rows. Prunes oldest-first past this. */
export const CACHE_MAX_ENTRIES = 300;

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

function getDb() {
  if (!dbPromise) {
    dbPromise = (async () => {
      const db = await SQLite.openDatabaseAsync("ykay_offline.db");
      await db.execAsync(`
        PRAGMA journal_mode = 'WAL';
        CREATE TABLE IF NOT EXISTS cache (
          url TEXT PRIMARY KEY,
          body TEXT NOT NULL,
          updatedAt INTEGER NOT NULL
        );
        CREATE TABLE IF NOT EXISTS queue (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          method TEXT NOT NULL,
          path TEXT NOT NULL,
          body TEXT,
          createdAt INTEGER NOT NULL
        );
      `);
      return db;
    })();
  }
  return dbPromise;
}

/**
 * Drop expired rows and, if still over the cap, the oldest rows until within it.
 * Called opportunistically on write so the cache cannot grow unbounded.
 */
async function pruneCache(db: SQLite.SQLiteDatabase): Promise<void> {
  const now = Date.now();
  // 1) Expired rows.
  await db.runAsync("DELETE FROM cache WHERE updatedAt < ?", now - CACHE_TTL_MS);
  // 2) Overflow. Count first, then delete the oldest (lowest updatedAt) rows.
  const row = await db.getFirstAsync<{ c: number }>("SELECT COUNT(*) AS c FROM cache");
  const count = row?.c ?? 0;
  if (count > CACHE_MAX_ENTRIES) {
    const excess = count - CACHE_MAX_ENTRIES;
    await db.runAsync(
      "DELETE FROM cache WHERE url IN (SELECT url FROM cache ORDER BY updatedAt ASC LIMIT ?)",
      excess,
    );
  }
}

export async function setCache(url: string, body: unknown): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    "INSERT OR REPLACE INTO cache (url, body, updatedAt) VALUES (?, ?, ?)",
    url,
    JSON.stringify(body),
    Date.now(),
  );
  // Keep the store bounded on every write.
  await pruneCache(db);
}

export async function getCache<T = unknown>(
  url: string,
  opts?: { ttlMs?: number },
): Promise<T | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ body: string; updatedAt: number }>(
    "SELECT body, updatedAt FROM cache WHERE url = ?",
    url,
  );
  if (!row) return null;
  const ttlMs = opts?.ttlMs ?? CACHE_TTL_MS;
  if (Date.now() - row.updatedAt > ttlMs) {
    // Stale entry — drop it and report a miss so the caller refetches.
    await db.runAsync("DELETE FROM cache WHERE url = ?", url);
    return null;
  }
  return JSON.parse(row.body) as T;
}

export async function addQueue(method: string, path: string, body: unknown): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    "INSERT INTO queue (method, path, body, createdAt) VALUES (?, ?, ?, ?)",
    method,
    path,
    body == null ? null : JSON.stringify(body),
    Date.now(),
  );
}

export async function getQueue(): Promise<
  { id: number; method: string; path: string; body: string | null }[]
> {
  const db = await getDb();
  return db.getAllAsync<{ id: number; method: string; path: string; body: string | null }>(
    "SELECT * FROM queue ORDER BY createdAt ASC",
  );
}

export async function removeQueue(id: number): Promise<void> {
  const db = await getDb();
  await db.runAsync("DELETE FROM queue WHERE id = ?", id);
}

export async function queueCount(): Promise<number> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ c: number }>("SELECT COUNT(*) AS c FROM queue");
  return row?.c ?? 0;
}

/**
 * Clear all locally stored offline data: the response cache, the pending write
 * queue, and the practice history/streak store. Used by the "Clear offline
 * data" setting. Does NOT touch authentication tokens or preferences.
 */
export async function clearOfflineData(): Promise<void> {
  const db = await getDb();
  await db.execAsync(`
    DELETE FROM cache;
    DELETE FROM queue;
    DELETE FROM practice_history;
  `);
}
