import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAdminFinanceContext } from "@/lib/finance";
import { reverseJournal } from "@/lib/ledger";
import { postExpenseSpend } from "@/lib/ledger-postings";
import { prisma } from "@/lib/prisma";
import { getClientIp } from "@/lib/requests";
import { requireModule } from "@/lib/module-guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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

  const total = expenses.reduce((s, e) => s + e.amount, 0);
  const byCategory = new Map<string, number>();
  for (const e of expenses)
    byCategory.set(e.category, (byCategory.get(e.category) || 0) + e.amount);

  return NextResponse.json({
    summary: {
      count: expenses.length,
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
      voidedAt: e.voidedAt ? e.voidedAt.toISOString() : null,
      voidReason: e.voidReason,
    })),
  });
}

export async function POST(request: NextRequest) {
  const context = await getAdminFinanceContext();
  if (!context) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const moduleCheck = await requireModule("expenses");
  if (!moduleCheck.ok) return moduleCheck.response;

  let input: z.infer<typeof createSchema>;
  try {
    input = createSchema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: "Invalid expense details." }, { status: 400 });
  }

  // The expense document and its ledger posting are one transaction (F5-08):
  // an expenditure that is not in the books is money the school cannot
  // explain later, and a posting that fails must not leave the document
  // behind either.
  const expense = await prisma.$transaction(async (tx) => {
    const created = await tx.expense.create({
      data: {
        schoolId: context.user.schoolId,
        category: input.category,
        title: input.title,
        amount: input.amount,
        spentAt: input.spentAt ? new Date(input.spentAt) : new Date(),
        vendor: input.vendor || null,
        paymentMethod: input.paymentMethod || null,
        reference: input.reference || null,
        notes: input.notes || null,
        recordedByUserId: context.user.id,
      },
    });

    await postExpenseSpend(tx, {
      schoolId: context.user.schoolId,
      expenseId: created.id,
      category: created.category,
      title: created.title,
      amountNaira: created.amount,
      paymentMethod: created.paymentMethod,
      actorUserId: context.user.id,
      spentAt: created.spentAt,
    });

    await tx.auditLog.create({
      data: {
        schoolId: context.user.schoolId,
        actorUserId: context.user.id,
        action: "EXPENSE_RECORDED",
        entityType: "Expense",
        entityId: created.id,
        ipAddress: getClientIp(request),
        metadata: {
          amount: created.amount,
          category: created.category,
          title: created.title,
        },
      },
    });

    return created;
  });

  return NextResponse.json({ expense }, { status: 201 });
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
