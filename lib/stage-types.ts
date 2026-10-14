/**
 * Stage vocabulary, declared once as plain strings.
 *
 * Why not import the Prisma enum here? These types are read by CLIENT
 * components (the setup wizard, the settings screens, the sidebar). Importing
 * `@prisma/client` into a browser bundle drags the whole engine shim with it —
 * `npm run check:boundary` fails the build on exactly that mistake.
 *
 * The values are asserted to match the Prisma enums at runtime by
 * `tests/lib/stages.test.ts` (which imports both), so the two can never drift
 * apart without a red test.
 */

/** Mirrors `enum SchoolStage` in prisma/schema.prisma. */
export type StageKey = "EARLY_YEARS" | "PRIMARY" | "JUNIOR_SECONDARY" | "SENIOR_SECONDARY";

export const STAGE_KEYS_ALL: readonly StageKey[] = [
  "EARLY_YEARS",
  "PRIMARY",
  "JUNIOR_SECONDARY",
  "SENIOR_SECONDARY",
] as const;

/** Mirrors `enum GradingMode` in prisma/schema.prisma. */
export type GradingMode = "PERCENTAGE" | "DESCRIPTOR";

export const GRADING_MODES: readonly GradingMode[] = ["PERCENTAGE", "DESCRIPTOR"] as const;

export function isStageKey(value: unknown): value is StageKey {
  return typeof value === "string" && (STAGE_KEYS_ALL as readonly string[]).includes(value);
}

export function isGradingMode(value: unknown): value is GradingMode {
  return typeof value === "string" && (GRADING_MODES as readonly string[]).includes(value);
}
