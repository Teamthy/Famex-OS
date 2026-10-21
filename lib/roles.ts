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
 * Roles for which MFA is required once the school enables the policy:
 * anyone who can move money or administer accounts. Enrolment itself is
 * self-service (lib/mfa.ts); login enforces the second factor whenever a
 * user has enrolled, and leadership accounts are expected to enrol first.
 */
export const MFA_EXPECTED_ROLES: readonly Role[] = [
  "ADMIN",
  "DIRECTOR",
  "PROPRIETOR",
  "PRINCIPAL",
  "BURSAR",
];

export function isRole(value: string): value is Role {
  return (ALL_ROLES as readonly string[]).includes(value);
}

export function roleIn(role: Role | string, group: readonly Role[]): boolean {
  return (group as readonly string[]).includes(role);
}
