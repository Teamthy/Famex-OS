import { NextRequest, NextResponse } from "next/server";
import { UserRole } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getClientIp } from "@/lib/requests";
import { requireRole } from "@/lib/session";
import { getEnabledModules, MODULE_KEYS, MODULES } from "@/lib/modules";
import { isModuleKey, mergeModuleSwitches } from "@/lib/module-registry";
import { readPublicSystemConfig } from "@/lib/system-flags";
import { PRODUCT_NAME } from "@/lib/brand";

export const dynamic = "force-dynamic";

// F20 / W1: Licence & Usage. Server-authoritative — the client only asks.
// Rule 13: auth → role → (module entitlement is the subject of this screen).
const LICENCE_ROLES = [UserRole.ADMIN, UserRole.DIRECTOR];

/**
 * GET /api/admin/licence
 *
 * A single-school Famex install holds exactly one licence — there is no SaaS
 * plan tier or cross-school subscription (that was the EDUos platform layer,
 * stripped in W1 / F20-06, F20-07). This endpoint reports:
 *
 *   • licence identity   — product, school, status, provisioning date
 *   • module switches    — School.modules (F0-25): what this school uses,
 *                          visible so nav, entitlement and licence cannot drift
 *   • usage meters       — storage / messages / AI credits / SMS. The meters are
 *                          wired in F20 (W12); until then they report null so
 *                          the UI shows an honest empty state, never a faked
 *                          number (Rule 3: the client may only ask).
 *   • integrations       — which providers are configured (from system flags)
 */
export async function GET() {
  const user = await requireRole(LICENCE_ROLES);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const school = await prisma.school.findUnique({
    where: { id: user.schoolId },
    select: { name: true, slug: true, status: true, createdAt: true },
  });

  const enabled = await getEnabledModules(user.schoolId);
  const config = readPublicSystemConfig();

  return NextResponse.json({
    product: PRODUCT_NAME,
    licence: {
      model: "Single-school licence",
      schoolName: school?.name ?? null,
      schoolSlug: school?.slug ?? null,
      schoolStatus: school?.status ?? null,
      provisionedAt: school?.createdAt ? school.createdAt.toISOString() : null,
    },
    // Every module, labelled from the registry (lib/module-registry.ts) so the
    // name shown here is the same name the sidebar and the guard use.
    modules: MODULE_KEYS.map((key) => ({
      key,
      enabled: enabled.has(key),
      label: MODULES[key].label,
      summary: MODULES[key].summary,
      release: MODULES[key].release,
    })),
    // Meters land with the full Licence & Usage build (F20, W12). null = "not
    // measured yet", which the UI renders as an explanatory empty state.
    usage: {
      storage: null as number | null,
      messages: null as number | null,
      aiCredits: null as number | null,
      sms: null as number | null,
    },
    integrations: config.configured,
    serverTime: new Date().toISOString(),
  });
}

const patchSchema = z.object({
  /** Partial switch map: { fees: false, exams: true }. Unknown keys are refused. */
  modules: z.record(z.string(), z.boolean()),
});

/**
 * PATCH /api/admin/licence — flip this school's module switches (F0-25).
 *
 * Server-authoritative and audited (Rule 9): the switches are entitlement, not
 * preference. A key that is not in the registry is refused rather than stored,
 * because a stored unknown key is nav drift waiting to happen (banned move:
 * a module with no School.modules entry, and its mirror).
 *
 * The response returns the RESOLVED list, so the client never has to
 * re-implement "absent means enabled".
 */
export async function PATCH(request: NextRequest) {
  const user = await requireRole(LICENCE_ROLES);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let input: z.infer<typeof patchSchema>;
  try {
    input = patchSchema.parse(await request.json());
  } catch {
    return NextResponse.json(
      { error: "Send a switch map, e.g. { fees: false }." },
      { status: 422 },
    );
  }

  const unknown = Object.keys(input.modules).filter((key) => !isModuleKey(key));
  if (unknown.length > 0) {
    return NextResponse.json(
      {
        error: `Unknown module key(s): ${unknown.join(", ")}. Add them to lib/module-registry.ts first.`,
      },
      { status: 422 },
    );
  }

  const school = await prisma.school.findUnique({
    where: { id: user.schoolId },
    select: { modules: true },
  });
  const before = mergeModuleSwitches(school?.modules ?? null, {});
  const after = mergeModuleSwitches(school?.modules ?? null, input.modules);

  const changed = MODULE_KEYS.filter((key) => before[key] !== after[key]);

  await prisma.school.update({
    where: { id: user.schoolId },
    data: { modules: after },
  });

  if (changed.length > 0) {
    await prisma.auditLog.create({
      data: {
        schoolId: user.schoolId,
        actorUserId: user.id,
        action: "MODULE_SWITCHES_UPDATED",
        entityType: "School",
        entityId: user.schoolId,
        ipAddress: getClientIp(request),
        metadata: { changed: changed.map((key) => `${key}=${after[key]}`) },
      },
    });
  }

  return NextResponse.json({
    ok: true,
    changed,
    modules: MODULE_KEYS.map((key) => ({
      key,
      enabled: after[key] === true,
      label: MODULES[key].label,
      summary: MODULES[key].summary,
      release: MODULES[key].release,
    })),
  });
}
