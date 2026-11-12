import { AlertDeliveryStatus, UserRole } from "@prisma/client";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/session";

export const dynamic = "force-dynamic";

/**
 * F0-27 single-school DevOps overview. Every database read is scoped to the
 * configured Famex school; response data is operational metadata and counts,
 * never student, parent, staff, or message contents.
 */
export async function GET() {
  const user = await requireRole([UserRole.SUPER_ADMIN]);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const school = await prisma.school.findUnique({
    where: { id: user.schoolId },
    select: { name: true, status: true },
  });
  if (!school) return NextResponse.json({ error: "School not found." }, { status: 404 });

  const now = new Date();
  const [activeUsers, failedNotifications, dueNotifications, failedJobs] = await Promise.all([
    prisma.user.count({
      where: { schoolId: user.schoolId, isActive: true, isSuspended: false },
    }),
    prisma.notificationJob.count({
      where: { schoolId: user.schoolId, status: AlertDeliveryStatus.FAILED },
    }),
    prisma.notificationJob.count({
      where: {
        schoolId: user.schoolId,
        status: AlertDeliveryStatus.PENDING,
        nextAttemptAt: { lte: now },
      },
    }),
    prisma.notificationJob.findMany({
      where: { schoolId: user.schoolId, status: AlertDeliveryStatus.FAILED },
      orderBy: { createdAt: "desc" },
      take: 10,
      select: {
        id: true,
        kind: true,
        channel: true,
        attempts: true,
        maxAttempts: true,
        createdAt: true,
      },
    }),
  ]);

  return NextResponse.json({
    generatedAt: now.toISOString(),
    school: { name: school.name, status: school.status },
    deployment: {
      environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? "unknown",
      commit: process.env.VERCEL_GIT_COMMIT_SHA ?? "unknown",
      region: process.env.VERCEL_REGION ?? "unknown",
      uptimeSeconds: Math.floor(process.uptime()),
    },
    overview: { activeUsers, failedNotifications, dueNotifications },
    failedJobs: failedJobs.map((job) => ({ ...job, createdAt: job.createdAt.toISOString() })),
  });
}
