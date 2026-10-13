import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

/**
 * Paystack transaction verification — the trust boundary for school fees.
 *
 * The classification matters more than the happy path. `definite` decides
 * whether app/api/parent/fees/payments marks an attempt FAILED, so the split
 * has to be exactly right:
 *
 *   definite     Paystack answered authoritatively "not paid / does not match"
 *   inconclusive we never got an answer — the money may already have moved
 *
 * Getting it the wrong way round strands real payments.
 */

const SECRET = "sk_test_verification_secret";

const REFERENCE = "ykay_fee_abc123";
const AMOUNT_KOBO = 45_000_00;
const EMAIL = "parent@example.com";

function successPayload(overrides: Record<string, unknown> = {}) {
  return {
    status: true,
    message: "Verification successful",
    data: {
      status: "success",
      reference: REFERENCE,
      amount: AMOUNT_KOBO,
      currency: "NGN",
      paid_at: "2026-09-07T10:00:00.000Z",
      customer: { email: EMAIL },
      metadata: { invoiceId: "inv_1" },
      ...overrides,
    },
  };
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

async function loadVerify() {
  const mod = await import("@/lib/paystack");
  return { verify: mod.verifyPaystackTransaction, Err: mod.PaystackVerificationError };
}

describe("verifyPaystackTransaction classification", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllGlobals();
    process.env.PAYSTACK_SECRET_KEY = SECRET;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.PAYSTACK_SECRET_KEY;
  });

  it("returns the verified payload when everything matches", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => jsonResponse(successPayload())),
    );
    const { verify } = await loadVerify();

    const result = (await verify(REFERENCE, AMOUNT_KOBO, EMAIL)) as Record<string, unknown>;

    expect(result.status).toBe("success");
    expect(result.reference).toBe(REFERENCE);
    expect(result.amount).toBe(AMOUNT_KOBO);
  });

  it("matches the payer email case-insensitively and with padding", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        jsonResponse(successPayload({ customer: { email: "  Parent@Example.COM " } })),
      ),
    );
    const { verify } = await loadVerify();

    await expect(verify(REFERENCE, AMOUNT_KOBO, EMAIL)).resolves.toBeDefined();
  });

  describe("definite refusals — Paystack answered, so FAILED is safe", () => {
    it.each([
      ["the transaction is not paid", successPayload({ status: "pending" })],
      ["the transaction was abandoned", successPayload({ status: "abandoned" })],
      ["the amount is lower than the invoice", successPayload({ amount: 10_000_00 })],
      ["the amount is higher than the invoice", successPayload({ amount: 99_000_00 })],
      ["the currency is not NGN", successPayload({ currency: "USD" })],
      [
        "the payer email belongs to someone else",
        successPayload({ customer: { email: "other@example.com" } }),
      ],
    ])("is definite when %s", async (_label, payload) => {
      vi.stubGlobal(
        "fetch",
        vi.fn(async () => jsonResponse(payload)),
      );
      const { verify, Err } = await loadVerify();

      const error = await verify(REFERENCE, AMOUNT_KOBO, EMAIL).catch((e: unknown) => e);

      expect(error).toBeInstanceOf(Err);
      expect((error as InstanceType<typeof Err>).definite).toBe(true);
    });
  });

  describe("inconclusive failures — the money may already have moved", () => {
    it("is inconclusive when fetch throws (network down, DNS, TLS, reset)", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn(async () => {
          throw new TypeError("fetch failed");
        }),
      );
      const { verify, Err } = await loadVerify();

      const error = await verify(REFERENCE, AMOUNT_KOBO, EMAIL).catch((e: unknown) => e);

      expect(error).toBeInstanceOf(Err);
      expect((error as InstanceType<typeof Err>).definite).toBe(false);
    });

    it("is inconclusive on a 500 from Paystack", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn(async () => jsonResponse({ status: false, message: "Server error" }, 500)),
      );
      const { verify, Err } = await loadVerify();

      const error = await verify(REFERENCE, AMOUNT_KOBO, EMAIL).catch((e: unknown) => e);

      expect((error as InstanceType<typeof Err>).definite).toBe(false);
    });

    it("is inconclusive on a 429 rate limit", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn(async () => jsonResponse({ status: false, message: "Rate limited" }, 429)),
      );
      const { verify, Err } = await loadVerify();

      const error = await verify(REFERENCE, AMOUNT_KOBO, EMAIL).catch((e: unknown) => e);

      expect((error as InstanceType<typeof Err>).definite).toBe(false);
    });

    it("is inconclusive when the reference is not found yet (404)", async () => {
      // Paystack can 404 briefly after a redirect. That is not proof of
      // non-payment, so it must not fail the attempt.
      vi.stubGlobal(
        "fetch",
        vi.fn(async () => jsonResponse({ status: false, message: "Transaction not found" }, 404)),
      );
      const { verify, Err } = await loadVerify();

      const error = await verify(REFERENCE, AMOUNT_KOBO, EMAIL).catch((e: unknown) => e);

      expect((error as InstanceType<typeof Err>).definite).toBe(false);
    });

    it("is inconclusive on a non-JSON body from an intermediary proxy", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn(async () => new Response("<html>502 Bad Gateway</html>", { status: 502 })),
      );
      const { verify, Err } = await loadVerify();

      const error = await verify(REFERENCE, AMOUNT_KOBO, EMAIL).catch((e: unknown) => e);

      expect(error).toBeInstanceOf(Err);
      expect((error as InstanceType<typeof Err>).definite).toBe(false);
    });

    it("is inconclusive when status:true but data is missing", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn(async () => jsonResponse({ status: true, message: "ok" })),
      );
      const { verify, Err } = await loadVerify();

      const error = await verify(REFERENCE, AMOUNT_KOBO, EMAIL).catch((e: unknown) => e);

      expect((error as InstanceType<typeof Err>).definite).toBe(false);
    });
  });

  it("never leaks the secret key or raw provider response into the message", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => jsonResponse({ status: false, message: "Invalid key sk_live_XYZ" }, 401)),
    );
    const { verify } = await loadVerify();

    const error = (await verify(REFERENCE, AMOUNT_KOBO, EMAIL).catch((e: unknown) => e)) as Error;

    expect(error.message).not.toContain(SECRET);
    expect(error.message).not.toContain("sk_live_XYZ");
    expect(error.message).toMatch(/contact the bursary/i);
  });

  it("throws on a missing secret key rather than calling Paystack unauthenticated", async () => {
    delete process.env.PAYSTACK_SECRET_KEY;
    vi.resetModules();
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const { verify } = await loadVerify();

    await expect(verify(REFERENCE, AMOUNT_KOBO, EMAIL)).rejects.toThrow(/PAYSTACK_SECRET_KEY/);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("PaystackVerificationError", () => {
  it("defaults to inconclusive, so a new throw site cannot silently fail a payment", async () => {
    const { PaystackVerificationError } = await import("@/lib/paystack");

    expect(new PaystackVerificationError("x").definite).toBe(false);
    expect(new PaystackVerificationError("x", {}).definite).toBe(false);
    expect(new PaystackVerificationError("x", { definite: true }).definite).toBe(true);
  });

  it("is catchable as a plain Error", async () => {
    const { PaystackVerificationError } = await import("@/lib/paystack");
    const error: unknown = new PaystackVerificationError("boom", { definite: true });

    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toBe("boom");
    expect((error as Error).name).toBe("PaystackVerificationError");
  });
});
