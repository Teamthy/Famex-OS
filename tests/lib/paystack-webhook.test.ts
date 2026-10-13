import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createHmac } from "crypto";

/**
 * Paystack webhook signature verification.
 *
 * This is the trust boundary for money: anything that passes this check is
 * treated as a real, cleared payment. It must reject unsigned, wrong-secret and
 * tampered payloads, and must compare in constant time so the digest can't be
 * recovered byte-by-byte via timing.
 */

const SECRET = "sk_test_webhook_secret_for_tests";

function sign(body: string, secret = SECRET) {
  return createHmac("sha512", secret).update(body).digest("hex");
}

describe("verifyPaystackWebhookSignature", () => {
  beforeEach(() => {
    vi.resetModules();
    process.env.PAYSTACK_SECRET_KEY = SECRET;
  });

  afterEach(() => {
    delete process.env.PAYSTACK_SECRET_KEY;
  });

  it("accepts a correctly signed body", async () => {
    const { verifyPaystackWebhookSignature } = await import("@/lib/paystack");
    const body = JSON.stringify({ event: "charge.success", data: { reference: "ref_1" } });

    expect(verifyPaystackWebhookSignature(body, sign(body))).toBe(true);
  });

  it("rejects a missing signature header", async () => {
    const { verifyPaystackWebhookSignature } = await import("@/lib/paystack");
    const body = JSON.stringify({ event: "charge.success" });

    expect(verifyPaystackWebhookSignature(body, null)).toBe(false);
    expect(verifyPaystackWebhookSignature(body, "")).toBe(false);
  });

  it("rejects a signature produced with the wrong secret", async () => {
    const { verifyPaystackWebhookSignature } = await import("@/lib/paystack");
    const body = JSON.stringify({ event: "charge.success" });

    expect(verifyPaystackWebhookSignature(body, sign(body, "sk_wrong_secret"))).toBe(false);
  });

  it("rejects a tampered amount — the signature no longer matches", async () => {
    const { verifyPaystackWebhookSignature } = await import("@/lib/paystack");

    const original = JSON.stringify({
      event: "charge.success",
      data: { reference: "ref_1", amount: 5_000_00 },
    });
    const signature = sign(original);

    // Attacker inflates the amount but replays the original signature.
    const tampered = JSON.stringify({
      event: "charge.success",
      data: { reference: "ref_1", amount: 5_000_000_00 },
    });

    expect(verifyPaystackWebhookSignature(tampered, signature)).toBe(false);
  });

  it("rejects a signature of the wrong length without throwing", async () => {
    const { verifyPaystackWebhookSignature } = await import("@/lib/paystack");
    const body = JSON.stringify({ event: "charge.success" });

    // timingSafeEqual throws on length mismatch, so the length pre-check matters.
    expect(() => verifyPaystackWebhookSignature(body, "abc123")).not.toThrow();
    expect(verifyPaystackWebhookSignature(body, "abc123")).toBe(false);
  });

  it("is sensitive to a single flipped byte", async () => {
    const { verifyPaystackWebhookSignature } = await import("@/lib/paystack");
    const body = JSON.stringify({ event: "charge.success", data: { reference: "ref_1" } });

    const good = sign(body);
    const flipped = (good[0] === "a" ? "b" : "a") + good.slice(1);

    expect(verifyPaystackWebhookSignature(body, flipped)).toBe(false);
  });

  it("treats an empty body as signable but distinct", async () => {
    const { verifyPaystackWebhookSignature } = await import("@/lib/paystack");

    expect(verifyPaystackWebhookSignature("", sign(""))).toBe(true);
    expect(verifyPaystackWebhookSignature("", sign("not empty"))).toBe(false);
  });

  it("throws when PAYSTACK_SECRET_KEY is unset rather than silently passing", async () => {
    delete process.env.PAYSTACK_SECRET_KEY;
    vi.resetModules();

    const { verifyPaystackWebhookSignature } = await import("@/lib/paystack");
    // Fail loud on misconfiguration — never fall through to "valid".
    expect(() => verifyPaystackWebhookSignature("body", "a".repeat(128))).toThrow(
      /PAYSTACK_SECRET_KEY/,
    );
  });
});

describe("toPrismaJson", () => {
  beforeEach(() => {
    vi.resetModules();
    process.env.PAYSTACK_SECRET_KEY = SECRET;
  });

  it("round-trips a provider payload to plain JSON", async () => {
    const { toPrismaJson } = await import("@/lib/paystack");
    const result = toPrismaJson({ status: "success", amount: 1000, nested: { a: 1 } });

    expect(result).toEqual({ status: "success", amount: 1000, nested: { a: 1 } });
  });

  it("normalises null and undefined to null", async () => {
    const { toPrismaJson } = await import("@/lib/paystack");

    expect(toPrismaJson(null)).toBeNull();
    expect(toPrismaJson(undefined)).toBeNull();
  });

  it("strips functions and undefined members that Prisma cannot store", async () => {
    const { toPrismaJson } = await import("@/lib/paystack");
    const result = toPrismaJson({ keep: "yes", drop: undefined, fn: () => "x" }) as Record<
      string,
      unknown
    >;

    expect(result).toEqual({ keep: "yes" });
  });
});
