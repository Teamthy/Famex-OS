import { describe, it, expect, vi, beforeEach } from "vitest";
import { mockPrisma } from "../setup";

/**
 * Recording what promotion decided, and on what evidence.
 *
 * `recordPromotionDecisions` — the audit trail behind `PromotionRecord` — was
 * written and then never called by anything. The enrolments moved, the session
 * rolled over, and the *reason* was lost the moment the request returned. A
 * parent asking "on what average was my child promoted?" a year later had no
 * answer, and neither did the school.
 *
 * It is now called by POST /api/admin/promotion. These tests pin the parts that
 * make it a usable audit trail rather than a pile of rows:
 *
 *   - a plain promotion is recorded as NOT an override;
 *   - an admin changing the outcome is recorded as an override, WITH its reason,
 *     keeping both the proposal and the final call;
 *   - a student with no compiled result is recorded with no evidence, not with
 *     an invented one;
 *   - re-running replaces the row instead of duplicating it;
 *   - the promotion itself never fails because the audit write failed.
 */

vi.mock("@/lib/module-guard", () => ({
  requireModule: vi.fn(async () => ({
    ok: true,
    user: { id: "u_admin", schoolId: "school_1", role: "ADMIN" },
    enabled: new Set<string>(),
  })),
}));

const FROM = "sess_2025";
const TO = "sess_2026";

function request(body: unknown) {
  return { json: async () => body } as never;
}

type Outcome = "PROMOTED" | "REPEATED" | "GRADUATED" | "WITHDRAWN" | "TRANSFERRED";

/** A plan row shaped like buildPlan()'s output. */
function planRow(
  studentProfileId: string,
  overrides: Record<string, unknown> = {},
): {
  studentProfileId: string;
  displayName: string;
  studentId: string;
  currentClassId: string;
  currentClassName: string;
  currentLevel: string;
  arm: string;
  proposedOutcome: Outcome;
  targetClassId: string | null;
  targetClassName: string | null;
  blocker: string | null;
  yearAverage: number | null;
  yearGrade: string | null;
  termsCounted: number;
  academicProposal: "PROMOTE" | "REPEAT" | "GRADUATE" | "UNKNOWN";
  academicNote: string | null;
} {
  return {
    studentProfileId,
    displayName: `Student ${studentProfileId}`,
    studentId: `FIS/${studentProfileId}`,
    currentClassId: "c_jss1a",
    currentClassName: "JSS 1A",
    currentLevel: "JSS1",
    arm: "A",
    proposedOutcome: "PROMOTED" as Outcome,
    targetClassId: "c_jss2a",
    targetClassName: "JSS 2A",
    blocker: null,
    yearAverage: 72,
    yearGrade: "B2",
    termsCounted: 3,
    academicProposal: "PROMOTE" as const,
    academicNote: null,
    ...overrides,
  } as ReturnType<typeof planRow>;
}

/** Make buildPlan return exactly these rows. */
function planReturns(rows: unknown[]) {
  mockPrisma.studentEnrolment.findMany.mockImplementation(async (args: unknown) => {
    const where = (args as { where?: { sessionId?: string } })?.where;
    if (where?.sessionId !== FROM) return [];
    return rows.map((r) => {
      const row = r as ReturnType<typeof planRow>;
      return {
        studentProfileId: row.studentProfileId,
        classId: row.currentClassId,
        studentProfile: {
          id: row.studentProfileId,
          displayName: row.displayName,
          studentId: row.studentId,
          isActive: true,
        },
        classroom: {
          id: row.currentClassId,
          displayName: row.currentClassName,
          level: row.currentLevel,
          arm: row.arm,
          stage: null,
        },
      };
    });
  });
  mockPrisma.schoolClass.findMany.mockResolvedValue([
    { id: "c_jss2a", displayName: "JSS 2A", level: "JSS2", arm: "A" },
  ]);
  mockPrisma.termResult.findMany.mockResolvedValue(
    rows.map((r) => {
      const row = r as ReturnType<typeof planRow>;
      return {
        studentProfileId: row.studentProfileId,
        termIndex: 3,
        cumulativeAverage: row.yearAverage,
        cumulativeGrade: row.yearGrade,
        termsCounted: row.termsCounted,
      };
    }),
  );
  mockPrisma.classTermResult.findMany.mockResolvedValue([
    { classId: "c_jss1a", termIndex: 1 },
    { classId: "c_jss1a", termIndex: 2 },
    { classId: "c_jss1a", termIndex: 3 },
  ]);
}

describe("recordPromotionDecisions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.stageConfig.findMany.mockResolvedValue([]);
    mockPrisma.promotionRecord.upsert.mockResolvedValue({});
  });

  it("records a plain promotion as no override, with its average", async () => {
    const { recordPromotionDecisions } = await import("@/lib/promotion");
    const row = planRow("s1");

    await recordPromotionDecisions({
      schoolId: "school_1",
      fromSessionId: FROM,
      toSessionId: TO,
      actorUserId: "u_admin",
      plan: [row],
      fromSessionLabel: "2025/2026",
      toSessionLabel: "2026/2027",
    });

    const payload = mockPrisma.promotionRecord.upsert.mock.calls[0][0].create as Record<
      string,
      unknown
    >;
    expect(payload.status).toBe("PROMOTED");
    expect(payload.yearAverage).toBe(72);
    expect(payload.yearGrade).toBe("B2");
    expect(payload.isOverride).toBe(false);
    expect(payload.overrideReason).toBeNull();
    // Both sessions and both classes are snapshotted by name: a class can be
    // renamed or deleted, and the record must still read correctly afterwards.
    expect(payload.fromClassId).toBe("c_jss1a");
    expect(payload.fromClassName).toBe("JSS 1A");
    expect(payload.toClassName).toBe("JSS 2A");
    expect(payload.toSessionLabel).toBe("2026/2027");
    expect(payload.decidedByUserId).toBe("u_admin");
  });

  it("records an admin's change as an override, keeping the proposal", async () => {
    const { recordPromotionDecisions } = await import("@/lib/promotion");

    // Results said promote; the admin decided the child repeats.
    await recordPromotionDecisions({
      schoolId: "school_1",
      fromSessionId: FROM,
      toSessionId: TO,
      actorUserId: "u_admin",
      plan: [
        { ...planRow("s1"), proposedOutcome: "REPEATED", overrideReason: "Long absence" },
      ],
      fromSessionLabel: "2025/2026",
      toSessionLabel: "2026/2027",
    });

    const payload = mockPrisma.promotionRecord.upsert.mock.calls[0][0].create as Record<
      string,
      unknown
    >;
    expect(payload.status).toBe("REPEATED");
    expect(payload.proposedStatus).toBe("PROMOTED");
    expect(payload.isOverride).toBe(true);
    expect(payload.overrideReason).toBe("Long absence");
  });

  it("never invents a reason when the admin gave none", async () => {
    const { recordPromotionDecisions } = await import("@/lib/promotion");

    await recordPromotionDecisions({
      schoolId: "school_1",
      fromSessionId: FROM,
      toSessionId: TO,
      actorUserId: "u_admin",
      plan: [{ ...planRow("s1"), proposedOutcome: "GRADUATED" }],
      fromSessionLabel: "2025/2026",
      toSessionLabel: null,
    });

    const payload = mockPrisma.promotionRecord.upsert.mock.calls[0][0].create as Record<
      string,
      unknown
    >;
    expect(payload.isOverride).toBe(true);
    // A fallback that says a human changed it — not a fabricated justification.
    expect(payload.overrideReason).toMatch(/changed by an administrator/i);
  });

  it("records a student with no result without inventing an average", async () => {
    const { recordPromotionDecisions } = await import("@/lib/promotion");

    await recordPromotionDecisions({
      schoolId: "school_1",
      fromSessionId: FROM,
      toSessionId: TO,
      actorUserId: "u_admin",
      plan: [
        planRow("s1", {
          yearAverage: null,
          yearGrade: null,
          termsCounted: 0,
          academicProposal: "UNKNOWN",
          academicNote: "No compiled result for this session.",
        }),
      ],
      fromSessionLabel: "2025/2026",
      toSessionLabel: "2026/2027",
    });

    const payload = mockPrisma.promotionRecord.upsert.mock.calls[0][0].create as Record<
      string,
      unknown
    >;
    expect(payload.yearAverage).toBeNull();
    expect(payload.yearGrade).toBeNull();
    // Unknown evidence cannot be an override: there was no proposal to override.
    expect(payload.proposedStatus).toBeNull();
    expect(payload.isOverride).toBe(false);
  });

  it("is keyed on student+session, so a re-run updates instead of duplicating", async () => {
    const { recordPromotionDecisions } = await import("@/lib/promotion");

    await recordPromotionDecisions({
      schoolId: "school_1",
      fromSessionId: FROM,
      toSessionId: TO,
      actorUserId: "u_admin",
      plan: [planRow("s1")],
      fromSessionLabel: "2025/2026",
      toSessionLabel: "2026/2027",
    });

    const call = mockPrisma.promotionRecord.upsert.mock.calls[0][0];
    expect(call.where).toEqual({
      studentProfileId_fromSessionId: { studentProfileId: "s1", fromSessionId: FROM },
    });
    expect(call.update).toEqual(call.create);
  });
});

describe("POST /api/admin/promotion", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.stageConfig.findMany.mockResolvedValue([]);
    mockPrisma.promotionRecord.upsert.mockResolvedValue({});
    mockPrisma.academicSession.count.mockResolvedValue(2);
    // Both destination classes exist and belong to this school.
    mockPrisma.schoolClass.count.mockResolvedValue(2);
    mockPrisma.academicSession.findFirst.mockImplementation(async (args: unknown) => {
      const where = (args as { where?: { id?: string } })?.where;
      return { id: where?.id, label: where?.id === FROM ? "2025/2026" : "2026/2027" };
    });
    mockPrisma.studentEnrolment.count.mockResolvedValue(0);
    mockPrisma.studentEnrolment.updateMany.mockResolvedValue({ count: 1 });
    mockPrisma.studentEnrolment.create.mockResolvedValue({});
    mockPrisma.studentProfile.update.mockResolvedValue({ userId: null });
    mockPrisma.auditLog.create.mockResolvedValue({});
  });

  it("commits, then records a row per student", async () => {
    planReturns([planRow("s1"), planRow("s2")]);

    const { POST } = await import("@/app/api/admin/promotion/route");
    const res = await POST(
      request({
        fromSessionId: FROM,
        toSessionId: TO,
        decisions: [
          { studentProfileId: "s1", outcome: "PROMOTED", targetClassId: "c_jss2a" },
          {
            studentProfileId: "s2",
            outcome: "REPEATED",
            targetClassId: "c_jss1a",
            overrideReason: "Failed both terms after illness",
          },
        ],
      }) as never,
    );

    expect(res.status).toBe(200);
    const body = (await res.json()) as { ok: boolean; auditRecorded: boolean };
    expect(body.ok).toBe(true);
    expect(body.auditRecorded).toBe(true);
    expect(mockPrisma.promotionRecord.upsert).toHaveBeenCalledTimes(2);

    const s2 = mockPrisma.promotionRecord.upsert.mock.calls[1][0].create as Record<
      string,
      unknown
    >;
    expect(s2.isOverride).toBe(true);
    expect(s2.overrideReason).toBe("Failed both terms after illness");
  });

  it("still succeeds when the audit write fails, and says so", async () => {
    mockPrisma.schoolClass.count.mockResolvedValue(1);
    // A rolled-over session must not be reported as a failure just because the
    // history row could not be written. Re-running the promotion to retry an
    // audit row would move every student a second time.
    planReturns([planRow("s1")]);
    mockPrisma.promotionRecord.upsert.mockRejectedValue(new Error("write conflict"));

    const { POST } = await import("@/app/api/admin/promotion/route");
    const res = await POST(
      request({
        fromSessionId: FROM,
        toSessionId: TO,
        decisions: [{ studentProfileId: "s1", outcome: "PROMOTED", targetClassId: "c_jss2a" }],
      }) as never,
    );

    expect(res.status).toBe(200);
    const body = (await res.json()) as { ok: boolean; auditRecorded: boolean; recordError: string };
    expect(body.ok).toBe(true);
    expect(body.auditRecorded).toBe(false);
    expect(body.recordError).toMatch(/write conflict/);
    // The promotion itself did happen.
    expect(mockPrisma.studentEnrolment.create).toHaveBeenCalled();
  });

  it("rejects an override reason that is too short to mean anything", async () => {
    const { POST } = await import("@/app/api/admin/promotion/route");
    const res = await POST(
      request({
        fromSessionId: FROM,
        toSessionId: TO,
        decisions: [
          {
            studentProfileId: "s1",
            outcome: "REPEATED",
            targetClassId: "c_jss1a",
            overrideReason: "no",
          },
        ],
      }) as never,
    );

    expect(res.status).toBe(400);
    expect(mockPrisma.studentEnrolment.create).not.toHaveBeenCalled();
  });

  it("does not commit when the promotion itself is refused", async () => {
    mockPrisma.schoolClass.count.mockResolvedValue(1);
    planReturns([planRow("s1")]);
    mockPrisma.studentEnrolment.count.mockResolvedValue(3); // already ran

    const { POST } = await import("@/app/api/admin/promotion/route");
    const res = await POST(
      request({
        fromSessionId: FROM,
        toSessionId: TO,
        decisions: [{ studentProfileId: "s1", outcome: "PROMOTED", targetClassId: "c_jss2a" }],
      }) as never,
    );

    expect(res.status).toBe(409);
    // No half-recorded history for a run that never happened.
    expect(mockPrisma.promotionRecord.upsert).not.toHaveBeenCalled();
  });
});

describe("GET /api/admin/promotion", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.stageConfig.findMany.mockResolvedValue([]);
    mockPrisma.academicSession.findFirst.mockResolvedValue({
      id: FROM,
      label: "2025/2026",
      startsOn: new Date("2025-09-01"),
    });
    mockPrisma.academicSession.findMany.mockResolvedValue([
      { id: FROM, label: "2025/2026", isCurrent: true, startsOn: new Date("2025-09-01") },
      { id: TO, label: "2026/2027", isCurrent: false, startsOn: new Date("2026-09-01") },
    ]);
  });

  it("surfaces how many rows a human still has to look at", async () => {
    planReturns([
      planRow("s1"),
      planRow("s2", {
        yearAverage: null,
        yearGrade: null,
        termsCounted: 0,
        academicProposal: "UNKNOWN",
        academicNote: "No compiled result for this session.",
      }),
    ]);

    const { GET } = await import("@/app/api/admin/promotion/route");
    const res = await GET({
      nextUrl: { searchParams: new URLSearchParams() },
    } as never);

    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      needingReview: number;
      withoutResults: number;
      summary: { total: number; needingReview: number };
    };
    expect(body.needingReview).toBe(1);
    expect(body.withoutResults).toBe(1);
    expect(body.summary.total).toBe(2);
  });
});
