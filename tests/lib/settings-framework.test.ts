import { describe, it, expect, vi, beforeEach } from "vitest";
import { mockPrisma } from "../setup";

/**
 * Settings framework (F0-18).
 *
 * Reads are tolerant — a half-written or legacy JSON blob degrades per field,
 * because a settings screen that throws is a school that cannot change its own
 * name. Writes are strict — an invalid value is refused with the field, because
 * a silent fallback on a write configures the school differently from what its
 * admin saw and pressed save on.
 */

beforeEach(() => {
  vi.clearAllMocks();
});

describe("parseSchoolSettings (read path)", () => {
  it("returns the defaults for nothing at all", async () => {
    const { parseSchoolSettings, DEFAULT_SCHOOL_SETTINGS } = await import("@/lib/settings");
    expect(parseSchoolSettings(null)).toEqual(DEFAULT_SCHOOL_SETTINGS);
    expect(parseSchoolSettings("garbage")).toEqual(DEFAULT_SCHOOL_SETTINGS);
  });

  it("fills only the missing fields, keeping the valid ones", async () => {
    const { parseSchoolSettings } = await import("@/lib/settings");
    const parsed = parseSchoolSettings({
      academic: { termsPerSession: 2 },
      results: { showPositions: false },
      fees: { invoiceDueDays: 30 },
    });

    expect(parsed.academic).toEqual({ termsPerSession: 2, weekStartsOn: "MONDAY" });
    expect(parsed.results.showPositions).toBe(false);
    expect(parsed.results.releaseRequired).toBe(true);
    expect(parsed.fees).toEqual({ currency: "NGN", invoiceDueDays: 30 });
  });

  it("falls back per section when a section is corrupt", async () => {
    const { parseSchoolSettings } = await import("@/lib/settings");
    const parsed = parseSchoolSettings({
      academic: { termsPerSession: "lots", weekStartsOn: "FRIDAY" },
      results: { showPositions: true, showCumulative: true, releaseRequired: false },
    });

    // The corrupt academic section degrades; the sound results section survives.
    expect(parsed.academic.termsPerSession).toBe(3);
    expect(parsed.results.releaseRequired).toBe(false);
  });
});

describe("mergeSchoolSettings (write path)", () => {
  it("merges a partial patch over the current settings", async () => {
    const { mergeSchoolSettings, DEFAULT_SCHOOL_SETTINGS } = await import("@/lib/settings");
    const merged = mergeSchoolSettings(DEFAULT_SCHOOL_SETTINGS, {
      academic: { termsPerSession: 2 },
    });
    expect(merged.academic.termsPerSession).toBe(2);
    expect(merged.academic.weekStartsOn).toBe("MONDAY");
    expect(merged.fees).toEqual(DEFAULT_SCHOOL_SETTINGS.fees);
  });

  it("refuses an invalid value instead of silently defaulting it", async () => {
    const { mergeSchoolSettings, DEFAULT_SCHOOL_SETTINGS } = await import("@/lib/settings");
    expect(() =>
      mergeSchoolSettings(DEFAULT_SCHOOL_SETTINGS, { academic: { termsPerSession: 99 } }),
    ).toThrow();
    expect(() =>
      mergeSchoolSettings(DEFAULT_SCHOOL_SETTINGS, { fees: { currency: "USD" } }),
    ).toThrow();
  });
});

describe("getSchoolSettings / saveSchoolSettings", () => {
  it("reads the raw column through the tolerant parser", async () => {
    const { getSchoolSettings } = await import("@/lib/settings");
    mockPrisma.school.findUnique.mockResolvedValue({
      id: "school_1",
      settings: { academic: { termsPerSession: 2 } },
    } as never);

    const settings = await getSchoolSettings("school_1");
    expect(settings.academic.termsPerSession).toBe(2);
  });

  it("writes a validated document", async () => {
    const { saveSchoolSettings, DEFAULT_SCHOOL_SETTINGS } = await import("@/lib/settings");
    await saveSchoolSettings("school_1", DEFAULT_SCHOOL_SETTINGS);
    expect(mockPrisma.school.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "school_1" } }),
    );
  });
});

describe("stage configuration", () => {
  it("seeds a stage's config and default bands exactly once", async () => {
    const { ensureStageConfig } = await import("@/lib/settings");
    mockPrisma.stageConfig.findUnique.mockResolvedValue(null as never);
    mockPrisma.gradeBand.count.mockResolvedValue(0 as never);

    await ensureStageConfig("school_1", "SENIOR_SECONDARY");

    expect(mockPrisma.stageConfig.create).toHaveBeenCalledTimes(1);
    const written = mockPrisma.gradeBand.createMany.mock.calls[0][0] as { data: unknown[] };
    expect(written.data).toHaveLength(9); // A1 … F9

    // Idempotent: an existing row means no second create.
    vi.clearAllMocks();
    mockPrisma.stageConfig.findUnique.mockResolvedValue({ id: "cfg_1" } as never);
    await ensureStageConfig("school_1", "SENIOR_SECONDARY");
    expect(mockPrisma.stageConfig.create).not.toHaveBeenCalled();
    expect(mockPrisma.gradeBand.createMany).not.toHaveBeenCalled();
  });

  it("refuses a pass mark above the stage's own scale", async () => {
    const { updateStageConfig, SettingsValidationError } = await import("@/lib/settings");
    mockPrisma.stageConfig.findUnique.mockResolvedValue({
      id: "cfg_1",
      maxScore: 4,
      passMark: 2,
    } as never);

    await expect(
      updateStageConfig("school_1", "EARLY_YEARS", { passMark: 40 }),
    ).rejects.toBeInstanceOf(SettingsValidationError);
  });
});

describe("grade bands", () => {
  it("validates coverage before writing anything", async () => {
    const { replaceGradeBands, SettingsValidationError } = await import("@/lib/settings");
    mockPrisma.stageConfig.findUnique.mockResolvedValue({
      id: "cfg_1",
      maxScore: 100,
      gradingMode: "PERCENTAGE",
    } as never);

    await expect(
      replaceGradeBands("school_1", "JUNIOR_SECONDARY", [
        { grade: "A", minScore: 70, maxScore: 100, remark: "Good", points: null, order: 1 },
        { grade: "F", minScore: 0, maxScore: 39, remark: "Fail", points: null, order: 2 },
      ]),
    ).rejects.toBeInstanceOf(SettingsValidationError);

    // Nothing was written on the way to the refusal.
    expect(mockPrisma.gradeBand.deleteMany).not.toHaveBeenCalled();
    expect(mockPrisma.gradeBand.createMany).not.toHaveBeenCalled();
  });

  it("accepts a full 1–4 descriptor scale on the early-years stage", async () => {
    const { replaceGradeBands } = await import("@/lib/settings");
    mockPrisma.stageConfig.findUnique.mockResolvedValue({
      id: "cfg_1",
      maxScore: 4,
      gradingMode: "DESCRIPTOR",
    } as never);
    mockPrisma.gradeBand.findMany.mockResolvedValue([] as never);

    await replaceGradeBands("school_1", "EARLY_YEARS", [
      { grade: "EE", minScore: 4, maxScore: 4, remark: "Exceeding", points: null, order: 1 },
      { grade: "ME", minScore: 3, maxScore: 3, remark: "Meeting", points: null, order: 2 },
      { grade: "AE", minScore: 2, maxScore: 2, remark: "Approaching", points: null, order: 3 },
      { grade: "BE", minScore: 1, maxScore: 1, remark: "Beginning", points: null, order: 4 },
    ]);

    expect(mockPrisma.gradeBand.createMany).toHaveBeenCalledTimes(1);
  });
});
