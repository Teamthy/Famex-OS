import { describe, it, expect } from "vitest";

/**
 * Invoice status derivation.
 *
 * `computeInvoiceStatus` decides whether a parent sees "PAID", "PARTIAL",
 * "OVERDUE" or "UNPAID", and it gates CBT access via lib/fee-lock. Getting
 * PAID wrong either locks out a parent who has settled, or lets an unpaid
 * student sit an exam.
 */
describe("Finance — computeInvoiceStatus", () => {
  const past = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const future = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  it("marks PAID when payment exactly settles the invoice", async () => {
    const { computeInvoiceStatus } = await import("@/lib/finance");
    const { FeeInvoiceStatus } = await import("@prisma/client");
    expect(computeInvoiceStatus(50_000, 50_000)).toBe(FeeInvoiceStatus.PAID);
  });

  it("marks PAID on overpayment rather than falling back to PARTIAL", async () => {
    const { computeInvoiceStatus } = await import("@/lib/finance");
    const { FeeInvoiceStatus } = await import("@prisma/client");
    expect(computeInvoiceStatus(50_000, 60_000)).toBe(FeeInvoiceStatus.PAID);
  });

  it("PAID takes precedence over an elapsed due date", async () => {
    const { computeInvoiceStatus } = await import("@/lib/finance");
    const { FeeInvoiceStatus } = await import("@prisma/client");
    // Settled late — must not be reported as OVERDUE.
    expect(computeInvoiceStatus(50_000, 50_000, past)).toBe(FeeInvoiceStatus.PAID);
  });

  it("marks PARTIAL for any non-zero payment below the total", async () => {
    const { computeInvoiceStatus } = await import("@/lib/finance");
    const { FeeInvoiceStatus } = await import("@prisma/client");
    expect(computeInvoiceStatus(50_000, 1)).toBe(FeeInvoiceStatus.PARTIAL);
    expect(computeInvoiceStatus(50_000, 49_999)).toBe(FeeInvoiceStatus.PARTIAL);
  });

  it("PARTIAL takes precedence over an elapsed due date", async () => {
    const { computeInvoiceStatus } = await import("@/lib/finance");
    const { FeeInvoiceStatus } = await import("@prisma/client");
    // Part-paid and late still reads PARTIAL — the parent has engaged.
    expect(computeInvoiceStatus(50_000, 20_000, past)).toBe(FeeInvoiceStatus.PARTIAL);
  });

  it("marks OVERDUE when nothing is paid and the due date has passed", async () => {
    const { computeInvoiceStatus } = await import("@/lib/finance");
    const { FeeInvoiceStatus } = await import("@prisma/client");
    expect(computeInvoiceStatus(50_000, 0, past)).toBe(FeeInvoiceStatus.OVERDUE);
  });

  it("marks UNPAID when nothing is paid and the due date is ahead", async () => {
    const { computeInvoiceStatus } = await import("@/lib/finance");
    const { FeeInvoiceStatus } = await import("@prisma/client");
    expect(computeInvoiceStatus(50_000, 0, future)).toBe(FeeInvoiceStatus.UNPAID);
  });

  it("marks UNPAID when no due date is set", async () => {
    const { computeInvoiceStatus } = await import("@/lib/finance");
    const { FeeInvoiceStatus } = await import("@prisma/client");
    expect(computeInvoiceStatus(50_000, 0)).toBe(FeeInvoiceStatus.UNPAID);
    expect(computeInvoiceStatus(50_000, 0, null)).toBe(FeeInvoiceStatus.UNPAID);
  });

  it("treats a zero-total invoice as PAID", async () => {
    const { computeInvoiceStatus } = await import("@/lib/finance");
    const { FeeInvoiceStatus } = await import("@prisma/client");
    // 0 >= 0 — a waived/scholarship invoice should not read as UNPAID.
    expect(computeInvoiceStatus(0, 0)).toBe(FeeInvoiceStatus.PAID);
  });
});

describe("Finance — label helpers", () => {
  it("renders payment methods for receipts", async () => {
    const { feeMethodLabel } = await import("@/lib/finance");
    const { FeePaymentMethod } = await import("@prisma/client");

    expect(feeMethodLabel(FeePaymentMethod.BANK_TRANSFER)).toBe("Bank Transfer");
    expect(feeMethodLabel(FeePaymentMethod.CASH)).toBe("Cash");
    expect(feeMethodLabel(FeePaymentMethod.CARD)).toBe("Card");
    expect(feeMethodLabel(FeePaymentMethod.USSD)).toBe("USSD");
    expect(feeMethodLabel(FeePaymentMethod.PAYSTACK)).toBe("Paystack");
  });

  it("humanises underscored enum values", async () => {
    const { feeStatusLabel, paymentStatusLabel } = await import("@/lib/finance");
    const { FeeInvoiceStatus, FeePaymentStatus } = await import("@prisma/client");

    expect(feeStatusLabel(FeeInvoiceStatus.PAID)).toBe("PAID");
    expect(paymentStatusLabel(FeePaymentStatus.COMPLETED)).toBe("COMPLETED");
  });
});
