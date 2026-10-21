import { AlertDeliveryStatus } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { applyWhatsappStatus } from "@/app/api/webhooks/whatsapp/route";
import { mockPrisma } from "../setup";

/**
 * Delivery receipts (W4): only the provider webhook may promote SENT →
 * DELIVERED or demote SENT → FAILED, matched by provider message id.
 */
describe("applyWhatsappStatus", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.notificationJob.updateMany.mockResolvedValue({ count: 1 });
  });

  it("promotes a SENT job to DELIVERED with the provider timestamp", async () => {
    const changed = await applyWhatsappStatus({
      id: "wamid.123",
      status: "delivered",
      timestamp: "1760000000",
    });
    expect(changed).toBe(true);
    const call = mockPrisma.notificationJob.updateMany.mock.calls[0][0];
    expect(call.where).toEqual({
      providerMessageId: "wamid.123",
      status: AlertDeliveryStatus.SENT,
    });
    expect(call.data.status).toBe(AlertDeliveryStatus.DELIVERED);
    expect(call.data.deliveredAt).toEqual(new Date(1760000000 * 1000));
  });

  it("treats read as delivered", async () => {
    await applyWhatsappStatus({ id: "wamid.9", status: "read" });
    const call = mockPrisma.notificationJob.updateMany.mock.calls[0][0];
    expect(call.data.status).toBe(AlertDeliveryStatus.DELIVERED);
  });

  it("records the provider error on failure", async () => {
    await applyWhatsappStatus({
      id: "wamid.5",
      status: "failed",
      errors: [{ code: 131026, message: "Message undeliverable" }],
    });
    const call = mockPrisma.notificationJob.updateMany.mock.calls[0][0];
    expect(call.data.status).toBe(AlertDeliveryStatus.FAILED);
    expect(call.data.lastError).toContain("Message undeliverable");
  });

  it("ignores sent echoes and malformed statuses without touching the DB", async () => {
    expect(await applyWhatsappStatus({ id: "wamid.1", status: "sent" })).toBe(false);
    expect(await applyWhatsappStatus({ status: "delivered" })).toBe(false);
    expect(mockPrisma.notificationJob.updateMany).not.toHaveBeenCalled();
  });

  it("reports no change for an unknown or already-final message", async () => {
    mockPrisma.notificationJob.updateMany.mockResolvedValue({ count: 0 });
    expect(await applyWhatsappStatus({ id: "wamid.x", status: "delivered" })).toBe(false);
  });
});
