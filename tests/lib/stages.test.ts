import { describe, it, expect } from "vitest";
import { GradingMode, SchoolStage } from "@prisma/client";

/**
 * The school ladder, grade bands and provisioning templates
 * (F0-18, 10-scope-additions §4).
 *
 * The base was secondary-only: levels, grading and report templates all
 * assumed JSS1–SS3. W2 adds the ladder the six affected places resolve
 * against, and these tests pin the parts that fail QUIETLY if they drift:
 *
 *   • the plain-string StageKey type vs the Prisma enum (a rename in the
 *     schema would otherwise break at runtime, in production, in a report),
 *   • the default bands vs `waecGrade()` — the running code and the configured
 *     bands must agree, or the same mark gets two grades,
 *   • band coverage: a gap silently drops every score inside it.
 */

describe("stage ladder", () => {
  it("keeps StageKey and GradingMode in step with the Prisma enums", async () => {
    const { STAGE_KEYS_ALL, GRADING_MODES } = await import("@/lib/stage-types");
    expect([...STAGE_KEYS_ALL].sort()).toEqual(Object.values(SchoolStage).sort());
    expect([...GRADING_MODES].sort()).toEqual(Object.values(GradingMode).sort());
  });

  it("orders every level from Creche to SS3 without gaps or duplicates", async () => {
    const { LEVEL_LADDER, STAGES } = await import("@/lib/stages");

    const orders = LEVEL_LADDER.map((entry) => entry.order);
    expect(orders).toEqual([...Array(LEVEL_LADDER.length).keys()]);

    const levelNames = LEVEL_LADDER.map((entry) => entry.level);
    expect(new Set(levelNames).size).toBe(levelNames.length);

    // Every stage contributes at least one level, youngest first.
    const stageOrder = STAGES.map((stage) => stage.order);
    expect(stageOrder).toEqual([...stageOrder].sort((a, b) => a - b));
  });

  it("walks the ladder across stage boundaries", async () => {
    const { nextLevelOnLadder, isTerminalLevelOnLadder } = await import("@/lib/stages");

    // The transitions the base could not express:
    expect(nextLevelOnLadder("KG")).toBe("PRI1");
    expect(nextLevelOnLadder("PRI6")).toBe("JSS1");
    expect(nextLevelOnLadder("JSS3")).toBe("SS1");
    expect(nextLevelOnLadder("SS3")).toBeNull();

    expect(isTerminalLevelOnLadder("SS3")).toBe(true);
    expect(isTerminalLevelOnLadder("PRI6")).toBe(false);
    // An unknown level is not "terminal" — it is unknown, which must surface.
    expect(nextLevelOnLadder("JSS9")).toBeNull();
    expect(isTerminalLevelOnLadder("JSS9")).toBe(false);
  });

  it("resolves a level to its stage, case- and space-insensitively", async () => {
    const { stageForLevel, canonicalLevel, levelLabel } = await import("@/lib/stages");
    expect(stageForLevel("CRE")).toBe("EARLY_YEARS");
    expect(stageForLevel("kg")).toBe("EARLY_YEARS");
    expect(stageForLevel("PRI3")).toBe("PRIMARY");
    expect(stageForLevel("jss2")).toBe("JUNIOR_SECONDARY");
    expect(stageForLevel("SS3")).toBe("SENIOR_SECONDARY");
    expect(stageForLevel("JSS9")).toBeNull();
    expect(canonicalLevel("jss 1")).toBe("JSS1");
    expect(levelLabel("JSS1")).toBe("JSS 1");
  });

  it("grades early years with descriptors and secondary with percentages", async () => {
    const { stageDefinition } = await import("@/lib/stages");
    expect(stageDefinition("EARLY_YEARS").gradingMode).toBe("DESCRIPTOR");
    expect(stageDefinition("EARLY_YEARS").defaultsToCbt).toBe(false);
    expect(stageDefinition("JUNIOR_SECONDARY").gradingMode).toBe("PERCENTAGE");
    expect(stageDefinition("SENIOR_SECONDARY").defaultsToCbt).toBe(true);
  });
});

describe("default grade bands", () => {
  it("matches waecGrade() for every band boundary", async () => {
    const { WAEC_BANDS, defaultBandsForStage } = await import("@/lib/stages");
    const { waecGrade } = await import("@/lib/gradebook");

    const bands = defaultBandsForStage("SENIOR_SECONDARY");
    expect(bands.map((band) => band.grade)).toEqual(WAEC_BANDS.map((band) => band.grade));

    // Both ends of every band, plus a mid-band score, resolve to that band.
    for (const band of WAEC_BANDS) {
      expect(waecGrade(band.minScore)).toBe(band.grade);
      expect(waecGrade(band.maxScore)).toBe(band.grade);
      expect(waecGrade(Math.floor((band.minScore + band.maxScore) / 2))).toBe(band.grade);
    }
  });

  it("covers the whole scale in every stage's defaults", async () => {
    const { STAGES, defaultBandsForStage, validateGradeBands } = await import("@/lib/stages");
    for (const stage of STAGES) {
      // Descriptor stages rate 1–4 (there is no zero); percentage stages 0–100.
      const floor = stage.gradingMode === "DESCRIPTOR" ? 1 : 0;
      const result = validateGradeBands(defaultBandsForStage(stage.key), stage.maxScore, floor);
      expect({ stage: stage.key, ...result }).toEqual({ stage: stage.key, ok: true });
    }
  });
});

describe("validateGradeBands", () => {
  const bands = (rows: [string, number, number][]) =>
    rows.map(([grade, minScore, maxScore], index) => ({
      grade,
      minScore,
      maxScore,
      remark: grade,
      points: null,
      order: index + 1,
    }));

  it("accepts a continuous set and rejects a gap", async () => {
    const { validateGradeBands } = await import("@/lib/stages");
    expect(
      validateGradeBands(
        bands([
          ["A", 70, 100],
          ["B", 40, 69],
          ["F", 0, 39],
        ]),
        100,
      ).ok,
    ).toBe(true);

    const gap = validateGradeBands(
      bands([
        ["A", 70, 100],
        ["B", 40, 60],
        ["F", 0, 39],
      ]),
      100,
    );
    expect(gap.ok).toBe(false);
    if (!gap.ok) expect(gap.error).toMatch(/Nothing covers 61–69/);
  });

  it("rejects overlaps, duplicate labels and a short scale", async () => {
    const { validateGradeBands } = await import("@/lib/stages");

    const overlap = validateGradeBands(
      bands([
        ["A", 60, 100],
        ["B", 40, 70],
        ["F", 0, 39],
      ]),
      100,
    );
    expect(overlap.ok).toBe(false);

    const duplicate = validateGradeBands(
      bands([
        ["A", 60, 100],
        ["A", 0, 59],
      ]),
      100,
    );
    expect(duplicate.ok).toBe(false);
    if (!duplicate.ok) expect(duplicate.error).toMatch(/same grade label/);

    const short = validateGradeBands(bands([["A", 0, 59]]), 100);
    expect(short.ok).toBe(false);
    if (!short.ok) expect(short.error).toMatch(/must cover 0–100/);

    const inverted = validateGradeBands(bands([["A", 80, 20]]), 100);
    expect(inverted.ok).toBe(false);
  });

  it("accepts a descriptor scale on the early-years 1–4 rating", async () => {
    const { validateGradeBands } = await import("@/lib/stages");
    const ratings = bands([
      ["EE", 4, 4],
      ["ME", 3, 3],
      ["AE", 2, 2],
      ["BE", 1, 1],
    ]);
    expect(validateGradeBands(ratings, 4, 1).ok).toBe(true);
    // The same set over a 0-based scale is incomplete and must be refused.
    expect(validateGradeBands(ratings, 4, 0).ok).toBe(false);
  });
});

describe("suggestedModulesForStages", () => {
  it("switches CBT and marks off for an early-years-only school", async () => {
    const { suggestedModulesForStages } = await import("@/lib/stages");
    const suggested = suggestedModulesForStages(["EARLY_YEARS"]);
    expect(suggested.exams).toBe(false);
    expect(suggested.gradebook).toBe(false);
    expect(suggested.timetable).toBe(false);
    // But the school is never provisioned empty.
    expect(suggested.fees).toBe(true);
    expect(suggested.attendance).toBe(true);
    expect(suggested.report_cards).toBe(true);
  });

  it("keeps everything on for a secondary school", async () => {
    const { suggestedModulesForStages } = await import("@/lib/stages");
    const suggested = suggestedModulesForStages(["JUNIOR_SECONDARY", "SENIOR_SECONDARY"]);
    expect(suggested.exams).toBe(true);
    expect(suggested.gradebook).toBe(true);
    expect(suggested.timetable).toBe(true);
  });

  it("gives every stage a subject template with unique names", async () => {
    const { STAGES, STAGE_SUBJECT_TEMPLATES } = await import("@/lib/stages");
    for (const stage of STAGES) {
      const template = STAGE_SUBJECT_TEMPLATES[stage.key];
      expect(template.length).toBeGreaterThanOrEqual(6);
      const names = template.map((subject) => subject.name);
      expect(new Set(names).size).toBe(names.length);
      for (const subject of template) expect(subject.code).toMatch(/^[A-Z]{3}$/);
    }
  });
});
