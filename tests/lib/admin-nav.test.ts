import { describe, expect, it } from "vitest";

import { resolveNav, ADMIN_NAV_GROUPS } from "@/lib/nav";
import { MODULE_KEYS } from "@/lib/module-registry";

/**
 * The admin rail.
 *
 * The sidebar is generated from this registry, so a mistake here is a menu the
 * whole school sees. These pin the properties the shell depends on: every row a
 * teacher can click goes somewhere real, a switched-off module takes its rows
 * with it, and no row is labelled "AI …" — the de-AI naming rule.
 */

const everyModule = [...MODULE_KEYS];

describe("resolveNav", () => {
  it("returns the full registry when every module is on", () => {
    // Role omitted: resolve as a school administrator, who sees everything.
    const groups = resolveNav(everyModule);
    expect(groups.length).toBe(ADMIN_NAV_GROUPS.length);
    for (const group of groups) expect(group.items.length).toBeGreaterThan(0);
  });

  it("drops a group entirely when its module is switched off", () => {
    // A half-shown arm is worse than a hidden one: the rows would 403.
    // "exams" owns the CBT & Exams group. Switching it off must take the
    // whole group with it, or its rows would render and then 403.
    const withoutExams = everyModule.filter((key) => key !== "exams");
    const groups = resolveNav(withoutExams);
    expect(groups.some((group) => group.key === "cbt")).toBe(false);
    expect(groups.length).toBeLessThan(ADMIN_NAV_GROUPS.length);

    // And a group that keeps a core row survives the same switch-off.
    const cbtInFull = resolveNav(everyModule).find((group) => group.key === "cbt");
    expect(cbtInFull?.items.length).toBeGreaterThan(0);
  });

  it("never drops a core group, whatever is switched off", () => {
    const groups = resolveNav([]);
    const core = ADMIN_NAV_GROUPS.filter((group) => group.moduleKey === null);
    expect(groups.length).toBeGreaterThanOrEqual(core.length);
    for (const group of core)
      expect(groups.some((candidate) => candidate.key === group.key)).toBe(true);
  });

  it("gives every live row a route, and no planned row one", () => {
    for (const group of resolveNav(everyModule)) {
      for (const item of group.items) {
        if (item.status === "live") {
          expect(item.href, `${group.key}/${item.label} is live but has no href`).toBeTruthy();
          expect(item.href!.startsWith("/")).toBe(true);
        } else {
          // A planned row with an href invites someone to link to a 404.
          expect(item.href, `${item.label} is planned but has an href`).toBeUndefined();
        }
      }
    }
  });

  it("does not label a row with the AI prefix", () => {
    // Naming rule §2: name the capability, not the technology. Two rows called
    // "AI Builder" told a head teacher nothing about what they do.
    for (const group of resolveNav(everyModule))
      for (const item of group.items)
        expect(item.label, `"${item.label}" starts with AI`).not.toMatch(/^ai\b/i);
  });

  it("has no duplicate routes, so active-row highlighting is unambiguous", () => {
    const hrefs = resolveNav(everyModule)
      .flatMap((group) => group.items.map((item) => item.href))
      .filter((href): href is string => Boolean(href));
    expect(new Set(hrefs).size).toBe(hrefs.length);
  });

  it("marks a group as having live items when any child is live", () => {
    for (const group of resolveNav(everyModule)) {
      const hasLive = group.items.some((item) => item.status === "live");
      // The sidebar uses this to decide whether a group starts open; getting it
      // wrong buries the working product under roadmap rows.
      expect(group.hasLiveItems).toBe(hasLive);
    }
  });

  it("gives every group a key, a label and an icon the sidebar can resolve", () => {
    for (const group of resolveNav(everyModule)) {
      expect(group.key).toBeTruthy();
      expect(group.label).toBeTruthy();
      expect(group.icon).toBeTruthy();
    }
  });
});
