/**
 * Money — one unit, one conversion point, no floats (Rule 2).
 *
 * ── Why this file exists ───────────────────────────────────────────────────
 * The base stores two different things in two different units and never says
 * so out loud:
 *
 *   • School-fee documents (`FeeInvoice`, `FeePayment`, `FeeStructureItem`,
 *     `Expense`, `Budget`) hold WHOLE NAIRA integers — `amount * 100` in
 *     `app/api/parent/fees/payment-intents/route.ts` is the moment naira
 *     becomes Paystack kobo.
 *   • Admissions (`APPLICATION_FEE_KOBO`) and the gateway already speak KOBO.
 *
 * The W3 ledger is kobo (`prisma/schema.prisma`, `LedgerLine.amount`), so the
 * boundary has to be explicit and it has to be in ONE place. A conversion
 * sprinkled through a route handler is how a school ends up with a ₦8,500
 * payment recorded as ₦850,000 — or 85 kobo.
 *
 * Everything here is integer arithmetic: `+`, `-`, `*`, `%` and comparisons on
 * `number` that is known to be a safe integer. No `parseFloat`, no `toFixed`
 * for arithmetic, no rounding of money that already exists. `0.1 + 0.2` is
 * exactly the class of bug this file is here to make impossible.
 */

/** Kobo in one naira. Fixed by NGN; not a school setting. */
export const KOBO_PER_NAIRA = 100;

/** Default currency symbol for display only — never for arithmetic. */
export const NAIRA_SYMBOL = "₦";

/**
 * A whole-naira integer as stored by the legacy documents. Branded only in
 * comments (a nominal brand would fight every arithmetic site in the app) —
 * the guard functions below are what actually stop a mixed unit.
 */
export type Naira = number;

/** An integer kobo value — the ledger's unit. */
export type Kobo = number;

export function isIntegerAmount(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value);
}

/**
 * Assert an integer amount in the given unit. Throws rather than silently
 * truncating: a fractional naira is either a bug or a decision someone has to
 * make explicitly, and money must not round itself.
 */
export function assertIntegerAmount(value: number, label = "amount", unit = "kobo"): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`${label} must be a finite number of ${unit}.`);
  }
  if (!Number.isSafeInteger(value)) {
    throw new Error(`${label} must be a whole number of ${unit} — no fractions, no rounding.`);
  }
  return value;
}

/** Assert a positive (> 0) integer amount. */
export function assertPositiveAmount(value: number, label = "amount", unit = "kobo"): number {
  const integer = assertIntegerAmount(value, label, unit);
  if (integer <= 0) throw new Error(`${label} must be greater than zero.`);
  return integer;
}

/** Assert a signed (non-zero) integer amount — the ledger line guard. */
export function assertSignedAmount(value: number, label = "amount"): number {
  const integer = assertIntegerAmount(value, label);
  if (integer === 0) throw new Error(`${label} must not be zero — a zero leg posts nothing.`);
  return integer;
}

/**
 * Whole naira → kobo (documents → ledger). Refuses fractional naira instead of
 * rounding, because the documents cannot represent it: if a caller has 8500.5
 * naira, the bug is upstream and must surface there.
 */
export function nairaToKobo(naira: Naira): Kobo {
  assertIntegerAmount(naira, "naira amount", "naira");
  return assertIntegerAmount(naira * KOBO_PER_NAIRA, "kobo amount", "kobo");
}

/**
 * Kobo → naira. Exact only for whole-naira amounts; for anything else the
 * result is fractional and is for DISPLAY (`formatKobo`) or reporting — never
 * for writing back into a naira-typed document.
 */
export function koboToNaira(kobo: Kobo): number {
  assertIntegerAmount(kobo, "kobo amount", "kobo");
  return kobo / KOBO_PER_NAIRA;
}

/** True when a kobo amount is a whole number of naira (safe to store in a naira column). */
export function isWholeNaira(kobo: Kobo): boolean {
  return assertIntegerAmount(kobo, "kobo amount", "kobo") % KOBO_PER_NAIRA === 0;
}

/** Integer-safe negation that never produces `-0`. */
export function negate(kobo: Kobo): Kobo {
  assertIntegerAmount(kobo, "kobo amount", "kobo");
  return kobo === 0 ? 0 : -kobo;
}

/** Integer-safe sum. `Array.prototype.reduce` with floats is the other half of Rule 2. */
export function sumKobo(values: readonly Kobo[]): Kobo {
  let total = 0;
  for (const value of values) total += assertIntegerAmount(value, "kobo amount", "kobo");
  return assertIntegerAmount(total, "kobo total", "kobo");
}

/** Sum of the absolute values — "how much moved", regardless of direction. */
export function sumAbsKobo(values: readonly Kobo[]): Kobo {
  return sumKobo(values.map((value) => Math.abs(assertIntegerAmount(value, "kobo amount"))));
}

/**
 * Format kobo for display. Default is whole naira with no decimals (what a
 * bursar reads and writes); `decimals: true` shows kobo, which is what a
 * ledger statement and a gateway settlement report need.
 */
export function formatKobo(
  kobo: Kobo,
  options: { decimals?: boolean; symbol?: string; sign?: "auto" | "never" } = {},
): string {
  const { decimals = false, symbol = NAIRA_SYMBOL, sign = "auto" } = options;
  assertIntegerAmount(kobo, "kobo amount", "kobo");

  const negative = kobo < 0;
  const absolute = Math.abs(kobo);
  const naira = Math.trunc(absolute / KOBO_PER_NAIRA);
  const remainder = absolute % KOBO_PER_NAIRA;

  const whole = naira.toLocaleString("en-NG");
  // A non-zero kobo remainder is ALWAYS shown, whatever the caller asked for:
  // a statement that rounds a balance to ₦8,500 when ₦8,500.50 is owed is how
  // a parent is asked for money that does not clear the invoice.
  const body =
    remainder === 0
      ? decimals
        ? `${whole}.00`
        : whole
      : `${whole}.${remainder.toString().padStart(2, "0")}`;

  const prefix = negative && sign === "auto" ? "-" : "";
  return `${prefix}${symbol}${body}`;
}

/** Format a whole-naira document amount (invoice, expense, budget). */
export function formatNaira(naira: Naira, options: { symbol?: string } = {}): string {
  return formatKobo(nairaToKobo(naira), options);
}

/**
 * Percentage of a kobo amount, as an integer kobo — rounded, because a
 * collection rate is a metric, not a balance. Money that will be POSTED is
 * never computed this way.
 */
export function percentOfKobo(kobo: Kobo, percent: number): Kobo {
  assertIntegerAmount(kobo, "kobo amount", "kobo");
  if (typeof percent !== "number" || !Number.isFinite(percent)) {
    throw new Error("percent must be a finite number.");
  }
  return Math.round((kobo * percent) / 100);
}
