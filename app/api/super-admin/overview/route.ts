import { AlertDeliveryStatus, FeePaymentStatus, UserRole } from "@prisma/client";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await requireRole([UserRole.SUPER_ADMIN]);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const [
    usersByRole,
    activeUsers,
    suspendedUsers,
    loginsToday,
    loginsWeek,
    auditToday,
    failedNotifications,
    pendingNotifications,
    applications,
    itEnrollments,
    examAttempts,
    reportCards,
    recentErrors,
    latestLogins,
    feePayments,
    feeInvoices,
    expenses,
    recentPayments,
    recentAudit,
  ] = await Promise.all([
    prisma.user.groupBy({ by: ["role"], _count: true }),
    prisma.user.count({ where: { isActive: true, isSuspended: false } }),
    prisma.user.count({ where: { isSuspended: true } }),
    prisma.auditLog.count({ where: { action: "USER_SIGNED_IN", createdAt: { gte: dayAgo } } }),
    prisma.auditLog.count({ where: { action: "USER_SIGNED_IN", createdAt: { gte: weekAgo } } }),
    prisma.auditLog.count({ where: { createdAt: { gte: dayAgo } } }),
    prisma.notificationJob.count({ where: { status: AlertDeliveryStatus.FAILED } }),
    prisma.notificationJob.count({ where: { status: AlertDeliveryStatus.PENDING } }),
    prisma.admissionApplication.count(),
    prisma.itEnrollment.count(),
    prisma.examAttempt.count(),
    prisma.reportCard.count(),
    prisma.notificationJob.findMany({
      where: { status: AlertDeliveryStatus.FAILED },
      orderBy: { updatedAt: "desc" },
      take: 5,
      select: {
        id: true,
        channel: true,
        subject: true,
        lastError: true,
        attempts: true,
        updatedAt: true,
      },
    }),
    prisma.auditLog.findMany({
      where: { action: "USER_SIGNED_IN" },
      orderBy: { createdAt: "desc" },
      take: 8,
      include: { actor: { select: { name: true, email: true, role: true } } },
    }),
    prisma.feePayment.findMany({
      take: 200,
      where: { status: FeePaymentStatus.COMPLETED },
      select: { amount: true, paidAt: true },
    }),
    prisma.feeInvoice.findMany({
      take: 200,
      select: { totalAmount: true, amountPaid: true, balanceDue: true, status: true },
    }),
    prisma.expense.findMany({ take: 200, select: { amount: true } }).catch(() => []),
    prisma.feePayment.findMany({
      where: { status: FeePaymentStatus.COMPLETED },
      orderBy: { paidAt: "desc" },
      take: 12,
      include: {
        studentProfile: { select: { displayName: true, studentId: true } },
      },
    }),
    prisma.auditLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 25,
      include: { actor: { select: { name: true, email: true, role: true } } },
    }),
  ]);

  const incomeTotal = feePayments.reduce((s, p) => s + p.amount, 0);
  const incomeToday = feePayments
    .filter((p) => p.paidAt >= dayAgo)
    .reduce((s, p) => s + p.amount, 0);
  const incomeWeek = feePayments
    .filter((p) => p.paidAt >= weekAgo)
    .reduce((s, p) => s + p.amount, 0);
  const expenseTotal = (expenses as Array<{ amount: number }>).reduce((s, e) => s + e.amount, 0);
  const billed = feeInvoices.reduce((s, i) => s + i.totalAmount, 0);
  const outstanding = feeInvoices.reduce((s, i) => s + i.balanceDue, 0);

  return NextResponse.json({
    platform: {
      usersByRole: usersByRole.map((row) => ({ role: row.role, count: row._count })),
      activeUsers,
      suspendedUsers,
      loginsToday,
      loginsWeek,
      auditEventsToday: auditToday,
      applications,
      itEnrollments,
      examAttempts,
      reportCards,
    },
    finance: {
      incomeTotal,
      incomeToday,
      incomeWeek,
      expenseTotal,
      netPosition: incomeTotal - expenseTotal,
      billed,
      outstanding,
      collectionRate: billed ? Math.round(((billed - outstanding) / billed) * 100) : 0,
      recentPayments: recentPayments.map((p) => ({
        id: p.id,
        amount: p.amount,
        method: p.method,
        reference: p.reference,
        receiptNumber: p.receiptNumber,
        paidAt: p.paidAt.toISOString(),
        student: p.studentProfile.displayName,
        studentId: p.studentProfile.studentId,
      })),
    },
    health: {
      failedNotifications,
      pendingNotifications,
      recentFailures: recentErrors.map((job) => ({
        id: job.id,
        channel: job.channel,
        subject: job.subject,
        lastError: job.lastError,
        attempts: job.attempts,
        at: job.updatedAt.toISOString(),
      })),
    },
    latestLogins: latestLogins.map((entry) => ({
      name: entry.actor?.name || "Unknown",
      email: entry.actor?.email || "—",
      role: entry.actor?.role || "—",
      ip: entry.ipAddress,
      at: entry.createdAt.toISOString(),
    })),
    recentAudit: recentAudit.map((entry) => ({
      id: entry.id,
      action: entry.action,
      entityType: entry.entityType,
      entityId: entry.entityId,
      actor: entry.actor?.email || "system",
      role: entry.actor?.role || "—",
      ip: entry.ipAddress,
      at: entry.createdAt.toISOString(),
    })),
  });
}
