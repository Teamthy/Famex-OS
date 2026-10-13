import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAdminFinanceContext } from "@/lib/finance";
import { assertNotImpersonating } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { getClientIp } from "@/lib/requests";

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

  const limit = Math.min(Number(request.nextUrl.searchParams.get("limit") || 100), 300);
  const category = request.nextUrl.searchParams.get("category")?.trim();

  const expenses = await prisma.expense.findMany({
    where: {
      schoolId: context.user.schoolId,
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
    })),
  });
}

export async function POST(request: NextRequest) {
  const context = await getAdminFinanceContext();
  if (!context) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const impersonating = assertNotImpersonating(context.user);
  if (impersonating) return impersonating;

  let input: z.infer<typeof createSchema>;
  try {
    input = createSchema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: "Invalid expense details." }, { status: 400 });
  }

  const expense = await prisma.expense.create({
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

  await prisma.auditLog.create({
    data: {
      schoolId: context.user.schoolId,
      actorUserId: context.user.id,
      action: "EXPENSE_RECORDED",
      entityType: "Expense",
      entityId: expense.id,
      ipAddress: getClientIp(request),
      metadata: { amount: expense.amount, category: expense.category, title: expense.title },
    },
  });

  return NextResponse.json({ expense }, { status: 201 });
}

export async function DELETE(request: NextRequest) {
  const context = await getAdminFinanceContext();
  if (!context) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const impersonating = assertNotImpersonating(context.user);
  if (impersonating) return impersonating;
  const id = request.nextUrl.searchParams.get("id")?.trim();
  if (!id) return NextResponse.json({ error: "Expense id required." }, { status: 400 });

  const existing = await prisma.expense.findFirst({
    where: { id, schoolId: context.user.schoolId },
  });
  if (!existing) return NextResponse.json({ error: "Expense not found." }, { status: 404 });

  await prisma.expense.delete({ where: { id } });
  await prisma.auditLog.create({
    data: {
      schoolId: context.user.schoolId,
      actorUserId: context.user.id,
      action: "EXPENSE_DELETED",
      entityType: "Expense",
      entityId: id,
      ipAddress: getClientIp(request),
      metadata: { amount: existing.amount, title: existing.title },
    },
  });
  return NextResponse.json({ ok: true });
}
