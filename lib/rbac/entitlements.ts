/**
 * The role × page entitlement matrix (B-06) — one server-enforced source of
 * truth for WHERE each role may go in the browser.
 *
 * Before this file the same decision lived in four hand-written copies that
 * had drifted apart:
 *
 *   • middleware.ts `destinationFor`  — knew 8 of 13 roles; the other five
 *     (PROPRIETOR, PRINCIPAL, VICE_PRINCIPAL, LIBRARIAN, NURSE) fell through
 *     to `/student/dashboard`.
 *   • middleware.ts `allowed`         — let only 4 roles into `/admin`, so a
 *     nurse bounced login → /admin/clinic → /student/dashboard → denied →
 *     /student/dashboard… an unbreakable redirect loop.
 *   • app/login/page.tsx destinations — knew all 13, but disagreed with both
 *     middleware copies about where COORDINATOR and BURSAR land.
 *   • lib/nav.ts AdminNavRole         — an 8-role type the sidebar filtered
 *     against.
 *
 * The rule from here on: middleware, the login page, the nav registry and the
 * tests all READ this table; nobody re-derives a role list for a destination
 * or a prefix again. API-level authority stays where Rule 13 already puts it
 * — `requireModule(module, ROLES_GROUP)` in each route, with the groups in
 * lib/roles.ts — and tests/lib/rbac-entitlements.test.ts asserts the two
 * layers agree (every role an API group admits can also enter the prefix
 * that hosts the page for it).
 *
 * Deliberately prisma-free (string union + plain data, same pattern as
 * lib/roles.ts) so the EDGE middleware can import it: no Prisma client, no
 * `next/headers`, nothing node-only.
 */
import { ALL_ROLES, type Role } from "@/lib/roles";

/** The protected top-level workspaces (mirrors middleware's prefixes). */
export type PortalArea =
  "admin" | "admin-admissions" | "teacher" | "parent" | "student" | "staff" | "super-admin";

export const PORTAL_AREAS: readonly PortalArea[] = [
  "super-admin",
  "admin",
  "admin-admissions",
  "teacher",
  "parent",
  "student",
  "staff",
];

export type RoleEntitlement = {
  /**
   * Where login lands this role AND where middleware bounces it when it
   * wanders into a workspace that is not theirs. The two MUST be the same
   * string or the bounce becomes a loop — the test suite asserts exactly
   * that (`home` always sits inside one of the role's own `areas`, or in a
   * public-to-them dashboard).
   */
  home: string;
  /** Protected workspaces this role may enter (middleware-enforced). */
  areas: readonly PortalArea[];
  /** Whether the grouped admin sidebar renders for this role at all. */
  adminNav: boolean;
};

/**
 * The matrix. Reading a row answers "what is this role allowed to touch in
 * the browser" without opening any route file.
 *
 * Judgement calls, recorded so they are decisions and not accidents:
 *   • PROPRIETOR gets the admin workspace and the staff directory but NOT
 *     the teacher workspace: owner oversight, not classroom presence.
 *   • PRINCIPAL and VICE_PRINCIPAL get the teacher workspace (academic
 *     leadership observes classes); COORDINATOR keeps admin-admissions as
 *     their home because admissions is their day job.
 *   • LIBRARIAN and NURSE enter the admin workspace because their arms live
 *     there (/admin/library, /admin/clinic); what they can DO inside is
 *     still the API's call (LIBRARY_ROLES / CLINIC_ROLES, Rule 13).
 *   • BURSAR homes on /admin/fees — the queue they live in — exactly as the
 *     login page already promised.
 */
export const ROLE_ENTITLEMENTS: Record<Role, RoleEntitlement> = {
  SUPER_ADMIN: {
    home: "/super-admin",
    areas: ["super-admin", "admin", "admin-admissions", "teacher", "staff"],
    adminNav: true,
  },
  ADMIN: {
    home: "/admin",
    areas: ["admin", "admin-admissions", "teacher", "staff"],
    adminNav: true,
  },
  DIRECTOR: {
    home: "/admin",
    areas: ["admin", "admin-admissions", "teacher", "staff"],
    adminNav: true,
  },
  PROPRIETOR: {
    home: "/admin",
    areas: ["admin", "admin-admissions", "staff"],
    adminNav: true,
  },
  PRINCIPAL: {
    home: "/admin",
    areas: ["admin", "admin-admissions", "teacher", "staff"],
    adminNav: true,
  },
  VICE_PRINCIPAL: {
    home: "/admin",
    areas: ["admin", "admin-admissions", "teacher", "staff"],
    adminNav: true,
  },
  BURSAR: {
    home: "/admin/fees",
    areas: ["admin", "staff"],
    adminNav: true,
  },
  COORDINATOR: {
    home: "/admin-admissions",
    areas: ["admin", "admin-admissions", "staff"],
    adminNav: true,
  },
  LIBRARIAN: {
    home: "/admin/library",
    areas: ["admin"],
    adminNav: true,
  },
  NURSE: {
    home: "/admin/clinic",
    areas: ["admin"],
    adminNav: true,
  },
  HOD: {
    home: "/teacher/dashboard",
    areas: ["teacher", "staff"],
    adminNav: false,
  },
  TEACHER: {
    home: "/teacher/dashboard",
    areas: ["teacher", "staff"],
    adminNav: false,
  },
  PARENT: {
    home: "/parent/dashboard",
    areas: ["parent"],
    adminNav: false,
  },
  STUDENT: {
    home: "/student/dashboard",
    areas: ["student"],
    adminNav: false,
  },
};

/** Every role the matrix knows — tests assert this equals ALL_ROLES. */
export const ENTITLED_ROLES: readonly Role[] = ALL_ROLES;

/** Where login lands a role, and where middleware bounces it. */
export function homeFor(role: Role | string): string {
  const entitlement = ROLE_ENTITLEMENTS[role as Role];
  // Unknown/garbage role strings (a stale JWT, a hand-edited cookie) get the
  // least privileged workspace rather than an exception in the edge runtime.
  return entitlement ? entitlement.home : "/student/dashboard";
}

/** Does this role's entitlement include the given workspace? */
export function canEnterArea(role: Role | string, area: PortalArea): boolean {
  const entitlement = ROLE_ENTITLEMENTS[role as Role];
  return entitlement ? entitlement.areas.includes(area) : false;
}

/**
 * Which protected workspace a pathname belongs to, or null when it is not
 * one. Segment-exact on purpose: `"/admin-admissions/x"` is NOT `/admin`,
 * which a naive `startsWith("/admin")` would have swallowed (that swallow is
 * part of why the old middleware could not express these five roles).
 */
export function areaOfPath(pathname: string): PortalArea | null {
  const first = pathname.split("/")[1];
  return (PORTAL_AREAS as readonly string[]).includes(first ?? "") ? (first as PortalArea) : null;
}

/**
 * Middleware's page-level question: may this role open this pathname?
 * `/change-password` is handled by the caller (every role may, and must).
 */
export function canRoleEnterPath(role: Role | string, pathname: string): boolean {
  const area = areaOfPath(pathname);
  if (area === null) return false;
  return canEnterArea(role, area);
}

/** Roles for which the grouped admin sidebar renders at all. */
export const ADMIN_NAV_ROLES: readonly Role[] = ALL_ROLES.filter(
  (role) => ROLE_ENTITLEMENTS[role].adminNav,
);
