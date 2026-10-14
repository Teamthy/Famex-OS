import { NextResponse } from "next/server";
import { MODULE_KEYS, type ModuleKey } from "@/lib/module-registry";
import { getEnabledModules } from "@/lib/modules";
import { getSession } from "@/lib/session";

export const dynamic = "force-dynamic";

/**
 * Roles that work inside the admin workspace. Only they pay for the extra
 * modules lookup — a parent or student session has no use for it.
 */
const ADMIN_WORKSPACE_ROLES = new Set(["ADMIN", "DIRECTOR", "BURSAR", "COORDINATOR"]);

/**
 * GET /api/auth/me — who am I, and what is this school licensed to use?
 *
 * `modules` (F0-17) is what the admin sidebar renders from: nav, route guards
 * and Licence & Usage all resolve the SAME module set, so a school that
 * switches an arm off sees the rows disappear here AND gets a 403 from the
 * API. It is deliberately returned only for admin-workspace roles; for
 * everyone else it is null and costs one fewer query.
 *
 * The list is the enabled set resolved by the pure registry, never a raw
 * School.modules blob — the client should not have to re-implement the
 * "absent means enabled" rule.
 */
export async function GET() {
  const user = await getSession();
  if (!user) return NextResponse.json({ user: null }, { status: 401 });

  if (!ADMIN_WORKSPACE_ROLES.has(user.role)) {
    return NextResponse.json({ user, modules: null });
  }

  let modules: ModuleKey[] | null = null;
  try {
    modules = [...(await getEnabledModules(user.schoolId))];
  } catch {
    // The session is still valid even if the entitlement read failed; the
    // sidebar falls back to showing the full registry and the API guard is
    // where entitlement is actually enforced.
    modules = [...MODULE_KEYS];
  }

  return NextResponse.json({ user, modules });
}
