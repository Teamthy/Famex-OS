import { AlertDeliveryStatus, UserRole } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getClientIp } from "@/lib/requests";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/session";

export const dynamic = "force-dynamic";

const schema = z.object({
  reason: z.enum(["PROVIDER_RECOVERED", "CONFIGURATION_FIXED", "MANUAL_REVIEW"]),
});

/**
 * Retry one failed notification for the one configured Famex school.
 * The failed→pending transition is conditional and audited in one transaction;
 * repeating or racing a click cannot enqueue a second retry.
 */
export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const user = await requireRole([UserRole.SUPER_ADMIN]);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: z.infer<typeof schema>;
  try {
    body = schema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: "Choose a valid retry reason." }, { status: 400 });
  }

  const { id } = await context.params;
  const result = await prisma.$transaction(async (tx) => {
    const job = await tx.notificationJob.findFirst({
      where: { id, schoolId: user.schoolId },
      select: {
        id: true,
        status: true,
        attempts: true,
        maxAttempts: true,
        updatedAt: true,
      },
    });
    if (!job) return { kind: "NOT_FOUND" as const };
    if (job.status !== AlertDeliveryStatus.FAILED) return { kind: "NOT_FAILED" as const };

    const updated = await tx.notificationJob.updateMany({
      where: {
        id: job.id,
        schoolId: user.schoolId,
        status: AlertDeliveryStatus.FAILED,
        updatedAt: job.updatedAt,
      },
      data: {
        status: AlertDeliveryStatus.PENDING,
        nextAttemptAt: new Date(),
        maxAttempts: Math.max(job.maxAttempts, job.attempts + 1),
        lastError: null,
      },
    });
    if (updated.count !== 1) return { kind: "RACE_LOST" as const };

    await tx.auditLog.create({
      data: {
        schoolId: user.schoolId,
        actorUserId: user.id,
        action: "SUPER_ADMIN_NOTIFICATION_RETRY_REQUESTED",
        entityType: "NotificationJob",
        entityId: job.id,
        ipAddress: getClientIp(request),
        metadata: {
          reason: body.reason,
          previousAttempts: job.attempts,
          previousMaxAttempts: job.maxAttempts,
        },
      },
    });
    return { kind: "REQUEUED" as const };
  });

  if (result.kind === "NOT_FOUND") {
    return NextResponse.json(
      { error: "Notification not found in this Famex school." },
      { status: 404 },
    );
  }
  if (result.kind !== "REQUEUED") {
    return NextResponse.json(
      { error: "This notification is no longer failed; refresh the dashboard before retrying." },
      { status: 409 },
    );
  }
  return NextResponse.json({
    ok: true,
    message: "Notification queued for one further delivery attempt.",
  });
}
