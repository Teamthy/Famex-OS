/**
 * Settings framework (F0-18) — one source of truth for how the school runs.
 *
 * Before W2, "settings" were scattered: some in env vars (SCHOOL_NAME, …),
 * some typed per screen, some repeated as literals. The wizard, the settings
 * screens, the sessions API and the results code each read a different thing.
 *
 * Three stores, deliberately:
 *
 *   • School row + TenantBranding — identity and branding (already existed;
 *     the wizard now writes them through this module instead of its own SQL).
 *   • School.settings JSON       — school-wide defaults that belong to no
 *     single record: terms per session, week start, result and fee policy.
 *     Typed by `schoolSettingsSchema`; NEVER read raw.
 *   • StageConfig + GradeBand    — per-stage academic/result configuration,
 *     because a pre-school and a senior school cannot be graded the same way
 *     (10-scope-additions §4).
 *
 * Reads are tolerant: a half-written or legacy JSON blob degrades to defaults
 * per field rather than breaking a page. Writes are strict: an invalid value
 * is refused with the field name, because a silent fallback on a write is how
 * a school ends up configured differently from what its admin saw.
 */
import { GradingMode, SchoolStage } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import {
  STAGES,
  defaultBandsForStage,
  stageDefinition,
  validateGradeBands,
  type GradeBandDefinition,
} from "@/lib/stages";
import type { StageKey } from "@/lib/stage-types";

// ── School-wide settings ────────────────────────────────────

export const schoolSettingsSchema = z.object({
  academic: z.object({
    /** Terms in a session. Nigerian norm is 3; some schools run 2. */
    termsPerSession: z.number().int().min(1).max(6),
    weekStartsOn: z.enum(["MONDAY", "SUNDAY"]),
  }),
  results: z.object({
    /** Compute and print class positions. */
    showPositions: z.boolean(),
    /** Show session cumulative alongside the term result. */
    showCumulative: z.boolean(),
    /** Parents see a result only after it is explicitly released. */
    releaseRequired: z.boolean(),
  }),
  fees: z.object({
    /** ISO 4217 code. Money is integer kobo everywhere (Rule 2). */
    currency: z.literal("NGN"),
    /** Days after issue before an invoice is overdue. */
    invoiceDueDays: z.number().int().min(0).max(120),
  }),
});

export type SchoolSettings = z.infer<typeof schoolSettingsSchema>;

export const DEFAULT_SCHOOL_SETTINGS: SchoolSettings = {
  academic: { termsPerSession: 3, weekStartsOn: "MONDAY" },
  results: { showPositions: true, showCumulative: true, releaseRequired: true },
  fees: { currency: "NGN", invoiceDueDays: 14 },
};

function asObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

/**
 * Tolerant read: fill every missing or invalid field from the defaults.
 * Per-field, so one bad key cannot reset the rest of the school's settings.
 */
export function parseSchoolSettings(raw: unknown): SchoolSettings {
  const source = asObject(raw);
  const merged = {
    academic: { ...DEFAULT_SCHOOL_SETTINGS.academic, ...asObject(source.academic) },
    results: { ...DEFAULT_SCHOOL_SETTINGS.results, ...asObject(source.results) },
    fees: { ...DEFAULT_SCHOOL_SETTINGS.fees, ...asObject(source.fees) },
  };
  const parsed = schoolSettingsSchema.safeParse(merged);
  if (parsed.success) return parsed.data;

  // Preserve what is valid, default what is not.
  const fallback: SchoolSettings = {
    academic: { ...DEFAULT_SCHOOL_SETTINGS.academic },
    results: { ...DEFAULT_SCHOOL_SETTINGS.results },
    fees: { ...DEFAULT_SCHOOL_SETTINGS.fees },
  };
  const academic = schoolSettingsSchema.shape.academic.safeParse(merged.academic);
  if (academic.success) fallback.academic = academic.data;
  const results = schoolSettingsSchema.shape.results.safeParse(merged.results);
  if (results.success) fallback.results = results.data;
  const fees = schoolSettingsSchema.shape.fees.safeParse(merged.fees);
  if (fees.success) fallback.fees = fees.data;
  return fallback;
}

/**
 * Strict merge for writes: patch over current, then validate the whole thing.
 * Throws a ZodError the route turns into a 422 naming the field.
 */
export function mergeSchoolSettings(current: SchoolSettings, patch: unknown): SchoolSettings {
  const source = asObject(patch);
  return schoolSettingsSchema.parse({
    academic: { ...current.academic, ...asObject(source.academic) },
    results: { ...current.results, ...asObject(source.results) },
    fees: { ...current.fees, ...asObject(source.fees) },
  });
}

export async function getSchoolSettings(schoolId: string): Promise<SchoolSettings> {
  const school = await prisma.school.findUnique({
    where: { id: schoolId },
    select: { settings: true },
  });
  return parseSchoolSettings(school?.settings ?? null);
}

export async function saveSchoolSettings(
  schoolId: string,
  settings: SchoolSettings,
): Promise<SchoolSettings> {
  const parsed = schoolSettingsSchema.parse(settings);
  await prisma.school.update({ where: { id: schoolId }, data: { settings: parsed } });
  return parsed;
}

// ── Per-stage configuration ─────────────────────────────────

export type StageConfigView = {
  stage: StageKey;
  label: string;
  order: number;
  isOffered: boolean;
  gradingMode: "PERCENTAGE" | "DESCRIPTOR";
  maxScore: number;
  passMark: number;
  usesPositions: boolean;
  usesCbt: boolean;
  assessmentSummary: string;
  bandCount: number;
};

function configDefaultsFor(stage: StageKey) {
  const definition = stageDefinition(stage);
  return {
    isOffered: true,
    gradingMode: definition.gradingMode,
    maxScore: definition.maxScore,
    passMark: definition.passMark,
    usesPositions: true,
    usesCbt: definition.defaultsToCbt,
  };
}

/**
 * Create the row for a stage if it does not exist, and seed its default grade
 * bands. Idempotent — safe to call on every read of a settings screen, which
 * is how an existing school gets its configuration without a data migration.
 */
export async function ensureStageConfig(schoolId: string, stage: StageKey): Promise<void> {
  const defaults = configDefaultsFor(stage);

  const existing = await prisma.stageConfig.findUnique({
    where: { schoolId_stage: { schoolId, stage: SchoolStage[stage] } },
    select: { id: true },
  });
  if (existing) return;

  await prisma.stageConfig.create({
    data: { schoolId, stage: SchoolStage[stage], ...defaults },
  });

  const bandCount = await prisma.gradeBand.count({
    where: { schoolId, stage: SchoolStage[stage] },
  });
  if (bandCount === 0) {
    await prisma.gradeBand.createMany({
      data: defaultBandsForStage(stage).map((band) => ({
        schoolId,
        stage: SchoolStage[stage],
        grade: band.grade,
        minScore: band.minScore,
        maxScore: band.maxScore,
        remark: band.remark,
        points: band.points,
        order: band.order,
      })),
      skipDuplicates: true,
    });
  }
}

/** Ensure config + bands for several stages — used by the wizard. */
export async function ensureStageConfigs(schoolId: string, stages: StageKey[]): Promise<void> {
  for (const stage of stages) await ensureStageConfig(schoolId, stage);
}

/**
 * Every stage row for a school, in ladder order, creating missing rows so the
 * screen always has something real to show rather than an empty table.
 *
 * `isOffered` is false only when the school explicitly said so; a stage that
 * has never been configured is offered by default, because the base school
 * runs secondary and a blank settings screen must not read as "no school".
 */
export async function listStageConfigs(schoolId: string): Promise<StageConfigView[]> {
  await ensureStageConfigs(
    schoolId,
    STAGES.map((stage) => stage.key),
  );

  const rows = await prisma.stageConfig.findMany({
    where: { schoolId },
    orderBy: { stage: "asc" },
  });
  const bandCounts = await prisma.gradeBand.groupBy({
    by: ["stage"],
    where: { schoolId },
    _count: { _all: true },
  });
  const countByStage = new Map(bandCounts.map((row) => [row.stage as string, row._count._all]));

  return STAGES.map((definition) => {
    const row = rows.find((entry) => entry.stage === SchoolStage[definition.key]);
    const stored = row
      ? {
          isOffered: row.isOffered,
          gradingMode: row.gradingMode as "PERCENTAGE" | "DESCRIPTOR",
          maxScore: row.maxScore,
          passMark: row.passMark,
          usesPositions: row.usesPositions,
          usesCbt: row.usesCbt,
        }
      : configDefaultsFor(definition.key);
    return {
      stage: definition.key,
      label: definition.label,
      order: definition.order,
      ...stored,
      assessmentSummary: definition.assessmentSummary,
      bandCount: countByStage.get(String(SchoolStage[definition.key])) ?? 0,
    };
  });
}

export type StageConfigPatch = {
  isOffered?: boolean;
  gradingMode?: "PERCENTAGE" | "DESCRIPTOR";
  maxScore?: number;
  passMark?: number;
  usesPositions?: boolean;
  usesCbt?: boolean;
};

export const stageConfigPatchSchema = z.object({
  isOffered: z.boolean().optional(),
  gradingMode: z.enum(["PERCENTAGE", "DESCRIPTOR"]).optional(),
  maxScore: z.number().int().min(1).max(1000).optional(),
  passMark: z.number().int().min(0).max(1000).optional(),
  usesPositions: z.boolean().optional(),
  usesCbt: z.boolean().optional(),
});

/**
 * Update one stage. Refuses a pass mark above the stage's own scale — a
 * primary stage with passMark 40 and maxScore 4 would fail every child.
 */
export async function updateStageConfig(
  schoolId: string,
  stage: StageKey,
  patch: StageConfigPatch,
): Promise<StageConfigView> {
  await ensureStageConfig(schoolId, stage);
  const existing = await prisma.stageConfig.findUnique({
    where: { schoolId_stage: { schoolId, stage: SchoolStage[stage] } },
  });

  const maxScore = patch.maxScore ?? existing?.maxScore ?? configDefaultsFor(stage).maxScore;
  const passMark = patch.passMark ?? existing?.passMark ?? configDefaultsFor(stage).passMark;
  if (passMark > maxScore) {
    throw new SettingsValidationError(
      `The pass mark (${passMark}) cannot be above the maximum score (${maxScore}).`,
    );
  }

  await prisma.stageConfig.update({
    where: { schoolId_stage: { schoolId, stage: SchoolStage[stage] } },
    data: {
      ...(patch.isOffered !== undefined ? { isOffered: patch.isOffered } : {}),
      ...(patch.gradingMode ? { gradingMode: GradingMode[patch.gradingMode] } : {}),
      ...(patch.maxScore !== undefined ? { maxScore: patch.maxScore } : {}),
      ...(patch.passMark !== undefined ? { passMark: patch.passMark } : {}),
      ...(patch.usesPositions !== undefined ? { usesPositions: patch.usesPositions } : {}),
      ...(patch.usesCbt !== undefined ? { usesCbt: patch.usesCbt } : {}),
    },
  });

  const configs = await listStageConfigs(schoolId);
  return configs.find((config) => config.stage === stage) as StageConfigView;
}

export class SettingsValidationError extends Error {
  readonly code = "SETTINGS_INVALID";
  constructor(message: string) {
    super(message);
    this.name = "SettingsValidationError";
  }
}

// ── Grade bands ─────────────────────────────────────────────

export async function listGradeBands(
  schoolId: string,
  stage: StageKey,
): Promise<GradeBandDefinition[]> {
  await ensureStageConfig(schoolId, stage);
  const rows = await prisma.gradeBand.findMany({
    where: { schoolId, stage: SchoolStage[stage] },
    orderBy: { order: "asc" },
  });
  return rows.map((row) => ({
    grade: row.grade,
    minScore: row.minScore,
    maxScore: row.maxScore,
    remark: row.remark,
    points: row.points,
    order: row.order,
  }));
}

export const gradeBandInputSchema = z.object({
  grade: z.string().trim().min(1).max(12),
  minScore: z.number().int().min(0),
  maxScore: z.number().int().min(0),
  remark: z.string().trim().max(80),
  points: z.number().int().min(0).max(99).nullable(),
  order: z.number().int().min(0).max(99),
});

export const gradeBandsInputSchema = z.object({
  bands: z.array(gradeBandInputSchema).min(1).max(20),
});

/**
 * Replace a stage's bands in one transaction.
 *
 * Validated BEFORE anything is written: bands must cover 0 → maxScore with no
 * gaps and no overlaps (lib/stages.validateGradeBands). A gap drops every
 * score inside it out of the broadsheet, and the school only notices when a
 * parent asks why a grade is missing.
 */
export async function replaceGradeBands(
  schoolId: string,
  stage: StageKey,
  bands: GradeBandDefinition[],
): Promise<GradeBandDefinition[]> {
  await ensureStageConfig(schoolId, stage);
  const config = await prisma.stageConfig.findUnique({
    where: { schoolId_stage: { schoolId, stage: SchoolStage[stage] } },
    select: { maxScore: true, gradingMode: true },
  });
  const maxScore = config?.maxScore ?? configDefaultsFor(stage).maxScore;
  // A descriptor stage rates 1–4; a percentage stage scores 0–100.
  const floor = config?.gradingMode === GradingMode.DESCRIPTOR ? 1 : 0;

  const validation = validateGradeBands(bands, maxScore, floor);
  if (!validation.ok) throw new SettingsValidationError(validation.error);

  await prisma.$transaction([
    prisma.gradeBand.deleteMany({ where: { schoolId, stage: SchoolStage[stage] } }),
    prisma.gradeBand.createMany({
      data: bands.map((band, index) => ({
        schoolId,
        stage: SchoolStage[stage],
        grade: band.grade.trim().toUpperCase(),
        minScore: band.minScore,
        maxScore: band.maxScore,
        remark: band.remark.trim(),
        points: band.points,
        order: band.order ?? index + 1,
      })),
    }),
  ]);

  return listGradeBands(schoolId, stage);
}

// ── Wizard-facing helpers ───────────────────────────────────

/** Which stages the school has said it runs, youngest first. */
export async function offeredStages(schoolId: string): Promise<StageKey[]> {
  const configs = await listStageConfigs(schoolId);
  return configs.filter((config) => config.isOffered).map((config) => config.stage);
}
