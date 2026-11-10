import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAdminFinanceContext } from "@/lib/finance";
import { requireModule } from "@/lib/module-guard";
import { prisma } from "@/lib/prisma";
import {
  listUnclaimedPayments,
  recordGatewaySettlement,
  SettlementClaimError,
} from "@/lib/settlements";

export const runtime = "nodejs";

/**
 * Gateway settlement matching (F5-16), per reference (B-16).
 *
 * The bursar records a Paystack payout (reference + gross + charges + net,
 * read off the gateway dashboard) TOGETHER WITH the payment references the
 * payout clears, from the gateway's own settlement report. lib/settlements.ts
 * validates and claims those payments exactly once and books the one
 * movement the books are missing: the charges (DR expense:gateway_charges /
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
  paymentReferences: z.array(z.string().trim().min(1).max(120)).min(1).max(500),
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

  // B-16: the work list is per payment — completed online payments no
  // payout has claimed yet — not an aggregate recount of everything, which
  // double-counted as soon as two payouts overlapped.
  const unclaimed = await listUnclaimedPayments(context.user.schoolId);

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
    unclaimedPayments: unclaimed.payments,
    unclaimedTotalNaira: unclaimed.totalNaira,
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
    const settledAt = input.settledAt ? new Date(input.settledAt) : new Date();

    const result = await recordGatewaySettlement({
      schoolId: context.user.schoolId,
      reference: input.reference,
      grossKobo: input.grossKobo,
      chargesKobo: input.chargesKobo,
      netKobo: input.netKobo,
      settledAt,
      paymentReferences: input.paymentReferences,
      actorUserId: context.user.id,
    });

    return NextResponse.json(result, { status: result.replay ? 200 : 201 });
  } catch (error) {
    if (error instanceof SettlementClaimError) {
      return NextResponse.json({ error: error.message, issues: error.issues }, { status: 409 });
    }
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
