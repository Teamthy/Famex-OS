import { FeeInstalmentPlanStatus, FeeInvoiceStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { AdjustmentActor } from "@/lib/fee-adjustments";

/**
 * Instalment plans (F5-10, W3 close-out).
 *
 * ── The design decision (recorded in HANDOFF §9 before coding) ─────────────
 * A plan is a SCHEDULE of due fragments against ONE invoice. Fragments do
 * NOT bill separately and there is deliberately NO new ledger posting rule:
 * the invoice accrual already happened when the invoice was raised, and
 * payments keep settling the invoice through postCompletedFeePayment.
 * Fragment state (PAID / PARTIAL / OVERDUE / DUE) is therefore a pure
 * projection — the invoice's settled amount beyond the pre-plan baseline,
 * allocated to fragments in sequence order — so the schedule can never
 * disagree with the documents about how much has been paid.
 *
 * Rules:
 * - Fragments must sum EXACTLY to the invoice's balanceDue at creation. A
 *   plan that schedules ₦1 more or less than what is owed is a second,
 *   conflicting receivable — refuse it.
 * - One ACTIVE plan per invoice (enforced here; a partial unique index
 *   cannot be modelled in Prisma and would show up as schema drift).
 * - Plans are never deleted. Cancelling records who/why and frees the
 *   invoice for a replacement plan; the cancelled schedule stays as history.
 * - Amounts are whole naira, matching the invoice document.
 */

export const MIN_INSTALMENTS = 2;
export const MAX_INSTALMENTS = 12;

export type InstalmentFragmentInput = {
  dueDate: Date;
  amountNaira: number;
};

export type InstalmentFragmentState = "PAID" | "PARTIAL" | "OVERDUE" | "DUE";

export type InstalmentProjection = {
  sequence: number;
  dueDate: Date;
  amountNaira: number;
  allocatedNaira: number;
  outstandingNaira: number;
  state: InstalmentFragmentState;
};

function assertFragmentShape(fragments: InstalmentFragmentInput[]) {
  if (fragments.length < MIN_INSTALMENTS || fragments.length > MAX_INSTALMENTS) {
    throw new Error(
      `An instalment plan needs between ${MIN_INSTALMENTS} and ${MAX_INSTALMENTS} instalments.`,
    );
  }
  for (const fragment of fragments) {
    if (!Number.isInteger(fragment.amountNaira) || fragment.amountNaira <= 0) {
      throw new Error("Every instalment must be a positive whole-naira amount.");
    }
    if (Number.isNaN(fragment.dueDate.getTime())) {
      throw new Error("Every instalment needs a valid due date.");
    }
  }
  for (let i = 1; i < fragments.length; i += 1) {
    if (fragments[i].dueDate.getTime() <= fragments[i - 1].dueDate.getTime()) {
      throw new Error("Instalment due dates must be in increasing order.");
    }
  }
}

/**
 * Pure allocation: spread `settledSincePlanNaira` across the fragments in
 * sequence order and label each one. `now` is injected so tests are exact.
 */
export function allocateInstalments(
  fragments: { sequence: number; dueDate: Date; amountNaira: number }[],
  settledSincePlanNaira: number,
  now: Date = new Date(),
): InstalmentProjection[] {
  let remaining = Math.max(0, settledSincePlanNaira);
  const ordered = [...fragments].sort((a, b) => a.sequence - b.sequence);
  return ordered.map((fragment) => {
    const allocated = Math.min(remaining, fragment.amountNaira);
    remaining -= allocated;
    const outstanding = fragment.amountNaira - allocated;
    const state: InstalmentFragmentState =
      outstanding === 0
        ? "PAID"
        : allocated > 0
          ? "PARTIAL"
          : fragment.dueDate.getTime() < now.getTime()
            ? "OVERDUE"
            : "DUE";
    return {
      sequence: fragment.sequence,
      dueDate: fragment.dueDate,
      amountNaira: fragment.amountNaira,
      allocatedNaira: allocated,
      outstandingNaira: outstanding,
      state,
    };
  });
}

/** How much of the invoice was already settled BEFORE the plan existed. */
export function settledBaselineNaira(
  invoice: { totalAmount: number },
  plan: { totalScheduledNaira: number },
): number {
  return invoice.totalAmount - plan.totalScheduledNaira;
}

export function projectPlan(
  plan: {
    totalScheduledNaira: number;
    instalments: { sequence: number; dueDate: Date; amountNaira: number }[];
  },
  invoice: {
    totalAmount: number;
    amountPaid: number;
    amountDiscounted: number;
    amountCredited: number;
  },
  now: Date = new Date(),
) {
  const settledTotal = invoice.amountPaid + invoice.amountDiscounted + invoice.amountCredited;
  const settledSincePlan = Math.max(0, settledTotal - settledBaselineNaira(invoice, plan));
  const fragments = allocateInstalments(plan.instalments, settledSincePlan, now);
  const nextDue = fragments.find((f) => f.outstandingNaira > 0) ?? null;
  return {
    fragments,
    settledSincePlanNaira: settledSincePlan,
    outstandingNaira: Math.max(0, plan.totalScheduledNaira - settledSincePlan),
    isComplete: settledSincePlan >= plan.totalScheduledNaira,
    nextDue,
    overdueCount: fragments.filter((f) => f.state === "OVERDUE").length,
  };
}

export async function createInstalmentPlan(input: {
  schoolId: string;
  invoiceId: string;
  fragments: InstalmentFragmentInput[];
  reason?: string;
  actor: AdjustmentActor;
}) {
  assertFragmentShape(input.fragments);
  const totalScheduled = input.fragments.reduce((sum, f) => sum + f.amountNaira, 0);

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
  if (invoice.status === FeeInvoiceStatus.PAID || invoice.balanceDue <= 0) {
    throw new Error("That invoice is already settled, so it cannot be scheduled.");
  }
  if (totalScheduled !== invoice.balanceDue) {
    throw new Error(
      `Instalments must add up to exactly what the invoice still owes (₦${invoice.balanceDue.toLocaleString("en-NG")}). They currently add up to ₦${totalScheduled.toLocaleString("en-NG")}.`,
    );
  }

  const plan = await prisma.$transaction(async (tx) => {
    const active = await tx.feeInstalmentPlan.findFirst({
      where: { invoiceId: invoice.id, status: FeeInstalmentPlanStatus.ACTIVE },
      select: { id: true },
    });
    if (active) {
      throw new Error(
        "This invoice already has an active instalment plan. Cancel it before creating a replacement.",
      );
    }
    const created = await tx.feeInstalmentPlan.create({
      data: {
        schoolId: input.schoolId,
        invoiceId: invoice.id,
        studentProfileId: invoice.studentProfileId,
        totalScheduledNaira: totalScheduled,
        reason: input.reason?.trim() || null,
        createdByUserId: input.actor.userId,
        instalments: {
          create: input.fragments.map((fragment, index) => ({
            schoolId: input.schoolId,
            sequence: index + 1,
            dueDate: fragment.dueDate,
            amountNaira: fragment.amountNaira,
          })),
        },
      },
      include: { instalments: { orderBy: { sequence: "asc" } } },
    });
    await tx.auditLog.create({
      data: {
        schoolId: input.schoolId,
        actorUserId: input.actor.userId,
        action: "FEE_INSTALMENT_PLAN_CREATED",
        entityType: "FeeInstalmentPlan",
        entityId: created.id,
        metadata: {
          invoiceId: invoice.id,
          invoiceNumber: invoice.invoiceNumber,
          totalScheduledNaira: totalScheduled,
          instalmentCount: input.fragments.length,
        },
      },
    });
    return created;
  });

  return plan;
}

export async function cancelInstalmentPlan(input: {
  schoolId: string;
  planId: string;
  reason: string;
  actor: AdjustmentActor;
}) {
  const reason = input.reason.trim();
  if (reason.length < 4) {
    throw new Error("A reason of at least 4 characters is required — it is kept permanently.");
  }
  const plan = await prisma.feeInstalmentPlan.findFirst({
    where: { id: input.planId, schoolId: input.schoolId },
    select: { id: true, status: true, invoiceId: true },
  });
  if (!plan) throw new Error("That instalment plan could not be found.");
  if (plan.status !== FeeInstalmentPlanStatus.ACTIVE) {
    throw new Error("Only an active instalment plan can be cancelled.");
  }

  const cancelled = await prisma.$transaction(async (tx) => {
    const updated = await tx.feeInstalmentPlan.update({
      where: { id: plan.id },
      data: {
        status: FeeInstalmentPlanStatus.CANCELLED,
        cancelledByUserId: input.actor.userId,
        cancelledAt: new Date(),
        cancelReason: reason,
      },
    });
    await tx.auditLog.create({
      data: {
        schoolId: input.schoolId,
        actorUserId: input.actor.userId,
        action: "FEE_INSTALMENT_PLAN_CANCELLED",
        entityType: "FeeInstalmentPlan",
        entityId: plan.id,
        metadata: { invoiceId: plan.invoiceId, reason },
      },
    });
    return updated;
  });

  return cancelled;
}

/**
 * Read model for one invoice's plan (active or most recent), with the
 * projection applied. Lazily flips an ACTIVE plan to COMPLETED when the
 * invoice has been fully settled since the plan was created, so queues can
 * filter on status without a cron.
 */
export async function getInstalmentPlanForInvoice(input: {
  schoolId: string;
  invoiceId: string;
  now?: Date;
}) {
  const invoice = await prisma.feeInvoice.findFirst({
    where: { id: input.invoiceId, schoolId: input.schoolId },
    select: {
      id: true,
      invoiceNumber: true,
      totalAmount: true,
      amountPaid: true,
      amountDiscounted: true,
      amountCredited: true,
      balanceDue: true,
      status: true,
    },
  });
  if (!invoice) return null;

  const plan = await prisma.feeInstalmentPlan.findFirst({
    where: { invoiceId: invoice.id, schoolId: input.schoolId },
    orderBy: { createdAt: "desc" },
    include: { instalments: { orderBy: { sequence: "asc" } } },
  });
  if (!plan) return { invoice, plan: null, projection: null };

  const projection = projectPlan(plan, invoice, input.now ?? new Date());

  if (plan.status === FeeInstalmentPlanStatus.ACTIVE && projection.isComplete) {
    const completed = await prisma.feeInstalmentPlan.update({
      where: { id: plan.id },
      data: { status: FeeInstalmentPlanStatus.COMPLETED },
      include: { instalments: { orderBy: { sequence: "asc" } } },
    });
    return { invoice, plan: completed, projection };
  }

  return { invoice, plan, projection };
}
