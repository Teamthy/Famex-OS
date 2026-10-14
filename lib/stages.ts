/**
 * School stages and the level ladder (F0-18, 10-scope-additions §4).
 *
 * Famex is not a secondary-only school: it runs pre-school through SS3. The
 * base assumed JSS1–SS3 in six different places (class levels, grading,
 * report templates, admissions entry points, timetabling, CBT), and the W2
 * audit (docs/famex/11-w2-stage-audit.md) recorded what breaks where. This
 * file is the single ladder those six places resolve against:
 *
 *   EARLY_YEARS → Creche · Nursery 1–2 · KG
 *   PRIMARY     → Primary 1–6
 *   JUNIOR_SECONDARY → JSS1–JSS3
 *   SENIOR_SECONDARY → SS1–SS3
 *
 * Pure by design — no prisma, no React — so the setup wizard (client), the
 * settings screens, the promotion maths and the migration backfill all read
 * the same table.
 */
import type { GradingMode, StageKey } from "@/lib/stage-types";

export type { GradingMode, StageKey } from "@/lib/stage-types";

export type LevelDefinition = {
  /** Matches SchoolClass.level and Subject.level. */
  level: string;
  /** Human label for pickers and reports. */
  label: string;
  /** Position on the whole-school ladder (Creche = 0 … SS3 = 14). */
  order: number;
};

export type StageDefinition = {
  key: StageKey;
  label: string;
  /** Ordering for pickers: youngest first. */
  order: number;
  /** The level a student is assessed at by default for this stage. */
  levels: LevelDefinition[];
  /** How this stage is graded unless the school says otherwise. */
  gradingMode: GradingMode;
  /** Highest score/rating on this stage's scale. */
  maxScore: number;
  /** Score/rating at or above which the stage is considered passed. */
  passMark: number;
  /** Whether a stage normally sits computer-based exams. */
  defaultsToCbt: boolean;
  /** One line explaining the assessment model, shown in settings. */
  assessmentSummary: string;
};

/** Ordered youngest → oldest. This order drives the wizard and promotion. */
export const STAGES: StageDefinition[] = [
  {
    key: "EARLY_YEARS",
    label: "Early Years (Pre-School)",
    order: 0,
    levels: [
      { level: "CRE", label: "Creche", order: 0 },
      { level: "NUR1", label: "Nursery 1", order: 1 },
      { level: "NUR2", label: "Nursery 2", order: 2 },
      { level: "KG", label: "Kindergarten", order: 3 },
    ],
    gradingMode: "DESCRIPTOR",
    maxScore: 4,
    passMark: 2,
    defaultsToCbt: false,
    assessmentSummary: "Developmental descriptors and narrative comments — not scored subjects.",
  },
  {
    key: "PRIMARY",
    label: "Primary",
    order: 1,
    levels: [
      { level: "PRI1", label: "Primary 1", order: 4 },
      { level: "PRI2", label: "Primary 2", order: 5 },
      { level: "PRI3", label: "Primary 3", order: 6 },
      { level: "PRI4", label: "Primary 4", order: 7 },
      { level: "PRI5", label: "Primary 5", order: 8 },
      { level: "PRI6", label: "Primary 6", order: 9 },
    ],
    gradingMode: "PERCENTAGE",
    maxScore: 100,
    passMark: 40,
    defaultsToCbt: false,
    assessmentSummary: "Letter grades over a 100-mark scale, with a class teacher's remark.",
  },
  {
    key: "JUNIOR_SECONDARY",
    label: "Junior Secondary",
    order: 2,
    levels: [
      { level: "JSS1", label: "JSS 1", order: 10 },
      { level: "JSS2", label: "JSS 2", order: 11 },
      { level: "JSS3", label: "JSS 3", order: 12 },
    ],
    gradingMode: "PERCENTAGE",
    maxScore: 100,
    passMark: 40,
    defaultsToCbt: true,
    assessmentSummary: "WAEC-style grades (A1–F9) over a 100-mark scale.",
  },
  {
    key: "SENIOR_SECONDARY",
    label: "Senior Secondary",
    order: 3,
    levels: [
      { level: "SS1", label: "SS 1", order: 13 },
      { level: "SS2", label: "SS 2", order: 14 },
      { level: "SS3", label: "SS 3", order: 15 },
    ],
    gradingMode: "PERCENTAGE",
    maxScore: 100,
    passMark: 40,
    defaultsToCbt: true,
    assessmentSummary: "WAEC-style grades (A1–F9) over a 100-mark scale, leading to WASSCE.",
  },
];

export const STAGE_KEYS: StageKey[] = STAGES.map((stage) => stage.key);

export function stageDefinition(key: StageKey): StageDefinition {
  const stage = STAGES.find((entry) => entry.key === key);
  if (!stage) throw new Error(`Unknown stage: ${key}`);
  return stage;
}

export function stageLabel(key: StageKey): string {
  return stageDefinition(key).label;
}

/** The whole-school ladder, youngest → oldest. */
export const LEVEL_LADDER: LevelDefinition[] = STAGES.flatMap((stage) => stage.levels).sort(
  (a, b) => a.order - b.order,
);

const LEVEL_BY_NAME = new Map(LEVEL_LADDER.map((entry) => [entry.level.toUpperCase(), entry]));

/** Which stage a level belongs to, or null for a level we do not recognise. */
export function stageForLevel(level: string): StageKey | null {
  const found = LEVEL_BY_NAME.get(level.trim().toUpperCase());
  if (!found) return null;
  const stage = STAGES.find((entry) => entry.levels.some((l) => l.level === found.level));
  return stage?.key ?? null;
}

/** Position on the ladder, or null when the level is unknown. */
export function levelOrder(level: string): number | null {
  return LEVEL_BY_NAME.get(level.trim().toUpperCase())?.order ?? null;
}

/** Human label for a level ("JSS1" → "JSS 1"), falling back to the raw value. */
export function levelLabel(level: string): string {
  return LEVEL_BY_NAME.get(level.trim().toUpperCase())?.label ?? level;
}

/** Every level in a stage, youngest first. */
export function levelsForStage(key: StageKey): LevelDefinition[] {
  return stageDefinition(key).levels;
}

/**
 * The next level up the ladder — KG → Primary 1, Primary 6 → JSS1,
 * JSS3 → SS1, SS3 → null (graduation).
 *
 * Deliberately derived from the ladder rather than a hand-kept map: a school
 * that runs pre-school and primary as well as secondary must not have to
 * remember to add its own transitions, and a wrong promotion is expensive to
 * unwind (see lib/academic-session.ts).
 */
export function nextLevelOnLadder(level: string): string | null {
  const order = levelOrder(level);
  if (order === null) return null;
  const next = LEVEL_LADDER.find((entry) => entry.order === order + 1);
  return next?.level ?? null;
}

/** True when this level is the last rung of the school. */
export function isTerminalLevelOnLadder(level: string): boolean {
  const def = LEVEL_BY_NAME.get(level.trim().toUpperCase());
  if (!def) return false;
  return def.order === LEVEL_LADDER[LEVEL_LADDER.length - 1].order;
}

// ── Grade bands ─────────────────────────────────────────────

export type GradeBandDefinition = {
  grade: string;
  /** Inclusive lower bound on the stage's scale. */
  minScore: number;
  /** Inclusive upper bound on the stage's scale. */
  maxScore: number;
  remark: string;
  /** Points for cumulative averages (WAEC style); null when the stage has none. */
  points: number | null;
  order: number;
};

/**
 * WAEC's nine-point scale, exactly as `waecGrade()` in lib/gradebook.ts
 * computes it — the bands and the running code must agree, so the default
 * table is written to match, and `tests/lib/stages.test.ts` asserts it.
 */
export const WAEC_BANDS: GradeBandDefinition[] = [
  { grade: "A1", minScore: 75, maxScore: 100, remark: "Excellent", points: 1, order: 1 },
  { grade: "B2", minScore: 70, maxScore: 74, remark: "Very Good", points: 2, order: 2 },
  { grade: "B3", minScore: 65, maxScore: 69, remark: "Good", points: 3, order: 3 },
  { grade: "C4", minScore: 60, maxScore: 64, remark: "Credit", points: 4, order: 4 },
  { grade: "C5", minScore: 55, maxScore: 59, remark: "Credit", points: 5, order: 5 },
  { grade: "C6", minScore: 50, maxScore: 54, remark: "Credit", points: 6, order: 6 },
  { grade: "D7", minScore: 45, maxScore: 49, remark: "Pass", points: 7, order: 7 },
  { grade: "E8", minScore: 40, maxScore: 44, remark: "Pass", points: 8, order: 8 },
  { grade: "F9", minScore: 0, maxScore: 39, remark: "Fail", points: 9, order: 9 },
];

/** Primary-school letter bands over the same 100-mark scale. */
export const PRIMARY_BANDS: GradeBandDefinition[] = [
  { grade: "A", minScore: 70, maxScore: 100, remark: "Excellent", points: null, order: 1 },
  { grade: "B", minScore: 60, maxScore: 69, remark: "Very Good", points: null, order: 2 },
  { grade: "C", minScore: 50, maxScore: 59, remark: "Good", points: null, order: 3 },
  { grade: "D", minScore: 40, maxScore: 49, remark: "Fair", points: null, order: 4 },
  { grade: "E", minScore: 0, maxScore: 39, remark: "Needs support", points: null, order: 5 },
];

/**
 * Early-years developmental descriptors over a 1–4 rating scale.
 * Narrative reports use the descriptor, never a percentage.
 */
export const EARLY_YEARS_BANDS: GradeBandDefinition[] = [
  {
    grade: "EE",
    minScore: 4,
    maxScore: 4,
    remark: "Exceeding expectation",
    points: null,
    order: 1,
  },
  { grade: "ME", minScore: 3, maxScore: 3, remark: "Meeting expectation", points: null, order: 2 },
  {
    grade: "AE",
    minScore: 2,
    maxScore: 2,
    remark: "Approaching expectation",
    points: null,
    order: 3,
  },
  {
    grade: "BE",
    minScore: 1,
    maxScore: 1,
    remark: "Beginning to develop",
    points: null,
    order: 4,
  },
];

/** The bands a stage starts with. The school may edit them in Result Settings. */
export function defaultBandsForStage(stage: StageKey): GradeBandDefinition[] {
  switch (stage) {
    case "EARLY_YEARS":
      return EARLY_YEARS_BANDS.map((band) => ({ ...band }));
    case "PRIMARY":
      return PRIMARY_BANDS.map((band) => ({ ...band }));
    case "JUNIOR_SECONDARY":
    case "SENIOR_SECONDARY":
      return WAEC_BANDS.map((band) => ({ ...band }));
  }
}

/**
 * Does this band set actually cover the scale?
 *
 * A gap (say 70–74 declared but nothing above 74) silently drops every score
 * in the hole out of the broadsheet, and it is only noticed when a parent asks
 * why their child's A is missing. The settings API refuses to save bands that
 * do not cover floor → maxScore continuously and without overlap.
 *
 * `floor` exists for descriptor stages: a 1–4 developmental rating has no
 * zero. Percentage stages start at 0.
 */
export function validateGradeBands(
  bands: GradeBandDefinition[],
  maxScore: number,
  floor = 0,
): { ok: true } | { ok: false; error: string } {
  if (bands.length === 0) return { ok: false, error: "At least one grade band is required." };

  const sorted = [...bands].sort((a, b) => a.minScore - b.minScore);
  let cursor = floor;

  for (const band of sorted) {
    if (!band.grade.trim()) return { ok: false, error: "Every band needs a grade label." };
    if (band.minScore > band.maxScore) {
      return { ok: false, error: `${band.grade}: the minimum is above the maximum.` };
    }
    if (band.minScore !== cursor) {
      return {
        ok: false,
        error:
          band.minScore < cursor
            ? `${band.grade}: overlaps the band below it.`
            : `Nothing covers ${cursor}–${band.minScore - 1}. Every score must land in a band.`,
      };
    }
    cursor = band.maxScore + 1;
  }

  if (cursor !== maxScore + 1) {
    return {
      ok: false,
      error: `Bands stop at ${cursor - 1}; they must cover ${floor}–${maxScore}.`,
    };
  }

  const grades = new Set(bands.map((band) => band.grade.trim().toUpperCase()));
  if (grades.size !== bands.length) {
    return { ok: false, error: "Two bands use the same grade label." };
  }

  return { ok: true };
}

// ── Provisioning templates ──────────────────────────────────

/**
 * A sensible starting subject catalogue per stage.
 *
 * Offered by the setup wizard as an editable checklist, never enforced — the
 * school's own curriculum wins. Secondary keeps the existing detailed
 * JSS1/SS1 catalogues (lib/subjects.ts) and reuses them here by stage.
 */
export const STAGE_SUBJECT_TEMPLATES: Record<
  StageKey,
  { name: string; code: string; elective: boolean }[]
> = {
  EARLY_YEARS: [
    { name: "Literacy", code: "LIT", elective: false },
    { name: "Numeracy", code: "NUM", elective: false },
    { name: "Rhymes & Songs", code: "RHY", elective: false },
    { name: "Creative Arts", code: "CRA", elective: false },
    { name: "Physical Development", code: "PHD", elective: false },
    { name: "Social Habits", code: "SOC", elective: false },
  ],
  PRIMARY: [
    { name: "Mathematics", code: "MTH", elective: false },
    { name: "English Studies", code: "ENG", elective: false },
    { name: "Basic Science and Technology", code: "BST", elective: false },
    { name: "National Values Education", code: "NVE", elective: false },
    { name: "Cultural and Creative Arts", code: "CCA", elective: false },
    { name: "Computer Studies", code: "CMP", elective: false },
    { name: "Physical and Health Education", code: "PHE", elective: false },
    { name: "French", code: "FRE", elective: true },
  ],
  JUNIOR_SECONDARY: [
    { name: "Mathematics", code: "MTH", elective: false },
    { name: "English Language", code: "ENG", elective: false },
    { name: "Basic Science", code: "BSC", elective: false },
    { name: "Basic Technology", code: "BTC", elective: false },
    { name: "Social Studies", code: "SOS", elective: false },
    { name: "Civic Education", code: "CIV", elective: false },
    { name: "Computer Studies", code: "CMP", elective: false },
    { name: "French", code: "FRE", elective: true },
  ],
  SENIOR_SECONDARY: [
    { name: "Mathematics", code: "MTH", elective: false },
    { name: "English Language", code: "ENG", elective: false },
    { name: "Civic Education", code: "CIV", elective: false },
    { name: "Biology", code: "BIO", elective: true },
    { name: "Chemistry", code: "CHM", elective: true },
    { name: "Physics", code: "PHY", elective: true },
    { name: "Further Mathematics", code: "FMT", elective: true },
    { name: "Literature in English", code: "LIT", elective: true },
    { name: "Government", code: "GOV", elective: true },
    { name: "Economics", code: "ECO", elective: true },
  ],
};

/**
 * Modules a school should start with, given the stages it actually runs.
 *
 * Banned move: "adding a new module without a School.modules entry". The
 * mirror is worse — a pre-school switching on CBT it will never use, or a
 * secondary school that never sees the fee screens. The wizard proposes a
 * starting set from the stages chosen, and the admin can override any of it.
 */
export function suggestedModulesForStages(stages: StageKey[]): Record<string, boolean> {
  const chosen = STAGES.filter((stage) => stages.includes(stage.key));
  const anyCbt = chosen.some((stage) => stage.defaultsToCbt);
  const anyScoredSubjects = chosen.some((stage) => stage.gradingMode === "PERCENTAGE");
  const earlyYearsOnly = chosen.length > 0 && chosen.every((stage) => stage.key === "EARLY_YEARS");

  return {
    // Arms that assume scored subjects are pointless for an early-years-only
    // school; everything else stays on so the school is not provisioned empty.
    exams: anyCbt,
    gradebook: anyScoredSubjects,
    report_cards: true,
    admissions: true,
    attendance: true,
    fees: true,
    users: true,
    communication: true,
    notifications: true,
    documents: true,
    timetable: !earlyYearsOnly,
    staff_attendance: true,
    expenses: true,
    budgets: true,
    news: true,
    parents: true,
    front_desk: true,
    help_desk: true,
    learning_hub: true,
    studio: true,
    hr: true,
    website: true,
  };
}

/** Normalise a level string for comparisons ("jss 1" → "JSS1"). */
export function canonicalLevel(level: string): string {
  return level.trim().toUpperCase().replace(/\s+/g, "");
}
