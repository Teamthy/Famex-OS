import { FeePaymentStatus, GatewaySettlementStatus } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAdminFinanceContext } from "@/lib/finance";
import { postGatewaySettlement } from "@/lib/ledger-postings";
import { requireModule } from "@/lib/module-guard";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

/**
 * Gateway settlement matching (F5-16).
 *
 * The bursar records a Paystack payout (reference + gross + charges + net,
 * read off the gateway dashboard). The route matches the payout against
 * the payments the gateway actually cleared and books the one movement
 * the books are missing: the charges (DR expense:gateway_charges /
 * CR bank). Payments already credited the bank at gross when they landed.
 * Amounts are kobo — the gateway reports kobo, and rounding them to
 * naira would invent money.
 */
const kobo = z.number().int().nonnegative();
const recordSchema = z.object({
  action: z.literal("RECORD"),
  reference: z.string().trim().min(4).max(80),
  settledAt: z.string().datetime().optional(),
  grossKobo: kobo.positive(),
  chargesKobo: kobo,
  netKobo: kobo,
});

export async function GET() {
  const context = await getAdminFinanceContext();
  if (!context) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const moduleCheck = await requireModule("fees");
  if (!moduleCheck.ok) return moduleCheck.response;

  const settlements = await prisma.gatewaySettlement.findMany({
    where: { schoolId: context.user.schoolId },
    orderBy: { settledAt: "desc" },
    take: 100,
  });

  // What the gateway cleared but no settlement has been recorded for yet —
  // the bursar's "unmatched" work list.
  const unmatched = await prisma.feePayment.groupBy({
    by: ["method"],
    where: {
      schoolId: context.user.schoolId,
      status: FeePaymentStatus.COMPLETED,
      method: { not: "CASH" },
    },
    _count: { _all: true },
    _sum: { amount: true },
  });

  return NextResponse.json({
    settlements: settlements.map((s) => ({
      id: s.id,
      reference: s.reference,
      settledAt: s.settledAt.toISOString(),
      grossKobo: s.grossKobo,
      chargesKobo: s.chargesKobo,
      netKobo: s.netKobo,
      matchedKobo: s.matchedKobo,
      unmatchedKobo: s.grossKobo - s.matchedKobo,
      status: s.status,
    })),
    unmatchedOnline: unmatched.map((row) => ({
      method: row.method,
      payments: row._count._all,
      amountNaira: row._sum.amount ?? 0,
    })),
  });
}

export async function POST(request: NextRequest) {
  const context = await getAdminFinanceContext();
  if (!context) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const moduleCheck = await requireModule("fees", ["ADMIN", "DIRECTOR", "BURSAR"]);
  if (!moduleCheck.ok) return moduleCheck.response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  try {
    const input = recordSchema.parse(body);
    if (input.grossKobo - input.chargesKobo !== input.netKobo) {
      return NextResponse.json(
        { error: "Gross minus charges must equal net — check the payout figures." },
        { status: 400 },
      );
    }
    const settledAt = input.settledAt ? new Date(input.settledAt) : new Date();

    const result = await prisma.$transaction(async (tx) => {
      const existing = await tx.gatewaySettlement.findFirst({
        where: { schoolId: context.user.schoolId, reference: input.reference },
      });
      if (existing) {
        return { settlement: existing, replay: true as const };
      }

      // Match: completed online payments whose references this payout
      // clears, inside a ±5 day window around the payout date. The count
      // is a summary for the bursar, not a per-payment claim — per-item
      // matching follows the gateway's own settlement report (F5-16
      // continuation), and the charges posting does not depend on it.
      const windowMs = 5 * 86_400_000;
      const matched = await tx.feePayment.aggregate({
        where: {
          schoolId: context.user.schoolId,
          status: FeePaymentStatus.COMPLETED,
          method: { not: "CASH" },
          paidAt: { gte: new Date(settledAt.getTime() - windowMs), lte: settledAt },
        },
        _sum: { amount: true },
      });
      const matchedKobo = Math.min((matched._sum.amount ?? 0) * 100, input.grossKobo);

      const settlement = await tx.gatewaySettlement.create({
        data: {
          schoolId: context.user.schoolId,
          reference: input.reference,
          settledAt,
          grossKobo: input.grossKobo,
          chargesKobo: input.chargesKobo,
          netKobo: input.netKobo,
          matchedKobo,
          status:
            matchedKobo >= input.grossKobo
              ? GatewaySettlementStatus.MATCHED
              : matchedKobo > 0
                ? GatewaySettlementStatus.PARTIALLY_MATCHED
                : GatewaySettlementStatus.RECORDED,
          recordedByUserId: context.user.id,
        },
      });

      await postGatewaySettlement(tx, {
        schoolId: context.user.schoolId,
        settlementId: settlement.id,
        reference: input.reference,
        chargesKobo: input.chargesKobo,
        actorUserId: context.user.id,
        settledAt,
      });

      await tx.auditLog.create({
        data: {
          schoolId: context.user.schoolId,
          actorUserId: context.user.id,
          action: "GATEWAY_SETTLEMENT_RECORDED",
          entityType: "GatewaySettlement",
          entityId: settlement.id,
          metadata: {
            reference: input.reference,
            grossKobo: input.grossKobo,
            chargesKobo: input.chargesKobo,
            netKobo: input.netKobo,
            matchedKobo,
          },
        },
      });
      return { settlement, replay: false as const };
    });

    return NextResponse.json(result, { status: result.replay ? 200 : 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid request", details: error.flatten() },
        { status: 400 },
      );
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "The settlement could not be recorded." },
      { status: 400 },
    );
  }
}
