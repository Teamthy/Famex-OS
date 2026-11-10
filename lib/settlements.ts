import { FeePaymentStatus, GatewaySettlementStatus } from "@prisma/client";
import { postGatewaySettlement } from "@/lib/ledger-postings";
import { prisma } from "@/lib/prisma";

/**
 * Gateway settlement ingestion (F5-16), per reference (B-16).
 *
 * The old route "matched" a payout by re-aggregating EVERY completed online
 * payment in a ±5-day window around the payout date and capping the sum at
 * the gross. Two overlapping payouts therefore matched the same money
 * twice, the matched figure changed retroactively as new payments landed,
 * and the "unmatched" work list was a summary that could not be reconciled
 * against the gateway's own settlement report.
 *
 * Now a payout CLAIMS its payments reference-by-reference, exactly once:
 * - the bursar supplies the payment references from the gateway report;
 * - every reference must exist, be COMPLETED, be online, and be unclaimed;
 * - the claim is one guarded `updateMany` (settlementId null → this
 *   settlement) whose count must equal the list length, so two payouts
 *   racing for the same payment cannot both win;
 * - matched kobo is the SUM OF THE CLAIMED PAYMENTS — a fact about this
 *   payout, never a recount of the whole ledger;
 * - the charges journal (DR expense:gateway_charges / CR bank) posts in the
 *   same transaction, unchanged.
 *
 * Amounts: gateway figures are KOBO (the gateway reports kobo and rounding
 * to naira would invent money); fee documents are whole naira.
 */

export type SettlementClaimIssue = {
  reference: string;
  problem: "not-found" | "not-completed" | "cash-payment" | "already-claimed";
};

export class SettlementClaimError extends Error {
  readonly issues: SettlementClaimIssue[];
  constructor(issues: SettlementClaimIssue[]) {
    super(
      `The payout could not claim ${issues.length} reference(s): ` +
        issues
          .slice(0, 6)
          .map((i) => `${i.reference} (${i.problem.replaceAll("-", " ")})`)
          .join(", ") +
        (issues.length > 6 ? `, …` : ""),
    );
    this.name = "SettlementClaimError";
    this.issues = issues;
  }
}

export async function recordGatewaySettlement(input: {
  schoolId: string;
  reference: string;
  grossKobo: number;
  chargesKobo: number;
  netKobo: number;
  settledAt: Date;
  /** The payment references this payout clears, from the gateway report. */
  paymentReferences: string[];
  actorUserId: string;
}): Promise<{ settlement: unknown; replay: boolean }> {
  const references = [...new Set(input.paymentReferences.map((r) => r.trim()))].filter(Boolean);
  if (references.length === 0) {
    throw new Error("A payout must claim at least one payment reference.");
  }
  if (references.length > 500) {
    throw new Error("Record at most 500 payment references per payout.");
  }
  for (const [label, value] of [
    ["gross", input.grossKobo],
    ["charges", input.chargesKobo],
    ["net", input.netKobo],
  ] as const) {
    if (!Number.isInteger(value) || value < 0) {
      throw new Error(`The payout ${label} must be a non-negative integer of kobo.`);
    }
  }
  if (input.grossKobo <= 0) throw new Error("The payout gross must be positive.");
  if (input.grossKobo - input.chargesKobo !== input.netKobo) {
    throw new Error("Gross minus charges must equal net — check the payout figures.");
  }

  return prisma.$transaction(async (tx) => {
    const existing = await tx.gatewaySettlement.findFirst({
      where: { schoolId: input.schoolId, reference: input.reference },
    });
    if (existing) return { settlement: existing, replay: true };

    // Validate every claimed reference before anything is written.
    const payments = await tx.feePayment.findMany({
      where: { schoolId: input.schoolId, reference: { in: references } },
      select: {
        id: true,
        reference: true,
        amount: true,
        method: true,
        status: true,
        settlementId: true,
      },
    });
    const byReference = new Map(payments.map((p) => [p.reference, p]));
    const issues: SettlementClaimIssue[] = [];
    const claimable: typeof payments = [];
    for (const reference of references) {
      const payment = byReference.get(reference);
      if (!payment) issues.push({ reference, problem: "not-found" });
      else if (payment.status !== FeePaymentStatus.COMPLETED)
        issues.push({ reference, problem: "not-completed" });
      else if (payment.method === "CASH") issues.push({ reference, problem: "cash-payment" });
      else if (payment.settlementId) issues.push({ reference, problem: "already-claimed" });
      else claimable.push(payment);
    }
    if (issues.length > 0) throw new SettlementClaimError(issues);

    const matchedKobo = claimable.reduce((sum, p) => sum + p.amount * 100, 0);
    if (matchedKobo > input.grossKobo) {
      throw new Error(
        `The claimed payments total ${matchedKobo} kobo but the payout gross is ${input.grossKobo} — the claim exceeds the payout.`,
      );
    }

    const settlement = await tx.gatewaySettlement.create({
      data: {
        schoolId: input.schoolId,
        reference: input.reference,
        settledAt: input.settledAt,
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
        recordedByUserId: input.actorUserId,
      },
    });

    // The claim: ONE guarded statement — a payment already taken by a
    // concurrent payout makes the count short and rolls this record back.
    const claimed = await tx.feePayment.updateMany({
      where: {
        schoolId: input.schoolId,
        id: { in: claimable.map((p) => p.id) },
        settlementId: null,
      },
      data: { settlementId: settlement.id },
    });
    if (claimed.count !== claimable.length) {
      throw new Error(
        "One or more of these payments was claimed by another payout at the same time. Nothing was recorded — re-check the gateway report.",
      );
    }

    await postGatewaySettlement(tx, {
      schoolId: input.schoolId,
      settlementId: settlement.id,
      reference: input.reference,
      chargesKobo: input.chargesKobo,
      actorUserId: input.actorUserId,
      settledAt: input.settledAt,
    });

    await tx.auditLog.create({
      data: {
        schoolId: input.schoolId,
        actorUserId: input.actorUserId,
        action: "GATEWAY_SETTLEMENT_RECORDED",
        entityType: "GatewaySettlement",
        entityId: settlement.id,
        metadata: {
          reference: input.reference,
          grossKobo: input.grossKobo,
          chargesKobo: input.chargesKobo,
          netKobo: input.netKobo,
          matchedKobo,
          claimedPayments: claimable.length,
        },
      },
    });

    return { settlement, replay: false };
  });
}

/**
 * The bursar's work list: completed online payments no payout has claimed
 * yet — per payment, not the old aggregate recount.
 */
export async function listUnclaimedPayments(schoolId: string, limit = 300) {
  const payments = await prisma.feePayment.findMany({
    where: {
      schoolId,
      status: FeePaymentStatus.COMPLETED,
      method: { not: "CASH" },
      settlementId: null,
    },
    orderBy: { paidAt: "asc" },
    take: limit,
    select: {
      id: true,
      reference: true,
      receiptNumber: true,
      amount: true,
      method: true,
      paidAt: true,
      studentProfile: { select: { displayName: true } },
    },
  });
  return {
    payments: payments.map((p) => ({
      id: p.id,
      reference: p.reference,
      receiptNumber: p.receiptNumber,
      amountNaira: p.amount,
      method: p.method,
      paidAt: p.paidAt.toISOString(),
      studentName: p.studentProfile.displayName,
    })),
    totalNaira: payments.reduce((sum, p) => sum + p.amount, 0),
  };
}
