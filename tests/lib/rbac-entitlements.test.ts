import { describe, expect, it } from "vitest";
import { UserRole } from "@prisma/client";
import {
  ADMIN_NAV_ROLES,
  areaOfPath,
  canEnterArea,
  canRoleEnterPath,
  homeFor,
  PORTAL_AREAS,
  ROLE_ENTITLEMENTS,
} from "@/lib/rbac/entitlements";
import {
  ALL_ROLES,
  CLINIC_ROLES,
  LIBRARY_ROLES,
  PROVISIONABLE_STAFF_ROLES,
  type Role,
} from "@/lib/roles";

/**
 * B-06 regression net — the role × page × API entitlement matrix.
 *
 * The audit's required evidence was "parameterized login/route tests for
 * every UserRole, including direct URL access, API access, nav visibility,
 * and denied-object access". This file is the parameterized half: every
 * assertion below runs once per role in ALL_ROLES, and the expected tables
 * are hard-coded HERE (not imported from the matrix) so an accidental edit
 * to the matrix fails a test instead of silently re-opening the holes:
 *
 *   • the five-role middleware blind spot (PROPRIETOR/PRINCIPAL/
 *     VICE_PRINCIPAL/LIBRARIAN/NURSE bounced to /student/dashboard),
 *   • the nurse/librarian redirect LOOP (login → /admin/clinic → denied →
 *     /student/dashboard → denied → …),
 *   • the library API that refused the librarian and the clinic API that
 *     refused the nurse,
 *   • the staff <select> that could not create five of eleven staff roles.
 */

/** Independent copy of "which workspaces may this role enter" (B-06 table). */
const EXPECTED_AREAS: Record<Role, string[]> = {
  SUPER_ADMIN: ["super-admin", "admin", "admin-admissions", "teacher", "staff"],
  ADMIN: ["admin", "admin-admissions", "teacher", "staff"],
  DIRECTOR: ["admin", "admin-admissions", "teacher", "staff"],
  PROPRIETOR: ["admin", "admin-admissions", "staff"],
  PRINCIPAL: ["admin", "admin-admissions", "teacher", "staff"],
  VICE_PRINCIPAL: ["admin", "admin-admissions", "teacher", "staff"],
  BURSAR: ["admin", "staff"],
  COORDINATOR: ["admin", "admin-admissions", "staff"],
  LIBRARIAN: ["admin"],
  NURSE: ["admin"],
  HOD: ["teacher", "staff"],
  TEACHER: ["teacher", "staff"],
  PARENT: ["parent"],
  STUDENT: ["student"],
};

/** Independent copy of where login must land each role (B-06 table). */
const EXPECTED_HOME: Record<Role, string> = {
  SUPER_ADMIN: "/super-admin",
  ADMIN: "/admin",
  DIRECTOR: "/admin",
  PROPRIETOR: "/admin",
  PRINCIPAL: "/admin",
  VICE_PRINCIPAL: "/admin",
  BURSAR: "/admin/fees",
  COORDINATOR: "/admin-admissions",
  LIBRARIAN: "/admin/library",
  NURSE: "/admin/clinic",
  HOD: "/teacher/dashboard",
  TEACHER: "/teacher/dashboard",
  PARENT: "/parent/dashboard",
  STUDENT: "/student/dashboard",
};

const SAMPLE_PATH: Record<string, string> = {
  "super-admin": "/super-admin",
  admin: "/admin/fees",
  "admin-admissions": "/admin-admissions",
  teacher: "/teacher/dashboard",
  parent: "/parent/dashboard",
  student: "/student/dashboard",
  staff: "/staff",
};

describe("entitlement matrix — parameterized over every UserRole", () => {
  it.each(ALL_ROLES)("%s: has a complete matrix row", (role) => {
    const entitlement = ROLE_ENTITLEMENTS[role];
    expect(entitlement, `role ${role} missing from the matrix`).toBeDefined();
    expect(entitlement.home).toMatch(/^\//);
    expect(entitlement.areas.length).toBeGreaterThan(0);
  });

  it.each(ALL_ROLES)("%s: may enter exactly the workspaces in the B-06 table", (role) => {
    for (const area of PORTAL_AREAS) {
      expect(canEnterArea(role, area), `${role} × ${area}`).toBe(
        EXPECTED_AREAS[role].includes(area),
      );
    }
  });

  it.each(ALL_ROLES)("%s: direct URL access follows the matrix, per prefix", (role) => {
    for (const area of PORTAL_AREAS) {
      const path = SAMPLE_PATH[area];
      expect(canRoleEnterPath(role, path), `${role} → ${path}`).toBe(
        EXPECTED_AREAS[role].includes(area),
      );
    }
    // And nothing outside the protected workspaces is "entered" via this API.
    expect(canRoleEnterPath(role, "/api/admin/fees")).toBe(false);
    expect(canRoleEnterPath(role, "/")).toBe(false);
  });

  it.each(ALL_ROLES)("%s: login destination matches the B-06 table", (role) => {
    expect(homeFor(role)).toBe(EXPECTED_HOME[role]);
  });

  it.each(ALL_ROLES)(
    "%s: the bounce destination is a place the role may actually be (no redirect loops)",
    (role) => {
      // The loop the audit found was: denied → destinationFor(role) → denied
      // again. Terminating requires home to sit inside an area the role may
      // enter — asserted here for every role, forever.
      const home = homeFor(role);
      expect(canRoleEnterPath(role, home), `${role} home ${home} re-denies the role`).toBe(true);
    },
  );

  it.each(ALL_ROLES)("%s: unknown/garbage role strings fall to the least privilege", (role) => {
    // (the matrix itself, against a forged/expired JWT role claim)
    expect(homeFor(`${role}_FORGED`)).toBe("/student/dashboard");
    expect(canRoleEnterPath(`${role}_FORGED`, "/admin")).toBe(false);
  });
});

describe("area resolution", () => {
  it("does not let /admin swallow /admin-admissions (the old startsWith bug)", () => {
    expect(areaOfPath("/admin-admissions")).toBe("admin-admissions");
    expect(areaOfPath("/admin-admissions/stage/1")).toBe("admin-admissions");
    expect(areaOfPath("/admin/fees")).toBe("admin");
    expect(areaOfPath("/admin")).toBe("admin");
  });

  it("answers null for API routes and public pages", () => {
    expect(areaOfPath("/api/admin/fees")).toBeNull();
    expect(areaOfPath("/")).toBeNull();
    expect(areaOfPath("/admissions")).toBeNull();
    expect(areaOfPath("/login")).toBeNull();
  });
});

describe("role groups behind the APIs (Rule 13)", () => {
  it("gives the library to the librarian and the clinic to the nurse", () => {
    // The pre-B-06 inline lists omitted exactly these two roles.
    expect(LIBRARY_ROLES).toContain("LIBRARIAN");
    expect(CLINIC_ROLES).toContain("NURSE");
  });

  it("keeps child health need-to-know: the proprietor is out of the clinic", () => {
    expect(CLINIC_ROLES).not.toContain("PROPRIETOR");
    expect(LIBRARY_ROLES).toContain("PROPRIETOR");
  });

  it("maps every named group onto real Prisma enum members", () => {
    for (const role of [...LIBRARY_ROLES, ...CLINIC_ROLES, ...PROVISIONABLE_STAFF_ROLES]) {
      expect(Object.values(UserRole)).toContain(role);
    }
  });

  it("provisions every staff role and only staff roles", () => {
    expect([...PROVISIONABLE_STAFF_ROLES].sort()).toEqual(
      ALL_ROLES.filter(
        (role) => role !== "SUPER_ADMIN" && role !== "PARENT" && role !== "STUDENT",
      ).sort(),
    );
    // lib/people.ts's Prisma-typed STAFF_ROLES must stay in step.
    return import("@/lib/people").then(({ STAFF_ROLES }) => {
      expect([...STAFF_ROLES].sort()).toEqual([...PROVISIONABLE_STAFF_ROLES].sort());
    });
  });
});

describe("nav visibility follows the matrix", () => {
  const allModules = () =>
    import("@/lib/module-registry").then(
      ({ MODULES }) => Object.keys(MODULES) as import("@/lib/module-registry").ModuleKey[],
    );

  it.each(ALL_ROLES)("%s: admin sidebar membership matches adminNav", async (role) => {
    const { resolveNav } = await import("@/lib/nav");
    const enabled = await allModules();
    const resolved = resolveNav(enabled, role);
    const isAdminNavRole = ADMIN_NAV_ROLES.includes(role);
    expect(ROLE_ENTITLEMENTS[role].adminNav).toBe(isAdminNavRole);
    if (!isAdminNavRole) {
      // Teachers/parents/students never get the admin sidebar at all; the
      // middleware keeps them out of /admin entirely.
      expect(resolved).toEqual([]);
    } else {
      expect(resolved.length).toBeGreaterThan(0);
    }
  });

  it("shows the librarian the library and nothing moneyed", async () => {
    const { resolveNav } = await import("@/lib/nav");
    const enabled = await allModules();
    const groups = resolveNav(enabled, "LIBRARIAN");
    const hrefs = groups.flatMap((group) => group.items.map((item) => item.href));
    expect(hrefs).toContain("/admin/library");
    expect(hrefs).not.toContain("/admin/fees");
    expect(hrefs).not.toContain("/admin/staff");
    expect(hrefs).not.toContain("/admin/clinic");
  });

  it("shows the nurse the clinic, not the library", async () => {
    const { resolveNav } = await import("@/lib/nav");
    const enabled = await allModules();
    const hrefs = resolveNav(enabled, "NURSE").flatMap((group) =>
      group.items.map((item) => item.href),
    );
    expect(hrefs).toContain("/admin/clinic");
    expect(hrefs).not.toContain("/admin/library");
    expect(hrefs).not.toContain("/admin/fees");
  });

  it("keeps the bursar in money and assets but out of provisioning", async () => {
    const { resolveNav } = await import("@/lib/nav");
    const enabled = await allModules();
    const hrefs = resolveNav(enabled, "BURSAR").flatMap((group) =>
      group.items.map((item) => item.href),
    );
    expect(hrefs).toContain("/admin/fees");
    expect(hrefs).toContain("/admin/inventory");
    expect(hrefs).not.toContain("/admin/staff");
    expect(hrefs).not.toContain("/admin/library");
  });

  it("lets the coordinator provision staff and run the clinic, but not assets", async () => {
    const { resolveNav } = await import("@/lib/nav");
    const enabled = await allModules();
    const hrefs = resolveNav(enabled, "COORDINATOR").flatMap((group) =>
      group.items.map((item) => item.href),
    );
    // Staff APIs admit PEOPLE_ADMIN (coordinator included); the clinic group
    // has always admitted coordinators; inventory is bursar+leadership only.
    expect(hrefs).toContain("/admin/staff");
    expect(hrefs).toContain("/admin/clinic");
    expect(hrefs).not.toContain("/admin/inventory");
  });
});
