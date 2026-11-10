import {
  FeeInvoiceStatus,
  FeePaymentMethod,
  FeePaymentStatus,
  FeeRefundStatus,
  PaymentStatus,
  Prisma,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { computeInvoiceStatus, generateUniqueReceiptNumber } from "@/lib/finance";
import { postPaymentReceipt, postFeeRefund } from "@/lib/ledger-postings";

/**
 * Atomically post a completed school-fee payment — and (B-04) bind every
 * replay to the attempt and document it was meant for.
 *
 * The audit's P0, in one sentence: this function used to find an existing
 * payment by `reference` alone and return it as a replay before validating
 * anything, so a duplicate or conflicting reference could be reported as
 * success for the wrong school, invoice, student, amount or method. The
 * state machine below fixes that and the two related holes (an already-PAID
 * attempt being rebound to a different payment, and concurrent webhook +
 * browser verify both posting):
 *
 *   1. RESOLVE AND LOCK THE ATTEMPT FIRST. A PAID attempt can only ever
 *      return the payment posted against its own reference, and only if
 *      every immutable field matches; FAILED/ABANDONED attempts never post.
 *   2. COMPARE EVERY IMMUTABLE FIELD on a reference hit. Exact match →
 *      replay (success, idempotent). Any difference → `conflict`, never
 *      success — the caller answers 409 and the attempt stays untouched.
 *   3. TRANSITION ATTEMPT AND PAYMENT ATOMICALLY. The attempt moves
 *      PENDING → PAID with a guarded `updateMany` inside the same
 *      transaction as the payment, the invoice draw-down and the ledger
 *      journal, so two concurrent completions of one attempt cannot both
 *      commit: the loser's guard count is 0 and its whole posting rolls
 *      back. A payment that is not in the ledger does not exist, and a
 *      posting that fails rolls the payment back with it (Rule 10).
 *
 * Offline entries (fee-guard) are untouched by this path: they stay
 * PENDING_REVIEW until `completeOfflineReviewPayment` settles them.
 */
export type FeePaymentPostResult =
  | { outcome: "posted"; payment: FeePaymentShape; creditExcessNaira: number }
  | { outcome: "replay"; payment: FeePaymentShape; creditExcessNaira: number }
  | {
      outcome: "conflict";
      code:
        | "REFERENCE_BOUND_ELSEWHERE"
        | "ATTEMPT_ALREADY_PAID"
        | "ATTEMPT_NOT_POSTABLE"
        | "ATTEMPT_FIELD_MISMATCH";
      detail: string;
      existingPaymentId?: string;
    };

/** The fields a replay must match exactly, or it is a conflict. */
type Binding = {
  schoolId: string;
  invoiceId: string;
  studentProfileId: string;
  amount: number;
  method: FeePaymentMethod;
};

type FeePaymentShape = {
  id: string;
  schoolId: string;
  invoiceId: string;
  studentProfileId: string;
  parentProfileId: string | null;
  amount: number;
  method: FeePaymentMethod;
  status: FeePaymentStatus;
  reference: string;
  receiptNumber: string;
  paidAt: Date;
};

function bindingsMatch(payment: Binding, input: Binding): boolean {
  return (
    payment.schoolId === input.schoolId &&
    payment.invoiceId === input.invoiceId &&
    payment.studentProfileId === input.studentProfileId &&
    payment.amount === input.amount &&
    payment.method === input.method
  );
}

export async function postCompletedFeePayment(input: {
  attemptId?: string;
  schoolId: string;
  invoiceId: string;
  studentProfileId: string;
  parentProfileId?: string | null;
  amount: number;
  method: FeePaymentMethod;
  reference: string;
  providerData?: Prisma.InputJsonValue;
  actorUserId?: string | null;
  /**
   * Deliberate overpayment (F5-11): the bursar chose "pay extra / carry
   * forward". The excess becomes a FeeCredit (liability, 2000). Online
   * payments never set this — the parent intent route caps the amount at
   * balanceDue, so an online excess cannot be invented by a client.
   */
  allowExcessAsCredit?: boolean;
}): Promise<FeePaymentPostResult> {
  if (!Number.isInteger(input.amount) || input.amount <= 0) {
    throw new Error("Payment amount must be a positive integer (kobo/naira units as stored).");
  }
  const binding: Binding = {
    schoolId: input.schoolId,
    invoiceId: input.invoiceId,
    studentProfileId: input.studentProfileId,
    amount: input.amount,
    method: input.method,
  };

  return prisma.$transaction(async (tx) => {
    // ── 1. Resolve and lock the server-created attempt FIRST ──
    if (input.attemptId) {
      const attempt = await tx.feePaymentAttempt.findFirst({
        where: { id: input.attemptId, schoolId: input.schoolId },
      });
      if (!attempt) {
        throw new Error("The payment attempt could not be found for this school.");
      }
      // The attempt's own immutable fields are part of the binding: a caller
      // that re-points an attempt at another invoice/student/amount is a
      // conflict, not a payment.
      if (
        attempt.invoiceId !== input.invoiceId ||
        attempt.studentProfileId !== input.studentProfileId ||
        attempt.amount !== input.amount
      ) {
        return conflict(tx, input, "ATTEMPT_FIELD_MISMATCH", attempt.id);
      }
      if (attempt.status === PaymentStatus.PAID) {
        const paid = await tx.feePayment.findUnique({
          where: { reference: attempt.reference },
        });
        if (paid && bindingsMatch(paid, binding) && paid.reference === input.reference) {
          return { outcome: "replay" as const, payment: paid, creditExcessNaira: 0 };
        }
        return conflict(tx, input, "ATTEMPT_ALREADY_PAID", attempt.id, paid?.id);
      }
      if (attempt.status !== PaymentStatus.PENDING) {
        // FAILED / ABANDONED: money that the provider definitively refused,
        // or an attempt the school abandoned, must never post from a replay.
        return conflict(tx, input, "ATTEMPT_NOT_POSTABLE", attempt.id);
      }
    }

    // ── 2. A reference hit is a replay ONLY on an exact binding match ──
    const existing = await tx.feePayment.findUnique({ where: { reference: input.reference } });
    if (existing) {
      if (!bindingsMatch(existing, binding)) {
        return conflict(tx, input, "REFERENCE_BOUND_ELSEWHERE", input.attemptId, existing.id);
      }
      // True replay: settle the attempt too (guarded; already-PAID is fine
      // because that is exactly the state this replay represents).
      if (input.attemptId) {
        const moved = await tx.feePaymentAttempt.updateMany({
          where: { id: input.attemptId, status: PaymentStatus.PENDING },
          data: { status: PaymentStatus.PAID, providerData: input.providerData },
        });
        if (moved.count > 1) throw new Error("Attempt transition matched multiple rows.");
      }
      return { outcome: "replay" as const, payment: existing, creditExcessNaira: 0 };
    }

    // ── 3. Post: invoice draw-down, document, ledger, attempt — one tx ──
    // F5-11: only the part that settles the invoice touches the
    // receivable; a deliberate excess is held as a credit balance.
    let applied = input.amount;
    let creditExcess = 0;
    if (input.allowExcessAsCredit) {
      const current = await tx.feeInvoice.findFirst({
        where: { id: input.invoiceId, schoolId: input.schoolId },
        select: { balanceDue: true },
      });
      if (!current) {
        throw new Error("The invoice could not be found for this payment.");
      }
      applied = Math.min(input.amount, Math.max(current.balanceDue, 0));
      creditExcess = input.amount - applied;
      if (applied === 0 && creditExcess === input.amount) {
        throw new Error(
          "This invoice is already fully settled. The whole payment has been held for finance review.",
        );
      }
    }

    const reserved = await tx.feeInvoice.updateMany({
      where: {
        id: input.invoiceId,
        schoolId: input.schoolId,
        balanceDue: { gte: applied },
        status: {
          in: [FeeInvoiceStatus.UNPAID, FeeInvoiceStatus.PARTIAL, FeeInvoiceStatus.OVERDUE],
        },
      },
      data: {
        amountPaid: { increment: applied },
        balanceDue: { decrement: applied },
      },
    });

    if (reserved.count !== 1) {
      throw new Error(
        "The invoice balance changed before this payment could be posted. It has been held for finance review.",
      );
    }

    const invoice = await tx.feeInvoice.findUniqueOrThrow({ where: { id: input.invoiceId } });
    const status = computeInvoiceStatus(
      invoice.totalAmount,
      invoice.amountPaid,
      invoice.dueDate,
      (invoice.amountDiscounted ?? 0) + (invoice.amountCredited ?? 0),
    );
    await tx.feeInvoice.update({ where: { id: invoice.id }, data: { status } });

    const payment = await tx.feePayment.create({
      data: {
        schoolId: input.schoolId,
        invoiceId: input.invoiceId,
        studentProfileId: input.studentProfileId,
        parentProfileId: input.parentProfileId || null,
        amount: input.amount,
        method: input.method,
        status: FeePaymentStatus.COMPLETED,
        reference: input.reference,
        receiptNumber: await generateUniqueReceiptNumber(),
        providerData: input.providerData,
      },
    });

    // Rule 10: the document and its posting commit together — including
    // the credit document when part of the payment was an overpayment.
    await postPaymentReceipt(tx, {
      schoolId: input.schoolId,
      paymentId: payment.id,
      receiptNumber: payment.receiptNumber,
      reference: input.reference,
      amountNaira: input.amount,
      method: input.method,
      studentProfileId: input.studentProfileId,
      actorUserId: input.actorUserId ?? null,
      paidAt: payment.paidAt,
      creditNaira: creditExcess,
    });

    if (creditExcess > 0) {
      await tx.feeCredit.create({
        data: {
          schoolId: input.schoolId,
          studentProfileId: input.studentProfileId,
          parentProfileId: input.parentProfileId || null,
          amountNaira: creditExcess,
          amountRemainingNaira: creditExcess,
          sourcePaymentId: payment.id,
          createdByUserId: input.actorUserId || null,
        },
      });
    }

    if (input.attemptId) {
      // The guard that makes concurrent webhook + browser verify safe: the
      // attempt is still PENDING in this transaction's snapshot, and only
      // one committing transaction can win the PENDING → PAID move. The
      // loser rolls back its entire posting (payment, journal, draw-down).
      const moved = await tx.feePaymentAttempt.updateMany({
        where: { id: input.attemptId, status: PaymentStatus.PENDING },
        data: { status: PaymentStatus.PAID, providerData: input.providerData },
      });
      if (moved.count !== 1) {
        throw new Error(
          "This payment attempt was already settled by another request. The duplicate posting has been rolled back.",
        );
      }
    }

    await tx.auditLog.create({
      data: {
        schoolId: input.schoolId,
        actorUserId: input.actorUserId || null,
        action: "FEE_PAYMENT_POSTED",
        entityType: "FeePayment",
        entityId: payment.id,
        metadata: {
          reference: input.reference,
          amount: input.amount,
          invoiceId: input.invoiceId,
          method: input.method,
          creditExcessNaira: creditExcess,
          attemptId: input.attemptId ?? null,
          replay: false,
        },
      },
    });

    return { outcome: "posted" as const, payment, creditExcessNaira: creditExcess };
  });
}

type ConflictResult = Extract<FeePaymentPostResult, { outcome: "conflict" }>;

/** Record the conflict in the audit trail and return it to the caller. */
async function conflict(
  tx: Prisma.TransactionClient,
  input: { schoolId: string; reference: string; amount: number; invoiceId: string },
  code: ConflictResult["code"],
  attemptId?: string,
  existingPaymentId?: string,
): Promise<ConflictResult> {
  const detail = {
    REFERENCE_BOUND_ELSEWHERE:
      "This payment reference is already bound to a different invoice, student or amount. It has NOT been posted; finance must reconcile it.",
    ATTEMPT_ALREADY_PAID:
      "This payment attempt is already settled against a different document. It has NOT been posted again.",
    ATTEMPT_NOT_POSTABLE:
      "This payment attempt is failed or abandoned and can never post. Record the money through a new attempt.",
    ATTEMPT_FIELD_MISMATCH:
      "The payment attempt does not match the document it was posted for. It has NOT been posted.",
  }[code];
  await tx.auditLog.create({
    data: {
      schoolId: input.schoolId,
      actorUserId: null,
      action: "FEE_PAYMENT_REFERENCE_CONFLICT",
      entityType: "FeePaymentAttempt",
      entityId: attemptId ?? existingPaymentId ?? input.reference,
      metadata: { code, reference: input.reference, amount: input.amount, existingPaymentId },
    },
  });
  return { outcome: "conflict", code, detail, existingPaymentId };
}

/**
 * B-04: first-class completion of an offline (fee-guard) PENDING_REVIEW
 * payment. The release gate says offline entries stay unverified until a
 * bursar flips them; before this, nothing flipped them — the queue was a
 * dead end. Settling draws the invoice down and posts the receipt journal
 * in the same transaction, guarded so two bursars clicking approve settle
 * it once. A balance that moved underneath leaves the payment in
 * PENDING_REVIEW (throw → rollback) rather than half-settled.
 */
export async function completeOfflineReviewPayment(input: {
  paymentId: string;
  schoolId: string;
  actorUserId: string;
  note?: string | null;
}): Promise<FeePaymentPostResult> {
  return prisma.$transaction(async (tx) => {
    const payment = await tx.feePayment.findFirst({
      where: { id: input.paymentId, schoolId: input.schoolId },
    });
    if (!payment) throw new Error("The queued payment could not be found for this school.");
    if (payment.status === FeePaymentStatus.COMPLETED) {
      return { outcome: "replay" as const, payment, creditExcessNaira: 0 };
    }
    if (payment.status !== FeePaymentStatus.PENDING_REVIEW) {
      return {
        outcome: "conflict" as const,
        code: "ATTEMPT_NOT_POSTABLE" as const,
        detail: "This queued payment was already decided and cannot be approved again.",
        existingPaymentId: payment.id,
      };
    }

    const reserved = await tx.feeInvoice.updateMany({
      where: {
        id: payment.invoiceId,
        schoolId: input.schoolId,
        balanceDue: { gte: payment.amount },
        status: {
          in: [FeeInvoiceStatus.UNPAID, FeeInvoiceStatus.PARTIAL, FeeInvoiceStatus.OVERDUE],
        },
      },
      data: {
        amountPaid: { increment: payment.amount },
        balanceDue: { decrement: payment.amount },
      },
    });
    if (reserved.count !== 1) {
      throw new Error(
        "The invoice balance changed before this queued payment could be settled. It stays queued for review.",
      );
    }
    const invoice = await tx.feeInvoice.findUniqueOrThrow({ where: { id: payment.invoiceId } });
    const invoiceStatus = computeInvoiceStatus(
      invoice.totalAmount,
      invoice.amountPaid,
      invoice.dueDate,
      (invoice.amountDiscounted ?? 0) + (invoice.amountCredited ?? 0),
    );
    await tx.feeInvoice.update({ where: { id: invoice.id }, data: { status: invoiceStatus } });

    const settled = await tx.feePayment.updateMany({
      where: { id: payment.id, status: FeePaymentStatus.PENDING_REVIEW },
      data: { status: FeePaymentStatus.COMPLETED, paidAt: new Date() },
    });
    if (settled.count !== 1) {
      throw new Error("This queued payment was decided by another reviewer at the same time.");
    }

    await postPaymentReceipt(tx, {
      schoolId: input.schoolId,
      paymentId: payment.id,
      receiptNumber: payment.receiptNumber,
      reference: payment.reference,
      amountNaira: payment.amount,
      method: payment.method,
      studentProfileId: payment.studentProfileId,
      actorUserId: input.actorUserId,
      paidAt: new Date(),
      creditNaira: 0,
    });

    await tx.auditLog.create({
      data: {
        schoolId: input.schoolId,
        actorUserId: input.actorUserId,
        action: "OFFLINE_PAYMENT_REVIEW_APPROVED",
        entityType: "FeePayment",
        entityId: payment.id,
        metadata: {
          reference: payment.reference,
          amount: payment.amount,
          note: input.note ?? null,
        },
      },
    });
    return {
      outcome: "posted" as const,
      payment: { ...payment, status: FeePaymentStatus.COMPLETED },
      creditExcessNaira: 0,
    };
  });
}

/**
 * B-04: first-class rejection of a queued offline payment. The document is
 * never deleted (Rule 9) — it moves PENDING_REVIEW → FAILED with the
 * reviewer and reason on the audit trail, and no invoice or ledger effect
 * ever existed to reverse.
 */
export async function rejectOfflineReviewPayment(input: {
  paymentId: string;
  schoolId: string;
  actorUserId: string;
  note?: string | null;
}): Promise<{ outcome: "rejected" | "replay" | "conflict"; detail?: string }> {
  return prisma.$transaction(async (tx) => {
    const payment = await tx.feePayment.findFirst({
      where: { id: input.paymentId, schoolId: input.schoolId },
    });
    if (!payment) throw new Error("The queued payment could not be found for this school.");
    if (payment.status === FeePaymentStatus.FAILED) {
      return { outcome: "replay" as const };
    }
    if (payment.status !== FeePaymentStatus.PENDING_REVIEW) {
      return {
        outcome: "conflict" as const,
        detail: "This queued payment was already decided and cannot be rejected.",
      };
    }
    const moved = await tx.feePayment.updateMany({
      where: { id: payment.id, status: FeePaymentStatus.PENDING_REVIEW },
      data: { status: FeePaymentStatus.FAILED },
    });
    if (moved.count !== 1) {
      throw new Error("This queued payment was decided by another reviewer at the same time.");
    }
    await tx.auditLog.create({
      data: {
        schoolId: input.schoolId,
        actorUserId: input.actorUserId,
        action: "OFFLINE_PAYMENT_REVIEW_REJECTED",
        entityType: "FeePayment",
        entityId: payment.id,
        metadata: {
          reference: payment.reference,
          amount: payment.amount,
          note: input.note ?? null,
        },
      },
    });
    return { outcome: "rejected" as const };
  });
}

/**
 * B-04: provider-driven reversal (Paystack `refund.processed` /
 * `chargeback.success`). Previously the webhook ignored both events, so a
 * reversed charge stayed a COMPLETED receipt forever — concealed money.
 * A reversal posts its own FeeRefund document (Rule 10 source document,
 * requestedByUserId null = provider-initiated, migration
 * 20261110120000) and books the refund journal; the invoice is NOT
 * reopened (the F5-13 convention decideRefund and verify:ledger pin) and
 * the payment row is never deleted (Rule 9). Full reversals move the
 * payment to REFUNDED; partial ones stay COMPLETED with the refund
 * document and journal carrying the part returned.
 */
export async function postPaymentReversal(input: {
  reference: string;
  kind: "REFUND" | "CHARGEBACK";
  /** Whole naira reversed, as reported by the provider (kobo / 100). */
  amountNaira: number;
  /**
   * The provider's own event/record id (Rule 4 idempotency key). Unique on
   * FeeRefund, so a retried webhook — including a PARTIAL reversal, which
   * leaves the payment COMPLETED and cannot be deduplicated by status —
   * posts exactly one refund document, one restoration, one journal.
   */
  providerEventId?: string | null;
  providerData?: Prisma.InputJsonValue;
}): Promise<{
  outcome: "reversed" | "replay" | "conflict" | "unknown-reference";
  detail?: string;
}> {
  if (!Number.isInteger(input.amountNaira) || input.amountNaira <= 0) {
    throw new Error("Reversal amount must be a positive whole-naira integer.");
  }
  try {
    return await prisma.$transaction(async (tx) => {
      const payment = await tx.feePayment.findUnique({ where: { reference: input.reference } });
      if (!payment) return { outcome: "unknown-reference" as const };
      if (payment.status === FeePaymentStatus.REFUNDED) {
        return { outcome: "replay" as const };
      }
      if (payment.status !== FeePaymentStatus.COMPLETED) {
        return {
          outcome: "conflict" as const,
          detail: "Only a completed payment can be reversed by a provider event.",
        };
      }
      // Provider-event dedup: the same reversal delivered twice is a replay,
      // even when the first delivery only partially reversed the payment.
      if (input.providerEventId) {
        const seen = await tx.feeRefund.findFirst({
          where: { providerEventId: input.providerEventId },
          select: { id: true },
        });
        if (seen) return { outcome: "replay" as const };
      }
      const reversed = Math.min(input.amountNaira, payment.amount);
      const full = reversed >= payment.amount;

      const refund = await tx.feeRefund.create({
        data: {
          schoolId: payment.schoolId,
          paymentId: payment.id,
          invoiceId: payment.invoiceId,
          studentProfileId: payment.studentProfileId,
          amountNaira: reversed,
          reason:
            input.kind === "CHARGEBACK"
              ? `Provider chargeback against ${payment.reference}.`
              : `Provider refund processed against ${payment.reference}.`,
          status: FeeRefundStatus.APPROVED,
          requestedByUserId: null,
          approvedAt: new Date(),
          providerEventId: input.providerEventId ?? null,
        },
      });

      if (full) {
        const moved = await tx.feePayment.updateMany({
          where: { id: payment.id, status: FeePaymentStatus.COMPLETED },
          data: { status: FeePaymentStatus.REFUNDED, providerData: input.providerData },
        });
        if (moved.count !== 1) {
          throw new Error("This payment was reversed by another event at the same time.");
        }
      }

      // The invoice is deliberately NOT reopened — the exact F5-13 convention
      // decideRefund follows and verify:ledger pins: income nets through the
      // refunds account, and the receivable ledger keeps reconciling with the
      // documents to the kobo. A family that owes again after a chargeback is
      // a bursary decision (re-invoice/adjust), never a silent side effect of
      // a webhook.
      await postFeeRefund(tx, {
        schoolId: payment.schoolId,
        refundId: refund.id,
        paymentReference: payment.reference,
        receiptNumber: payment.receiptNumber,
        amountNaira: reversed,
        method: payment.method,
        studentProfileId: payment.studentProfileId,
        actorUserId: null,
      });

      await tx.auditLog.create({
        data: {
          schoolId: payment.schoolId,
          actorUserId: null,
          action: input.kind === "CHARGEBACK" ? "FEE_PAYMENT_CHARGED_BACK" : "FEE_PAYMENT_REFUNDED",
          entityType: "FeePayment",
          entityId: payment.id,
          metadata: {
            reference: payment.reference,
            reversedNaira: reversed,
            full,
            refundId: refund.id,
            kind: input.kind,
          },
        },
      });
      return { outcome: "reversed" as const };
    });
  } catch (error) {
    // Two concurrent deliveries of the same provider event: the unique
    // providerEventId index refuses the second refund document. That is a
    // replay, not a failure — the winner already reversed the money once.
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002" &&
      String(error.meta?.target ?? "").includes("providerEventId")
    ) {
      return { outcome: "replay" as const };
    }
    throw error;
  }
}
