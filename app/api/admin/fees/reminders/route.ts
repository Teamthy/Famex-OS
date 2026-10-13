import { AlertChannel, FeeInvoiceStatus, NotificationKind } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAdminFinanceContext } from "@/lib/finance";
import { createInAppNotification, queueNotificationJob } from "@/lib/notifications";
import { prisma } from "@/lib/prisma";
import { getClientIp } from "@/lib/requests";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({
  invoiceIds: z.array(z.string().min(1)).max(200).optional(),
  onlyOverdue: z.boolean().optional(),
  channel: z.enum(["EMAIL", "IN_APP"]).default("EMAIL"),
});

export async function POST(request: NextRequest) {
  const context = await getAdminFinanceContext();
  if (!context) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let input: z.infer<typeof schema>;
  try {
    input = schema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: "Invalid reminder request." }, { status: 400 });
  }

  const statuses: FeeInvoiceStatus[] = input.onlyOverdue
    ? [FeeInvoiceStatus.OVERDUE]
    : [FeeInvoiceStatus.UNPAID, FeeInvoiceStatus.PARTIAL, FeeInvoiceStatus.OVERDUE];

  const invoices = await prisma.feeInvoice.findMany({
    where: {
      schoolId: context.user.schoolId,
      balanceDue: { gt: 0 },
      status: { in: statuses },
      ...(input.invoiceIds?.length ? { id: { in: input.invoiceIds } } : {}),
    },
    include: {
      studentProfile: {
        select: { displayName: true, studentId: true, guardianEmail: true, guardianName: true },
      },
      parentProfile: {
        select: {
          displayName: true,
          phone: true,
          userId: true,
          user: { select: { email: true } },
        },
      },
    },
    take: 200,
  });

  let queued = 0;
  let inApp = 0;
  const day = new Date().toISOString().slice(0, 10);

  for (const invoice of invoices) {
    const parentName =
      invoice.parentProfile?.displayName ||
      invoice.studentProfile.guardianName ||
      "Parent/Guardian";
    const email = invoice.parentProfile?.user.email || invoice.studentProfile.guardianEmail || null;
    const amount = invoice.balanceDue;
    const subject = `Fee reminder — ${invoice.studentProfile.displayName} (${invoice.termLabel})`;
    const body =
      `This is a reminder that ${invoice.studentProfile.displayName} (${invoice.studentProfile.studentId}) ` +
      `has an outstanding balance of ₦${amount.toLocaleString()} on invoice ${invoice.invoiceNumber} ` +
      `(${invoice.title}, ${invoice.termLabel}).\n\n` +
      `Please pay via the parent portal or contact the bursary office.\n` +
      `Ykay College & Leadership Academy`;

    if (input.channel === "EMAIL" && email) {
      await queueNotificationJob({
        schoolId: context.user.schoolId,
        kind: NotificationKind.FEE_REMINDER,
        channel: AlertChannel.EMAIL,
        subject,
        body,
        recipientName: parentName,
        recipientEmail: email,
        recipientPhone: invoice.parentProfile?.phone || null,
        // Honour the parent's "Fees" preference on email too, not just push.
        recipientUserId: invoice.parentProfile?.userId ?? null,
        dedupeKey: `fee-rem:${invoice.id}:${day}:email`,
        metadata: { invoiceId: invoice.id, amount },
      });
      queued += 1;
    }

    if (invoice.parentProfile?.userId) {
      await createInAppNotification({
        schoolId: context.user.schoolId,
        userId: invoice.parentProfile.userId,
        kind: NotificationKind.FEE_REMINDER,
        title: "School fee reminder",
        body: `${invoice.studentProfile.displayName} has ₦${amount.toLocaleString()} outstanding (${invoice.invoiceNumber}).`,
        link: "/parent/fees",
      });
      inApp += 1;
    }
  }

  await prisma.auditLog.create({
    data: {
      schoolId: context.user.schoolId,
      actorUserId: context.user.id,
      action: "FEE_REMINDERS_QUEUED",
      entityType: "FeeInvoice",
      ipAddress: getClientIp(request),
      metadata: {
        invoiceCount: invoices.length,
        emailJobs: queued,
        inApp,
        onlyOverdue: Boolean(input.onlyOverdue),
      },
    },
  });

  return NextResponse.json({
    ok: true,
    matched: invoices.length,
    emailJobsQueued: queued,
    inAppNotifications: inApp,
    message:
      invoices.length === 0
        ? "No outstanding invoices matched."
        : `Queued reminders for ${invoices.length} invoice(s).`,
  });
}
