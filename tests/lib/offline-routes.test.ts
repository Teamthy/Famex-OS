import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect } from "vitest";

import {
  examRunnerPath,
  isOfflinePage,
  OFFLINE_PAGE_PATHS,
  OFFLINE_PAGE_PREFIXES,
} from "@/lib/offline-routes";

/**
 * Which pages must survive a lost connection.
 *
 * The exam runner is the one screen in the product where losing the network is
 * not an inconvenience but the end of a child's paper. "Save to device" stored
 * the questions in IndexedDB and nothing else — the route's own chunks had never
 * been fetched, because Next.js caches a route only after it has been visited.
 * So the one page that has to work offline was the least likely to.
 *
 * The worker keeps its own copy of this list (a service worker cannot import
 * from the app bundle), which makes drift the obvious failure mode: someone
 * adds a page here, nobody touches public/sw.js, and it silently does not work.
 * The last test below reads the worker and compares.
 */

describe("isOfflinePage", () => {
  it("keeps the offline fallback and the exam list", () => {
    expect(isOfflinePage("/offline")).toBe(true);
    expect(isOfflinePage("/student/exams")).toBe(true);
  });

  it("keeps any exam runner page", () => {
    expect(isOfflinePage("/student/exams/exm_abc123")).toBe(true);
    expect(isOfflinePage("/student/exams/cm4q8x9z0000")).toBe(true);
  });

  it("ignores a trailing slash, so one page is one cache entry", () => {
    expect(isOfflinePage("/student/exams/")).toBe(true);
    expect(isOfflinePage("/student/exams/exm_1/")).toBe(true);
  });

  it("does NOT cache a page showing live school data", () => {
    // A parent trusts what is on the screen. Yesterday's fees balance, served
    // from a cache with no indication it is stale, is worse than an error.
    expect(isOfflinePage("/student/dashboard")).toBe(false);
    expect(isOfflinePage("/admin/fees")).toBe(false);
    expect(isOfflinePage("/student/results")).toBe(false);
  });

  it("does not mistake a deeper path for a runner", () => {
    // /student/exams/<id>/review is a different screen with different data.
    expect(isOfflinePage("/student/exams/exm_1/review")).toBe(false);
  });
});

describe("examRunnerPath", () => {
  it("extracts the canonical path", () => {
    expect(examRunnerPath("/student/exams/exm_1")).toBe("/student/exams/exm_1");
    expect(examRunnerPath("/student/exams/exm_1/")).toBe("/student/exams/exm_1");
  });

  it("returns null for the list and for anything deeper", () => {
    expect(examRunnerPath("/student/exams")).toBeNull();
    expect(examRunnerPath("/student/exams/")).toBeNull();
    expect(examRunnerPath("/student/exams/exm_1/answers")).toBeNull();
  });

  it("rejects an id that is really a path traversal", () => {
    expect(examRunnerPath("/student/exams/..%2Fadmin")).toBeNull();
    expect(examRunnerPath("/student/exams/../admin/fees")).toBeNull();
  });
});

describe("public/sw.js stays in step with lib/offline-routes.ts", () => {
  const worker = readFileSync(join(process.cwd(), "public", "sw.js"), "utf8");

  /** Pull a string array literal out of the worker by its constant name. */
  function workerList(name: string): string[] {
    const match = new RegExp(`const ${name} = \\[([^\\]]*)\\]`).exec(worker);
    if (!match) throw new Error(`public/sw.js has no ${name}`);
    return [...match[1].matchAll(/"([^"]+)"/g)].map((m) => m[1]);
  }

  it("lists the same pages", () => {
    expect(workerList("OFFLINE_PAGES").sort()).toEqual([...OFFLINE_PAGE_PATHS].sort());
  });

  it("lists the same prefixes", () => {
    expect(workerList("OFFLINE_PREFIXES").sort()).toEqual([...OFFLINE_PAGE_PREFIXES].sort());
  });

  it("warms the exam runner when the page asks it to", () => {
    // The message name and the page's call in lib/offline/warm.ts are a
    // contract between two files that never import each other.
    expect(worker).toContain('"FAMEX_WARM_EXAM"');
    const warm = readFileSync(join(process.cwd(), "lib", "offline", "warm.ts"), "utf8");
    expect(warm).toContain("FAMEX_WARM_EXAM");
  });

  it("keeps its exam cache across deploys", () => {
    // A versioned cache is dropped on activate. Papers sit on a device for
    // days; deleting their chunks on deploy is how an offline exam opens to a
    // blank screen the morning after a release.
    expect(worker).toContain("EXAM_CACHE");
    const activate = worker.slice(worker.indexOf('addEventListener("activate"'));
    expect(activate).toContain("k !== EXAM_CACHE");
  });

  it("never serves a cached copy of an API response", () => {
    expect(worker).toContain("url.pathname.startsWith(API_PREFIX)) return;");
  });
});
