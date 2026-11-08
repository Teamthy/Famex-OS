import { describe, expect, it } from "vitest";

import { ALL_ROLES } from "@/lib/roles";
import { canAccessPath, portalHome, refusalRedirect } from "@/lib/portal-access";

/**
 * B-06 — one role × page matrix.
 *
 * The bug this pins: a principal signed in, the login screen sent them to
 * /admin, middleware refused it because its hard-coded list did not include
 * PRINCIPAL, and the refusal redirect fell through to /student/dashboard —
 * also refused, and bounced back. The person who owns the school could not
 * open the product, and the loop looked like a broken deployment rather than a
 * permission decision.
 *
 * The invariant below is the one that was broken: every role in the enum must
 * be able to open the page it is sent to.
 */

const ADMIN_PORTALS = ["/admin", "/admin/fees", "/admin/results", "/admin/settings"];

describe("portalHome", () => {
  it("sends every role somewhere it is actually allowed", () => {
    // This single assertion would have caught B-06 on the day it was written.
    for (const role of ALL_ROLES) {
      const home = portalHome(role);
      expect(home, `${role} has no home`).not.toBe("/login");
      expect(canAccessPath(role, home), `${role} is sent to ${home} and refused`).toBe(true);
    }
  });

  it("returns a route for every role, with none falling through", () => {
    for (const role of ALL_ROLES) expect(portalHome(role).startsWith("/")).toBe(true);
  });

  it.each([
    ["PROPRIETOR", "/admin"],
    ["PRINCIPAL", "/admin"],
    ["VICE_PRINCIPAL", "/admin"],
    ["LIBRARIAN", "/admin/library"],
    ["NURSE", "/admin/clinic"],
    ["TEACHER", "/teacher/dashboard"],
    ["PARENT", "/parent/dashboard"],
    ["STUDENT", "/student/dashboard"],
  ])("routes %s to %s", (role, expected) => {
    expect(portalHome(role)).toBe(expected);
  });
});

describe("canAccessPath — admin portal", () => {
  it("admits the leadership roles the login screen routes there", () => {
    for (const role of ["ADMIN", "DIRECTOR", "PROPRIETOR", "PRINCIPAL", "VICE_PRINCIPAL", "BURSAR", "COORDINATOR"]) {
      for (const path of ADMIN_PORTALS)
        expect(canAccessPath(role, path), `${role} refused ${path}`).toBe(true);
    }
  });

  it("confines an operations role to the module it operates", () => {
    // A nurse exists for the clinic. Handing her the whole workspace because
    // she appears in the same role list is the opposite of least privilege.
    expect(canAccessPath("NURSE", "/admin/clinic")).toBe(true);
    expect(canAccessPath("NURSE", "/admin/fees")).toBe(false);
    expect(canAccessPath("NURSE", "/admin/staff")).toBe(false);

    expect(canAccessPath("LIBRARIAN", "/admin/library")).toBe(true);
    expect(canAccessPath("LIBRARIAN", "/admin/inventory")).toBe(true);
    expect(canAccessPath("LIBRARIAN", "/admin/fees")).toBe(false);
  });

  it("keeps students, parents and teachers out of the admin workspace", () => {
    for (const role of ["STUDENT", "PARENT", "TEACHER", "HOD"]) {
      expect(canAccessPath(role, "/admin"), `${role} reached /admin`).toBe(false);
      expect(canAccessPath(role, "/admin/fees"), `${role} reached fees`).toBe(false);
    }
  });
});

describe("canAccessPath — the other portals", () => {
  it("gives each portal only its own audience", () => {
    expect(canAccessPath("STUDENT", "/student/dashboard")).toBe(true);
    expect(canAccessPath("PARENT", "/student/dashboard")).toBe(false);

    expect(canAccessPath("PARENT", "/parent/fees")).toBe(true);
    expect(canAccessPath("STUDENT", "/parent/fees")).toBe(false);

    expect(canAccessPath("TEACHER", "/teacher/dashboard")).toBe(true);
    expect(canAccessPath("STUDENT", "/teacher/dashboard")).toBe(false);
  });

  it("lets leadership into the teacher workspace, because they supervise it", () => {
    for (const role of ["ADMIN", "DIRECTOR"]) expect(canAccessPath(role, "/teacher/dashboard")).toBe(true);
  });

  it("always allows the forced password change", () => {
    // A user who owes a password change must be able to reach the one page
    // that clears it, whatever role they hold.
    for (const role of ALL_ROLES) expect(canAccessPath(role, "/change-password")).toBe(true);
  });

  it("lets every staff role reach /staff", () => {
    for (const role of ["TEACHER", "HOD", "ADMIN", "DIRECTOR", "COORDINATOR", "BURSAR", "PROPRIETOR", "PRINCIPAL", "VICE_PRINCIPAL", "LIBRARIAN", "NURSE"])
      expect(canAccessPath(role, "/staff/attendance"), role).toBe(true);
    expect(canAccessPath("STUDENT", "/staff/attendance")).toBe(false);
  });
});

describe("refusalRedirect — the loop guard", () => {
  it("returns null when the destination is the page already requested", () => {
    // null means "do not redirect, show a 403". Redirecting here is the loop.
    expect(refusalRedirect("PRINCIPAL", "/admin")).toBeNull();
    expect(refusalRedirect("STUDENT", "/student/dashboard")).toBeNull();
    expect(refusalRedirect("TEACHER", "/teacher/dashboard")).toBeNull();
  });

  it("sends an operations role off the workspace dashboard to its own module", () => {
    // Not a loop: the clinic is a different page she is allowed to open.
    expect(refusalRedirect("NURSE", "/admin")).toBe("/admin/clinic");
    expect(refusalRedirect("LIBRARIAN", "/admin/fees")).toBe("/admin/library");
  });

  it("still redirects a role that is merely in the wrong portal", () => {
    expect(refusalRedirect("STUDENT", "/admin/fees")).toBe("/student/dashboard");
    expect(refusalRedirect("PARENT", "/admin")).toBe("/parent/dashboard");
    expect(refusalRedirect("TEACHER", "/admin")).toBe("/teacher/dashboard");
  });

  it("never names a destination the role cannot open", () => {
    for (const role of ALL_ROLES) {
      const current = "/admin/finances";
      const destination = refusalRedirect(role, current);
      if (destination === null || destination === "/login") continue;
      expect(
        canAccessPath(role, destination),
        `${role} is redirected from ${current} to ${destination}, which it cannot open`,
      ).toBe(true);
    }
  });
});
