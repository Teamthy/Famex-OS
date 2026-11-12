import { UserRole } from "@prisma/client";
import { describe, expect, it } from "vitest";
import {
  ACADEMIC_ADMIN_ROLES,
  ADMIN_WORKSPACE_ROLES,
  ALL_ROLES,
  FINANCE_APPROVER_ROLES,
  FINANCE_ROLES,
  isRole,
  LEADERSHIP_ROLES,
  MFA_EXPECTED_ROLES,
  MFA_REQUIRED_ROLES,
  OPERATIONS_ROLES,
  ROLE_LABELS,
  roleIn,
  roleMatches,
  PROVISIONABLE_STAFF_ROLES,
} from "@/lib/roles";

/**
 * lib/roles.ts is deliberately prisma-free so client code can read it. The
 * price of that split is drift risk: this test is the weld between the
 * string union and the Prisma enum. If a role is added to the schema and
 * not here (or vice versa), this fails before a guard can silently miss it.
 */
describe("role vocabulary", () => {
  it("matches the Prisma UserRole enum exactly", () => {
    expect([...ALL_ROLES].sort()).toEqual([...Object.values(UserRole)].sort());
  });

  it("labels every role for staff screens", () => {
    for (const role of ALL_ROLES) {
      expect(ROLE_LABELS[role].length).toBeGreaterThan(0);
    }
  });

  it("keeps parents and students out of every staff group", () => {
    const groups = [
      LEADERSHIP_ROLES,
      ADMIN_WORKSPACE_ROLES,
      FINANCE_ROLES,
      ACADEMIC_ADMIN_ROLES,
      OPERATIONS_ROLES,
      MFA_EXPECTED_ROLES,
    ];
    for (const group of groups) {
      expect(roleIn("PARENT", group)).toBe(false);
      expect(roleIn("STUDENT", group)).toBe(false);
    }
  });

  it("gives the new operational roles operations access but not finance", () => {
    expect(roleIn("LIBRARIAN", OPERATIONS_ROLES)).toBe(true);
    expect(roleIn("NURSE", OPERATIONS_ROLES)).toBe(true);
    expect(roleIn("LIBRARIAN", FINANCE_ROLES)).toBe(false);
    expect(roleIn("NURSE", FINANCE_ROLES)).toBe(false);
  });

  it("expects MFA from money movers and platform operators without making the bursar leadership", () => {
    expect(roleIn("SUPER_ADMIN", MFA_EXPECTED_ROLES)).toBe(true);
    expect(roleIn("SUPER_ADMIN", MFA_REQUIRED_ROLES)).toBe(true);
    expect(roleIn("ADMIN", MFA_REQUIRED_ROLES)).toBe(false);
    expect(roleIn("BURSAR", MFA_EXPECTED_ROLES)).toBe(true);
    expect(roleIn("BURSAR", LEADERSHIP_ROLES)).toBe(false);
    expect([...FINANCE_APPROVER_ROLES]).toEqual([...LEADERSHIP_ROLES]);
  });

  it("grants school ADMIN access to Director and Super Admin while keeping platform role distinct", () => {
    expect(roleMatches("DIRECTOR", ["ADMIN"])).toBe(true);
    expect(roleMatches("DIRECTOR", ["SUPER_ADMIN"])).toBe(false);
    expect(roleMatches("SUPER_ADMIN", ["ADMIN"])).toBe(true);
    expect(roleMatches("SUPER_ADMIN", ["DIRECTOR"])).toBe(true);
    expect(roleMatches("SUPER_ADMIN", ["SUPER_ADMIN"])).toBe(true);
    expect(PROVISIONABLE_STAFF_ROLES).not.toContain("SUPER_ADMIN");
  });

  it("recognises roles and rejects strangers", () => {
    expect(isRole("PRINCIPAL")).toBe(true);
    expect(isRole("VICE_PRINCIPAL")).toBe(true);
    expect(isRole("SUPERADMIN")).toBe(false);
    expect(isRole("")).toBe(false);
  });
});
