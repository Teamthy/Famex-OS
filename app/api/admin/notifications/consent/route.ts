import { UserRole } from "@prisma/client";
import { NextResponse } from "next/server";
import { requireModule } from "@/lib/module-guard";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * Communication-consent coverage (L, W4 / NDPA).
 *
 * Admins need to see, before a broadcast, how many recipients have recorded
 * consent per channel/kind. Individual consent rows stay with the person
 * (self-service at /api/notifications/consent); this is the aggregate view.
 */
const CONSENT_ADMIN_ROLES: UserRole[] = [
  UserRole.ADMIN,
  UserRole.DIRECTOR,
  UserRole.PROPRIETOR,
  UserRole.PRINCIPAL,
  UserRole.COORDINATOR,
];

export async function GET() {
  const guard = await requireModule("notifications", CONSENT_ADMIN_ROLES);
  if (!guard.ok) return guard.response;
  const user = guard.user;

  const rows = await prisma.communicationConsent.groupBy({
    by: ["channel", "kind", "optedIn"],
    where: { schoolId: user.schoolId },
    _count: true,
  });

  return NextResponse.json({
    coverage: rows.map((row) => ({
      channel: row.channel,
      kind: row.kind,
      optedIn: row.optedIn,
      count: row._count,
    })),
  });
}
