import { AlertChannel } from "@prisma/client";
import { afterEach, describe, expect, it } from "vitest";
import { estimateNotificationCostKobo } from "@/lib/notifications";

/**
 * Spend reporting (W4) records an estimated marginal cost at accept time.
 * SMS is per-segment (GSM 160/153, Unicode 70/67); email stays null rather
 * than inventing precision on a plan-based provider.
 */
describe("estimateNotificationCostKobo", () => {
  afterEach(() => {
    delete process.env.NOTIFICATION_SMS_COST_KOBO;
    delete process.env.NOTIFICATION_WHATSAPP_COST_KOBO;
  });

  it("counts SMS segments for GSM text", () => {
    expect(estimateNotificationCostKobo(AlertChannel.SMS, "x".repeat(160))).toBe(650);
    expect(estimateNotificationCostKobo(AlertChannel.SMS, "x".repeat(161))).toBe(1300);
  });

  it("counts shorter segments for Unicode text", () => {
    expect(estimateNotificationCostKobo(AlertChannel.SMS, "₦".repeat(70))).toBe(650);
    expect(estimateNotificationCostKobo(AlertChannel.SMS, "₦".repeat(71))).toBe(1300);
  });

  it("prices WhatsApp flat and leaves email unpriced", () => {
    expect(estimateNotificationCostKobo(AlertChannel.WHATSAPP, "hello")).toBe(500);
    expect(estimateNotificationCostKobo(AlertChannel.EMAIL, "hello")).toBeNull();
  });

  it("honours deployment-configured rates", () => {
    process.env.NOTIFICATION_SMS_COST_KOBO = "700";
    expect(estimateNotificationCostKobo(AlertChannel.SMS, "short")).toBe(700);
  });
});
