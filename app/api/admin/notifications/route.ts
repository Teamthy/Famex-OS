import { AlertDeliveryStatus, UserRole } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getClientIp } from "@/lib/requests";
import { requireRole } from "@/lib/session";

export const dynamic = "force-dynamic";

const ADMIN_ROLES = [UserRole.ADMIN, UserRole.DIRECTOR, UserRole.COORDINATOR];

export async function GET(request: NextRequest) {
  const user = await requireRole(ADMIN_ROLES);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const statusParam = request.nextUrl.searchParams.get("status");
  const statusFilter =
    statusParam && Object.values(AlertDeliveryStatus).includes(statusParam as AlertDeliveryStatus)
      ? (statusParam as AlertDeliveryStatus)
      : null;

  const [counts, jobs] = await Promise.all([
    prisma.notificationJob.groupBy({
      by: ["status"],
      where: { schoolId: user.schoolId },
      _count: true,
    }),
    prisma.notificationJob.findMany({
      where: { schoolId: user.schoolId, ...(statusFilter ? { status: statusFilter } : {}) },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
  ]);

  const byStatus = Object.fromEntries(counts.map((row) => [row.status, row._count]));

  const channelCounts = await prisma.notificationJob.groupBy({
    by: ["channel", "status"],
    where: { schoolId: user.schoolId },
    _count: true,
  });

  return NextResponse.json({
    summary: {
      pending: byStatus[AlertDeliveryStatus.PENDING] || 0,
      sent: byStatus[AlertDeliveryStatus.SENT] || 0,
      failed: byStatus[AlertDeliveryStatus.FAILED] || 0,
      skipped: byStatus[AlertDeliveryStatus.SKIPPED] || 0,
    },
    channels: channelCounts.map((row) => ({
      channel: row.channel,
      status: row.status,
      count: row._count,
    })),
    jobs: jobs.map((job) => ({
      id: job.id,
      kind: job.kind,
      channel: job.channel,
      status: job.status,
      recipientName: job.recipientName,
      recipientEmail: job.recipientEmail,
      recipientPhone: job.recipientPhone,
      subject: job.subject,
      body: job.body,
      attempts: job.attempts,
      maxAttempts: job.maxAttempts,
      lastError: job.lastError,
      nextAttemptAt: job.nextAttemptAt.toISOString(),
      sentAt: job.sentAt?.toISOString() || null,
      createdAt: job.createdAt.toISOString(),
    })),
  });
}

const patchSchema = z.object({
  jobId: z.string().trim().min(1),
  action: z.enum(["RETRY", "CANCEL"]),
});

export async function PATCH(request: NextRequest) {
  const user = await requireRole(ADMIN_ROLES);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let payload: z.infer<typeof patchSchema>;
  try {
    payload = patchSchema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const job = await prisma.notificationJob.findFirst({
    where: { id: payload.jobId, schoolId: user.schoolId },
  });
  if (!job) return NextResponse.json({ error: "Notification job not found." }, { status: 404 });

  if (payload.action === "RETRY") {
    if (job.status === AlertDeliveryStatus.SENT) {
      return NextResponse.json(
        { error: "This notification was already delivered." },
        { status: 409 },
      );
    }
    await prisma.notificationJob.update({
      where: { id: job.id },
      data: {
        status: AlertDeliveryStatus.PENDING,
        nextAttemptAt: new Date(),
        maxAttempts: Math.max(job.maxAttempts, job.attempts + 1),
        lastError: null,
      },
    });
  } else {
    if (job.status === AlertDeliveryStatus.SENT) {
      return NextResponse.json(
        { error: "Delivered notifications cannot be cancelled." },
        { status: 409 },
      );
    }
    await prisma.notificationJob.update({
      where: { id: job.id },
      data: { status: AlertDeliveryStatus.SKIPPED, lastError: "Cancelled by administrator." },
    });
  }

  await prisma.auditLog.create({
    data: {
      schoolId: user.schoolId,
      actorUserId: user.id,
      action:
        payload.action === "RETRY" ? "NOTIFICATION_RETRY_REQUESTED" : "NOTIFICATION_CANCELLED",
      entityType: "NotificationJob",
      entityId: job.id,
      ipAddress: getClientIp(request),
    },
  });

  return NextResponse.json({
    ok: true,
    message:
      payload.action === "RETRY"
        ? "Notification re-queued for delivery."
        : "Notification cancelled.",
  });
}
