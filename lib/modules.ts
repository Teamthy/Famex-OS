import { prisma } from "@/lib/prisma";

/**
 * Per-tenant module / feature flags.
 *
 * Not all schools have IT education, CBT exams, or staff QR attendance.
 * Each school's enabled modules are stored as a JSON map on School.modules:
 *   { "admissions": true, "it_education": false, "exams": true, ... }
 *
 * When a module key is absent or true → enabled.
 * When explicitly false → disabled.
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
  "it_education",
] as const;

export type ModuleKey = (typeof MODULE_KEYS)[number];

/** Modules enabled by default for a new tenant — everything EXCEPT it_education. */
export const DEFAULT_ENABLED: ModuleKey[] = MODULE_KEYS.filter((m) => m !== "it_education");

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
