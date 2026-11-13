import { createHmac } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  attemptRequiresPacketReview,
  classifyOfflineTiming,
  fingerprintQuestions,
  isAuthenticatedPacket,
  offlineTimingProblem,
  lateSittingMessage,
  packetMatchesStoredSnapshot,
  readOfflineManualReview,
  readOfflinePacketSnapshot,
  readOfflineReplayAnswers,
  reconcileAnswers,
  signPacket,
  verifyPacket,
  type OfflinePacketManifest,
} from "@/lib/offline-packet";

const QUESTIONS = [
  {
    id: "q1",
    type: "MCQ",
    marks: 2,
    sortOrder: 1,
    questionText: "Which option is correct?",
    options: [
      { key: "A", text: "First" },
      { key: "B", text: "Second" },
    ],
    correctKey: "A",
    correctText: null,
  },
  {
    id: "q2",
    type: "MCQ",
    marks: 2,
    sortOrder: 2,
    questionText: "What is two plus two?",
    options: [
      { key: "A", text: "4" },
      { key: "B", text: "5" },
    ],
    correctKey: "A",
    correctText: null,
  },
  {
    id: "q3",
    type: "ESSAY",
    marks: 6,
    sortOrder: 3,
    questionText: "Explain your answer.",
    correctKey: null,
    correctText: null,
    options: null,
  },
];

function legacyFingerprint(questions: typeof QUESTIONS): string {
  const canonical = [...questions]
    .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || a.id.localeCompare(b.id))
    .map((question) => `${question.id}:${question.type}:${question.marks}`)
    .join("|");
  let first = 0x811c9dc5;
  let second = 0x01000193;
  for (let index = 0; index < canonical.length; index += 1) {
    const code = canonical.charCodeAt(index);
    first = Math.imul((first ^ code) >>> 0, 16777619) >>> 0;
    second = Math.imul((second + code * (index + 1)) >>> 0, 2246822519) >>> 0;
  }
  return `${first.toString(16).padStart(8, "0")}${second.toString(16).padStart(8, "0")}`;
}

function manifest(overrides: Partial<OfflinePacketManifest> = {}): OfflinePacketManifest {
  return {
    examId: "exam-123456",
    packetId: "123456-deadbeef",
    fingerprint: fingerprintQuestions(QUESTIONS),
    questionCount: QUESTIONS.length,
    totalMarks: 10,
    durationMinutes: 60,
    sessionLabel: "2026/2027",
    termIndex: 1,
    downloadedAt: "2026-11-01T08:00:00.000Z",
    ...overrides,
  };
}

describe("attemptRequiresPacketReview", () => {
  it("recognizes only an explicit review hold", () => {
    expect(attemptRequiresPacketReview({ requiresManualReview: true })).toBe(true);
    expect(attemptRequiresPacketReview({ requiresManualReview: false })).toBe(false);
    expect(attemptRequiresPacketReview(null)).toBe(false);
    expect(attemptRequiresPacketReview(["requiresManualReview"])).toBe(false);
  });
});

describe("stored offline attempt snapshot metadata", () => {
  it("reads a complete question snapshot and replayed answers", () => {
    const paper = manifest();
    const metadata = {
      offlineQuestionSnapshot: { manifest: paper, signature: "signed", questions: QUESTIONS },
      offlineReplayAnswers: [{ questionId: "q1", response: "A" }],
      offlineManualReview: {
        reviewedAt: "2026-11-01T10:00:00.000Z",
        reviewedByUserId: "teacher_1",
        reason: "Reviewed against the original paper.",
        marks: [{ questionId: "q1", awardedMarks: 2 }],
        score: 2,
      },
    };
    expect(readOfflinePacketSnapshot(metadata)).toMatchObject({
      manifest: paper,
      signature: "signed",
      questions: QUESTIONS,
    });
    expect(readOfflineReplayAnswers(metadata)).toEqual([{ questionId: "q1", response: "A" }]);
    expect(readOfflineManualReview(metadata)).toMatchObject({
      score: 2,
      reason: "Reviewed against the original paper.",
    });
  });

  it("binds a replay to the signed packet assigned to that attempt", () => {
    const paper = manifest();
    const snapshot = { manifest: paper, signature: "server-signature", questions: QUESTIONS };
    expect(packetMatchesStoredSnapshot(paper, "server-signature", snapshot)).toBe(true);
    expect(
      packetMatchesStoredSnapshot(
        { ...paper, downloadedAt: "2026-12-01T08:00:00.000Z" },
        "server-signature",
        snapshot,
      ),
    ).toBe(false);
    expect(packetMatchesStoredSnapshot(paper, "other-signature", snapshot)).toBe(false);
  });

  it("rejects incomplete snapshots whose totals do not match the paper", () => {
    const paper = manifest({ totalMarks: 100 });
    expect(
      readOfflinePacketSnapshot({
        offlineQuestionSnapshot: { manifest: paper, signature: "signed", questions: QUESTIONS },
      }),
    ).toBeNull();
    expect(readOfflinePacketSnapshot({ offlineQuestionSnapshot: {} })).toBeNull();
    expect(
      readOfflineReplayAnswers({ offlineReplayAnswers: [{ questionId: 2, response: "bad" }] }),
    ).toEqual([]);
  });
});

describe("fingerprintQuestions", () => {
  it("is stable for the same paper", () => {
    expect(fingerprintQuestions(QUESTIONS)).toBe(fingerprintQuestions([...QUESTIONS]));
  });

  it("is order-independent for the same set", () => {
    const shuffled = [QUESTIONS[2], QUESTIONS[0], QUESTIONS[1]];
    expect(fingerprintQuestions(shuffled)).toBe(fingerprintQuestions(QUESTIONS));
  });

  it("changes when a question is added", () => {
    expect(fingerprintQuestions([...QUESTIONS, { id: "q4", type: "MCQ", marks: 2 }])).not.toBe(
      fingerprintQuestions(QUESTIONS),
    );
  });

  it("changes when a question's marks change", () => {
    const altered = QUESTIONS.map((q) => (q.id === "q1" ? { ...q, marks: 5 } : q));
    expect(fingerprintQuestions(altered)).not.toBe(fingerprintQuestions(QUESTIONS));
  });

  it("changes when a question's type changes", () => {
    const altered = QUESTIONS.map((q) => (q.id === "q1" ? { ...q, type: "ESSAY" } : q));
    expect(fingerprintQuestions(altered)).not.toBe(fingerprintQuestions(QUESTIONS));
  });

  it("changes when a question is removed", () => {
    expect(fingerprintQuestions(QUESTIONS.slice(0, 2))).not.toBe(fingerprintQuestions(QUESTIONS));
  });

  it("produces a SHA-256 hex tag", () => {
    expect(fingerprintQuestions(QUESTIONS)).toMatch(/^[0-9a-f]{64}$/);
  });

  it.each([
    ["question wording", { questionText: "An edited stem" }],
    ["answer options", { options: [{ key: "A", text: "Edited option" }] }],
    ["answer key", { correctKey: "B" }],
  ])("changes when %s changes", (_label, change) => {
    const altered = QUESTIONS.map((question) =>
      question.id === "q1" ? { ...question, ...change } : question,
    );
    expect(fingerprintQuestions(altered)).not.toBe(fingerprintQuestions(QUESTIONS));
  });

  it("handles an empty paper without throwing", () => {
    expect(typeof fingerprintQuestions([])).toBe("string");
  });
});

describe("packet signing", () => {
  const original = process.env.AUTH_SECRET;

  beforeEach(() => {
    process.env.AUTH_SECRET = "test-secret-value-that-is-long-enough-to-sign";
  });
  afterEach(() => {
    if (original === undefined) delete process.env.AUTH_SECRET;
    else process.env.AUTH_SECRET = original;
  });

  it("signs a manifest deterministically", () => {
    const base = manifest();
    const a = signPacket(base);
    const b = signPacket(base);
    expect(a.signature).toBe(b.signature);
    expect(a.packetId).toBe(b.packetId);
  });

  it("derives a packet id from the exam and fingerprint", () => {
    const signed = signPacket(manifest());
    expect(signed.packetId).toBe(`123456-${manifest().fingerprint.slice(0, 10)}`);
  });

  it("changes the signature when the marks total changes", () => {
    const a = signPacket(manifest());
    const b = signPacket(manifest({ totalMarks: 11 }));
    expect(a.signature).not.toBe(b.signature);
  });

  it("changes the signature when the term changes", () => {
    const a = signPacket(manifest());
    const b = signPacket(manifest({ termIndex: 2 }));
    expect(a.signature).not.toBe(b.signature);
  });

  it("refuses to sign without a usable secret", () => {
    process.env.AUTH_SECRET = "short";
    expect(() => signPacket(manifest())).toThrow(/AUTH_SECRET/);
  });
});

describe("verifyPacket", () => {
  const original = process.env.AUTH_SECRET;

  beforeEach(() => {
    process.env.AUTH_SECRET = "test-secret-value-that-is-long-enough-to-sign";
  });
  afterEach(() => {
    if (original === undefined) delete process.env.AUTH_SECRET;
    else process.env.AUTH_SECRET = original;
  });

  it("accepts an untouched packet", () => {
    const paper = manifest();
    const { signature } = signPacket(paper);
    expect(verifyPacket({ manifest: paper, signature, currentQuestions: QUESTIONS })).toEqual({
      ok: true,
    });
  });

  it("authenticates a legacy packet but holds it for review because its digest omitted content", () => {
    const paper = manifest({ fingerprint: legacyFingerprint(QUESTIONS) });
    const { signature } = signPacket(paper);
    const result = verifyPacket({ manifest: paper, signature, currentQuestions: QUESTIONS });
    expect(result).toMatchObject({ ok: false, reason: "FINGERPRINT_MISMATCH" });
    expect(isAuthenticatedPacket(result)).toBe(true);
  });

  it("rejects a missing signature", () => {
    const result = verifyPacket({
      manifest: manifest(),
      signature: null,
      currentQuestions: QUESTIONS,
    });
    expect(result).toMatchObject({ ok: false, reason: "NO_SIGNATURE" });
  });

  it("rejects a forged signature", () => {
    const result = verifyPacket({
      manifest: manifest(),
      signature: "not-a-real-signature",
      currentQuestions: QUESTIONS,
    });
    expect(result).toMatchObject({ ok: false, reason: "BAD_SIGNATURE" });
  });

  it("rejects a manifest that was altered after signing", () => {
    const { signature } = signPacket(manifest());
    const tampered = manifest({ totalMarks: 100 });
    const result = verifyPacket({ manifest: tampered, signature, currentQuestions: QUESTIONS });
    expect(result).toMatchObject({ ok: false, reason: "BAD_SIGNATURE" });
  });

  it("binds the download timestamp to the packet signature", () => {
    const paper = manifest();
    const { signature } = signPacket(paper);
    const tampered = manifest({ downloadedAt: "2026-09-01T00:00:00.000Z" });

    expect(
      verifyPacket({ manifest: tampered, signature, currentQuestions: QUESTIONS }),
    ).toMatchObject({
      ok: false,
      reason: "BAD_SIGNATURE",
    });
  });

  it("still recognizes already-downloaded v1 packets during rollout", () => {
    const paper = manifest();
    const legacyPayload = [
      paper.examId,
      paper.fingerprint,
      paper.questionCount,
      paper.totalMarks,
      paper.durationMinutes,
      paper.sessionLabel,
      paper.termIndex,
    ].join(".");
    const signature = createHmac("sha256", process.env.AUTH_SECRET!)
      .update(legacyPayload)
      .digest("base64url");

    expect(verifyPacket({ manifest: paper, signature, currentQuestions: QUESTIONS })).toEqual({
      ok: true,
    });
  });

  it("distinguishes an authenticated paper edit from an unauthenticated packet", () => {
    const paper = manifest();
    const { signature } = signPacket(paper);
    const edited = [...QUESTIONS, { id: "q4", type: "MCQ", marks: 2, sortOrder: 4 }];

    expect(
      isAuthenticatedPacket(verifyPacket({ manifest: paper, signature, currentQuestions: edited })),
    ).toBe(true);
    expect(isAuthenticatedPacket({ ok: false, reason: "BAD_SIGNATURE", detail: "forged" })).toBe(
      false,
    );
    expect(isAuthenticatedPacket(null)).toBe(false);
  });

  it("reports a fingerprint mismatch when the paper changed underneath", () => {
    const paper = manifest();
    const { signature } = signPacket(paper);
    const edited = [...QUESTIONS, { id: "q4", type: "MCQ", marks: 2, sortOrder: 4 }];
    const result = verifyPacket({ manifest: paper, signature, currentQuestions: edited });
    expect(result).toMatchObject({ ok: false, reason: "FINGERPRINT_MISMATCH" });
  });

  it("explains a mismatch in words a student can act on", () => {
    const paper = manifest();
    const { signature } = signPacket(paper);
    const result = verifyPacket({
      manifest: paper,
      signature,
      currentQuestions: QUESTIONS.slice(0, 1),
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.detail).toMatch(/paper changed/i);
      expect(result.detail).toMatch(/teacher/i);
    }
  });

  it("does not throw when the server cannot sign at all", () => {
    process.env.AUTH_SECRET = "short";
    const result = verifyPacket({
      manifest: manifest(),
      signature: "anything",
      currentQuestions: QUESTIONS,
    });
    expect(result).toMatchObject({ ok: false, reason: "NO_SIGNATURE" });
  });
});

describe("reconcileAnswers", () => {
  const current = [
    { id: "q1", marks: 2 },
    { id: "q2", marks: 2 },
    { id: "q3", marks: 6 },
  ];

  it("accepts answers whose questions still exist", () => {
    const result = reconcileAnswers({
      answers: [
        { questionId: "q1", response: "A" },
        { questionId: "q2", response: "B" },
      ],
      currentQuestions: current,
    });
    expect(result.accepted).toHaveLength(2);
    expect(result.orphaned).toHaveLength(0);
    expect(result.missing).toEqual(["q3"]);
    expect(result.paperMatches).toBe(true);
    expect(result.currentTotalMarks).toBe(10);
  });

  it("reports an answer to a question that no longer exists instead of dropping it silently", () => {
    const result = reconcileAnswers({
      answers: [
        { questionId: "q1", response: "A" },
        { questionId: "q-gone", response: "C" },
      ],
      currentQuestions: current,
    });
    expect(result.accepted.map((a) => a.questionId)).toEqual(["q1"]);
    expect(result.orphaned.map((a) => a.questionId)).toEqual(["q-gone"]);
    expect(result.paperMatches).toBe(false);
  });

  it("lists every unanswered question", () => {
    const result = reconcileAnswers({ answers: [], currentQuestions: current });
    expect(result.missing).toEqual(["q1", "q2", "q3"]);
    expect(result.accepted).toHaveLength(0);
  });

  it("treats a null response as an answer that arrived", () => {
    const result = reconcileAnswers({
      answers: [{ questionId: "q1", response: null }],
      currentQuestions: [{ id: "q1", marks: 2 }],
    });
    expect(result.accepted).toHaveLength(1);
    expect(result.missing).toHaveLength(0);
  });

  it("handles an empty paper", () => {
    const result = reconcileAnswers({ answers: [], currentQuestions: [] });
    expect(result).toMatchObject({ currentTotalMarks: 0, accepted: [], missing: [] });
  });
});

describe("offlineTimingProblem", () => {
  // The only timing evidence on a replay is the device's own account of when
  // the paper was sat. classifyOfflineTiming() bounds how LONG a sitting was;
  // nothing bounded when it could have HAPPENED, so a device could claim a
  // sitting from before it downloaded the paper, or from a year ago, and the
  // server would take it — including into a term already compiled and released.
  const now = new Date("2026-11-10T12:00:00.000Z");
  const base = {
    downloadedAt: "2026-11-01T08:00:00.000Z",
    startedAt: "2026-11-01T09:00:00.000Z",
    submittedAt: "2026-11-01T09:50:00.000Z",
    now,
  };

  it("accepts an ordinary sitting", () => {
    expect(offlineTimingProblem(base)).toBeNull();
  });

  it("accepts a sitting synced days later", () => {
    // The normal case this must never refuse: sat on Monday, no signal until
    // the student reaches a town.
    expect(offlineTimingProblem({ ...base, submittedAt: "2026-11-08T09:50:00.000Z" })).toBeNull();
  });

  it("accepts a start a few seconds before the download finished", () => {
    // Two IndexedDB writes in a fast tap-through; ordering is not exact.
    expect(offlineTimingProblem({ ...base, startedAt: "2026-11-01T07:59:40.000Z" })).toBeNull();
  });

  it("refuses a sitting that started before its paper was downloaded", () => {
    // The answers could not have existed on this device.
    const problem = offlineTimingProblem({
      ...base,
      downloadedAt: "2026-11-01T10:00:00.000Z",
      startedAt: "2026-11-01T09:00:00.000Z",
    });
    expect(problem?.code).toBe("STARTED_BEFORE_DOWNLOAD");
  });

  it("refuses a sitting that claims to start in the future", () => {
    const problem = offlineTimingProblem({
      ...base,
      startedAt: "2026-12-01T09:00:00.000Z",
      submittedAt: "2026-12-01T09:50:00.000Z",
    });
    expect(problem?.code).toBe("STARTED_IN_FUTURE");
  });

  it("refuses a submission timestamped before its own start", () => {
    const problem = offlineTimingProblem({
      ...base,
      submittedAt: "2026-11-01T08:30:00.000Z",
    });
    expect(problem?.code).toBe("SUBMITTED_BEFORE_STARTED");
  });

  it("refuses a sitting begun long after the paper closed", () => {
    // Not a late sync — a way to write an attempt into a finished term.
    const problem = offlineTimingProblem({
      ...base,
      availableUntil: "2026-10-01T00:00:00.000Z",
      downloadedAt: null,
      startedAt: "2026-11-01T09:00:00.000Z",
    });
    expect(problem?.code).toBe("STALE_SITTING");
  });

  it("still accepts a sitting inside a long-closed window when it is only days old", () => {
    const problem = offlineTimingProblem({
      ...base,
      availableUntil: "2026-10-30T00:00:00.000Z",
      downloadedAt: null,
      startedAt: "2026-11-01T09:00:00.000Z",
    });
    expect(problem).toBeNull();
  });

  it("refuses an ancient sitting when the paper has no window at all", () => {
    const problem = offlineTimingProblem({
      ...base,
      downloadedAt: null,
      startedAt: "2026-06-01T09:00:00.000Z",
      submittedAt: "2026-06-01T09:50:00.000Z",
    });
    expect(problem?.code).toBe("STALE_SITTING");
  });

  it("does not refuse a sitting merely because the manifest omitted downloadedAt", () => {
    // Older clients do not send it. Refusing them would fail every sitting from
    // a device that has not updated — exactly when there is no way to retry.
    expect(offlineTimingProblem({ ...base, downloadedAt: null })).toBeNull();
  });

  it("gives the student a reason they can act on", () => {
    const problem = offlineTimingProblem({ ...base, startedAt: "not a date" });
    expect(problem?.message).toMatch(/not a date/i);
  });
});

describe("classifyOfflineTiming", () => {
  const start = "2026-11-01T09:00:00.000Z";

  it("does not flag a sitting inside its window", () => {
    const result = classifyOfflineTiming({
      startedAt: start,
      submittedAt: "2026-11-01T09:50:00.000Z",
      durationMinutes: 60,
    });
    expect(result).toMatchObject({ late: false, elapsedMinutes: 50, overrunMinutes: 0 });
  });

  it("allows the grace period", () => {
    const result = classifyOfflineTiming({
      startedAt: start,
      submittedAt: "2026-11-01T10:04:00.000Z",
      durationMinutes: 60,
    });
    expect(result.late).toBe(false);
  });

  it("flags a sitting past the grace period", () => {
    const result = classifyOfflineTiming({
      startedAt: start,
      submittedAt: "2026-11-01T10:10:00.000Z",
      durationMinutes: 60,
    });
    expect(result).toMatchObject({ late: true, overrunMinutes: 5 });
  });

  it("flags a paper left open overnight", () => {
    const result = classifyOfflineTiming({
      startedAt: start,
      submittedAt: "2026-11-02T09:00:00.000Z",
      durationMinutes: 60,
    });
    expect(result.late).toBe(true);
    expect(result.overrunMinutes).toBeGreaterThan(1000);
  });

  it("treats a missing submission time as having just started", () => {
    const result = classifyOfflineTiming({
      startedAt: start,
      submittedAt: null,
      durationMinutes: 60,
    });
    expect(result).toMatchObject({ late: false, elapsedMinutes: 0 });
  });

  it("never reports negative elapsed time from a device clock going backwards", () => {
    const result = classifyOfflineTiming({
      startedAt: "2026-11-01T09:00:00.000Z",
      submittedAt: "2026-11-01T08:00:00.000Z",
      durationMinutes: 60,
    });
    expect(result.elapsedMinutes).toBe(0);
    expect(result.late).toBe(false);
  });

  it("honours a custom grace period", () => {
    const result = classifyOfflineTiming({
      startedAt: start,
      submittedAt: "2026-11-01T10:10:00.000Z",
      durationMinutes: 60,
      graceMinutes: 15,
    });
    expect(result.late).toBe(false);
  });

  it("explains a late sitting without blaming the student", () => {
    expect(lateSittingMessage(5)).toContain("5 minute");
    expect(lateSittingMessage(5)).toMatch(/saved/i);
  });
});
