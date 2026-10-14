/**
 * Posting rules (F5-09) — how each money document turns into ledger legs.
 *
 * Everything that touches money calls one of these, inside the transaction
 * that writes the document itself. The document and its posting commit
 * together or not at all, so there is no window in which a payment exists and
 * the ledger has not heard about it.
 *
 *   Document                     Debit                Credit
 *   ─────────────────────────────────────────────────────────────────────────
 *   Fee invoice raised           fees receivable      school fees income
 *   Fee payment received         cash | bank          fees receivable
 *   Expenditure recorded         expense:<category>   cash | bank
 *   Expenditure voided           (counter-entry: reverseJournal)
 *   Discount approved (F5-12)    discounts            fees receivable
 *   Refund paid (F5-13)          refunds              cash | bank
 *
 * Accrual, not cash accounting: an invoice is income when it is billed and a
 * receivable until it is paid. That is what makes the arrears ageing report
 * (F5-17) and the position statement (F5-18) possible at all — a cash-basis
 * school cannot tell a bursar what is still owed.
 *
 * Units: the documents hold whole naira, the ledger holds kobo. The conversion
 * happens HERE and nowhere else (`lib/money.ts`), once per posting.
 */
import type { FeePaymentMethod } from "@prisma/client";
import { nairaToKobo, negate } from "@/lib/money";
import { expenseAccountKey, type LedgerSystemKey } from "@/lib/ledger-accounts";
import { postJournal, type LedgerClient, type PostJournalResult } from "@/lib/ledger";

/** Where money physically lands for a given payment method. */
export function assetKeyForMethod(
  method: FeePaymentMethod | string | null | undefined,
): LedgerSystemKey {
  switch (method) {
    case "CASH":
      return "cash";
    default:
      // Bank transfer, card, USSD and Paystack payouts all land in the bank
      // account. Paystack settlement timing is reconciled separately (F5-16)
      // against the payouts, not by pretending the money is already there.
      return "bank";
  }
}

/**
 * A raised fee invoice → a receivable and income.
 *
 * Idempotency key is the invoice id, so re-running a whole-term generation (or
 * a retry after a partial failure) cannot bill the same invoice twice in the
 * ledger — the unique (schoolId, idempotencyKey) index returns the first
 * posting instead.
 */
export async function postInvoiceAccrual(
  client: LedgerClient,
  input: {
    schoolId: string;
    invoiceId: string;
    invoiceNumber: string;
    /** Whole-naira invoice total, as stored on the document. */
    totalNaira: number;
    termLabel?: string | null;
    studentProfileId: string;
    actorUserId?: string | null;
    postedAt?: Date;
  },
): Promise<PostJournalResult> {
  const amount = nairaToKobo(input.totalNaira);
  const memo = [input.invoiceNumber, input.termLabel].filter(Boolean).join(" · ");

  return postJournal(client, {
    schoolId: input.schoolId,
    description: `Fee invoice ${input.invoiceNumber} raised${input.termLabel ? ` (${input.termLabel})` : ""}`,
    sourceType: "FEE_INVOICE",
    sourceId: input.invoiceId,
    actorUserId: input.actorUserId ?? null,
    idempotencyKey: `fee-invoice:${input.invoiceId}`,
    postedAt: input.postedAt,
    lines: [
      { systemKey: "fees_receivable", amount, memo, studentProfileId: input.studentProfileId },
      {
        systemKey: "fee_income",
        amount: negate(amount),
        memo,
        studentProfileId: input.studentProfileId,
      },
    ],
  });
}

/**
 * A completed fee payment → money in, receivable down.
 *
 * Idempotency key is the payment id: the payment service already dedupes on
 * the gateway/bank reference (Rule 4), and this is the second line of defence
 * — even a replay that somehow reaches the ledger returns the first journal.
 */
export async function postPaymentReceipt(
  client: LedgerClient,
  input: {
    schoolId: string;
    paymentId: string;
    receiptNumber?: string | null;
    reference: string;
    /** Whole-naira amount received, as stored on the payment document. */
    amountNaira: number;
    method: FeePaymentMethod | string | null | undefined;
    studentProfileId: string;
    actorUserId?: string | null;
    paidAt?: Date;
  },
): Promise<PostJournalResult> {
  const amount = nairaToKobo(input.amountNaira);
  const asset = assetKeyForMethod(input.method);
  const memo = [input.receiptNumber, input.reference].filter(Boolean).join(" · ");

  return postJournal(client, {
    schoolId: input.schoolId,
    description: `Fee payment received${input.receiptNumber ? ` — receipt ${input.receiptNumber}` : ""}`,
    sourceType: "FEE_PAYMENT",
    sourceId: input.paymentId,
    actorUserId: input.actorUserId ?? null,
    idempotencyKey: `fee-payment:${input.paymentId}`,
    postedAt: input.paidAt,
    lines: [
      { systemKey: asset, amount, memo, studentProfileId: input.studentProfileId },
      {
        systemKey: "fees_receivable",
        amount: negate(amount),
        memo,
        studentProfileId: input.studentProfileId,
      },
    ],
  });
}

/**
 * An expenditure → the expense (or its category account) debited, cash/bank
 * credited. Created on demand under `expense:<category>` so the trial balance
 * breaks spending out by category instead of hiding it in one "operating
 * expenses" line.
 */
export async function postExpenseSpend(
  client: LedgerClient,
  input: {
    schoolId: string;
    expenseId: string;
    category: string;
    title: string;
    /** Whole-naira amount, as stored on the expense document. */
    amountNaira: number;
    paymentMethod?: string | null;
    actorUserId?: string | null;
    spentAt?: Date;
  },
): Promise<PostJournalResult> {
  const amount = nairaToKobo(input.amountNaira);
  const memo = input.title.trim().slice(0, 120);

  return postJournal(client, {
    schoolId: input.schoolId,
    description: `Expenditure — ${input.category}: ${memo}`,
    sourceType: "EXPENSE",
    sourceId: input.expenseId,
    actorUserId: input.actorUserId ?? null,
    idempotencyKey: `expense:${input.expenseId}`,
    postedAt: input.spentAt,
    lines: [
      { systemKey: expenseAccountKey(input.category), amount, memo },
      { systemKey: assetKeyForMethod(input.paymentMethod), amount: negate(amount), memo },
    ],
  });
}

/**
 * Opening balances at go-live: the bursar states what the school holds and
 * owes on day one. Not a document — it is the one posting that is allowed to
 * come from nowhere, which is exactly why it is its own source type and why
 * `postJournal` still refuses it unless it balances.
 */
export async function postOpeningBalance(
  client: LedgerClient,
  input: {
    schoolId: string;
    actorUserId?: string | null;
    /** ISO date the balances are struck at. Part of the idempotency key. */
    asOf: string;
    description?: string;
    lines: Array<{ systemKey: LedgerSystemKey; amount: number; memo?: string }>;
  },
): Promise<PostJournalResult> {
  return postJournal(client, {
    schoolId: input.schoolId,
    description: input.description?.trim() || `Opening balances at ${input.asOf}`,
    sourceType: "OPENING_BALANCE",
    sourceId: null,
    actorUserId: input.actorUserId ?? null,
    idempotencyKey: `opening-balance:${input.asOf}`,
    postedAt: new Date(`${input.asOf}T00:00:00.000Z`),
    lines: input.lines.map((line) => ({
      systemKey: line.systemKey,
      amount: line.amount,
      memo: line.memo,
    })),
  });
}
