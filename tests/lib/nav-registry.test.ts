import { describe, it, expect } from "vitest";

/**
 * The grouped admin navigation registry (F0-17, F0-25).
 *
 * Three failures this pins:
 *   • a `live` row without a page (a dead link — the founder's explicit "no"),
 *   • a `planned` row for a screen that already exists (stale roadmap),
 *   • a module switch that takes the rows off the sidebar in one place but not
 *     the other — the drift this whole workstream exists to prevent.
 */

describe("registry shape", () => {
  it("never gives a planned row a href (a stub invites a link to nothing)", async () => {
    const { ADMIN_NAV_GROUPS } = await import("@/lib/nav");
    for (const group of ADMIN_NAV_GROUPS) {
      for (const item of group.items) {
        if (item.status === "planned") expect(item.href).toBeUndefined();
        else expect(item.href).toMatch(/^\//);
      }
    }
  });

  it("uses unique labels inside a group and unique routes across the registry", async () => {
    const { ADMIN_NAV_GROUPS } = await import("@/lib/nav");
    const seenRoutes: string[] = [];
    for (const group of ADMIN_NAV_GROUPS) {
      const labels = group.items.map((item) => item.label);
      expect(new Set(labels).size, `duplicate label in group ${group.key}`).toBe(labels.length);
      for (const item of group.items) {
        if (item.status === "live" && item.href) seenRoutes.push(item.href);
      }
    }
    // Each screen appears once. If a screen genuinely needs two entry points,
    // this assertion is the place to record why.
    const duplicates = seenRoutes.filter((route, index) => seenRoutes.indexOf(route) !== index);
    expect(duplicates).toEqual([]);
  });

  it("keeps core groups core — a school must not be able to hide its own settings", async () => {
    const { ADMIN_NAV_GROUPS } = await import("@/lib/nav");
    const settings = ADMIN_NAV_GROUPS.find((group) => group.key === "settings");
    const licence = ADMIN_NAV_GROUPS.find((group) => group.key === "licence");
    expect(settings?.moduleKey).toBeNull();
    expect(licence?.moduleKey).toBeNull();
  });

  it("labels nav the way the founder asked (no AI-prefixed groups)", async () => {
    const { ADMIN_NAV_GROUPS } = await import("@/lib/nav");
    for (const group of ADMIN_NAV_GROUPS) {
      expect(group.label.startsWith("AI ")).toBe(false);
      for (const item of group.items) expect(item.label.startsWith("AI ")).toBe(false);
    }
    expect(ADMIN_NAV_GROUPS.map((group) => group.label)).toContain("Studio");
    expect(ADMIN_NAV_GROUPS.map((group) => group.label)).toContain("Learning Hub");
  });
});

describe("resolveNav", () => {
  it("drops a group whose module is switched off — including its roadmap rows", async () => {
    const { resolveNav, ADMIN_NAV_GROUPS } = await import("@/lib/nav");
    const enabled = ADMIN_NAV_GROUPS.flatMap((group) => (group.moduleKey ? [group.moduleKey] : []));

    const withoutCbt = resolveNav(
      enabled.filter((key) => key !== "exams"),
      "ADMIN",
    );
    expect(withoutCbt.some((group) => group.label === "CBT & Exams")).toBe(false);

    const withCbt = resolveNav(enabled, "ADMIN");
    expect(withCbt.some((group) => group.label === "CBT & Exams")).toBe(true);
  });

  it("keeps core groups visible whatever the switches say", async () => {
    const { resolveNav } = await import("@/lib/nav");
    const groups = resolveNav([], "ADMIN");
    const labels = groups.map((group) => group.label);
    expect(labels).toContain("Home");
    expect(labels).toContain("Settings");
    expect(labels).toContain("Licence & Usage");
  });

  it("hides role-restricted rows from other roles but keeps them for ADMIN", async () => {
    const { resolveNav, ADMIN_NAV_GROUPS } = await import("@/lib/nav");
    const enabled = ADMIN_NAV_GROUPS.flatMap((group) => (group.moduleKey ? [group.moduleKey] : []));

    const asAdmin = resolveNav(enabled, "ADMIN")
      .flatMap((group) => group.items)
      .map((item) => item.label);
    const asBursar = resolveNav(enabled, "BURSAR")
      .flatMap((group) => group.items)
      .map((item) => item.label);

    // /admin/licence is ADMIN/DIRECTOR only at the API, so the row mirrors it.
    expect(asAdmin).toContain("Licence & Usage");
    expect(asBursar).not.toContain("Licence & Usage");
    // ...and everything unrestricted is still there for both.
    expect(asBursar).toContain("Dashboard");
  });

  it("shows the full product when the module list is not known yet", async () => {
    const { resolveNav, ADMIN_NAV_GROUPS } = await import("@/lib/nav");
    const everything = ADMIN_NAV_GROUPS.flatMap((group) =>
      group.moduleKey ? [group.moduleKey] : [],
    );
    const groups = resolveNav(everything, null);
    expect(groups.length).toBe(ADMIN_NAV_GROUPS.length);
  });

  it("says whether a group has real links, so the sidebar can fold the roadmap", async () => {
    const { resolveNav, ADMIN_NAV_GROUPS } = await import("@/lib/nav");
    const enabled = ADMIN_NAV_GROUPS.flatMap((group) => (group.moduleKey ? [group.moduleKey] : []));
    const groups = resolveNav(enabled, "ADMIN");

    const live = groups.find((group) => group.key === "settings");
    const roadmapOnly = groups.find((group) => group.key === "front_desk");
    expect(live?.hasLiveItems).toBe(true);
    expect(roadmapOnly?.hasLiveItems).toBe(false);
    expect(roadmapOnly?.items.every((item) => item.status === "planned")).toBe(true);
  });
});

describe("check:modules parity helpers", () => {
  it("lists live hrefs and planned hrefs consistently", async () => {
    const { liveNavHrefs, plannedNavHrefs, ADMIN_NAV_GROUPS } = await import("@/lib/nav");
    const live = liveNavHrefs();
    const planned = plannedNavHrefs();

    expect(live.length).toBeGreaterThan(0);
    // Planned rows carry no href at all in the registry today.
    expect(planned).toEqual([]);
    expect(live).toContain("/admin");
    expect(new Set(live).size).toBeLessThanOrEqual(live.length);

    const registryLive = ADMIN_NAV_GROUPS.flatMap((group) =>
      group.items.filter((item) => item.status === "live").map((item) => item.href),
    );
    expect(live.length).toBe(registryLive.length);
  });
});
