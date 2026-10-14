import { describe, it, expect } from "vitest";

/**
 * Module registry — resolution rules (F0-17, F0-25).
 *
 * The whole point of W2 is that nav, route entitlement and the licence screen
 * read ONE resolution of School.modules. These tests pin the rules that
 * resolution obeys, including the one the base got wrong:
 *
 *   the base returned "all enabled" whenever the filtered set came out empty,
 *   so a school that switched every module off silently got every module back.
 *   An admin doing exactly that (disabling CBT for an early-years-only school)
 *   would have watched the switches refuse to take effect.
 */

describe("MODULE_KEYS", () => {
  it("declares every module the nav registry and guards reference", async () => {
    const { MODULE_KEYS } = await import("@/lib/module-registry");
    const { ADMIN_NAV_GROUPS } = await import("@/lib/nav");

    const referenced = new Set<string>();
    for (const group of ADMIN_NAV_GROUPS) {
      if (group.moduleKey) referenced.add(group.moduleKey);
      for (const item of group.items) {
        const key = item.moduleKey === undefined ? group.moduleKey : item.moduleKey;
        if (key) referenced.add(key);
      }
    }

    for (const key of referenced) expect(MODULE_KEYS).toContain(key);
  });

  it("gives every module a label, a summary and an owning workstream", async () => {
    const { MODULE_KEYS, MODULES } = await import("@/lib/module-registry");
    for (const key of MODULE_KEYS) {
      const definition = MODULES[key];
      expect(definition.label.length).toBeGreaterThan(2);
      expect(definition.summary.length).toBeGreaterThan(10);
      expect(definition.release).toMatch(/^W\d{1,2}$/);
    }
  });
});

describe("resolveEnabledModules", () => {
  it("treats a missing or unusable value as 'nothing configured' — all on", async () => {
    const { resolveEnabledModules, DEFAULT_ENABLED } = await import("@/lib/module-registry");
    for (const value of [null, undefined, "nonsense", 42, []]) {
      expect([...resolveEnabledModules(value)].sort()).toEqual([...DEFAULT_ENABLED].sort());
    }
  });

  it("treats an object naming no known key as unconfigured, not as 'all off'", async () => {
    const { resolveEnabledModules, DEFAULT_ENABLED } = await import("@/lib/module-registry");
    // A legacy or typo'd blob must not disable the whole product by accident.
    expect([...resolveEnabledModules({ retired_module: false, old_arm: false })]).toEqual([
      ...resolveEnabledModules(null),
    ]);
    expect(resolveEnabledModules({ retired_module: false }).size).toBe(DEFAULT_ENABLED.length);
  });

  it("honours explicit switches, absent keys defaulting to enabled", async () => {
    const { resolveEnabledModules } = await import("@/lib/module-registry");
    const enabled = resolveEnabledModules({ fees: false, exams: true });
    expect(enabled.has("fees")).toBe(false);
    expect(enabled.has("exams")).toBe(true);
    // Untouched keys keep the product on — a school that has only ever flipped
    // one switch must not lose everything else.
    expect(enabled.has("admissions")).toBe(true);
  });

  it("keeps a school that switched EVERYTHING off off (the base re-enabled it)", async () => {
    const { resolveEnabledModules, MODULE_KEYS } = await import("@/lib/module-registry");
    const allOff = Object.fromEntries(MODULE_KEYS.map((key) => [key, false]));
    expect(resolveEnabledModules(allOff).size).toBe(0);
  });
});

describe("mergeModuleSwitches", () => {
  it("keeps only declared keys and preserves the rest of the stored config", async () => {
    const { mergeModuleSwitches, MODULE_KEYS } = await import("@/lib/module-registry");

    const merged = mergeModuleSwitches(
      { fees: false },
      // A rogue key must be dropped: storing it is nav drift waiting to happen.
      { exams: false, not_a_module: true } as never,
    );

    expect(merged.fees).toBe(false);
    expect(merged.exams).toBe(false);
    expect(merged).not.toHaveProperty("not_a_module");
    expect(Object.keys(merged).sort()).toEqual([...MODULE_KEYS].sort());
  });

  it("round-trips its own output", async () => {
    const { mergeModuleSwitches, resolveEnabledModules } = await import("@/lib/module-registry");
    const stored = mergeModuleSwitches(null, { budgets: false });
    expect(resolveEnabledModules(stored).has("budgets")).toBe(false);
    expect(mergeModuleSwitches(stored, { budgets: true }).budgets).toBe(true);
  });
});

describe("isModuleKey", () => {
  it("accepts declared keys and refuses everything else", async () => {
    const { isModuleKey } = await import("@/lib/module-registry");
    expect(isModuleKey("fees")).toBe(true);
    expect(isModuleKey("it_education")).toBe(false);
    expect(isModuleKey("")).toBe(false);
    expect(isModuleKey(null)).toBe(false);
    expect(isModuleKey(7)).toBe(false);
  });
});
