import { NextRequest, NextResponse } from "next/server";
import { requireModule } from "@/lib/module-guard";
import { UserRole } from "@prisma/client";
import {
  addAsset,
  addMovement,
  assetStats,
  listAssets,
  listMovements,
  updateAsset,
} from "@/lib/inventory";
import { getClientIp } from "@/lib/requests";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function ctx() {
  // Rule 13: auth → role → module entitlement (Operations owns inventory).
  return requireModule("operations", [UserRole.ADMIN, UserRole.DIRECTOR, UserRole.BURSAR]);
}

export async function GET() {
  const guard = await ctx();
  if (!guard.ok) return guard.response;
  const user = guard.user;
  const [assets, movements] = await Promise.all([
    listAssets(user.schoolId),
    listMovements(user.schoolId),
  ]);
  return NextResponse.json({ assets, movements, stats: assetStats(assets) });
}

export async function POST(req: NextRequest) {
  const guard = await ctx();
  if (!guard.ok) return guard.response;
  const user = guard.user;

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  try {
    if (body?.kind === "ASSET") {
      const asset = await addAsset(user.schoolId, body);
      await prisma.auditLog
        .create({
          data: {
            schoolId: user.schoolId,
            actorUserId: user.id,
            action: "INVENTORY_ASSET_ADDED",
            entityType: "Asset",
            entityId: asset.id,
            ipAddress: getClientIp(req),
            metadata: { name: asset.data.name },
          },
        })
        .catch(() => {});
      return NextResponse.json({ asset }, { status: 201 });
    }
    if (body?.kind === "MOVEMENT") {
      const mv = await addMovement(user.schoolId, { ...body, actorName: user.name });
      if (body.assetId && body.action) {
        const condition =
          body.action === "DISPOSE" ? "DISPOSED" : body.action === "REPAIR" ? "DAMAGED" : undefined;
        if (condition)
          await updateAsset(user.schoolId, body.assetId, { condition }).catch(() => {});
      }
      return NextResponse.json({ movement: mv }, { status: 201 });
    }
    return NextResponse.json({ error: "Unknown kind." }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? "Invalid data." }, { status: 400 });
  }
}
