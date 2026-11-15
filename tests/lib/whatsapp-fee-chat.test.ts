import { AlertChannel, NotificationKind, PaymentProvider, PaymentStatus } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  customerServiceWindowOpen,
  normaliseWhatsAppPhone,
  processWhatsAppFeeMessage,
} from "@/lib/whatsapp-fee-chat";
import { mockPrisma } from "../setup";

const { initializePaystackTransaction, sendWhatsapp } = vi.hoisted(() => ({
  initializePaystackTransaction: vi.fn(),
  sendWhatsapp: vi.fn(),
}));

vi.mock("@/lib/paystack", () => ({ initializePaystackTransaction }));
vi.mock("@/lib/whatsapp", () => ({ sendWhatsapp }));

describe("WhatsApp fee chat", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NEXT_PUBLIC_SITE_URL = "https://school.example";
    mockPrisma.school.findFirst.mockResolvedValue({
      id: "school_1",
      slug: "famex",
      name: "Famex",
      subdomain: null,
      customDomain: null,
      status: "ACTIVE",
    });
    mockPrisma.whatsAppInboundMessage.create.mockResolvedValue({
      id: "inbound_1",
      replyText: null,
      replyAcceptedAt: null,
    });
    mockPrisma.whatsAppInboundMessage.findUnique.mockResolvedValue(null);
    mockPrisma.whatsAppInboundMessage.updateMany.mockResolvedValue({ count: 1 });
    mockPrisma.whatsAppInboundMessage.update.mockResolvedValue({});
    mockPrisma.parentProfile.findMany.mockResolvedValue([
      {
        id: "parent_1",
        userId: "user_1",
        phone: "+234 803 123 4567",
        user: { email: "parent@example.com" },
      },
    ]);
    mockPrisma.communicationConsent.findUnique.mockResolvedValue(null);
    mockPrisma.feeInvoice.findFirst.mockResolvedValue({
      id: "invoice_1",
      invoiceNumber: "INV-2026-01",
      balanceDue: 25000,
      studentProfileId: "student_1",
      parentProfileId: "parent_1",
      studentProfile: { displayName: "Ada Example" },
    });
    mockPrisma.feePaymentAttempt.findUnique.mockResolvedValue(null);
    mockPrisma.feePaymentAttempt.create.mockResolvedValue({
      id: "attempt_1",
      schoolId: "school_1",
      invoiceId: "invoice_1",
      studentProfileId: "student_1",
      parentProfileId: "parent_1",
      amount: 25000,
      provider: PaymentProvider.PAYSTACK,
      reference: "YKC-WA-FEE-1234567890ABCDEF",
      status: PaymentStatus.PENDING,
    });
    initializePaystackTransaction.mockResolvedValue({
      authorization_url: "https://checkout.paystack.com/secure",
    });
    sendWhatsapp.mockResolvedValue({ channel: "whatsapp", messageId: "wamid.reply" });
  });

  it("normalizes Nigerian phone numbers and requires a valid 24-hour window", () => {
    expect(normaliseWhatsAppPhone("0803 123 4567")).toBe("2348031234567");
    expect(normaliseWhatsAppPhone("+234 803 123 4567")).toBe("2348031234567");
    expect(normaliseWhatsAppPhone("12345")).toBeNull();
    expect(customerServiceWindowOpen("2000000000", 2000000000 * 1000)).toBe(true);
    expect(customerServiceWindowOpen("1999913599", 2000000000 * 1000)).toBe(false);
    expect(customerServiceWindowOpen("not-a-timestamp", 2000000000 * 1000)).toBe(false);
  });

  it("creates only a pending attempt and secure checkout; the Paystack webhook remains settlement authority", async () => {
    await processWhatsAppFeeMessage({
      id: "wamid.inbound.1",
      from: "2348031234567",
      timestamp: String(Math.floor(Date.now() / 1000)),
      text: "PAY INV-2026-01",
    });

    expect(mockPrisma.feePaymentAttempt.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          provider: PaymentProvider.PAYSTACK,
          status: PaymentStatus.PENDING,
          amount: 25000,
          invoiceId: "invoice_1",
        }),
      }),
    );
    expect(initializePaystackTransaction).toHaveBeenCalledWith(
      expect.objectContaining({
        amount: 2500000,
        metadata: expect.objectContaining({ kind: "SCHOOL_FEE", invoiceId: "invoice_1" }),
      }),
    );
    expect(sendWhatsapp).toHaveBeenCalledWith(
      expect.objectContaining({ to: "2348031234567", allowSmsFallback: false }),
    );
    expect(sendWhatsapp.mock.calls[0][0].text).not.toContain("Ada Example");
    expect(mockPrisma.feePayment.create).not.toHaveBeenCalled();
    expect(mockPrisma.feeInvoice.update).not.toHaveBeenCalled();
    expect(mockPrisma.communicationConsent.findUnique).toHaveBeenCalledWith({
      where: {
        userId_channel_kind: {
          userId: "user_1",
          channel: AlertChannel.WHATSAPP,
          kind: NotificationKind.FEE_REMINDER,
        },
      },
      select: { optedIn: true },
    });
  });

  it("does not put student names or invoice titles into outbound WhatsApp fee replies", async () => {
    mockPrisma.feeInvoice.findMany.mockResolvedValue([
      { invoiceNumber: "INV-2026-01", balanceDue: 25000 },
    ] as never);

    await processWhatsAppFeeMessage({
      id: "wamid.list",
      from: "2348031234567",
      timestamp: String(Math.floor(Date.now() / 1000)),
      text: "INVOICES",
    });

    expect(mockPrisma.feeInvoice.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        select: { invoiceNumber: true, balanceDue: true },
      }),
    );
    expect(sendWhatsapp.mock.calls[0][0].text).toContain("INV-2026-01");
    expect(sendWhatsapp.mock.calls[0][0].text).not.toContain("Ada Example");
    expect(sendWhatsapp.mock.calls[0][0].text).not.toContain("Tuition title");
  });

  it("does not send fee information when WhatsApp fee consent was withdrawn", async () => {
    mockPrisma.communicationConsent.findUnique.mockResolvedValue({ optedIn: false });

    await processWhatsAppFeeMessage({
      id: "wamid.opted-out",
      from: "2348031234567",
      timestamp: String(Math.floor(Date.now() / 1000)),
      text: "INVOICES",
    });

    expect(mockPrisma.whatsAppInboundMessage.updateMany).toHaveBeenCalledWith({
      where: { id: "inbound_1", status: "PROCESSING", processingToken: expect.any(String) },
      data: expect.objectContaining({ parentProfileId: "parent_1", status: "IGNORED" }),
    });
    expect(sendWhatsapp).not.toHaveBeenCalled();
    expect(mockPrisma.feePaymentAttempt.create).not.toHaveBeenCalled();
  });

  it("does not reprocess a duplicate while another fresh receipt claim is active", async () => {
    mockPrisma.whatsAppInboundMessage.create.mockRejectedValue({ code: "P2002" });
    mockPrisma.whatsAppInboundMessage.findUnique.mockResolvedValue({
      id: "inbound_1",
      schoolId: "school_1",
      status: "PROCESSING",
      replyText: null,
      replyAcceptedAt: null,
      updatedAt: new Date(),
    } as never);
    mockPrisma.whatsAppInboundMessage.updateMany.mockResolvedValue({ count: 0 });

    await processWhatsAppFeeMessage({
      id: "wamid.duplicate",
      from: "2348031234567",
      timestamp: String(Math.floor(Date.now() / 1000)),
      text: "INVOICES",
    });

    expect(mockPrisma.whatsAppInboundMessage.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: "inbound_1",
          OR: expect.arrayContaining([
            { status: { in: ["RECEIVED", "FAILED"] } },
            expect.objectContaining({ status: "PROCESSING", updatedAt: { lt: expect.any(Date) } }),
          ]),
        }),
      }),
    );
    expect(mockPrisma.feePaymentAttempt.create).not.toHaveBeenCalled();
    expect(sendWhatsapp).not.toHaveBeenCalled();
  });

  it("reclaims a stale processing lease after an abandoned worker", async () => {
    mockPrisma.whatsAppInboundMessage.create.mockRejectedValue({ code: "P2002" });
    mockPrisma.whatsAppInboundMessage.findUnique.mockResolvedValue({
      id: "inbound_1",
      schoolId: "school_1",
      status: "PROCESSING",
      replyText: null,
      replyAcceptedAt: null,
      updatedAt: new Date(Date.now() - 11 * 60 * 1000),
    } as never);
    mockPrisma.parentProfile.findMany.mockResolvedValue([]);

    await processWhatsAppFeeMessage({
      id: "wamid.stale",
      from: "2348031234567",
      timestamp: String(Math.floor(Date.now() / 1000)),
      text: "INVOICES",
    });

    expect(mockPrisma.whatsAppInboundMessage.updateMany).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        where: expect.objectContaining({
          OR: expect.arrayContaining([
            expect.objectContaining({ status: "PROCESSING", updatedAt: { lt: expect.any(Date) } }),
          ]),
        }),
        data: expect.objectContaining({
          status: "PROCESSING",
          processingToken: expect.any(String),
        }),
      }),
    );
    expect(mockPrisma.parentProfile.findMany).toHaveBeenCalled();
    expect(sendWhatsapp).not.toHaveBeenCalled();
  });

  it("reclaims failed work and retries the exact persisted response", async () => {
    sendWhatsapp.mockResolvedValueOnce({ channel: "none", error: "timeout" });
    const inbound = {
      id: "wamid.retry",
      from: "2348031234567",
      timestamp: String(Math.floor(Date.now() / 1000)),
      text: "INVOICES",
    };
    await expect(processWhatsAppFeeMessage(inbound)).rejects.toThrow(
      "Meta did not confirm acceptance",
    );
    const preparedReply = sendWhatsapp.mock.calls[0][0].text;

    mockPrisma.whatsAppInboundMessage.create.mockRejectedValue({ code: "P2002" });
    mockPrisma.whatsAppInboundMessage.findUnique.mockResolvedValue({
      id: "inbound_1",
      schoolId: "school_1",
      status: "FAILED",
      replyText: preparedReply,
      replyAcceptedAt: null,
      updatedAt: new Date(),
    } as never);
    sendWhatsapp.mockResolvedValueOnce({ channel: "whatsapp", messageId: "wamid.reply.retry" });

    await processWhatsAppFeeMessage(inbound);

    expect(sendWhatsapp).toHaveBeenCalledTimes(2);
    expect(sendWhatsapp.mock.calls[1][0].text).toBe(preparedReply);
    expect(mockPrisma.feeInvoice.findMany).toHaveBeenCalledTimes(1);
  });

  it("does not answer inbound messages outside Meta's customer-service window", async () => {
    await processWhatsAppFeeMessage({
      id: "wamid.expired",
      from: "2348031234567",
      timestamp: String(Math.floor(Date.now() / 1000) - 86401),
      text: "INVOICES",
    });

    expect(mockPrisma.whatsAppInboundMessage.create).not.toHaveBeenCalled();
    expect(sendWhatsapp).not.toHaveBeenCalled();
  });
});
