/**
 * What happens to data on this device when the user signs out.
 *
 * The device holds three kinds of data, and they do not deserve the same
 * treatment:
 *
 *  1. **Cached school data** (`fis-offline`): a student's fees, results,
 *     messages, a parent's invoices. Private, re-fetchable, and worthless the
 *     moment the session ends. Always deleted.
 *
 *  2. **Queued writes** (`fis-offline`): attendance marked, a note written,
 *     still waiting to reach the server. Deleting these silently destroys work
 *     somebody did. Deleted too, but only after saying so — see
 *     `queueDiscardWarning`.
 *
 *  3. **Exam papers** (`famex-offline-exams`): a downloaded paper and the
 *     answers typed into it. This is the awkward one. It is the most sensitive
 *     thing on the device (a child's exam answers) and the only copy in
 *     existence until it syncs. Deleting it on sign-out loses an exam; keeping
 *     it hands the next person at that device a paper they did not sit.
 *
 * The decision taken here:
 *
 *   • **Unsynced papers are never deleted on sign-out.** The answers are
 *     irreplaceable and sign-out is often exactly what a student does when a
 *     device is misbehaving. They stay, owned, encrypted at rest by the OS, and
 *     are only visible to the student who owns them.
 *   • **Every paper is tagged with its owner**, and a runner opened by anyone
 *     else ref… see `ownsPaper()`. Storage is not a security boundary on a
 *     shared device; the check is.
 *   • **Synced papers ARE deleted on sign-out.** The server has them. Leaving
 *     them is a leak with no upside.
 *   • **A sign-out on a device that still holds unsynced work asks first.**
 *     The caller shows the reason; nobody should discover the next morning that
 *     their exam answers are the reason they could not sign out.
 *
 * This is deliberately a pure module. The stores are IndexedDB and the tests
 * run in Node, so the policy is separated from the plumbing and tested
 * directly: `tests/lib/offline-session.test.ts`.
 */

/** The minimum a stored paper must expose for the ownership rules. */
export type PaperOwnership = {
  id: string;
  /** User id that downloaded it. Absent on papers saved before this existed. */
  ownerUserId?: string | null;
  /** `AWAITING_SYNC` means the server does not have these answers yet. */
  status: string;
};

/**
 * A signed-in user, as much as this policy needs.
 *
 * Ownership is decided by `id` alone; `schoolId` is optional so a caller that
 * only has the user id can still ask the ownership question. Scoping by school
 * as well would make a transferred student's own papers invisible to them.
 */
export type DeviceUser = {
  id: string;
  schoolId?: string;
};

export type SignOutPlan = {
  /** Cached school data (`fis-offline` cache store). Always cleared. */
  clearCache: boolean;
  /** Queued writes. Cleared — but see `queueDiscardWarning`. */
  clearQueue: boolean;
  /** Exam papers that will be deleted from the device. */
  papersToDelete: string[];
  /** Exam papers deliberately kept because they have not synced. */
  papersKept: string[];
  /**
   * True when the user should be warned that signing out discards work that
   * has not reached the server. The caller must show this before proceeding.
   */
  needsConfirmation: boolean;
  /** Human-readable reasons, for the confirmation dialog. */
  warnings: string[];
};

/**
 * Work out what signing out does to this device.
 *
 * `papers` are the papers currently stored, `queueCount` the pending writes.
 * Passing them in rather than reading the stores keeps this decision testable
 * and lets the caller show the confirmation before it deletes anything.
 */
export function planSignOut(params: {
  papers: readonly PaperOwnership[];
  queueCount: number;
}): SignOutPlan {
  const papersToDelete: string[] = [];
  const papersKept: string[] = [];

  for (const paper of params.papers) {
    if (paper.status === "AWAITING_SYNC") {
      papersKept.push(paper.id);
    } else {
      // SYNCED (server has it) or DOWNLOADED/IN_PROGRESS.
      //
      // A paper that was merely downloaded and never opened holds no answers,
      // so deleting it costs a re-download. A paper that was opened but not
      // submitted is different — the clock has started and the student has
      // typed answers that only exist here. Treating it like a download would
      // reset a sitting the student can then re-open with a fresh clock.
      // It is kept, and shows as IN_PROGRESS, exactly as a reload would.
      if (paper.status === "IN_PROGRESS") papersKept.push(paper.id);
      else papersToDelete.push(paper.id);
    }
  }

  const warnings: string[] = [];
  if (papersKept.some((id) => params.papers.find((p) => p.id === id)?.status === "AWAITING_SYNC")) {
    warnings.push(
      "An exam you submitted has not reached the school yet. It stays on this device and will send when the connection returns.",
    );
  }
  if (papersKept.some((id) => params.papers.find((p) => p.id === id)?.status === "IN_PROGRESS")) {
    warnings.push(
      "An exam paper you are in the middle of stays on this device with your answers. Sign in again to continue it.",
    );
  }
  if (params.queueCount > 0) {
    warnings.push(
      `${params.queueCount} change${params.queueCount === 1 ? "" : "s"} made while offline ${
        params.queueCount === 1 ? "has" : "have"
      } not reached the school and will be lost if you sign out.`,
    );
  }

  return {
    clearCache: true,
    clearQueue: true,
    papersToDelete,
    papersKept,
    needsConfirmation: params.queueCount > 0,
    warnings,
  };
}

/**
 * May this user sit this paper?
 *
 * A paper with no owner predates ownership tagging. It is treated as the
 * current user's only if they are the role that could have downloaded it —
 * refusing outright would strand every paper downloaded before this shipped,
 * mid-exam-period, which is the worst possible moment to break.
 */
export function ownsPaper(paper: PaperOwnership, user: DeviceUser | null): boolean {
  if (!user) return false;
  if (!paper.ownerUserId) return true;
  return paper.ownerUserId === user.id;
}

/**
 * Which papers must this user NOT see?
 *
 * Empty when the papers belong to them, which is the normal case. Non-empty
 * means a previous user's work is on the device: it must be invisible, and the
 * caller should not offer to resume it.
 */
export function foreignPapers(
  papers: readonly PaperOwnership[],
  user: DeviceUser | null,
): string[] {
  return papers.filter((p) => !ownsPaper(p, user)).map((p) => p.id);
}
