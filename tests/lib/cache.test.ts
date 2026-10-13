import { describe, it, expect, beforeEach } from "vitest";
import { cache, cached } from "@/lib/cache";

describe("MemoryCache", () => {
  beforeEach(() => {
    cache.clear();
  });

  it("stores and retrieves a value", async () => {
    await cache.set("key1", { name: "test" }, 60);
    const result = await cache.get<{ name: string }>("key1");
    expect(result).toEqual({ name: "test" });
  });

  it("returns null for missing keys", async () => {
    const result = await cache.get("nonexistent");
    expect(result).toBeNull();
  });

  it("expires entries after TTL", async () => {
    await cache.set("expiring", "value", 0); // 0 second TTL
    // Wait a tick
    await new Promise((r) => setTimeout(r, 10));
    const result = await cache.get("expiring");
    expect(result).toBeNull();
  });

  it("deletes entries", async () => {
    await cache.set("to-delete", "value", 60);
    await cache.delete("to-delete");
    const result = await cache.get("to-delete");
    expect(result).toBeNull();
  });

  it("deletes entries by prefix", async () => {
    await cache.set("prefix:a", 1, 60);
    await cache.set("prefix:b", 2, 60);
    await cache.set("other:c", 3, 60);
    await cache.deleteByPrefix("prefix:");
    expect(await cache.get("prefix:a")).toBeNull();
    expect(await cache.get("prefix:b")).toBeNull();
    expect(await cache.get("other:c")).toBe(3);
  });
});

describe("cached() helper", () => {
  beforeEach(() => {
    cache.clear();
  });

  it("calls fetcher on cache miss and caches the result", async () => {
    let callCount = 0;
    const fetcher = async () => {
      callCount++;
      return { data: "fresh" };
    };

    const first = await cached("test-key", 60, fetcher);
    expect(first).toEqual({ data: "fresh" });
    expect(callCount).toBe(1);

    const second = await cached("test-key", 60, fetcher);
    expect(second).toEqual({ data: "fresh" });
    expect(callCount).toBe(1); // Should not call fetcher again
  });

  it("calls fetcher again after cache expiry", async () => {
    let callCount = 0;
    const fetcher = async () => {
      callCount++;
      return callCount;
    };

    await cached("expire-test", 0, fetcher); // 0s TTL
    await new Promise((r) => setTimeout(r, 10));
    const result = await cached("expire-test", 60, fetcher);
    expect(result).toBe(2);
    expect(callCount).toBe(2);
  });
});
