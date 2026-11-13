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
import { createHash, createHmac, timingSafeEqual } from "crypto";

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

export type OfflinePacketQuestionSnapshot = {
  id: string;
  type: string;
  questionText: string;
  options: unknown;
  correctKey: string | null;
  correctText: string | null;
  marks: number;
  sortOrder: number;
};

export type StoredOfflinePacketSnapshot = {
  manifest: OfflinePacketManifest;
  signature: string;
  questions: OfflinePacketQuestionSnapshot[];
};

type Fingerprintable = {
  id: string;
  type: string;
  marks: number;
  sortOrder?: number;
  questionText?: string;
  options?: unknown;
  correctKey?: string | null;
  correctText?: string | null;
};

function canonicalValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalValue);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, nested]) => [key, canonicalValue(nested)]),
    );
  }
  return value;
}

/**
 * Fingerprint the complete delivered paper and grading key. A change to a stem,
 * option, answer key, marks, type, or order must make an offline packet stale;
 * otherwise replay could silently grade answers against a paper the student
 * never received. The HMAC authenticates this SHA-256 version tag.
 */
export function fingerprintQuestions(questions: Fingerprintable[]): string {
  const canonical = [...questions]
    .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || a.id.localeCompare(b.id))
    .map((question) => ({
      id: question.id,
      type: question.type,
      marks: question.marks,
      sortOrder: question.sortOrder ?? 0,
      questionText: question.questionText ?? null,
      options: canonicalValue(question.options ?? null),
      correctKey: question.correctKey ?? null,
      correctText: question.correctText ?? null,
    }));
  return createHash("sha256").update(JSON.stringify(canonical)).digest("hex");
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
function signingPayload(
  manifest: Omit<OfflinePacketManifest, "packetId">,
  includeDownloadedAt = true,
): string {
  const fields = [
    manifest.examId,
    manifest.fingerprint,
    manifest.questionCount,
    manifest.totalMarks,
    manifest.durationMinutes,
    manifest.sessionLabel ?? "",
    manifest.termIndex ?? "",
  ];
  if (includeDownloadedAt) fields.push(manifest.downloadedAt);
  return fields.join(".");
}

export function signPacket(manifest: Omit<OfflinePacketManifest, "packetId">): {
  packetId: string;
  signature: string;
} {
  const signature = createHmac("sha256", secret())
    .update(signingPayload(manifest))
    .digest("base64url");
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

/** A paper edit can invalidate the fingerprint without invalidating its HMAC. */
export function isAuthenticatedPacket(verification: PacketVerification | null): boolean {
  return verification?.ok === true || verification?.reason === "FINGERPRINT_MISMATCH";
}

/** True when a signed offline sitting was retained but deliberately not scored. */
export function attemptRequiresPacketReview(metadata: unknown): boolean {
  return (
    typeof metadata === "object" &&
    metadata !== null &&
    !Array.isArray(metadata) &&
    "requiresManualReview" in metadata &&
    metadata.requiresManualReview === true
  );
}

/** Read a structurally valid, server-persisted packet snapshot from attempt metadata. */
export type OfflineManualReviewRecord = {
  reviewedAt: string;
  reviewedByUserId: string;
  reason: string;
  marks: Array<{ questionId: string; awardedMarks: number }>;
  score: number;
};

export function readOfflineManualReview(metadata: unknown): OfflineManualReviewRecord | null {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return null;
  const value = (metadata as Record<string, unknown>).offlineManualReview;
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const review = value as Record<string, unknown>;
  if (
    typeof review.reviewedAt !== "string" ||
    typeof review.reviewedByUserId !== "string" ||
    typeof review.reason !== "string" ||
    typeof review.score !== "number" ||
    !Array.isArray(review.marks)
  ) {
    return null;
  }
  const marks: OfflineManualReviewRecord["marks"] = [];
  for (const raw of review.marks) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
    const mark = raw as Record<string, unknown>;
    if (typeof mark.questionId !== "string" || typeof mark.awardedMarks !== "number") return null;
    marks.push({ questionId: mark.questionId, awardedMarks: mark.awardedMarks });
  }
  return {
    reviewedAt: review.reviewedAt,
    reviewedByUserId: review.reviewedByUserId,
    reason: review.reason,
    marks,
    score: review.score,
  };
}

export function readOfflineReplayAnswers(
  metadata: unknown,
): Array<{ questionId: string; response: string | null }> {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return [];
  const value = (metadata as Record<string, unknown>).offlineReplayAnswers;
  if (!Array.isArray(value)) return [];
  return value.flatMap((raw) => {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return [];
    const answer = raw as Record<string, unknown>;
    if (
      typeof answer.questionId !== "string" ||
      !(typeof answer.response === "string" || answer.response === null)
    ) {
      return [];
    }
    return [{ questionId: answer.questionId, response: answer.response }];
  });
}

export function packetMatchesStoredSnapshot(
  submitted: OfflinePacketManifest | null | undefined,
  signature: string | null | undefined,
  stored: StoredOfflinePacketSnapshot | null,
): boolean {
  if (!submitted || !signature || !stored || signature !== stored.signature) return false;
  const original = stored.manifest;
  return (
    submitted.examId === original.examId &&
    submitted.packetId === original.packetId &&
    submitted.fingerprint === original.fingerprint &&
    submitted.questionCount === original.questionCount &&
    submitted.totalMarks === original.totalMarks &&
    submitted.durationMinutes === original.durationMinutes &&
    submitted.sessionLabel === original.sessionLabel &&
    submitted.termIndex === original.termIndex &&
    submitted.downloadedAt === original.downloadedAt
  );
}

export function readOfflinePacketSnapshot(metadata: unknown): StoredOfflinePacketSnapshot | null {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return null;
  const stored = (metadata as Record<string, unknown>).offlineQuestionSnapshot;
  if (!stored || typeof stored !== "object" || Array.isArray(stored)) return null;
  const record = stored as Record<string, unknown>;
  const rawManifest = record.manifest;
  if (!rawManifest || typeof rawManifest !== "object" || Array.isArray(rawManifest)) return null;
  const value = rawManifest as Record<string, unknown>;
  if (
    typeof record.signature !== "string" ||
    typeof value.examId !== "string" ||
    typeof value.packetId !== "string" ||
    typeof value.fingerprint !== "string" ||
    typeof value.questionCount !== "number" ||
    !Number.isInteger(value.questionCount) ||
    typeof value.totalMarks !== "number" ||
    !Number.isInteger(value.totalMarks) ||
    typeof value.durationMinutes !== "number" ||
    !Number.isInteger(value.durationMinutes) ||
    Number(value.questionCount) < 0 ||
    Number(value.totalMarks) < 0 ||
    Number(value.durationMinutes) <= 0 ||
    !(typeof value.sessionLabel === "string" || value.sessionLabel === null) ||
    !(typeof value.termIndex === "number" || value.termIndex === null) ||
    typeof value.downloadedAt !== "string" ||
    !Array.isArray(record.questions)
  ) {
    return null;
  }

  const questions: OfflinePacketQuestionSnapshot[] = [];
  for (const raw of record.questions) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
    const question = raw as Record<string, unknown>;
    if (
      typeof question.id !== "string" ||
      typeof question.type !== "string" ||
      typeof question.questionText !== "string" ||
      typeof question.marks !== "number" ||
      !Number.isInteger(question.marks) ||
      question.marks < 0 ||
      typeof question.sortOrder !== "number" ||
      !Number.isInteger(question.sortOrder) ||
      !(typeof question.correctKey === "string" || question.correctKey === null) ||
      !(typeof question.correctText === "string" || question.correctText === null)
    ) {
      return null;
    }
    questions.push({
      id: question.id,
      type: question.type,
      questionText: question.questionText,
      options: question.options,
      correctKey: question.correctKey,
      correctText: question.correctText,
      marks: question.marks,
      sortOrder: question.sortOrder,
    });
  }

  const manifest: OfflinePacketManifest = {
    examId: value.examId,
    packetId: value.packetId,
    fingerprint: value.fingerprint,
    questionCount: value.questionCount,
    totalMarks: value.totalMarks,
    durationMinutes: value.durationMinutes,
    sessionLabel: value.sessionLabel,
    termIndex: value.termIndex,
    downloadedAt: value.downloadedAt,
  };
  if (
    manifest.questionCount !== questions.length ||
    manifest.totalMarks !== questions.reduce((sum, question) => sum + question.marks, 0)
  ) {
    return null;
  }
  return { manifest, signature: record.signature, questions };
}

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

  let signatureMatches = false;
  try {
    const given = Buffer.from(params.signature);
    const currentPayload = signingPayload(params.manifest);
    const currentSignature = createHmac("sha256", secret())
      .update(currentPayload)
      .digest("base64url");
    const currentExpected = Buffer.from(currentSignature);
    signatureMatches =
      given.length === currentExpected.length && timingSafeEqual(given, currentExpected);

    if (!signatureMatches) {
      // Accept already-downloaded v1 papers through the offline window. Their
      // signature predates downloadedAt binding; all newly issued packets use
      // the current payload. Device timestamps remain advisory, not proof.
      const legacyPayload = signingPayload(params.manifest, false);
      const legacySignature = createHmac("sha256", secret())
        .update(legacyPayload)
        .digest("base64url");
      const legacyExpected = Buffer.from(legacySignature);
      signatureMatches =
        given.length === legacyExpected.length && timingSafeEqual(given, legacyExpected);
    }
  } catch {
    return {
      ok: false,
      reason: "NO_SIGNATURE",
      detail: "The server cannot verify packets — check AUTH_SECRET.",
    };
  }

  if (!signatureMatches) {
    return {
      ok: false,
      reason: "BAD_SIGNATURE",
      detail: "The packet signature does not match this paper.",
    };
  }

  // Legacy 16-character fingerprints do not authenticate stems/options/keys.
  // They intentionally mismatch the new digest and remain accepted only as
  // review-required sittings, never as silently verified graded papers.
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
}): {
  code:
    "STARTED_BEFORE_DOWNLOAD" | "STARTED_IN_FUTURE" | "SUBMITTED_BEFORE_STARTED" | "STALE_SITTING";
  message: string;
} | null {
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
