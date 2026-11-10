import { ExpenseApprovalStatus } from "@prisma/client";
import { postExpenseSpend } from "@/lib/ledger-postings";
import { prisma } from "@/lib/prisma";

/**
 * Expenses with segregation of duties (B-16).
 *
 * Before this, ANY finance role could record an expense of any size and it
 * posted to the ledger in the same breath — one actor, one click, money out
 * of the books with no second pair of eyes. The refunds flow already had
 * maker-checker; expenditures did not.
 *
 * The rule now:
 * - Below `EXPENSE_APPROVAL_THRESHOLD_NAIRA`: recorded and posted
 *   immediately (day-to-day petty cash must not queue behind a director).
 * - At or above it: the document is created PENDING_APPROVAL and posts NO
 *   journal until a second actor — an approver role who is NOT the
 *   recorder — approves it. Document and posting still commit together
 *   (Rule 10), just at approval time instead of record time.
 * - Approval is guarded (`updateMany` on PENDING_APPROVAL): two approvers
 *   clicking at once post the spend exactly once; the loser is told so.
 * - Voiding is unchanged and already Rule-9 safe: a pending expense has no
 *   journal, so voiding it is the stamp alone; an approved one reverses by
 *   counter-entry.
 */

/** Whole naira. ₦100,000 and above needs a second actor. */
export const EXPENSE_APPROVAL_THRESHOLD_NAIRA = 100_000;

const APPROVER_ROLES = new Set<string>(["ADMIN", "DIRECTOR", "PROPRIETOR", "PRINCIPAL"]);

export type ExpenseActor = { userId: string; role: string };

export function expenseRequiresApproval(amountNaira: number): boolean {
  return amountNaira >= EXPENSE_APPROVAL_THRESHOLD_NAIRA;
}

export async function recordExpense(input: {
  schoolId: string;
  category: string;
  title: string;
  /** Whole naira, integer. */
  amount: number;
  spentAt?: Date;
  vendor?: string | null;
  paymentMethod?: string | null;
  reference?: string | null;
  notes?: string | null;
  actor: ExpenseActor;
  ipAddress?: string | null;
}) {
  if (!Number.isInteger(input.amount) || input.amount <= 0) {
    throw new Error("Expense amount must be a positive whole-naira integer.");
  }
  const needsApproval = expenseRequiresApproval(input.amount);

  return prisma.$transaction(async (tx) => {
    const created = await tx.expense.create({
      data: {
        schoolId: input.schoolId,
        category: input.category,
        title: input.title,
        amount: input.amount,
        spentAt: input.spentAt ?? new Date(),
        vendor: input.vendor ?? null,
        paymentMethod: input.paymentMethod ?? null,
        reference: input.reference ?? null,
        notes: input.notes ?? null,
        recordedByUserId: input.actor.userId,
        approvalStatus: needsApproval
          ? ExpenseApprovalStatus.PENDING_APPROVAL
          : ExpenseApprovalStatus.APPROVED,
      },
    });

    if (!needsApproval) {
      // Below the threshold the document and its posting commit together,
      // exactly as before (F5-08).
      await postExpenseSpend(tx, {
        schoolId: input.schoolId,
        expenseId: created.id,
        category: created.category,
        title: created.title,
        amountNaira: created.amount,
        paymentMethod: created.paymentMethod,
        actorUserId: input.actor.userId,
        spentAt: created.spentAt,
      });
    }

    await tx.auditLog.create({
      data: {
        schoolId: input.schoolId,
        actorUserId: input.actor.userId,
        action: needsApproval ? "EXPENSE_RECORDED_PENDING_APPROVAL" : "EXPENSE_RECORDED",
        entityType: "Expense",
        entityId: created.id,
        ipAddress: input.ipAddress ?? null,
        metadata: {
          amount: created.amount,
          category: created.category,
          title: created.title,
          requiresApproval: needsApproval,
        },
      },
    });

    return created;
  });
}

export async function approveExpense(input: {
  schoolId: string;
  expenseId: string;
  actor: ExpenseActor;
  note?: string | null;
  ipAddress?: string | null;
}): Promise<{ expense: unknown; posted: boolean; replay: boolean }> {
  if (!APPROVER_ROLES.has(input.actor.role)) {
    throw new Error("Only an admin, director, proprietor or principal can approve expenses.");
  }

  return prisma.$transaction(async (tx) => {
    const expense = await tx.expense.findFirst({
      where: { id: input.expenseId, schoolId: input.schoolId },
    });
    if (!expense) throw new Error("That expense could not be found.");
    if (expense.voidedAt) throw new Error("That expense has been voided.");
    if (expense.approvalStatus === ExpenseApprovalStatus.APPROVED) {
      // Already approved (a retry of the same click): never posts twice.
      return { expense, posted: false, replay: true };
    }
    if (expense.recordedByUserId === input.actor.userId) {
      throw new Error(
        "You cannot approve an expense you recorded — a second person must approve it.",
      );
    }

    const moved = await tx.expense.updateMany({
      where: {
        id: expense.id,
        approvalStatus: ExpenseApprovalStatus.PENDING_APPROVAL,
        voidedAt: null,
      },
      data: {
        approvalStatus: ExpenseApprovalStatus.APPROVED,
        approvedByUserId: input.actor.userId,
        approvedAt: new Date(),
      },
    });
    if (moved.count !== 1) {
      throw new Error("That expense was decided by another approver at the same time.");
    }

    // The money event happens HERE — document and journal in one transaction
    // (Rule 10), keyed by expenseId so even a pathological retry cannot
    // double-post.
    await postExpenseSpend(tx, {
      schoolId: input.schoolId,
      expenseId: expense.id,
      category: expense.category,
      title: expense.title,
      amountNaira: expense.amount,
      paymentMethod: expense.paymentMethod,
      actorUserId: input.actor.userId,
      spentAt: expense.spentAt,
    });

    await tx.auditLog.create({
      data: {
        schoolId: input.schoolId,
        actorUserId: input.actor.userId,
        action: "EXPENSE_APPROVED",
        entityType: "Expense",
        entityId: expense.id,
        ipAddress: input.ipAddress ?? null,
        metadata: {
          amount: expense.amount,
          category: expense.category,
          title: expense.title,
          recordedByUserId: expense.recordedByUserId,
          note: input.note ?? null,
        },
      },
    });

    const approved = await tx.expense.findUniqueOrThrow({ where: { id: expense.id } });
    return { expense: approved, posted: true, replay: false };
  });
}
