import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAdminFinanceContext } from "@/lib/finance";
import { assertNotImpersonating } from "@/lib/session";
import { currentSessionLabel, currentTermLabel, currentTermWindow } from "@/lib/gradebook";
import { prisma } from "@/lib/prisma";
import { getClientIp } from "@/lib/requests";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const upsertSchema = z.object({
  category: z.string().trim().min(2).max(80),
  amountLimit: z.number().int().positive().max(2_000_000_000),
  termLabel: z.string().trim().min(2).max(40).optional(),
  sessionLabel: z.string().trim().min(4).max(20).optional(),
  notes: z.string().trim().max(500).optional(),
});

export async function GET() {
  const context = await getAdminFinanceContext();
  if (!context) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const sessionLabel = currentSessionLabel();
  const termLabel = currentTermLabel();
  const termWindow = currentTermWindow();

  const [budgets, expenses] = await Promise.all([
    prisma.budget.findMany({
      take: 500,
      where: { schoolId: context.user.schoolId, sessionLabel },
      orderBy: [{ termLabel: "asc" }, { category: "asc" }],
    }),
    // Spend for THIS TERM only, summed in SQL.
    //
    // This previously loaded up to 500 expenses with no date predicate and
    // summed them in Node, so "term spend" silently included every expense the
    // school had ever recorded — a bursar comparing spend against a term budget
    // was reading a wrong number, and it drifted further out every term. The
    // 500-row cap also meant the figure was quietly incomplete once a school
    // passed that many records.
    prisma.expense.groupBy({
      by: ["category"],
      where: {
        schoolId: context.user.schoolId,
        spentAt: { gte: termWindow.from, lt: termWindow.to },
      },
      _sum: { amount: true },
    }),
  ]);

  const spentByCategory = new Map<string, number>();
  for (const row of expenses) {
    spentByCategory.set(row.category.toLowerCase(), row._sum.amount ?? 0);
  }

  return NextResponse.json({
    sessionLabel,
    termLabel,
    budgets: budgets.map((b) => {
      const spent = spentByCategory.get(b.category.toLowerCase()) || 0;
      const remaining = b.amountLimit - spent;
      return {
        id: b.id,
        category: b.category,
        termLabel: b.termLabel,
        sessionLabel: b.sessionLabel,
        amountLimit: b.amountLimit,
        spent,
        remaining,
        utilizationPct: b.amountLimit
          ? Math.min(999, Math.round((spent / b.amountLimit) * 100))
          : 0,
        notes: b.notes,
        overBudget: spent > b.amountLimit,
      };
    }),
  });
}

export async function POST(request: NextRequest) {
  const context = await getAdminFinanceContext();
  if (!context) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const impersonating = assertNotImpersonating(context.user);
  if (impersonating) return impersonating;

  let input: z.infer<typeof upsertSchema>;
  try {
    input = upsertSchema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: "Invalid budget details." }, { status: 400 });
  }

  const sessionLabel = input.sessionLabel || currentSessionLabel();
  const termLabel = input.termLabel || currentTermLabel();

  const budget = await prisma.budget.upsert({
    where: {
      schoolId_category_termLabel_sessionLabel: {
        schoolId: context.user.schoolId,
        category: input.category,
        termLabel,
        sessionLabel,
      },
    },
    create: {
      schoolId: context.user.schoolId,
      category: input.category,
      termLabel,
      sessionLabel,
      amountLimit: input.amountLimit,
      notes: input.notes || null,
      createdByUserId: context.user.id,
    },
    update: {
      amountLimit: input.amountLimit,
      notes: input.notes || null,
    },
  });

  await prisma.auditLog.create({
    data: {
      schoolId: context.user.schoolId,
      actorUserId: context.user.id,
      action: "BUDGET_UPSERTED",
      entityType: "Budget",
      entityId: budget.id,
      ipAddress: getClientIp(request),
      metadata: {
        category: budget.category,
        amountLimit: budget.amountLimit,
        termLabel,
        sessionLabel,
      },
    },
  });

  return NextResponse.json({ budget }, { status: 201 });
}
