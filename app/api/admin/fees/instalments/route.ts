import { FeeInstalmentPlanStatus } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  cancelInstalmentPlan,
  createInstalmentPlan,
  getInstalmentPlanForInvoice,
  projectPlan,
} from "@/lib/fee-instalments";
import { getAdminFinanceContext } from "@/lib/finance";
import { requireModule } from "@/lib/module-guard";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

/**
 * Instalment plans (F5-10).
 *
 * A plan schedules the balance an invoice already owes into dated
 * fragments; it never posts to the ledger (payments still settle the
 * invoice itself). Creating/cancelling is a finance-team action; the
 * fragment states in every response are projected from the invoice's
 * settled amount, never stored.
 */
const FINANCE_TEAM = ["ADMIN", "DIRECTOR", "PROPRIETOR", "PRINCIPAL", "BURSAR"] as const;

const createSchema = z.object({
  action: z.literal("CREATE"),
  invoiceId: z.string().min(1),
  fragments: z
    .array(
      z.object({
        dueDate: z.coerce.date(),
        amountNaira: z.number().int().positive(),
      }),
    )
    .min(2)
    .max(12),
  reason: z.string().trim().max(500).optional(),
});
const cancelSchema = z.object({
  action: z.literal("CANCEL"),
  planId: z.string().min(1),
  reason: z.string().trim().min(4).max(500),
});

async function resolveInvoiceId(schoolId: string, idOrNumber: string): Promise<string | null> {
  const invoice = await prisma.feeInvoice.findFirst({
    where: { schoolId, OR: [{ id: idOrNumber }, { invoiceNumber: idOrNumber }] },
    select: { id: true },
  });
  return invoice?.id ?? null;
}

export async function GET(request: NextRequest) {
  const context = await getAdminFinanceContext();
  if (!context) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const moduleCheck = await requireModule("fees");
  if (!moduleCheck.ok) return moduleCheck.response;

  const invoiceParam = request.nextUrl.searchParams.get("invoiceId");

  if (invoiceParam) {
    const invoiceId = await resolveInvoiceId(context.user.schoolId, invoiceParam);
    if (!invoiceId) {
      return NextResponse.json({ error: "That invoice could not be found." }, { status: 404 });
    }
    const result = await getInstalmentPlanForInvoice({
      schoolId: context.user.schoolId,
      invoiceId,
    });
    if (!result) {
      return NextResponse.json({ error: "That invoice could not be found." }, { status: 404 });
    }
    return NextResponse.json({
      invoice: {
        id: result.invoice.id,
        invoiceNumber: result.invoice.invoiceNumber,
        balanceDue: result.invoice.balanceDue,
        status: result.invoice.status,
      },
      plan: result.plan
        ? {
            id: result.plan.id,
            status: result.plan.status,
            totalScheduledNaira: result.plan.totalScheduledNaira,
            reason: result.plan.reason,
            createdAt: result.plan.createdAt.toISOString(),
          }
        : null,
      projection: result.projection
        ? {
            outstandingNaira: result.projection.outstandingNaira,
            isComplete: result.projection.isComplete,
            overdueCount: result.projection.overdueCount,
            nextDue: result.projection.nextDue
              ? {
                  sequence: result.projection.nextDue.sequence,
                  dueDate: result.projection.nextDue.dueDate.toISOString(),
                  outstandingNaira: result.projection.nextDue.outstandingNaira,
                }
              : null,
            fragments: result.projection.fragments.map((f) => ({
              sequence: f.sequence,
              dueDate: f.dueDate.toISOString(),
              amountNaira: f.amountNaira,
              allocatedNaira: f.allocatedNaira,
              outstandingNaira: f.outstandingNaira,
              state: f.state,
            })),
          }
        : null,
    });
  }

  // Bursar queue: active plans, worst (most overdue fragments) first.
  const plans = await prisma.feeInstalmentPlan.findMany({
    where: { schoolId: context.user.schoolId, status: FeeInstalmentPlanStatus.ACTIVE },
    orderBy: { createdAt: "desc" },
    take: 200,
    include: {
      instalments: { orderBy: { sequence: "asc" } },
      invoice: {
        select: {
          invoiceNumber: true,
          totalAmount: true,
          amountPaid: true,
          amountDiscounted: true,
          amountCredited: true,
          balanceDue: true,
          studentProfile: { select: { displayName: true } },
        },
      },
    },
  });

  const queue = plans
    .map((plan) => {
      const projection = projectPlan(plan, plan.invoice);
      return {
        id: plan.id,
        invoiceId: plan.invoiceId,
        invoiceNumber: plan.invoice.invoiceNumber,
        studentName: plan.invoice.studentProfile.displayName,
        totalScheduledNaira: plan.totalScheduledNaira,
        outstandingNaira: projection.outstandingNaira,
        overdueCount: projection.overdueCount,
        nextDueDate: projection.nextDue?.dueDate.toISOString() ?? null,
        nextDueNaira: projection.nextDue?.outstandingNaira ?? null,
        createdAt: plan.createdAt.toISOString(),
      };
    })
    .sort((a, b) => b.overdueCount - a.overdueCount);

  return NextResponse.json({
    plans: queue,
    overduePlanCount: queue.filter((p) => p.overdueCount > 0).length,
  });
}

export async function POST(request: NextRequest) {
  const context = await getAdminFinanceContext();
  if (!context) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const moduleCheck = await requireModule("fees", [...FINANCE_TEAM]);
  if (!moduleCheck.ok) return moduleCheck.response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const raw = (body ?? {}) as { action?: string };
  try {
    if (raw.action === "CREATE") {
      const input = createSchema.parse(body);
      const invoiceId = await resolveInvoiceId(context.user.schoolId, input.invoiceId);
      if (!invoiceId) {
        return NextResponse.json({ error: "That invoice could not be found." }, { status: 404 });
      }
      const plan = await createInstalmentPlan({
        schoolId: context.user.schoolId,
        invoiceId,
        fragments: input.fragments,
        reason: input.reason,
        actor: { userId: context.user.id, role: context.user.role },
      });
      return NextResponse.json(
        {
          plan: {
            id: plan.id,
            invoiceId: plan.invoiceId,
            status: plan.status,
            totalScheduledNaira: plan.totalScheduledNaira,
            instalments: plan.instalments.map((f) => ({
              sequence: f.sequence,
              dueDate: f.dueDate.toISOString(),
              amountNaira: f.amountNaira,
            })),
          },
        },
        { status: 201 },
      );
    }
    if (raw.action === "CANCEL") {
      const input = cancelSchema.parse(body);
      const plan = await cancelInstalmentPlan({
        schoolId: context.user.schoolId,
        planId: input.planId,
        reason: input.reason,
        actor: { userId: context.user.id, role: context.user.role },
      });
      return NextResponse.json({ plan: { id: plan.id, status: plan.status } });
    }
    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid request", details: error.flatten() },
        { status: 400 },
      );
    }
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "The instalment plan could not be saved.",
      },
      { status: 400 },
    );
  }
}
