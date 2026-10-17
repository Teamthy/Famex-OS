import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/session";
import { UserRole } from "@prisma/client";
import { addAlert, clinicStats, listAlerts, listVisits, recordVisit } from "@/lib/clinic";
import { getClientIp } from "@/lib/requests";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function ctx() {
  return requireRole([UserRole.ADMIN, UserRole.DIRECTOR, UserRole.COORDINATOR, UserRole.TEACHER]);
}

export async function GET() {
  const user = await ctx();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const [visits, alerts] = await Promise.all([listVisits(user.schoolId), listAlerts(user.schoolId)]);
  return NextResponse.json({ visits, alerts, stats: clinicStats(visits) });
}

export async function POST(req: NextRequest) {
  const user = await ctx();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: any;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON." }, { status: 400 }); }

  try {
    if (body?.kind === "VISIT") {
      const visit = await recordVisit(user.schoolId, body);
      await prisma.auditLog.create({
        data: {
          schoolId: user.schoolId, actorUserId: user.id,
          action: "CLINIC_VISIT_RECORDED", entityType: "ClinicVisit", entityId: visit.id,
          ipAddress: getClientIp(req),
          metadata: { personName: visit.data.personName, referredOut: visit.data.referredOut },
        },
      }).catch(() => {});
      return NextResponse.json({ visit }, { status: 201 });
    }
    if (body?.kind === "ALERT") {
      const alert = await addAlert(user.schoolId, body);
      await prisma.auditLog.create({
        data: {
          schoolId: user.schoolId, actorUserId: user.id,
          action: "CLINIC_ALERT_ADDED", entityType: "MedicalAlert", entityId: alert.id,
          ipAddress: getClientIp(req),
          metadata: { personName: alert.data.personName, condition: alert.data.condition },
        },
      }).catch(() => {});
      return NextResponse.json({ alert }, { status: 201 });
    }
    return NextResponse.json({ error: "Unknown kind." }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? "Invalid data." }, { status: 400 });
  }
}
