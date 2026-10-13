import { NextResponse } from "next/server";
import { UserRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/session";
import { getEnabledModules, MODULE_KEYS } from "@/lib/modules";
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
    modules: MODULE_KEYS.map((key) => ({ key, enabled: enabled.has(key) })),
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
