import {
  AlertChannel,
  AlertDeliveryStatus,
  NotificationKind,
  ReportCardStatus,
  UserRole,
} from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getClientIp } from "@/lib/requests";
import { requireRole } from "@/lib/session";

export const dynamic = "force-dynamic";

const allowedRoles = [UserRole.ADMIN, UserRole.DIRECTOR, UserRole.COORDINATOR];
const schema = z.object({ classId: z.string().trim().min(1).optional() });

/**
 * POST /api/admin/report-cards/release
 * Release every DRAFT report card at once (optionally scoped to one class).
 * Notification/audit rows are persisted in the same transaction as the release
 * so a successful release always has a retryable paper trail.
 */
export async function POST(request: NextRequest) {
  const user = await requireRole(allowedRoles);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let payload: z.infer<typeof schema>;
  try {
    payload = schema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const where = {
    schoolId: user.schoolId,
    status: ReportCardStatus.DRAFT,
    ...(payload.classId ? { studentProfile: { currentClassId: payload.classId } } : {}),
  };

  const ipAddress = getClientIp(request);
  const result = await prisma.$transaction(async (tx) => {
    const drafts = await tx.reportCard.findMany({
      where,
      select: {
        id: true,
        reportNumber: true,
        termLabel: true,
        sessionLabel: true,
        overallAverage: true,
        overallGrade: true,
        studentProfile: {
          select: {
            displayName: true,
            guardianName: true,
            guardianEmail: true,
            userId: true,
            parentLinks: {
              where: { isPrimary: true },
              take: 1,
              select: { parentProfile: { select: { userId: true, displayName: true } } },
            },
          },
        },
      },
    });

    if (!drafts.length) return { count: 0 };

    const release = await tx.reportCard.updateMany({
      where: {
        schoolId: user.schoolId,
        id: { in: drafts.map((d) => d.id) },
        status: ReportCardStatus.DRAFT,
      },
      data: { status: ReportCardStatus.RELEASED, releasedAt: new Date() },
    });

    for (const d of drafts) {
      const msg = `The ${d.termLabel} (${d.sessionLabel}) report card for ${
        d.studentProfile.displayName || "your child"
      } has been released. Overall: ${d.overallAverage}% (${d.overallGrade}).`;
      const parentUserId = d.studentProfile.parentLinks[0]?.parentProfile?.userId;
      const prefs = parentUserId
        ? await tx.notificationPreference.findUnique({
            where: { userId: parentUserId },
            select: { results: true },
          })
        : null;
      const deliverEmail = !parentUserId || (prefs?.results ?? true);

      if (d.studentProfile.guardianEmail && deliverEmail) {
        await tx.notificationJob.upsert({
          where: { dedupeKey: `report:${d.id}:email` },
          update: {},
          create: {
            schoolId: user.schoolId,
            kind: NotificationKind.REPORT_RELEASED,
            channel: AlertChannel.EMAIL,
            status: AlertDeliveryStatus.PENDING,
            subject: "Report card released — Ykay College",
            body: msg,
            recipientName: d.studentProfile.guardianName,
            recipientEmail: d.studentProfile.guardianEmail,
            dedupeKey: `report:${d.id}:email`,
            metadata: { reportCardId: d.id, reportNumber: d.reportNumber },
          },
        });
      }
      if (parentUserId) {
        await tx.userNotification.create({
          data: {
            schoolId: user.schoolId,
            userId: parentUserId,
            kind: NotificationKind.REPORT_RELEASED,
            title: "Report Card Released",
            body: msg,
            link: "/parent/report-cards",
          },
        });
      }
      if (d.studentProfile.userId) {
        await tx.userNotification.create({
          data: {
            schoolId: user.schoolId,
            userId: d.studentProfile.userId,
            kind: NotificationKind.REPORT_RELEASED,
            title: "Your Report Card Is Ready",
            body: `Your ${d.termLabel} report card has been released. Overall: ${d.overallAverage}% (${d.overallGrade}).`,
            link: "/student/report-cards",
          },
        });
      }
    }

    await tx.auditLog.create({
      data: {
        schoolId: user.schoolId,
        actorUserId: user.id,
        action: "REPORT_CARDS_BATCH_RELEASED",
        entityType: "ReportCard",
        entityId: payload.classId || "all",
        ipAddress,
        metadata: { count: release.count, classId: payload.classId || null } as never,
      },
    });

    return { count: release.count };
  });

  if (!result.count) {
    return NextResponse.json({ released: 0, message: "No draft report cards to release." });
  }

  return NextResponse.json({
    released: result.count,
    message: `${result.count} report card(s) released. Parents and students have been queued/notified.`,
  });
}
