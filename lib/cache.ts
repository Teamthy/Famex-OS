/**
 * Simple in-memory LRU cache for expensive database queries.
 *
 * For 1K DAU, many requests hit the same read-heavy endpoints
 * (school config, fee structure, class lists, etc.). This cache
 * reduces database load by serving fresh-enough data from memory.
 *
 * In production, consider upgrading to Upstash Redis or Vercel KV
 * for shared caching across serverless instances.
 */

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

class MemoryCache {
  private store = new Map<string, CacheEntry<unknown>>();
  private maxSize: number;

  constructor(maxSize = 500) {
    this.maxSize = maxSize;
  }

  async get<T>(key: string): Promise<T | null> {
    const entry = this.store.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return null;
    }
    return entry.value as T;
  }

  async set<T>(key: string, value: T, ttlSeconds: number): Promise<void> {
    // Evict oldest entries if at capacity
    if (this.store.size >= this.maxSize) {
      const firstKey = this.store.keys().next().value;
      if (firstKey) this.store.delete(firstKey);
    }

    this.store.set(key, {
      value,
      expiresAt: Date.now() + ttlSeconds * 1000,
    });
  }

  async delete(key: string): Promise<void> {
    this.store.delete(key);
  }

  async deleteByPrefix(prefix: string): Promise<void> {
    for (const key of this.store.keys()) {
      if (key.startsWith(prefix)) {
        this.store.delete(key);
      }
    }
  }

  clear(): void {
    this.store.clear();
  }
}

export const cache = new MemoryCache();

/**
 * Helper to cache a database query result.
 *
 * Usage:
 *   const data = await cached("school:config:abc", 300, () =>
 *     prisma.school.findUnique({ where: { id: "abc" } })
 *   );
 */
export async function cached<T>(
  key: string,
  ttlSeconds: number,
  fetcher: () => Promise<T>,
): Promise<T> {
  const hit = await cache.get<T>(key);
  if (hit !== null) return hit;

  const value = await fetcher();
  await cache.set(key, value, ttlSeconds);
  return value;
}
