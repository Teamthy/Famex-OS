/**
 * Route-level module entitlement (Rule 13: auth → role → module).
 *
 * Every admin API route already checked the session and the role. What nothing
 * checked was whether the school has that arm switched on — so a school that
 * turned CBT off still had working CBT endpoints, reachable by anyone who
 * remembered the URL, and `School.modules` was decoration rather than
 * entitlement (F0-17, F0-25).
 *
 * This is the one helper those routes call. It answers 401/403 consistently
 * and, crucially, distinguishes three different refusals:
 *
 *   401 NO_SESSION            — sign in.
 *   403 WRONG_ROLE            — the account is fine, this screen is not theirs.
 *   403 MODULE_DISABLED       — the school switched the arm off; an admin can
 *                               switch it back on in Licence & Usage.
 *   503 ENTITLEMENT_UNAVAILABLE — the database could not tell us. Deliberately
 *                               NOT a 403 and deliberately not a fallback to
 *                               "allow": a module the school disabled must not
 *                               become usable because the DB blipped.
 */
import { NextResponse } from "next/server";
import { UserRole } from "@prisma/client";
import { MODULES, type ModuleKey } from "@/lib/module-registry";
import { getEnabledModulesStrict } from "@/lib/modules";
import { requireRole, type SessionUser } from "@/lib/session";

export type ModuleGuardResult =
  { ok: true; user: SessionUser; enabled: Set<ModuleKey> } | { ok: false; response: NextResponse };

/** Roles that work inside the admin workspace, when the caller does not say. */
const ADMIN_WORKSPACE_ROLES: UserRole[] = [
  UserRole.ADMIN,
  UserRole.DIRECTOR,
  UserRole.BURSAR,
  UserRole.COORDINATOR,
];

export function moduleDisabledResponse(moduleKey: ModuleKey): NextResponse {
  const label = MODULES[moduleKey].label;
  return NextResponse.json(
    {
      error: `${label} is switched off for this school. An administrator can turn it on in Licence & Usage.`,
      code: "MODULE_DISABLED",
      module: moduleKey,
    },
    { status: 403 },
  );
}

export function entitlementUnavailableResponse(): NextResponse {
  return NextResponse.json(
    {
      error: "Could not check what this school is licensed to use. Please try again.",
      code: "ENTITLEMENT_UNAVAILABLE",
    },
    { status: 503 },
  );
}

/**
 * Guard an API route: session → optional role list → module entitlement.
 *
 * Usage:
 *   const guard = await requireModule("fees", [UserRole.ADMIN, UserRole.BURSAR]);
 *   if (!guard.ok) return guard.response;
 *   const { user } = guard;
 *   // ... `guard.enabled` is the full enabled set, to save a second query
 *   //     when the handler needs to check another module.
 */
export async function requireModule(
  /**
   * The module this route needs, or `null` for a CORE route (settings, the
   * wizard, the dashboard) that every admin workspace role may use. Core
   * routes still run the same session+role chain — only the entitlement step
   * is skipped, and `enabled` comes back empty.
   */
  moduleKey: ModuleKey | null,
  roles?: UserRole[],
): Promise<ModuleGuardResult> {
  // Session + role first — `requireRole` is the same check every route already
  // used, so a route that swaps its own call for this one does not change how
  // it authenticates, only what it does next.
  const user = await requireRole(roles && roles.length > 0 ? roles : ADMIN_WORKSPACE_ROLES);
  if (!user) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }

  if (moduleKey === null) {
    return { ok: true, user, enabled: new Set<ModuleKey>() };
  }

  let enabled: Set<ModuleKey>;
  try {
    enabled = await getEnabledModulesStrict(user.schoolId);
  } catch {
    return { ok: false, response: entitlementUnavailableResponse() };
  }

  if (!enabled.has(moduleKey)) {
    return { ok: false, response: moduleDisabledResponse(moduleKey) };
  }

  return { ok: true, user, enabled };
}

/**
 * Guard for a route where any one of several modules entitles the caller
 * (e.g. the finance overview is useful with Fees OR Budgets switched on).
 */
export async function requireAnyModule(
  moduleKeys: ModuleKey[],
  roles?: UserRole[],
): Promise<ModuleGuardResult> {
  const primary = moduleKeys[0];
  if (!primary) throw new Error("requireAnyModule needs at least one module key.");

  const user = await requireRole(roles && roles.length > 0 ? roles : ADMIN_WORKSPACE_ROLES);
  if (!user) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }

  let enabled: Set<ModuleKey>;
  try {
    enabled = await getEnabledModulesStrict(user.schoolId);
  } catch {
    return { ok: false, response: entitlementUnavailableResponse() };
  }

  if (!moduleKeys.some((key) => enabled.has(key))) {
    return { ok: false, response: moduleDisabledResponse(primary) };
  }

  return { ok: true, user, enabled };
}
