import { describe, expect, it } from "vitest";

import { foreignPapers, ownsPaper, planSignOut } from "@/lib/offline/session";

/**
 * What sign-out does to a shared device (audit B-15).
 *
 * The audit found that web sign-out posts to /api/auth/logout and clears the
 * cookie, and the next person at that device can open the browser's
 * IndexedDB — a student's fees, a parent's messages, and a downloaded exam
 * paper with the answers typed into it. `cacheClear()` existed in
 * lib/offline/db.ts precisely for this and, it turned out, had **no callers at
 * all**. Its own doc comment claimed it ran on sign-out.
 *
 * The rules below are the ones that matter, kept pure so they can be tested
 * without an IndexedDB shim (the vitest environment is `node`).
 */

const user = { id: "usr_1", schoolId: "school_1" };

function paper(id: string, status: string, ownerUserId: string | null = "usr_1") {
  return { id, status, ownerUserId };
}

describe("planSignOut", () => {
  it("always clears cached school data", () => {
    // Fees, results, messages. Re-fetchable in a second, and worthless to the
    // next person at the device.
    expect(planSignOut({ papers: [], queueCount: 0 }).clearCache).toBe(true);
  });

  it("clears cached data even when nothing else is on the device", () => {
    const plan = planSignOut({ papers: [], queueCount: 0 });
    expect(plan.papersToDelete).toEqual([]);
    expect(plan.papersKept).toEqual([]);
    expect(plan.needsConfirmation).toBe(false);
  });

  it("deletes a synced paper — the server already has it", () => {
    const plan = planSignOut({ papers: [paper("exm_1", "SYNCED")], queueCount: 0 });
    expect(plan.papersToDelete).toEqual(["exm_1"]);
    expect(plan.papersKept).toEqual([]);
  });

  it("deletes a paper that was downloaded but never opened", () => {
    // No answers exist, so deleting costs a re-download and nothing else.
    const plan = planSignOut({ papers: [paper("exm_1", "DOWNLOADED")], queueCount: 0 });
    expect(plan.papersToDelete).toEqual(["exm_1"]);
  });

  it("KEEPS a submitted paper that has not reached the school", () => {
    // This is the whole reason the exam store is a separate database. The
    // answers are the only copy in existence; deleting them destroys a
    // child's exam.
    const plan = planSignOut({ papers: [paper("exm_1", "AWAITING_SYNC")], queueCount: 0 });
    expect(plan.papersToDelete).toEqual([]);
    expect(plan.papersKept).toEqual(["exm_1"]);
    expect(plan.warnings.join(" ")).toMatch(/not reached the school yet/i);
  });

  it("KEEPS an exam in progress, with its answers and its clock", () => {
    // Treating this like a download would delete the typed answers and hand
    // the student a fresh clock on re-open — a way to buy extra time.
    const plan = planSignOut({ papers: [paper("exm_1", "IN_PROGRESS")], queueCount: 0 });
    expect(plan.papersKept).toEqual(["exm_1"]);
    expect(plan.warnings.join(" ")).toMatch(/in the middle/i);
  });

  it("warns before discarding queued offline writes", () => {
    // Attendance marked in a dead spot is real work. It is discarded on
    // sign-out, but never silently.
    const plan = planSignOut({ papers: [], queueCount: 3 });
    expect(plan.clearQueue).toBe(true);
    expect(plan.needsConfirmation).toBe(true);
    expect(plan.warnings.join(" ")).toMatch(/3 changes/i);
    expect(plan.warnings.join(" ")).toMatch(/will be lost/i);
  });

  it("does not demand confirmation for a device with nothing pending", () => {
    const plan = planSignOut({ papers: [paper("exm_1", "DOWNLOADED")], queueCount: 0 });
    expect(plan.needsConfirmation).toBe(false);
  });

  it("handles a mixed device without losing anything irreplaceable", () => {
    const plan = planSignOut({
      papers: [
        paper("exm_synced", "SYNCED"),
        paper("exm_open", "IN_PROGRESS"),
        paper("exm_pending", "AWAITING_SYNC"),
        paper("exm_saved", "DOWNLOADED"),
      ],
      queueCount: 1,
    });

    expect(plan.papersToDelete.sort()).toEqual(["exm_saved", "exm_synced"]);
    expect(plan.papersKept.sort()).toEqual(["exm_open", "exm_pending"]);
    expect(plan.needsConfirmation).toBe(true);
  });
});

describe("ownsPaper", () => {
  it("lets the owner open their paper", () => {
    expect(ownsPaper(paper("exm_1", "DOWNLOADED", "usr_1"), user)).toBe(true);
  });

  it("refuses another user's paper on a shared device", () => {
    // The actual leak: storage is per-browser, not per-account, so the next
    // student to log in could open a paper someone else downloaded.
    expect(ownsPaper(paper("exm_1", "DOWNLOADED", "usr_2"), user)).toBe(false);
  });

  it("refuses everything when nobody is signed in", () => {
    expect(ownsPaper(paper("exm_1", "DOWNLOADED", "usr_1"), null)).toBe(false);
  });

  it("allows an untagged paper, so nothing already downloaded is stranded", () => {
    // Papers saved before ownership tagging existed carry no owner. Refusing
    // them would break every paper downloaded before this shipped — mid
    // exam-period, which is the worst possible time.
    expect(ownsPaper(paper("exm_old", "IN_PROGRESS", null), user)).toBe(true);
  });
});

describe("foreignPapers", () => {
  it("lists only the papers that are not the user's", () => {
    const papers = [
      paper("mine", "DOWNLOADED", "usr_1"),
      paper("theirs", "AWAITING_SYNC", "usr_2"),
      paper("old", "DOWNLOADED", null),
    ];
    expect(foreignPapers(papers, user)).toEqual(["theirs"]);
  });

  it("lists everything when signed out", () => {
    const papers = [paper("a", "DOWNLOADED", "usr_1"), paper("b", "DOWNLOADED", "usr_2")];
    expect(foreignPapers(papers, null)).toEqual(["a", "b"]);
  });
});
