/**
 * Role vocabulary and role GROUPS (B, FIS production core).
 *
 * Before this file, every route hand-wrote its own role list
 * (`[UserRole.ADMIN, UserRole.DIRECTOR]`, `["ADMIN", "DIRECTOR", "BURSAR"]`, …).
 * That is how a new role silently misses half the screens it should have —
 * or, worse, gets added to a money screen it should never see because
 * someone pasted the nearest list.
 *
 * The rule from here on: **name the group, never re-derive it.** A route
 * that needs "leadership" imports LEADERSHIP_ROLES; adding a future role is
 * a one-line change here plus the enum migration.
 *
 * This module is deliberately prisma-free (string union + plain arrays) so
 * client components and the nav registry can read it without dragging the
 * Prisma client into the browser bundle — the same pattern as
 * lib/ledger-accounts.ts. tests/lib/roles.test.ts asserts the union and the
 * Prisma `UserRole` enum stay exactly in step.
 */

export type Role =
  | "SUPER_ADMIN"
  | "ADMIN"
  | "DIRECTOR"
  | "BURSAR"
  | "COORDINATOR"
  | "HOD"
  | "TEACHER"
  | "PARENT"
  | "STUDENT"
  | "PROPRIETOR"
  | "PRINCIPAL"
  | "VICE_PRINCIPAL"
  | "LIBRARIAN"
  | "NURSE";

export const ALL_ROLES: readonly Role[] = [
  "SUPER_ADMIN",
  "ADMIN",
  "DIRECTOR",
  "BURSAR",
  "COORDINATOR",
  "HOD",
  "TEACHER",
  "PARENT",
  "STUDENT",
  "PROPRIETOR",
  "PRINCIPAL",
  "VICE_PRINCIPAL",
  "LIBRARIAN",
  "NURSE",
];

/** Human label for staff screens — the enum is never shown raw to a user. */
export const ROLE_LABELS: Record<Role, string> = {
  SUPER_ADMIN: "Super Administrator",
  ADMIN: "Administrator",
  DIRECTOR: "Director",
  PROPRIETOR: "Proprietor",
  PRINCIPAL: "Principal",
  VICE_PRINCIPAL: "Vice Principal",
  BURSAR: "Bursar",
  COORDINATOR: "Coordinator",
  HOD: "Head of Department",
  TEACHER: "Teacher",
  LIBRARIAN: "Librarian",
  NURSE: "School Nurse",
  PARENT: "Parent",
  STUDENT: "Student",
};

/**
 * School leadership: may approve money movements (with approver ≠ requester
 * still enforced in the service), decide result corrections, and administer
 * the school. DIRECTOR is the legacy leadership role from the base build;
 * PROPRIETOR and PRINCIPAL are its distinct real-world counterparts.
 */
export const LEADERSHIP_ROLES: readonly Role[] = ["ADMIN", "DIRECTOR", "PROPRIETOR", "PRINCIPAL"];

/** Roles that work inside the admin workspace (module-guard default). */
export const ADMIN_WORKSPACE_ROLES: readonly Role[] = [
  "ADMIN",
  "DIRECTOR",
  "PROPRIETOR",
  "PRINCIPAL",
  "VICE_PRINCIPAL",
  "BURSAR",
  "COORDINATOR",
];

/** Finance team: fees, finances and the bursar queues. */
export const FINANCE_ROLES: readonly Role[] = [
  "ADMIN",
  "DIRECTOR",
  "PROPRIETOR",
  "PRINCIPAL",
  "BURSAR",
  "COORDINATOR",
];

/** Approves discounts/refunds/adjustments. Requesting is wider; approving is leadership only. */
export const FINANCE_APPROVER_ROLES: readonly Role[] = LEADERSHIP_ROLES;

/** Academic oversight: gradebook lock/release and result-correction decisions. */
export const ACADEMIC_ADMIN_ROLES: readonly Role[] = [
  "ADMIN",
  "DIRECTOR",
  "PRINCIPAL",
  "VICE_PRINCIPAL",
  "COORDINATOR",
];

/** Operations modules (library / clinic / inventory) day-to-day operators. */
export const OPERATIONS_ROLES: readonly Role[] = [
  "ADMIN",
  "DIRECTOR",
  "PRINCIPAL",
  "LIBRARIAN",
  "NURSE",
];

/**
 * Library arm (B-06): the LIBRARIAN role exists precisely to run it, plus
 * leadership oversight and the academic roles that browse/catalogue for
 * classes. Before the entitlement matrix this list was hand-written in the
 * library route and OMITTED the librarian — the one role the arm is for.
 */
export const LIBRARY_ROLES: readonly Role[] = [
  "ADMIN",
  "DIRECTOR",
  "PROPRIETOR",
  "PRINCIPAL",
  "VICE_PRINCIPAL",
  "COORDINATOR",
  "HOD",
  "TEACHER",
  "LIBRARIAN",
];

/**
 * Clinic / health arm (B-06): child health records are need-to-know, so this
 * list is deliberately narrower than LIBRARY_ROLES — the NURSE runs the arm,
 * academic leadership oversees it, and the proprietor (a non-academic owner)
 * is out. The clinic route's hand-written list previously omitted the nurse.
 */
export const CLINIC_ROLES: readonly Role[] = [
  "ADMIN",
  "DIRECTOR",
  "PRINCIPAL",
  "VICE_PRINCIPAL",
  "COORDINATOR",
  "TEACHER",
  "NURSE",
];

/**
 * Inventory & assets arm (B-06): the bursar tracks assets alongside money;
 * leadership oversees. Named here so the inventory route and the nav row
 * read one list (the route previously inlined it).
 */
export const INVENTORY_ROLES: readonly Role[] = ["ADMIN", "DIRECTOR", "BURSAR"];

/**
 * People administration (Staff & HR): who may create, invite and edit staff
 * accounts. lib/people.ts maps these names onto the Prisma enum for the API;
 * the nav group reads the names directly.
 */
export const PEOPLE_ADMIN_ROLE_NAMES: readonly Role[] = ["ADMIN", "DIRECTOR", "COORDINATOR"];

/**
 * Roles the staff provisioning flow (Staff & HR → invite / create direct)
 * may create (B-06). PARENT and STUDENT are excluded on purpose: students are
 * provisioned by admissions enrolment and parents by linkage to a student,
 * never by a staff-screen form. tests/lib/rbac-entitlements.test.ts asserts
 * this union and lib/people.ts's Prisma-typed STAFF_ROLES stay in step.
 */
export const PROVISIONABLE_STAFF_ROLES: readonly Role[] = ALL_ROLES.filter(
  (role) => role !== "SUPER_ADMIN" && role !== "PARENT" && role !== "STUDENT",
);

/**
 * Roles for which MFA is required once the school enables the policy:
 * anyone who can move money or administer accounts. Enrolment itself is
 * self-service (lib/mfa.ts); login enforces the second factor whenever a
 * user has enrolled, and leadership accounts are expected to enrol first.
 */
export const MFA_EXPECTED_ROLES: readonly Role[] = [
  "SUPER_ADMIN",
  "ADMIN",
  "DIRECTOR",
  "PROPRIETOR",
  "PRINCIPAL",
  "BURSAR",
];

/** Roles that must not receive a full session until MFA is enrolled. */
export const MFA_REQUIRED_ROLES: readonly Role[] = ["SUPER_ADMIN"];

/**
 * F0-03 in-school hierarchy: DIRECTOR inherits ADMIN permissions wherever an API
 * explicitly admits ADMIN. SUPER_ADMIN also inherits school ADMIN access for
 * this single-school install, plus its separate platform DevOps workspace.
 */
export function roleMatches(role: string, allowed: readonly string[]): boolean {
  return (
    allowed.includes(role) ||
    (role === "DIRECTOR" && allowed.includes("ADMIN")) ||
    (role === "SUPER_ADMIN" && (allowed.includes("ADMIN") || allowed.includes("DIRECTOR")))
  );
}

export function isRole(value: string): value is Role {
  return (ALL_ROLES as readonly string[]).includes(value);
}

export function roleIn(role: Role | string, group: readonly Role[]): boolean {
  return roleMatches(role, group);
}
