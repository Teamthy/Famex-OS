import { ExpenseApprovalStatus } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { approveExpense, recordExpense } from "@/lib/expenses";
import { getAdminFinanceContext } from "@/lib/finance";
import { reverseJournal } from "@/lib/ledger";
import { prisma } from "@/lib/prisma";
import { getClientIp } from "@/lib/requests";
import { requireModule } from "@/lib/module-guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const approveSchema = z.object({
  action: z.literal("APPROVE"),
  expenseId: z.string().min(1),
  note: z.string().trim().max(500).optional(),
});

const createSchema = z.object({
  category: z.string().trim().min(2).max(80),
  title: z.string().trim().min(2).max(160),
  amount: z.number().int().positive().max(500_000_000),
  spentAt: z.string().optional(),
  vendor: z.string().trim().max(120).optional(),
  paymentMethod: z.enum(["CASH", "BANK_TRANSFER", "CARD", "OTHER"]).optional(),
  reference: z.string().trim().max(120).optional(),
  notes: z.string().trim().max(500).optional(),
});

export async function GET(request: NextRequest) {
  const context = await getAdminFinanceContext();
  if (!context) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const moduleCheck = await requireModule("expenses");
  if (!moduleCheck.ok) return moduleCheck.response;

  const limit = Math.min(Number(request.nextUrl.searchParams.get("limit") || 100), 300);
  const category = request.nextUrl.searchParams.get("category")?.trim();
  // Voided rows are kept (Rule 9) but hidden by default — the bursar's list is
  // what the school spent, not what it once typed and then withdrew.
  const includeVoided = request.nextUrl.searchParams.get("includeVoided") === "1";

  const expenses = await prisma.expense.findMany({
    where: {
      schoolId: context.user.schoolId,
      ...(includeVoided ? {} : { voidedAt: null }),
      ...(category ? { category: { equals: category, mode: "insensitive" } } : {}),
    },
    orderBy: { spentAt: "desc" },
    take: limit,
  });

  // B-16: pending-approval expenses have posted nothing — counting them as
  // spending would overstate the ledger side of the net position.
  const posted = expenses.filter((e) => e.approvalStatus === ExpenseApprovalStatus.APPROVED);
  const total = posted.reduce((s, e) => s + e.amount, 0);
  const byCategory = new Map<string, number>();
  for (const e of posted) byCategory.set(e.category, (byCategory.get(e.category) || 0) + e.amount);

  return NextResponse.json({
    summary: {
      count: expenses.length,
      postedCount: posted.length,
      totalSpent: total,
      byCategory: [...byCategory.entries()].map(([category, amount]) => ({ category, amount })),
    },
    expenses: expenses.map((e) => ({
      id: e.id,
      category: e.category,
      title: e.title,
      amount: e.amount,
      spentAt: e.spentAt.toISOString(),
      vendor: e.vendor,
      paymentMethod: e.paymentMethod,
      reference: e.reference,
      notes: e.notes,
      approvalStatus: e.approvalStatus,
      recordedByUserId: e.recordedByUserId,
      approvedByUserId: e.approvedByUserId,
      approvedAt: e.approvedAt ? e.approvedAt.toISOString() : null,
      voidedAt: e.voidedAt ? e.voidedAt.toISOString() : null,
      voidReason: e.voidReason,
    })),
    pendingApprovals: expenses.filter(
      (e) => e.approvalStatus === ExpenseApprovalStatus.PENDING_APPROVAL && !e.voidedAt,
    ).length,
  });
}

export async function POST(request: NextRequest) {
  const context = await getAdminFinanceContext();
  if (!context) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const moduleCheck = await requireModule("expenses");
  if (!moduleCheck.ok) return moduleCheck.response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const raw = (body ?? {}) as { action?: string };

  // B-16: second-actor approval for expenses at/above the threshold. The
  // journal posts HERE, not at record time, and never for the recorder.
  if (raw.action === "APPROVE") {
    let input: z.infer<typeof approveSchema>;
    try {
      input = approveSchema.parse(body);
    } catch {
      return NextResponse.json({ error: "Invalid approval request." }, { status: 400 });
    }
    try {
      const result = await approveExpense({
        schoolId: context.user.schoolId,
        expenseId: input.expenseId,
        actor: { userId: context.user.id, role: context.user.role },
        note: input.note,
        ipAddress: getClientIp(request),
      });
      return NextResponse.json(result);
    } catch (error) {
      return NextResponse.json(
        { error: error instanceof Error ? error.message : "The expense could not be approved." },
        { status: 400 },
      );
    }
  }

  let input: z.infer<typeof createSchema>;
  try {
    input = createSchema.parse(body);
  } catch {
    return NextResponse.json({ error: "Invalid expense details." }, { status: 400 });
  }

  // The expense document and (below the maker-checker threshold) its ledger
  // posting are one transaction (F5-08); at or above the threshold the
  // document waits PENDING_APPROVAL and the posting lands on approval.
  let expense;
  try {
    expense = await recordExpense({
      schoolId: context.user.schoolId,
      category: input.category,
      title: input.title,
      amount: input.amount,
      spentAt: input.spentAt ? new Date(input.spentAt) : undefined,
      vendor: input.vendor,
      paymentMethod: input.paymentMethod,
      reference: input.reference,
      notes: input.notes,
      actor: { userId: context.user.id, role: context.user.role },
      ipAddress: getClientIp(request),
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "The expense could not be recorded." },
      { status: 400 },
    );
  }

  const pending = expense.approvalStatus === ExpenseApprovalStatus.PENDING_APPROVAL;
  return NextResponse.json({ expense, pendingApproval: pending }, { status: pending ? 202 : 201 });
}

/**
 * Void an expense (Rule 9 / F5-13).
 *
 * This used to `prisma.expense.delete` — the record that money left the school
 * simply stopped existing, which is exactly the correction-by-deletion the
 * rules forbid and the reason a bursar could not explain last term's spending.
 * Now the row stays, `voidedAt`/`voidedByUserId`/`voidReason` are stamped, and
 * the ledger posting is cancelled by a counter-entry journal (never by editing
 * or removing the original).
 */
export async function DELETE(request: NextRequest) {
  const context = await getAdminFinanceContext();
  if (!context) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const moduleCheck = await requireModule("expenses");
  if (!moduleCheck.ok) return moduleCheck.response;

  const id = request.nextUrl.searchParams.get("id")?.trim();
  if (!id) return NextResponse.json({ error: "Expense id required." }, { status: 400 });

  const reason =
    request.nextUrl.searchParams.get("reason")?.trim().slice(0, 300) || "Voided by the bursary";

  const existing = await prisma.expense.findFirst({
    where: { id, schoolId: context.user.schoolId },
  });
  if (!existing) return NextResponse.json({ error: "Expense not found." }, { status: 404 });
  if (existing.voidedAt) {
    return NextResponse.json({ error: "This expense has already been voided." }, { status: 409 });
  }

  // Written before W3? Then it was never posted, so there is nothing to
  // reverse — the void stamp alone is the correct (and honest) outcome.
  const journal = await prisma.ledgerJournal.findFirst({
    where: { schoolId: context.user.schoolId, sourceType: "EXPENSE", sourceId: id },
    select: { id: true, number: true },
  });

  const result = await prisma.$transaction(async (tx) => {
    const voided = await tx.expense.update({
      where: { id },
      data: {
        voidedAt: new Date(),
        voidedByUserId: context.user.id,
        voidReason: reason,
      },
    });

    const reversal = journal
      ? await reverseJournal(tx, {
          schoolId: context.user.schoolId,
          journalId: journal.id,
          actorUserId: context.user.id,
          reason: `Expenditure voided: ${reason}`,
        })
      : null;

    await tx.auditLog.create({
      data: {
        schoolId: context.user.schoolId,
        actorUserId: context.user.id,
        action: "EXPENSE_VOIDED",
        entityType: "Expense",
        entityId: id,
        ipAddress: getClientIp(request),
        metadata: {
          amount: existing.amount,
          title: existing.title,
          category: existing.category,
          reason,
          reversalJournal: reversal?.journal.number ?? null,
          originalJournal: journal?.number ?? null,
        },
      },
    });

    return { voided, reversal };
  });

  return NextResponse.json({
    ok: true,
    voidedAt: result.voided.voidedAt?.toISOString() ?? null,
    reversalJournal: result.reversal?.journal.number ?? null,
  });
}
