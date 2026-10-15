/**
 * Chart of accounts (F5-08, F5-09) — the vocabulary the ledger posts in.
 *
 * Deliberately FREE OF SERVER IMPORTS, like `lib/module-registry.ts` and
 * `lib/stage-types.ts`: the ledger screens are client components and read
 * these labels/types. Importing `@prisma/client` here would drag the engine
 * into the browser bundle and `npm run check:boundary` fails the build on
 * exactly that. The string unions below mirror the Prisma enums and
 * `tests/lib/ledger-accounts.test.ts` asserts the two match at runtime, so
 * they cannot drift.
 *
 * ── Why a fixed chart instead of "create accounts as you go" ───────────────
 * A bursar must be able to explain a balance a year later (§9 Money). If the
 * application invented accounts ad hoc and posted to whichever one looked
 * right, the trial balance would be a list of near-duplicates. So the accounts
 * the SOFTWARE posts to are a closed, pre-provisioned set (`systemKey`), and a
 * school's own expense categories are the one place accounts are created on
 * demand — under a reserved `expense:` key prefix, at 5xxx codes.
 */

/** Mirrors `enum LedgerAccountType` in prisma/schema.prisma. */
export type LedgerAccountTypeKey = "ASSET" | "LIABILITY" | "EQUITY" | "INCOME" | "EXPENSE";

export const LEDGER_ACCOUNT_TYPES: readonly LedgerAccountTypeKey[] = [
  "ASSET",
  "LIABILITY",
  "EQUITY",
  "INCOME",
  "EXPENSE",
] as const;

/**
 * Mirrors `enum LedgerSourceType` in prisma/schema.prisma. Every posting names
 * the kind of document behind it.
 */
export type LedgerSourceTypeKey =
  | "OPENING_BALANCE"
  | "FEE_INVOICE"
  | "FEE_PAYMENT"
  | "FEE_CREDIT"
  | "FEE_DISCOUNT"
  | "FEE_REFUND"
  | "FEE_TRANSFER"
  | "GATEWAY_SETTLEMENT"
  | "EXPENSE"
  | "EXPENSE_VOID"
  | "MANUAL_ADJUSTMENT";

export const LEDGER_SOURCE_TYPES: readonly LedgerSourceTypeKey[] = [
  "OPENING_BALANCE",
  "FEE_INVOICE",
  "FEE_PAYMENT",
  "FEE_CREDIT",
  "FEE_DISCOUNT",
  "FEE_REFUND",
  "FEE_TRANSFER",
  "GATEWAY_SETTLEMENT",
  "EXPENSE",
  "EXPENSE_VOID",
  "MANUAL_ADJUSTMENT",
] as const;

/** Human labels for the posting-source column on the ledger screens. */
export const LEDGER_SOURCE_LABELS: Record<LedgerSourceTypeKey, string> = {
  OPENING_BALANCE: "Opening balance",
  FEE_INVOICE: "Fee invoice",
  FEE_PAYMENT: "Fee payment",
  FEE_CREDIT: "Credit applied",
  FEE_DISCOUNT: "Discount / scholarship",
  FEE_REFUND: "Refund",
  FEE_TRANSFER: "Fee transfer",
  GATEWAY_SETTLEMENT: "Gateway settlement",
  EXPENSE: "Expenditure",
  EXPENSE_VOID: "Voided expenditure",
  MANUAL_ADJUSTMENT: "Manual adjustment",
};

/**
 * The accounts the application itself posts to. A `systemKey` is unique per
 * school, so "the bank account" is one row forever — no `findFirst` on a name.
 */
export type LedgerSystemKey =
  | "cash"
  | "bank"
  | "fees_receivable"
  | "student_credit"
  | "capital"
  | "fee_income"
  | "discounts"
  | "refunds"
  | "expense_default"
  | "suspense";

export type LedgerAccountDefinition = {
  /** Accountant-style code; unique per school. */
  code: string;
  name: string;
  type: LedgerAccountTypeKey;
  systemKey: LedgerSystemKey | null;
  /** One line, shown on the chart-of-accounts screen and used in help text. */
  summary: string;
};

/**
 * Provisioned for every school by `ensureLedgerAccounts()` (idempotent — safe
 * to call on any write path, and re-run at any time).
 *
 * Codes follow the usual 1xxx assets / 2xxx liabilities / 3xxx equity /
 * 4xxx income / 5xxx expenses grouping, with 41xx reserved for contra-income
 * (discounts, refunds) and 5xxx for the school's own expense categories.
 */
export const DEFAULT_CHART_OF_ACCOUNTS: readonly LedgerAccountDefinition[] = [
  {
    code: "1000",
    name: "Cash on hand",
    type: "ASSET",
    systemKey: "cash",
    summary: "Notes and coins in the bursary, recorded from cash receipts.",
  },
  {
    code: "1010",
    name: "Bank account",
    type: "ASSET",
    systemKey: "bank",
    summary: "Money at the bank — transfers, cards, USSD and settled gateway payouts.",
  },
  {
    code: "1100",
    name: "Fees receivable",
    type: "ASSET",
    systemKey: "fees_receivable",
    summary: "Billed to pupils and not yet paid — the arrears ageing source.",
  },
  {
    code: "2000",
    name: "Credit balances held",
    type: "LIABILITY",
    systemKey: "student_credit",
    summary: "Overpayments the school holds for a pupil (F5-11). A liability, not income.",
  },
  {
    code: "2100",
    name: "Unidentified receipts",
    type: "LIABILITY",
    systemKey: "suspense",
    summary: "Money received that is not yet matched to a pupil or invoice.",
  },
  {
    code: "3000",
    name: "Capital and reserves",
    type: "EQUITY",
    systemKey: "capital",
    summary: "Owner's capital and opening balances.",
  },
  {
    code: "4000",
    name: "School fees income",
    type: "INCOME",
    systemKey: "fee_income",
    summary: "Fees billed for the term, per the fee structures.",
  },
  {
    code: "4100",
    name: "Discounts and scholarships",
    type: "INCOME",
    systemKey: "discounts",
    summary: "Contra-income: debited when a fee is waived (F5-12).",
  },
  {
    code: "4110",
    name: "Refunds",
    type: "INCOME",
    systemKey: "refunds",
    summary: "Contra-income: debited when money goes back (F5-13).",
  },
  {
    code: "5000",
    name: "Operating expenses",
    type: "EXPENSE",
    systemKey: "expense_default",
    summary: "Where an expenditure posts when its category has no account of its own.",
  },
];

/** Reserved prefix for a school's own expense-category accounts (5xxx). */
export const EXPENSE_ACCOUNT_PREFIX = "expense:";

/**
 * The stable system key for a school expense category. Lower-cased, trimmed,
 * whitespace collapsed to single underscores — so "Diesel / Generator" and
 * "diesel generator" are one account, not two.
 */
export function expenseAccountKey(category: string): string {
  const slug = category
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return `${EXPENSE_ACCOUNT_PREFIX}${slug || "uncategorised"}`;
}

/** True for a valid system key or a generated expense-category key. */
export function isLedgerSystemKey(value: string): boolean {
  if (value.startsWith(EXPENSE_ACCOUNT_PREFIX)) {
    return value.length > EXPENSE_ACCOUNT_PREFIX.length;
  }
  return DEFAULT_CHART_OF_ACCOUNTS.some((account) => account.systemKey === value);
}

/** The definition for a provisioned account, by key. */
export function accountDefinition(systemKey: LedgerSystemKey): LedgerAccountDefinition {
  const definition = DEFAULT_CHART_OF_ACCOUNTS.find((account) => account.systemKey === systemKey);
  if (!definition) throw new Error(`No provisioned ledger account for key "${systemKey}".`);
  return definition;
}

/**
 * Which way a balance is "normal" for each account type. The ledger stores
 * signed kobo (+debit / −credit), so a display layer needs this to show a
 * credit-normal account as a positive number instead of a confusing negative.
 */
export const DEBIT_NORMAL_TYPES: readonly LedgerAccountTypeKey[] = ["ASSET", "EXPENSE"] as const;

export function isDebitNormal(type: LedgerAccountTypeKey): boolean {
  return DEBIT_NORMAL_TYPES.includes(type);
}

export const ACCOUNT_TYPE_LABELS: Record<LedgerAccountTypeKey, string> = {
  ASSET: "Asset",
  LIABILITY: "Liability",
  EQUITY: "Equity",
  INCOME: "Income",
  EXPENSE: "Expense",
};

/** Accounting-equation order for the chart and the trial balance. */
export const ACCOUNT_TYPE_ORDER: readonly LedgerAccountTypeKey[] = [
  "ASSET",
  "LIABILITY",
  "EQUITY",
  "INCOME",
  "EXPENSE",
] as const;

export function accountTypeLabel(type: LedgerAccountTypeKey): string {
  return ACCOUNT_TYPE_LABELS[type];
}
