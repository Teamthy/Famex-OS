import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * The sign-out wiring itself, not just the policy.
 *
 * `tests/lib/offline-session.test.ts` proves `planSignOut()` decides correctly.
 * That is not the bug that shipped. The bug was that `cacheClear()` — written
 * for sign-out, documented as running on sign-out — had **no callers at all**,
 * and `AuthProvider` posted to /api/auth/logout and cleared nothing. A correct
 * decision that nobody asks for is the same as no decision.
 *
 * These assertions are therefore on the call graph. They are blunt, but they
 * fail exactly when the wiring is removed, which is the failure mode that
 * actually happened (audit B-15).
 */

const ROOT = process.cwd();
const read = (path: string) => readFileSync(join(ROOT, path), "utf8");

describe("sign-out clears the device", () => {
  const auth = read("components/AuthProvider.tsx");

  it("calls cacheClear", () => {
    expect(auth).toMatch(/cacheClear\s*\(/);
  });

  it("calls purgePapers with the papers the plan says are safe to lose", () => {
    expect(auth).toMatch(/purgePapers\s*\(\s*plan\.papersToDelete\s*\)/);
  });

  it("builds its decision from planSignOut rather than deleting everything", () => {
    // The tempting shortcut is `cacheClear(); purgePapers(allPapers)`. That
    // deletes a submitted-but-unsynced paper, which is the only copy of a
    // child's answers in existence.
    expect(auth).toMatch(/planSignOut\s*\(/);
    expect(auth).not.toMatch(/purgePapers\s*\(\s*papers\.map/);
  });

  it("clears the device during logout, not on some other path", () => {
    // Bounded by the callback, so this cannot pass by matching a helper
    // defined elsewhere in the file and never called.
    const start = auth.indexOf("const logoutImmediately = useCallback");
    expect(start).toBeGreaterThan(-1);
    const end = auth.indexOf("}, []);", start);
    expect(end).toBeGreaterThan(start);
    expect(auth.slice(start, end)).toMatch(/clearDeviceData\s*\(/);
  });

  it("still signs the user out when clearing fails", () => {
    // A device that cannot clear storage must not trap the user on it — the
    // person pressing sign-out is usually the one who wants off.
    expect(auth).toMatch(/\.catch\(\(\)\s*=>/);
    expect(auth).toMatch(/window\.location\.assign\("\/login"\)/);
  });
});

describe("the session store is scoped to its owner", () => {
  const store = read("lib/offline/exam-store.ts");

  it("exposes an ownership-aware reader", () => {
    expect(store).toMatch(/export async function getOwnPaper/);
    expect(store).toMatch(/export async function listOwnPapers/);
  });

  it("the reader refuses a paper that is not the caller's", () => {
    const fn = store.slice(store.indexOf("export async function getOwnPaper"));
    expect(fn.slice(0, 400)).toMatch(/ownsPaper\(/);
  });
});

describe("the pages that read papers use the scoped accessors", () => {
  it("the runner does not read a raw paper by id", () => {
    const runner = read("app/student/exams/[id]/page.tsx");
    // getPaper is the unscoped read. Using it here hands a child whatever
    // paper is on the device, whoever downloaded it.
    expect(runner).toMatch(/getOwnPaper\s*\(/);
    expect(runner).not.toMatch(
      /import \{[^}]*\bgetPaper\b[^}]*\} from "@\/lib\/offline\/exam-store"/,
    );
  });

  it("the list does not enumerate every paper on the device", () => {
    const list = read("app/student/exams/page.tsx");
    expect(list).toMatch(/listOwnPapers\s*\(/);
    expect(list).not.toMatch(
      /import \{[^}]*\blistPapers\b[^}]*\} from "@\/lib\/offline\/exam-store"/,
    );
  });
});
