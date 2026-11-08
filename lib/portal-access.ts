import {
  ACADEMIC_ADMIN_ROLES,
  ADMIN_WORKSPACE_ROLES,
  LEADERSHIP_ROLES,
  OPERATIONS_ROLES,
  type Role,
} from "@/lib/roles";

/**
 * Who may open which portal, and where they land.
 *
 * ── Why this file exists (B-06) ────────────────────────────────────────────
 * Three surfaces each answered "which roles are staff?" differently:
 *
 *   • lib/roles.ts already had ADMIN_WORKSPACE_ROLES and OPERATIONS_ROLES,
 *     and the API guards use them.
 *   • middleware.ts hard-coded ["ADMIN","DIRECTOR","COORDINATOR","BURSAR"].
 *   • app/login/page.tsx sent PROPRIETOR/PRINCIPAL/VICE_PRINCIPAL to /admin
 *     and LIBRARIAN/NURSE to /admin/library and /admin/clinic.
 *
 * The consequences were not cosmetic. A principal who signed in was sent to
 * /admin, refused by middleware, and redirected to `destinationFor(role)` —
 * which fell through to /student/dashboard. That was refused too, and bounced
 * back to the same place: an unbreakable loop, on the account of the person
 * who owns the school. A nurse and a librarian had the same experience.
 *
 * Meanwhile the APIs those roles exist for (clinic, library, inventory) were
 * already authorising them, so the UI refused access to endpoints that would
 * have answered. Two authorities, one product.
 *
 * This module is now the one answer. middleware.ts, the login redirect and
 * the tests all read it, so a role cannot be staff in one place and a stranger
 * in another.
 */

/** The admin workspace: dashboard, fees, results, settings, and the rest. */
export const PORTAL_ADMIN_ROLES: readonly Role[] = ADMIN_WORKSPACE_ROLES;

/**
 * Staff who work in the admin workspace but not the whole of it.
 *
 * A nurse opens /admin/clinic; she does not open payroll. This is a page-level
 * narrowing on top of the portal role list, and the APIs enforce the same
 * split through OPERATIONS_ROLES.
 */
const ESTATE_SCOPED_PATHS: ReadonlyArray<{ prefix: string; roles: readonly Role[] }> = [
  { prefix: "/admin/clinic", roles: OPERATIONS_ROLES },
  { prefix: "/admin/library", roles: OPERATIONS_ROLES },
  { prefix: "/admin/inventory", roles: OPERATIONS_ROLES },
];

export const PORTAL_TEACHER_ROLES: readonly Role[] = ["TEACHER", "HOD", "ADMIN", "DIRECTOR"];
export const PORTAL_STAFF_ROLES: readonly Role[] = [
  "TEACHER",
  "HOD",
  "ADMIN",
  "DIRECTOR",
  "COORDINATOR",
  "BURSAR",
  "PROPRIETOR",
  "PRINCIPAL",
  "VICE_PRINCIPAL",
  "LIBRARIAN",
  "NURSE",
];

/**
 * Where a signed-in role belongs.
 *
 * Every role in the enum resolves to a portal it is actually allowed into —
 * that is the invariant that broke the principal's session. `destinationFor`
 * and the access check are defined together so they cannot drift apart again.
 */
export function portalHome(role: string): string {
  // An operations role cannot open the admin dashboard, so landing there would
  // be the same refusal-with-nowhere-to-go that started this. Each lands on the
  // module it operates.
  if (role === "LIBRARIAN") return "/admin/library";
  if (role === "NURSE") return "/admin/clinic";
  if ((PORTAL_ADMIN_ROLES as readonly string[]).includes(role)) return "/admin";
  if (role === "TEACHER" || role === "HOD") return "/teacher/dashboard";
  if (role === "PARENT") return "/parent/dashboard";
  if (role === "STUDENT") return "/student/dashboard";
  // Unreachable for a role in the enum; a session with a corrupt or retired
  // role must land somewhere harmless rather than loop.
  return "/login";
}

/** May this role open this path at all? */
export function canAccessPath(role: string, pathname: string): boolean {
  if (pathname.startsWith("/change-password")) return true;

  const adminPath = pathname.startsWith("/admin") || pathname.startsWith("/admin-admissions");
  if (adminPath) {
    /**
     * An operations role is confined to the modules it operates.
     *
     * A nurse opens the clinic; she does not open payroll. This check has to
     * come FIRST: LIBRARIAN and NURSE are deliberately absent from
     * ADMIN_WORKSPACE_ROLES — they have no business in the workspace at large
     * — so testing workspace membership first rejected them everywhere,
     * including the two pages they exist for.
     */
    if (isOperationsOnly(role)) {
      return ESTATE_SCOPED_PATHS.some((entry) => pathname.startsWith(entry.prefix));
    }
    return (PORTAL_ADMIN_ROLES as readonly string[]).includes(role);
  }

  if (pathname.startsWith("/teacher")) return (PORTAL_TEACHER_ROLES as readonly string[]).includes(role);
  if (pathname.startsWith("/parent")) return role === "PARENT";
  if (pathname.startsWith("/student")) return role === "STUDENT";
  if (pathname.startsWith("/staff")) return (PORTAL_STAFF_ROLES as readonly string[]).includes(role);
  return true;
}

/** Roles that exist for the estate modules and nothing else. */
function isOperationsOnly(role: string): boolean {
  return role === "LIBRARIAN" || role === "NURSE";
}

/**
 * Where to send a role that tried to open a page it cannot have.
 *
 * Returns `null` when the destination is the page they are already on, which
 * is the loop condition — the caller must show a refusal (403) instead of
 * redirecting into itself.
 */
export function refusalRedirect(role: string, currentPath: string): string | null {
  const home = portalHome(role);
  if (home === "/login") return "/login";
  /**
   * Null means "do not redirect". The caller renders a 403 instead.
   *
   * Two cases produce it:
   *   • the home IS the requested page — redirecting would loop;
   *   • the home is a prefix of the requested page, so a redirect would land
   *     the user inside the same refused area (a nurse asking for /admin).
   */
  if (currentPath === home) return null;
  if (currentPath.startsWith(home + "/")) return null;
  // Belt and braces: never name a destination the role cannot open.
  if (!canAccessPath(role, home)) return null;
  return home;
}

/** Roles the login screen knows how to route. Every enum member, by design. */
export const LOGIN_ROLE_DESTINATIONS: Readonly<Record<string, string>> = Object.fromEntries(
  (
    [
      "ADMIN",
      "DIRECTOR",
      "PROPRIETOR",
      "PRINCIPAL",
      "VICE_PRINCIPAL",
      "BURSAR",
      "COORDINATOR",
      "HOD",
      "TEACHER",
      "PARENT",
      "STUDENT",
      "LIBRARIAN",
      "NURSE",
    ] as const
  ).map((role) => [role, portalHome(role)]),
);

export { LEADERSHIP_ROLES, ACADEMIC_ADMIN_ROLES };
