import {
  FeeCreditStatus,
  FeeDiscountKind,
  FeeDiscountStatus,
  FeeInvoiceStatus,
  FeePaymentStatus,
  FeeRefundStatus,
} from "@prisma/client";
import { computeInvoiceStatus } from "@/lib/finance";
import { postFeeDiscount, postFeeRefund, postFeeTransfer } from "@/lib/ledger-postings";
import { prisma } from "@/lib/prisma";

/**
 * The stage-B money documents (F5-11…F5-14): discounts, refunds, credit
 * transfers between pupils.
 *
 * Rules that hold for every function here:
 * - Money moves only on APPROVAL. Requesting is bookkeeping; approving is
 *   the money event, and it posts through lib/ledger-postings.ts in the
 *   same transaction as the document change (Rule 10).
 * - Approver ≠ requester, enforced here, not just in the UI. Two-person
 *   integrity is the control that makes discounts safe to offer.
 * - A reason is mandatory and immutable — it is the audit trail a director
 *   reads a year later.
 * - Nothing is deleted. A refund is settled by a counter-movement, a
 *   rejected request simply never posts (Rule 9).
 */

export type AdjustmentActor = {
  userId: string;
  role: string;
};

const APPROVER_ROLES = new Set(["ADMIN", "DIRECTOR"]);

function assertIntegerNaira(value: number, label: string) {
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`${label} must be a positive whole-naira amount.`);
  }
}

function assertReason(reason: string) {
  const trimmed = reason.trim();
  if (trimmed.length < 4) {
    throw new Error("A reason of at least 4 characters is required — it is kept permanently.");
  }
  return trimmed;
}

// ── Discounts & scholarships (F5-12, F5-24 register) ────────────────────

export async function requestDiscount(input: {
  schoolId: string;
  invoiceId: string;
  kind: FeeDiscountKind;
  amountNaira: number;
  reason: string;
  actor: AdjustmentActor;
}) {
  assertIntegerNaira(input.amountNaira, "Discount amount");
  const reason = assertReason(input.reason);

  const invoice = await prisma.feeInvoice.findFirst({
    where: { id: input.invoiceId, schoolId: input.schoolId },
    select: {
      id: true,
      studentProfileId: true,
      status: true,
      balanceDue: true,
      invoiceNumber: true,
    },
  });
  if (!invoice) throw new Error("That invoice could not be found.");
  if (invoice.status === FeeInvoiceStatus.PAID) {
    throw new Error("That invoice is already closed, so it cannot be discounted.");
  }
  if (input.amountNaira > invoice.balanceDue) {
    throw new Error("A discount cannot exceed what the invoice still owes.");
  }

  const discount = await prisma.feeDiscount.create({
    data: {
      schoolId: input.schoolId,
      invoiceId: invoice.id,
      studentProfileId: invoice.studentProfileId,
      kind: input.kind,
      amountNaira: input.amountNaira,
      reason,
      requestedByUserId: input.actor.userId,
    },
  });

  await prisma.auditLog.create({
    data: {
      schoolId: input.schoolId,
      actorUserId: input.actor.userId,
      action: "FEE_DISCOUNT_REQUESTED",
      entityType: "FeeDiscount",
      entityId: discount.id,
      metadata: {
        invoiceId: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        kind: input.kind,
        amountNaira: input.amountNaira,
        reason,
      },
    },
  });
  return discount;
}

export async function decideDiscount(input: {
  schoolId: string;
  discountId: string;
  approve: boolean;
  actor: AdjustmentActor;
}) {
  if (input.approve && !APPROVER_ROLES.has(input.actor.role)) {
    throw new Error("Only an admin or director can approve a discount.");
  }

  return prisma.$transaction(async (tx) => {
    const discount = await tx.feeDiscount.findFirst({
      where: { id: input.discountId, schoolId: input.schoolId },
    });
    if (!discount) throw new Error("That discount request could not be found.");
    if (discount.status !== FeeDiscountStatus.PENDING) {
      throw new Error("That discount request has already been decided.");
    }
    if (input.approve && discount.requestedByUserId === input.actor.userId) {
      throw new Error(
        "You cannot approve your own discount request — a second person must decide.",
      );
    }

    if (!input.approve) {
      const rejected = await tx.feeDiscount.update({
        where: { id: discount.id },
        data: {
          status: FeeDiscountStatus.REJECTED,
          approvedByUserId: input.actor.userId,
          approvedAt: new Date(),
        },
      });
      await tx.auditLog.create({
        data: {
          schoolId: input.schoolId,
          actorUserId: input.actor.userId,
          action: "FEE_DISCOUNT_REJECTED",
          entityType: "FeeDiscount",
          entityId: discount.id,
          metadata: { amountNaira: discount.amountNaira, kind: discount.kind },
        },
      });
      return { discount: rejected, posted: false as const };
    }

    // Apply to the invoice first (optimistic guard on what is still owed),
    // then post. Either both commit or neither does.
    const reserved = await tx.feeInvoice.updateMany({
      where: {
        id: discount.invoiceId,
        schoolId: input.schoolId,
        balanceDue: { gte: discount.amountNaira },
        status: { not: FeeInvoiceStatus.PAID },
      },
      data: {
        amountDiscounted: { increment: discount.amountNaira },
        balanceDue: { decrement: discount.amountNaira },
      },
    });
    if (reserved.count !== 1) {
      throw new Error("The invoice balance changed before this discount could be applied.");
    }

    const invoice = await tx.feeInvoice.findUniqueOrThrow({ where: { id: discount.invoiceId } });
    await tx.feeInvoice.update({
      where: { id: invoice.id },
      data: {
        status: computeInvoiceStatus(
          invoice.totalAmount,
          invoice.amountPaid,
          invoice.dueDate,
          invoice.amountDiscounted + invoice.amountCredited,
        ),
      },
    });

    await postFeeDiscount(tx, {
      schoolId: input.schoolId,
      discountId: discount.id,
      invoiceNumber: invoice.invoiceNumber,
      kind: discount.kind,
      amountNaira: discount.amountNaira,
      studentProfileId: discount.studentProfileId,
      actorUserId: input.actor.userId,
    });

    const approved = await tx.feeDiscount.update({
      where: { id: discount.id },
      data: {
        status: FeeDiscountStatus.APPROVED,
        approvedByUserId: input.actor.userId,
        approvedAt: new Date(),
      },
    });

    await tx.auditLog.create({
      data: {
        schoolId: input.schoolId,
        actorUserId: input.actor.userId,
        action: "FEE_DISCOUNT_APPROVED",
        entityType: "FeeDiscount",
        entityId: discount.id,
        metadata: {
          invoiceId: invoice.id,
          amountNaira: discount.amountNaira,
          kind: discount.kind,
          requestedByUserId: discount.requestedByUserId,
        },
      },
    });
    return { discount: approved, posted: true as const };
  });
}

// ── Refunds (F5-13) ──────────────────────────────────────────────────────

export async function requestRefund(input: {
  schoolId: string;
  paymentId: string;
  amountNaira: number;
  reason: string;
  actor: AdjustmentActor;
}) {
  assertIntegerNaira(input.amountNaira, "Refund amount");
  const reason = assertReason(input.reason);

  const payment = await prisma.feePayment.findFirst({
    where: { id: input.paymentId, schoolId: input.schoolId },
    select: {
      id: true,
      status: true,
      amount: true,
      invoiceId: true,
      studentProfileId: true,
      reference: true,
    },
  });
  if (!payment) throw new Error("That payment could not be found.");
  if (payment.status !== FeePaymentStatus.COMPLETED) {
    throw new Error("Only a completed payment can be refunded.");
  }
  if (input.amountNaira > payment.amount) {
    throw new Error("A refund cannot exceed the payment it reverses.");
  }
  const pending = await prisma.feeRefund.findFirst({
    where: { schoolId: input.schoolId, paymentId: payment.id, status: FeeRefundStatus.PENDING },
    select: { id: true },
  });
  if (pending) throw new Error("A refund is already awaiting approval for this payment.");

  const refund = await prisma.feeRefund.create({
    data: {
      schoolId: input.schoolId,
      paymentId: payment.id,
      invoiceId: payment.invoiceId,
      studentProfileId: payment.studentProfileId,
      amountNaira: input.amountNaira,
      reason,
      requestedByUserId: input.actor.userId,
    },
  });

  await prisma.auditLog.create({
    data: {
      schoolId: input.schoolId,
      actorUserId: input.actor.userId,
      action: "FEE_REFUND_REQUESTED",
      entityType: "FeeRefund",
      entityId: refund.id,
      metadata: {
        paymentId: payment.id,
        reference: payment.reference,
        amountNaira: input.amountNaira,
        reason,
      },
    },
  });
  return refund;
}

export async function decideRefund(input: {
  schoolId: string;
  refundId: string;
  approve: boolean;
  actor: AdjustmentActor;
}) {
  if (input.approve && !APPROVER_ROLES.has(input.actor.role)) {
    throw new Error("Only an admin or director can approve a refund.");
  }

  return prisma.$transaction(async (tx) => {
    const refund = await tx.feeRefund.findFirst({
      where: { id: input.refundId, schoolId: input.schoolId },
    });
    if (!refund) throw new Error("That refund request could not be found.");
    if (refund.status !== FeeRefundStatus.PENDING) {
      throw new Error("That refund request has already been decided.");
    }
    if (input.approve && refund.requestedByUserId === input.actor.userId) {
      throw new Error("You cannot approve your own refund request — a second person must decide.");
    }

    if (!input.approve) {
      const rejected = await tx.feeRefund.update({
        where: { id: refund.id },
        data: {
          status: FeeRefundStatus.REJECTED,
          approvedByUserId: input.actor.userId,
          approvedAt: new Date(),
        },
      });
      await tx.auditLog.create({
        data: {
          schoolId: input.schoolId,
          actorUserId: input.actor.userId,
          action: "FEE_REFUND_REJECTED",
          entityType: "FeeRefund",
          entityId: refund.id,
          metadata: { amountNaira: refund.amountNaira },
        },
      });
      return { refund: rejected, posted: false as const };
    }

    const payment = await tx.feePayment.findFirst({
      where: { id: refund.paymentId, schoolId: input.schoolId },
    });
    if (!payment) throw new Error("The payment behind this refund could not be found.");
    // Optimistic settle: only a still-COMPLETED payment can be refunded, so
    // a double approval (or a chargeback elsewhere) loses the race loudly.
    const settled = await tx.feePayment.updateMany({
      where: { id: payment.id, schoolId: input.schoolId, status: FeePaymentStatus.COMPLETED },
      data: { status: FeePaymentStatus.REFUNDED },
    });
    if (settled.count !== 1) {
      throw new Error("That payment is no longer in a refundable state.");
    }

    await postFeeRefund(tx, {
      schoolId: input.schoolId,
      refundId: refund.id,
      paymentReference: payment.reference,
      receiptNumber: payment.receiptNumber,
      amountNaira: refund.amountNaira,
      method: payment.method,
      studentProfileId: refund.studentProfileId,
      actorUserId: input.actor.userId,
    });

    const approved = await tx.feeRefund.update({
      where: { id: refund.id },
      data: {
        status: FeeRefundStatus.APPROVED,
        approvedByUserId: input.actor.userId,
        approvedAt: new Date(),
      },
    });

    await tx.auditLog.create({
      data: {
        schoolId: input.schoolId,
        actorUserId: input.actor.userId,
        action: "FEE_REFUND_APPROVED",
        entityType: "FeeRefund",
        entityId: refund.id,
        metadata: {
          paymentId: payment.id,
          reference: payment.reference,
          amountNaira: refund.amountNaira,
          requestedByUserId: refund.requestedByUserId,
        },
      },
    });
    return { refund: approved, posted: true as const };
  });
}

// ── Transfers between pupils' invoices (F5-14) ──────────────────────────

export async function transferFeeCredit(input: {
  schoolId: string;
  /** Caller-generated id for this transfer attempt — the posting key. */
  transferId: string;
  fromInvoiceId: string;
  toInvoiceId: string;
  amountNaira: number;
  actor: AdjustmentActor;
}) {
  assertIntegerNaira(input.amountNaira, "Transfer amount");
  if (input.fromInvoiceId === input.toInvoiceId) {
    throw new Error("Choose two different invoices to transfer between.");
  }

  return prisma.$transaction(async (tx) => {
    const [from, to] = await Promise.all([
      tx.feeInvoice.findFirst({ where: { id: input.fromInvoiceId, schoolId: input.schoolId } }),
      tx.feeInvoice.findFirst({ where: { id: input.toInvoiceId, schoolId: input.schoolId } }),
    ]);
    if (!from || !to) throw new Error("Both invoices must exist in this school.");
    if (from.amountPaid < input.amountNaira) {
      throw new Error("The source invoice has not settled that much — only paid money can move.");
    }
    if (to.balanceDue < input.amountNaira) {
      throw new Error("The target invoice does not owe that much.");
    }
    if (to.status === FeeInvoiceStatus.PAID) {
      throw new Error("The target invoice is already closed.");
    }

    const fromNextPaid = from.amountPaid - input.amountNaira;
    const toNextCredited = to.amountCredited + input.amountNaira;

    await tx.feeInvoice.update({
      where: { id: from.id },
      data: {
        amountPaid: fromNextPaid,
        balanceDue: from.balanceDue + input.amountNaira,
        status: computeInvoiceStatus(
          from.totalAmount,
          fromNextPaid,
          from.dueDate,
          from.amountDiscounted + from.amountCredited,
        ),
      },
    });
    await tx.feeInvoice.update({
      where: { id: to.id },
      data: {
        amountCredited: toNextCredited,
        balanceDue: to.balanceDue - input.amountNaira,
        status: computeInvoiceStatus(
          to.totalAmount,
          to.amountPaid,
          to.dueDate,
          to.amountDiscounted + toNextCredited,
        ),
      },
    });

    // One journal, one key: the school's total receivable does not move —
    // only whose name the arrears sit under (both per-student lines move).
    await postFeeTransfer(tx, {
      schoolId: input.schoolId,
      transferId: input.transferId,
      amountNaira: input.amountNaira,
      fromStudentProfileId: from.studentProfileId,
      toStudentProfileId: to.studentProfileId,
      fromInvoiceNumber: from.invoiceNumber,
      toInvoiceNumber: to.invoiceNumber,
      actorUserId: input.actor.userId,
    });

    await tx.auditLog.create({
      data: {
        schoolId: input.schoolId,
        actorUserId: input.actor.userId,
        action: "FEE_CREDIT_TRANSFERRED",
        entityType: "FeeInvoice",
        entityId: to.id,
        metadata: {
          transferId: input.transferId,
          fromInvoiceId: from.id,
          toInvoiceId: to.id,
          amountNaira: input.amountNaira,
        },
      },
    });
    return { fromInvoiceId: from.id, toInvoiceId: to.id, amountNaira: input.amountNaira };
  });
}

/** Open credit balances for the ledger screen (F5-11 register). */
export async function listOpenCredits(schoolId: string, limit = 50) {
  return prisma.feeCredit.findMany({
    where: {
      schoolId,
      status: { in: [FeeCreditStatus.OPEN, FeeCreditStatus.PARTIALLY_APPLIED] },
      amountRemainingNaira: { gt: 0 },
    },
    orderBy: { createdAt: "asc" },
    take: limit,
    include: { studentProfile: { select: { displayName: true } } },
  });
}
