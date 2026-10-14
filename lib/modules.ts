/**
 * Module entitlements — the server half of the feature switches (F0-17/F0-25).
 *
 * The registry itself (keys, labels, resolution rules) is in
 * `lib/module-registry.ts` and is re-exported here, so server callers keep
 * importing from `@/lib/modules` while client components can import the pure
 * registry without dragging prisma into the browser bundle
 * (`npm run check:boundary` enforces that split).
 */
import { prisma } from "@/lib/prisma";
import { ModuleKey, resolveEnabledModules } from "@/lib/module-registry";

export * from "@/lib/module-registry";

/**
 * Resolve the set of enabled modules for a school.
 *
 * Display path: falls back to DEFAULT_ENABLED when the database cannot be
 * read, because hiding a school's navigation is worse than showing a module
 * it switched off — the switch itself is re-checked on every API call (see
 * `getEnabledModulesStrict`, which the route guard uses and which refuses to
 * guess).
 */
export async function getEnabledModules(schoolId: string): Promise<Set<ModuleKey>> {
  const school = await prisma.school.findUnique({
    where: { id: schoolId },
    select: { modules: true },
  });

  return resolveEnabledModules(school?.modules ?? null);
}

/**
 * Enforcement path: the same resolution, but a database failure (or a missing
 * school) is surfaced instead of guessed at. A route guard must never answer
 * "is this module entitled?" from a fallback the school cannot see or
 * override — that would let a disabled module become usable during an outage.
 */
export async function getEnabledModulesStrict(schoolId: string): Promise<Set<ModuleKey>> {
  const school = await prisma.school.findUnique({
    where: { id: schoolId },
    select: { modules: true },
  });

  if (!school) {
    throw new ModuleLookupError(`No school found for id ${schoolId}.`);
  }

  return resolveEnabledModules(school.modules ?? null);
}

/** Raised when module entitlements cannot be established (DB down / no school). */
export class ModuleLookupError extends Error {
  readonly code = "MODULE_LOOKUP_FAILED";
  constructor(message: string) {
    super(message);
    this.name = "ModuleLookupError";
  }
}

/** Check a single module without fetching the full set (single-record query). */
export async function isModuleEnabled(schoolId: string, key: ModuleKey): Promise<boolean> {
  const enabled = await getEnabledModules(schoolId);
  return enabled.has(key);
}
