import { describe, it, expect, vi, beforeEach } from "vitest";
import { mockPrisma } from "../setup";

describe("Finance — Collision-safe receipt/reference generation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("generateReceiptNumber returns YKC-RCP-YYYY-XXXXXXXX format", async () => {
    const { generateReceiptNumber } = await import("@/lib/finance");
    const receipt = generateReceiptNumber();
    const year = new Date().getFullYear();

    expect(receipt).toMatch(new RegExp(`^YKC-RCP-${year}-[A-F0-9]{8}$`));
  });

  it("generatePaymentReference returns YKC-PAY-YYYY-XXXXXXXXXXXX format", async () => {
    const { generatePaymentReference } = await import("@/lib/finance");
    const ref = generatePaymentReference();
    const year = new Date().getFullYear();

    expect(ref).toMatch(new RegExp(`^YKC-PAY-${year}-[A-F0-9]{12}$`));
  });

  it("generateReceiptNumber produces unique values", async () => {
    const { generateReceiptNumber } = await import("@/lib/finance");
    const receipts = new Set<string>();

    for (let i = 0; i < 1000; i++) {
      receipts.add(generateReceiptNumber());
    }

    // All 1000 should be unique (128-bit UUID → collision probability is negligible)
    expect(receipts.size).toBe(1000);
  });

  it("generatePaymentReference produces unique values", async () => {
    const { generatePaymentReference } = await import("@/lib/finance");
    const refs = new Set<string>();

    for (let i = 0; i < 1000; i++) {
      refs.add(generatePaymentReference());
    }

    expect(refs.size).toBe(1000);
  });

  it("generateUniqueReceiptNumber checks DB for collisions", async () => {
    mockPrisma.feePayment.findUnique
      .mockResolvedValueOnce({ id: "existing" })
      .mockResolvedValueOnce(null);

    const { generateUniqueReceiptNumber } = await import("@/lib/finance");
    const receipt = await generateUniqueReceiptNumber();

    expect(receipt).toBeTruthy();
    expect(mockPrisma.feePayment.findUnique).toHaveBeenCalledTimes(2);
  });

  it("generateUniqueReceiptNumber throws after max retries", async () => {
    mockPrisma.feePayment.findUnique.mockResolvedValue({ id: "always-exists" });

    const { generateUniqueReceiptNumber } = await import("@/lib/finance");

    await expect(generateUniqueReceiptNumber(3)).rejects.toThrow(
      "Failed to generate unique receipt number after retries",
    );
  });
});
