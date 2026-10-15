import { describe, it, expect } from "vitest";
import { LedgerAccountType, LedgerSourceType } from "@prisma/client";
import {
  ACCOUNT_TYPE_ORDER,
  DEFAULT_CHART_OF_ACCOUNTS,
  LEDGER_ACCOUNT_TYPES,
  LEDGER_SOURCE_TYPES,
  accountDefinition,
  expenseAccountKey,
  isDebitNormal,
  isLedgerSystemKey,
} from "@/lib/ledger-accounts";

/**
 * The chart of accounts and the vocabulary the ledger posts in.
 *
 * `lib/ledger-accounts.ts` is deliberately prisma-free (client components read
 * it), so the string unions mirror the Prisma enums. THIS file is what keeps
 * them honest: it imports both and fails if either side gains or loses a value.
 */

describe("enum mirrors", () => {
  it("mirrors every LedgerAccountType", () => {
    expect([...LEDGER_ACCOUNT_TYPES].sort()).toEqual(Object.keys(LedgerAccountType).sort());
  });

  it("mirrors every LedgerSourceType", () => {
    expect([...LEDGER_SOURCE_TYPES].sort()).toEqual(Object.keys(LedgerSourceType).sort());
  });
});

describe("default chart", () => {
  it("has unique codes and unique system keys", () => {
    // Either collision means two "bank" accounts, and money posted to
    // whichever one the query happened to find first.
    const codes = DEFAULT_CHART_OF_ACCOUNTS.map((account) => account.code);
    const keys = DEFAULT_CHART_OF_ACCOUNTS.map((account) => account.systemKey).filter(Boolean);
    expect(new Set(codes).size).toBe(codes.length);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("provisions every account the posting rules name", () => {
    // A posting rule that names a key nobody provisions is a runtime failure on
    // the first payment of the term.
    for (const key of [
      "cash",
      "bank",
      "fees_receivable",
      "student_credit",
      "fee_income",
      "discounts",
      "refunds",
      "expense_default",
      "suspense",
    ]) {
      expect(accountDefinition(key as never).systemKey).toBe(key);
    }
  });

  it("keeps income credit-normal and assets debit-normal", () => {
    expect(isDebitNormal("ASSET")).toBe(true);
    expect(isDebitNormal("EXPENSE")).toBe(true);
    expect(isDebitNormal("INCOME")).toBe(false);
    expect(isDebitNormal("LIABILITY")).toBe(false);
    expect(isDebitNormal("EQUITY")).toBe(false);
  });

  it("orders account types the way a trial balance reads", () => {
    expect(ACCOUNT_TYPE_ORDER).toEqual(["ASSET", "LIABILITY", "EQUITY", "INCOME", "EXPENSE"]);
  });

  it("refuses to invent a definition for an unknown key", () => {
    expect(() => accountDefinition("not_a_key" as never)).toThrow(/No provisioned ledger account/);
  });
});

describe("expense category keys", () => {
  it("normalises case, spacing and punctuation to one account", () => {
    // "Diesel / Generator" and "diesel generator" are the same cost centre.
    // Two accounts for it is how the trial balance becomes unreadable.
    const a = expenseAccountKey("Diesel / Generator");
    const b = expenseAccountKey("diesel generator");
    const c = expenseAccountKey("  DIESEL   GENERATOR  ");
    expect(a).toBe("expense:diesel_generator");
    expect(b).toBe(a);
    expect(c).toBe(a);
  });

  it("never returns a bare prefix", () => {
    expect(expenseAccountKey("   ")).toBe("expense:uncategorised");
    expect(expenseAccountKey("!!!")).toBe("expense:uncategorised");
  });

  it("accepts generated keys and rejects invented ones", () => {
    expect(isLedgerSystemKey("expense:diesel_generator")).toBe(true);
    expect(isLedgerSystemKey("fee_income")).toBe(true);
    expect(isLedgerSystemKey("expense:")).toBe(false);
    expect(isLedgerSystemKey("made_up_account")).toBe(false);
  });
});
