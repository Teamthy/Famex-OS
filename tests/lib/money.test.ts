import { describe, it, expect } from "vitest";
import {
  KOBO_PER_NAIRA,
  assertIntegerAmount,
  assertPositiveAmount,
  assertSignedAmount,
  formatKobo,
  formatNaira,
  isWholeNaira,
  koboToNaira,
  nairaToKobo,
  negate,
  percentOfKobo,
  sumAbsKobo,
  sumKobo,
} from "@/lib/money";

/**
 * Money (Rule 2). The base stores fee documents in whole naira and the gateway
 * in kobo; the W3 ledger is kobo. This file is the single conversion point, so
 * these tests are the ones that stop a ₦8,500 payment becoming ₦850,000 — or
 * ₦85.
 */

describe("unit conversion", () => {
  it("converts whole naira to kobo exactly", () => {
    expect(nairaToKobo(8_500)).toBe(850_000);
    expect(nairaToKobo(0)).toBe(0);
    expect(nairaToKobo(1)).toBe(KOBO_PER_NAIRA);
  });

  it("round-trips", () => {
    for (const naira of [1, 25, 8_500, 150_000, 1_000_000]) {
      expect(koboToNaira(nairaToKobo(naira))).toBe(naira);
    }
  });

  it("refuses fractional naira instead of rounding it", () => {
    // The documents cannot hold 8500.5 naira. Silently rounding here would
    // move money that nobody decided to move.
    expect(() => nairaToKobo(8_500.5)).toThrow(/whole number of naira/);
  });

  it("refuses NaN, Infinity and non-numbers", () => {
    expect(() => nairaToKobo(NaN)).toThrow();
    expect(() => nairaToKobo(Infinity)).toThrow();
    expect(() => assertIntegerAmount("8500" as unknown as number)).toThrow();
  });

  it("knows when a kobo amount is whole naira", () => {
    expect(isWholeNaira(850_000)).toBe(true);
    expect(isWholeNaira(850_050)).toBe(false);
  });
});

describe("integer arithmetic", () => {
  it("sums without floating-point drift", () => {
    // 0.1 + 0.2 !== 0.3 in binary floating point. In kobo it is exactly 30.
    const tenKobo = 10;
    const twentyKobo = 20;
    expect(sumKobo([tenKobo, twentyKobo])).toBe(30);
    expect(sumKobo([tenKobo, twentyKobo])).not.toBe(30.000000000000004);
  });

  it("sums a term's collections exactly", () => {
    // A hundred payments of ₦12,345.67 — an amount that is not whole naira and
    // therefore only representable in kobo.
    const payments = Array.from({ length: 100 }, () => 1_234_567);
    expect(sumKobo(payments)).toBe(123_456_700);
  });

  it("sums absolute values regardless of direction", () => {
    expect(sumAbsKobo([500, -300, 200])).toBe(1_000);
  });

  it("negates without producing -0", () => {
    expect(negate(0)).toBe(0);
    expect(Object.is(negate(0), 0)).toBe(true);
    expect(negate(850_000)).toBe(-850_000);
  });

  it("rejects a zero ledger leg", () => {
    expect(() => assertSignedAmount(0)).toThrow(/must not be zero/);
  });

  it("rejects a non-positive payment", () => {
    expect(() => assertPositiveAmount(0)).toThrow(/greater than zero/);
    expect(() => assertPositiveAmount(-100)).toThrow(/greater than zero/);
  });

  it("computes a percentage as a rounded integer, never a float balance", () => {
    expect(percentOfKobo(333_333, 50)).toBe(166_667);
    expect(Number.isInteger(percentOfKobo(123_456, 33.3))).toBe(true);
  });
});

describe("display", () => {
  it("formats whole naira without decimals", () => {
    expect(formatKobo(850_000)).toBe("₦8,500");
  });

  it("never hides a kobo remainder — a statement must not look settled", () => {
    // Without this, a ₦8,500.50 balance prints as ₦8,500 and the family is
    // asked for money that does not clear the invoice.
    expect(formatKobo(850_050)).toBe("₦8,500.50");
    expect(formatKobo(850_050, { decimals: false })).toBe("₦8,500.50");
  });

  it("shows kobo on request", () => {
    expect(formatKobo(850_000, { decimals: true })).toBe("₦8,500.00");
    expect(formatKobo(1, { decimals: true })).toBe("₦0.01");
  });

  it("marks negative balances", () => {
    expect(formatKobo(-850_000)).toBe("-₦8,500");
  });

  it("formats a document amount in naira", () => {
    expect(formatNaira(12_500)).toBe("₦12,500");
  });
});
