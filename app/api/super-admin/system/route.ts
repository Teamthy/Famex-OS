import { UserRole } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { bridgeAttendanceAlerts, dispatchDueNotifications } from "@/lib/notifications";
import { prisma } from "@/lib/prisma";
import { getClientIp } from "@/lib/requests";
import { requireRole } from "@/lib/session";
import { readPublicSystemConfig, readSystemFlags, writeSystemFlags } from "@/lib/system-flags";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET() {
  const user = await requireRole([UserRole.SUPER_ADMIN]);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [pendingJobs, failedJobs, sentToday, school] = await Promise.all([
    prisma.notificationJob.count({ where: { status: "PENDING" } }),
    prisma.notificationJob.count({ where: { status: "FAILED" } }),
    prisma.notificationJob.count({
      where: { status: "SENT", sentAt: { gte: new Date(new Date().toDateString()) } },
    }),
    prisma.school.findFirst({ orderBy: { createdAt: "asc" } }),
  ]);

  return NextResponse.json({
    flags: await readSystemFlags(),
    config: readPublicSystemConfig(),
    school: school
      ? {
          id: school.id,
          name: school.name,
          slug: school.slug,
          email: school.email,
          phone: school.phone,
        }
      : null,
    notifications: { pendingJobs, failedJobs, sentToday },
  });
}

const patchSchema = z.object({
  action: z.enum(["SET_MAINTENANCE", "DISPATCH_NOTIFICATIONS"]),
  maintenanceMode: z.boolean().optional(),
  maintenanceMessage: z.string().trim().max(500).optional(),
});

export async function PATCH(request: NextRequest) {
  const user = await requireRole([UserRole.SUPER_ADMIN]);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let payload: z.infer<typeof patchSchema>;
  try {
    payload = patchSchema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  if (payload.action === "SET_MAINTENANCE") {
    const flags = await writeSystemFlags(
      {
        maintenanceMode: Boolean(payload.maintenanceMode),
        ...(payload.maintenanceMessage ? { maintenanceMessage: payload.maintenanceMessage } : {}),
      },
      user.id,
    );
    await prisma.auditLog.create({
      data: {
        schoolId: user.schoolId,
        actorUserId: user.id,
        action: "SUPER_ADMIN_SET_MAINTENANCE",
        entityType: "System",
        metadata: { maintenanceMode: flags.maintenanceMode },
        ipAddress: getClientIp(request),
      },
    });
    return NextResponse.json({ ok: true, flags });
  }

  if (payload.action === "DISPATCH_NOTIFICATIONS") {
    const bridge = await bridgeAttendanceAlerts();
    const result = await dispatchDueNotifications();
    await prisma.auditLog.create({
      data: {
        schoolId: user.schoolId,
        actorUserId: user.id,
        action: "SUPER_ADMIN_DISPATCH_NOTIFICATIONS",
        entityType: "NotificationJob",
        metadata: { bridge, result },
        ipAddress: getClientIp(request),
      },
    });
    return NextResponse.json({ ok: true, bridgedAttendanceAlerts: bridge.bridged, ...result });
  }

  return NextResponse.json({ error: "Unsupported action." }, { status: 400 });
}
