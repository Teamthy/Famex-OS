import { prisma } from "@/lib/prisma";

/**
 * Per-school module / feature flags.
 *
 * Not every school runs the same arms — some have no CBT exams, no staff QR
 * attendance, no expenses/budgets tracking. Each school's enabled modules are
 * stored as a JSON map on School.modules:
 *   { "admissions": true, "exams": false, "budgets": true, ... }
 *
 * When a module key is absent or true → enabled.
 * When explicitly false → disabled.
 *
 * F0-17 / F0-25: from W2 this list is the single switchboard that drives nav,
 * route guards and entitlement together, so the three can never drift apart.
 * (W1 dropped the retired it_education module — the IT Education arm was removed.)
 */

export const MODULE_KEYS = [
  "admissions",
  "attendance",
  "fees",
  "gradebook",
  "exams",
  "report_cards",
  "news",
  "staff_attendance",
  "notifications",
  "expenses",
  "budgets",
] as const;

export type ModuleKey = (typeof MODULE_KEYS)[number];

/** Modules enabled by default for a school — every module unless switched off. */
export const DEFAULT_ENABLED: ModuleKey[] = [...MODULE_KEYS];

/**
 * Resolve the set of enabled modules for a school.
 * Falls back to DEFAULT_ENABLED when no config exists.
 */
export async function getEnabledModules(schoolId: string): Promise<Set<ModuleKey>> {
  const school = await prisma.school.findUnique({
    where: { id: schoolId },
    select: { modules: true },
  });

  if (!school?.modules) return new Set(DEFAULT_ENABLED);

  try {
    const stored = school.modules as Record<string, boolean>;
    const enabled = MODULE_KEYS.filter((k) => stored[k] !== false);
    return new Set(enabled.length > 0 ? enabled : DEFAULT_ENABLED);
  } catch {
    return new Set(DEFAULT_ENABLED);
  }
}

/** Check a single module without fetching the full set (single-record query). */
export async function isModuleEnabled(schoolId: string, key: ModuleKey): Promise<boolean> {
  const enabled = await getEnabledModules(schoolId);
  return enabled.has(key);
}
