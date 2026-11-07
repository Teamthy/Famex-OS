/**
 * Offline exam packets — signing and reconciliation.
 *
 * A paper is downloaded to a device, sat with no connectivity, and replayed to
 * the server hours later. Two things have to be true for that to be safe:
 *
 *  1. The server must be able to tell WHICH version of the paper the device sat.
 *     A teacher who adds three questions or changes a question's marks after
 *     the paper was handed out has changed every score on it; a replay against
 *     the new version would grade answers against a paper the student never
 *     saw. The packet carries a fingerprint of the questions and a signature
 *     over it, and the replay reports — does not silently accept — a mismatch.
 *
 *  2. The client must never be trusted to grade. It has no answer key (the
 *     package deliberately omits `correctKey`/`correctText`), so it cannot mark;
 *     any score it reports is informational. The server re-grades from the
 *     stored responses on sync, with the same rules as a live sitting.
 *
 * Pure functions only: no database, no session. The route does the I/O.
 */
import { createHmac, timingSafeEqual } from "crypto";

/** What the device stores alongside the questions. */
export type OfflinePacketManifest = {
  examId: string;
  /** Stable id for this downloaded version, derived from the fingerprint. */
  packetId: string;
  /** HMAC over the ordered question ids, types and marks. */
  fingerprint: string;
  questionCount: number;
  totalMarks: number;
  durationMinutes: number;
  /** Term context, so a paper sat in January compiles into Second Term. */
  sessionLabel: string | null;
  termIndex: number | null;
  downloadedAt: string;
};

type Fingerprintable = { id: string; type: string; marks: number; sortOrder?: number };

/**
 * Fingerprint a paper.
 *
 * Question ids alone are not enough: a teacher can change a question's marks
 * without touching its text, and that changes every score on the paper. The
 * fingerprint covers id, type, marks and sort order — everything that changes
 * how an answer is graded.
 *
 * Unkeyed (not an HMAC): it identifies a version, it does not authenticate it.
 * Authentication is the signature below, which covers this value.
 */
export function fingerprintQuestions(questions: Fingerprintable[]): string {
  const canonical = [...questions]
    .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || a.id.localeCompare(b.id))
    .map((question) => `${question.id}:${question.type}:${question.marks}`)
    .join("|");
  // Short hash, deliberately: this is a version tag, not a security boundary.
  let h1 = 0x811c9dc5;
  let h2 = 0x01000193;
  for (let i = 0; i < canonical.length; i += 1) {
    const code = canonical.charCodeAt(i);
    h1 = (h1 ^ code) >>> 0;
    h1 = Math.imul(h1, 16777619) >>> 0;
    h2 = (h2 + code * (i + 1)) >>> 0;
    h2 = Math.imul(h2, 2246822519) >>> 0;
  }
  return `${h1.toString(16).padStart(8, "0")}${h2.toString(16).padStart(8, "0")}`;
}

function secret(): string {
  const value = process.env.AUTH_SECRET;
  if (!value || value.length < 32) {
    // Fail loudly rather than sign with a guessable key: a forged packet is how
    // a student could claim to have sat a paper they never opened.
    throw new Error("AUTH_SECRET must be at least 32 characters to sign offline packets.");
  }
  return value;
}

/** The string the signature covers. Order matters and is fixed here. */
function signingPayload(manifest: Omit<OfflinePacketManifest, "packetId">): string {
  return [
    manifest.examId,
    manifest.fingerprint,
    manifest.questionCount,
    manifest.totalMarks,
    manifest.durationMinutes,
    manifest.sessionLabel ?? "",
    manifest.termIndex ?? "",
  ].join(".");
}

export function signPacket(manifest: Omit<OfflinePacketManifest, "packetId">): {
  packetId: string;
  signature: string;
} {
  const signature = createHmac("sha256", secret()).update(signingPayload(manifest)).digest("base64url");
  return {
    packetId: `${manifest.examId.slice(-6)}-${manifest.fingerprint.slice(0, 10)}`,
    signature,
  };
}

export type PacketVerification =
  | { ok: true }
  | {
      ok: false;
      reason: "NO_SIGNATURE" | "BAD_SIGNATURE" | "FINGERPRINT_MISMATCH";
      detail: string;
    };

/**
 * Verify a replayed packet against the paper as it stands NOW.
 *
 * A mismatch is REPORTED, not rejected outright: refusing the submission would
 * destroy a sitting that really happened because a teacher fixed a typo
 * overnight. The route records `packetMismatch` on the attempt and leaves the
 * decision to the teacher — but it never silently grades against a different
 * paper without saying so.
 */
export function verifyPacket(params: {
  manifest: OfflinePacketManifest;
  signature: string | null | undefined;
  currentQuestions: Fingerprintable[];
}): PacketVerification {
  if (!params.signature) {
    return {
      ok: false,
      reason: "NO_SIGNATURE",
      detail: "The device did not present a packet signature.",
    };
  }

  let expected: string;
  try {
    expected = signPacket({
      examId: params.manifest.examId,
      fingerprint: params.manifest.fingerprint,
      questionCount: params.manifest.questionCount,
      totalMarks: params.manifest.totalMarks,
      durationMinutes: params.manifest.durationMinutes,
      sessionLabel: params.manifest.sessionLabel,
      termIndex: params.manifest.termIndex,
      downloadedAt: params.manifest.downloadedAt,
    }).signature;
  } catch {
    return {
      ok: false,
      reason: "NO_SIGNATURE",
      detail: "The server cannot verify packets — check AUTH_SECRET.",
    };
  }

  const given = Buffer.from(params.signature);
  const want = Buffer.from(expected);
  const signatureMatches = given.length === want.length && timingSafeEqual(given, want);

  if (!signatureMatches) {
    return {
      ok: false,
      reason: "BAD_SIGNATURE",
      detail: "The packet signature does not match this paper.",
    };
  }

  if (fingerprintQuestions(params.currentQuestions) !== params.manifest.fingerprint) {
    return {
      ok: false,
      reason: "FINGERPRINT_MISMATCH",
      detail:
        "The paper changed after it was downloaded. Your answers are kept and graded against the current questions; your teacher may need to review this sitting.",
    };
  }

  return { ok: true };
}

/* ------------------------------------------------------------------
   Reconciliation
   ------------------------------------------------------------------ */

export type ReplayAnswer = { questionId: string; response: string | null };

export type AnswerReconciliation = {
  /** Answers whose question still exists — these are graded. */
  accepted: ReplayAnswer[];
  /** Answers referring to a question that no longer exists. */
  orphaned: ReplayAnswer[];
  /** Questions on the paper the device never answered. */
  missing: string[];
  /** True when the device's answers and the server's paper line up. */
  paperMatches: boolean;
  /** What the paper is worth on the server's current version. */
  currentTotalMarks: number;
};

/**
 * Line the device's answers up with the server's current paper.
 *
 * Replay used to filter silently, so a student who answered twelve questions
 * against a faulted package and had six accepted saw "6 saved" with no
 * indication that half their paper was discarded. The counts are returned so
 * the route can record them and a teacher can see the sitting arrived partial.
 */
export function reconcileAnswers(params: {
  answers: ReplayAnswer[];
  currentQuestions: Array<{ id: string; marks: number }>;
}): AnswerReconciliation {
  const known = new Set(params.currentQuestions.map((question) => question.id));
  const accepted: ReplayAnswer[] = [];
  const orphaned: ReplayAnswer[] = [];
  const answeredIds = new Set<string>();

  for (const answer of params.answers) {
    if (!known.has(answer.questionId)) {
      orphaned.push(answer);
      continue;
    }
    answeredIds.add(answer.questionId);
    accepted.push(answer);
  }

  return {
    accepted,
    orphaned,
    missing: params.currentQuestions
      .filter((question) => !answeredIds.has(question.id))
      .map((question) => question.id),
    paperMatches: orphaned.length === 0,
    currentTotalMarks: params.currentQuestions.reduce((sum, question) => sum + question.marks, 0),
  };
}

/**
 * Advisory timing check.
 *
 * The device clock is not trustworthy — a student can wind it back — but the
 * server also cannot know when a paper was opened offline. This compares the
 * device's own reported start and end, which detects the honest failure modes
 * (a paper left open overnight, a crash and restart days later) without
 * pretending to be tamper-proof. A late sitting is recorded and left for the
 * teacher rather than silently accepted or silently binned.
 */
export function classifyOfflineTiming(params: {
  startedAt: string;
  submittedAt: string | null;
  durationMinutes: number;
  graceMinutes?: number;
}): { late: boolean; elapsedMinutes: number; overrunMinutes: number } {
  const grace = params.graceMinutes ?? 5;
  const started = new Date(params.startedAt).getTime();
  const submitted = params.submittedAt ? new Date(params.submittedAt).getTime() : started;
  const elapsedMs =
    Number.isFinite(started) && Number.isFinite(submitted) ? Math.max(0, submitted - started) : 0;
  const elapsedMinutes = Math.round(elapsedMs / 60_000);
  const allowed = params.durationMinutes + grace;
  return {
    late: elapsedMinutes > allowed,
    elapsedMinutes,
    overrunMinutes: Math.max(0, elapsedMinutes - allowed),
  };
}

/**
 * Can a claimed sitting actually have happened?
 *
 * The replay endpoint grades whatever the device hands it, and the only timing
 * evidence is the client's own `startedAt`/`submittedAt`. `classifyOfflineTiming`
 * checks the sitting is not LONGER than the paper allows, but nothing checked
 * that it could have happened at all: a device could claim a sitting before its
 * paper was downloaded, or a year after the term closed, and the server would
 * accept it.
 *
 * Left unbounded, this is a way to write an attempt into a term that has been
 * compiled and released. The window is deliberately generous — a paper
 * downloaded on Friday for a Monday exam, a student who sat it and had no
 * signal until the following week — because the cost of refusing a real sitting
 * is far higher than the cost of accepting a slightly stale one. What it
 * refuses is the impossible, not the inconvenient.
 *
 * Returns null when the timing is plausible, or a reason when it is not.
 */
export function offlineTimingProblem(params: {
  startedAt: string;
  submittedAt: string | null;
  /** When the device downloaded the paper. Null for clients that omit it. */
  downloadedAt: string | null;
  /** The exam's window, when it has one. */
  scheduledFor?: string | null;
  availableUntil?: string | null;
  /** How long a sitting may remain unsent. */
  maxStaleDays?: number;
  now?: Date;
}): { code: "STARTED_BEFORE_DOWNLOAD" | "STARTED_IN_FUTURE" | "SUBMITTED_BEFORE_STARTED" | "STALE_SITTING"; message: string } | null {
  const now = params.now ?? new Date();
  const maxStaleMs = (params.maxStaleDays ?? 30) * 24 * 60 * 60_000;
  const started = new Date(params.startedAt).getTime();
  const submitted = params.submittedAt ? new Date(params.submittedAt).getTime() : null;
  const downloaded = params.downloadedAt ? new Date(params.downloadedAt).getTime() : null;

  if (!Number.isFinite(started)) {
    return { code: "STARTED_IN_FUTURE", message: "The start time on this sitting is not a date." };
  }

  // A sitting cannot start before the paper was on the device. Allowed a
  // minute of slack: the device writes startedAt milliseconds after the
  // download in a fast tap-through, and clock ordering across two writes is
  // not something to refuse a child's exam over.
  if (downloaded !== null && Number.isFinite(downloaded) && started < downloaded - 60_000) {
    return {
      code: "STARTED_BEFORE_DOWNLOAD",
      message: "This sitting claims to have started before the paper was downloaded to the device.",
    };
  }

  // Nor in the future. A device clock set forward is the usual cause, and it
  // must not be able to create a sitting that has not happened.
  if (started > now.getTime() + 5 * 60_000) {
    return {
      code: "STARTED_IN_FUTURE",
      message: "This sitting claims to have started in the future. Check the device clock.",
    };
  }

  if (submitted !== null && Number.isFinite(submitted) && submitted < started) {
    return {
      code: "SUBMITTED_BEFORE_STARTED",
      message: "This sitting claims to have been submitted before it started.",
    };
  }

  // The window, when there is one. A paper closes at availableUntil; a sitting
  // that began long after it closed is not a late sync, it is a new attempt.
  const until = params.availableUntil ? new Date(params.availableUntil).getTime() : null;
  if (until !== null && Number.isFinite(until) && started > until + maxStaleMs) {
    return {
      code: "STALE_SITTING",
      message: "This sitting was made long after the paper closed and cannot be accepted.",
    };
  }

  // No window: fall back to age. A sitting unsent for a month is a data-entry
  // problem, not a connectivity one.
  if (started < now.getTime() - maxStaleMs * 3) {
    return {
      code: "STALE_SITTING",
      message: "This sitting is too old to accept. Ask your teacher to record it.",
    };
  }

  return null;
}

/** Human explanation for a late offline sitting, shown to the student. */
export function lateSittingMessage(overrunMinutes: number): string {
  return `Your answers are saved, but this sitting ran ${overrunMinutes} minute(s) past the paper's time. Your teacher will review it before it is scored.`;
}
