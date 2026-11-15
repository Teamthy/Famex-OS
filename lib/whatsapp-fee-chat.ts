import {
  AlertChannel,
  NotificationKind,
  PaymentProvider,
  PaymentStatus,
  UserRole,
} from "@prisma/client";
import { createHash, randomUUID } from "node:crypto";
import { hasCommunicationConsent, setCommunicationConsent } from "@/lib/communication-consent";
import { getConfiguredSchool } from "@/lib/school-resolution";
import { initializePaystackTransaction } from "@/lib/paystack";
import { prisma } from "@/lib/prisma";
import { getSchoolBrandTokens } from "@/lib/brand";
import { sendWhatsapp } from "@/lib/whatsapp";

export type WhatsAppTextMessage = {
  id: string;
  from: string;
  timestamp: string;
  text: string;
};

export function normaliseWhatsAppPhone(value: string): string | null {
  let digits = value.replace(/\D/g, "");
  if (digits.startsWith("00")) digits = digits.slice(2);
  if (digits.startsWith("0") && digits.length === 11) digits = `234${digits.slice(1)}`;
  if (digits.length === 10) digits = `234${digits}`;
  return /^234\d{10}$/.test(digits) ? digits : null;
}

export function customerServiceWindowOpen(timestamp: string, now = Date.now()): boolean {
  const seconds = Number(timestamp);
  if (!Number.isInteger(seconds) || seconds <= 0) return false;
  const receivedAt = seconds * 1000;
  return receivedAt <= now + 5 * 60 * 1000 && now - receivedAt < 24 * 60 * 60 * 1000;
}

function money(amountNaira: number): string {
  return `₦${amountNaira.toLocaleString("en-NG")}`;
}

async function findParentForPhone(schoolId: string, phone: string) {
  const nationalNumber = phone.slice(3);
  const candidates = await prisma.parentProfile.findMany({
    where: {
      schoolId,
      isActive: true,
      phone: { contains: nationalNumber.slice(-4) },
      user: { schoolId, role: UserRole.PARENT, isActive: true, isSuspended: false },
    },
    select: {
      id: true,
      userId: true,
      phone: true,
      user: { select: { email: true } },
    },
    take: 100,
  });
  const matches = candidates.filter(
    (candidate) => normaliseWhatsAppPhone(candidate.phone ?? "") === phone,
  );
  return matches.length === 1 ? matches[0] : null;
}

async function listOpenInvoices(schoolId: string, parentProfileId: string) {
  return prisma.feeInvoice.findMany({
    where: {
      schoolId,
      balanceDue: { gt: 0 },
      OR: [{ parentProfileId }, { studentProfile: { parentLinks: { some: { parentProfileId } } } }],
    },
    orderBy: [{ issuedAt: "desc" }, { invoiceNumber: "asc" }],
    take: 9,
    select: {
      invoiceNumber: true,
      balanceDue: true,
    },
  });
}

async function buildReply(input: {
  schoolId: string;
  parent: { id: string; userId: string; user: { email: string | null } };
  messageId: string;
  text: string;
}): Promise<string> {
  const command = input.text.trim();

  if (/^(stop|unsubscribe|opt out)$/i.test(command)) {
    await setCommunicationConsent({
      schoolId: input.schoolId,
      userId: input.parent.userId,
      channel: AlertChannel.WHATSAPP,
      kind: NotificationKind.FEE_REMINDER,
      optedIn: false,
      source: "whatsapp_inbound_stop",
    });
    return "";
  }

  if (/^(help|hi|hello|start|fees|invoices)$/i.test(command)) {
    const invoices = await listOpenInvoices(input.schoolId, input.parent.id);
    if (invoices.length === 0) {
      return "There are no outstanding school fee invoices linked to your parent account. Reply HELP for support.";
    }
    const shown = invoices
      .slice(0, 8)
      .map((invoice) => `Invoice ${invoice.invoiceNumber} (${money(invoice.balanceDue)} due)`);
    const more = invoices.length > 8 ? "\nMore invoices are available in the parent portal." : "";
    return `Outstanding invoices:\n${shown.join("\n")}${more}\n\nTo pay an invoice, reply PAY followed by its invoice number. Example: PAY ${invoices[0].invoiceNumber}. Reply STOP to opt out.`;
  }

  const payMatch = command.match(/^pay\s+(?:invoice\s+)?([a-z0-9][a-z0-9-]{1,79})$/i);
  if (!payMatch) {
    return "I can help with school fee invoices. Reply INVOICES to list balances, or PAY followed by an invoice number. Reply STOP to opt out.";
  }

  const invoiceNumber = payMatch[1];
  const invoice = await prisma.feeInvoice.findFirst({
    where: {
      schoolId: input.schoolId,
      invoiceNumber: { equals: invoiceNumber, mode: "insensitive" },
      balanceDue: { gt: 0 },
      OR: [
        { parentProfileId: input.parent.id },
        { studentProfile: { parentLinks: { some: { parentProfileId: input.parent.id } } } },
      ],
    },
    select: {
      id: true,
      invoiceNumber: true,
      balanceDue: true,
      studentProfileId: true,
    },
  });
  if (!invoice) {
    return "I could not find an outstanding invoice with that number linked to your account. Reply INVOICES to see your balances.";
  }

  const email = input.parent.user.email?.trim();
  if (!email) {
    return "A parent-account email is needed to create a secure checkout. Please update your contact details in the parent portal or contact the school office.";
  }

  const digest = createHash("sha256")
    .update(`${input.schoolId}:whatsapp:${input.messageId}`)
    .digest("hex")
    .slice(0, 16)
    .toUpperCase();
  const reference = `WA-FEE-${digest}`;
  const reservation = await prisma.$transaction(async (tx) => {
    // Serialize checkout creation per invoice so two distinct chat messages
    // cannot concurrently create separate pending charges for one balance.
    await tx.$queryRaw`SELECT "id" FROM "FeeInvoice" WHERE "id" = ${invoice.id} AND "schoolId" = ${input.schoolId} FOR UPDATE`;
    const existing = await tx.feePaymentAttempt.findUnique({ where: { reference } });
    if (existing) return { attempt: existing, created: false, blocked: false, amount: null };
    const pending = await tx.feePaymentAttempt.findFirst({
      where: {
        schoolId: input.schoolId,
        invoiceId: invoice.id,
        status: PaymentStatus.PENDING,
      },
      select: { id: true },
    });
    if (pending) return { attempt: null, created: false, blocked: true, amount: null };
    const currentInvoice = await tx.feeInvoice.findFirst({
      where: {
        id: invoice.id,
        schoolId: input.schoolId,
        balanceDue: { gt: 0 },
        OR: [
          { parentProfileId: input.parent.id },
          { studentProfile: { parentLinks: { some: { parentProfileId: input.parent.id } } } },
        ],
      },
      select: { balanceDue: true },
    });
    if (!currentInvoice) return { attempt: null, created: false, blocked: false, amount: null };
    const attempt = await tx.feePaymentAttempt.create({
      data: {
        schoolId: input.schoolId,
        invoiceId: invoice.id,
        studentProfileId: invoice.studentProfileId,
        parentProfileId: input.parent.id,
        provider: PaymentProvider.PAYSTACK,
        amount: currentInvoice.balanceDue,
        reference,
        status: PaymentStatus.PENDING,
        payerEmail: email,
      },
    });
    return { attempt, created: true, blocked: false, amount: currentInvoice.balanceDue };
  });
  if (reservation.blocked) {
    return "A payment request for this invoice is already pending. Please check the parent portal or contact the school bursary before starting another payment.";
  }
  if (!reservation.attempt) {
    return "That invoice is no longer outstanding or linked to your account. Reply INVOICES to check your current balances.";
  }
  if (!reservation.created || reservation.amount === null) {
    return "This WhatsApp request already has a checkout in progress. No second checkout was created; reply INVOICES to check the balance after payment.";
  }
  const attempt = reservation.attempt;
  const paymentAmount = reservation.amount;

  let checkout: Awaited<ReturnType<typeof initializePaystackTransaction>>;
  try {
    const siteUrl = getSchoolBrandTokens().siteUrl;
    const site = siteUrl ? new URL(siteUrl) : null;
    if (!site || site.protocol !== "https:" || site.hostname === "localhost") {
      throw new Error("Canonical HTTPS payment site URL is not configured.");
    }
    checkout = await initializePaystackTransaction({
      email,
      amount: paymentAmount * 100,
      reference,
      callbackUrl: `${siteUrl}/parent/fees?verify=${encodeURIComponent(reference)}`,
      metadata: {
        kind: "SCHOOL_FEE",
        paymentAttemptId: attempt.id,
        invoiceId: invoice.id,
        schoolId: input.schoolId,
      },
    });
    const checkoutUrl = new URL(checkout.authorization_url);
    if (checkoutUrl.protocol !== "https:" || checkoutUrl.hostname !== "checkout.paystack.com") {
      throw new Error("Paystack returned an unexpected checkout host.");
    }
  } catch {
    // A transport failure can happen after Paystack accepted the initialize
    // request. Keep this attempt pending and block a second checkout until a
    // bursar reconciles it; do not tell the parent no payment exists.
    return "I could not confirm checkout setup. Please do not try another payment link yet; contact the school bursary to check this request.";
  }

  return `Secure Paystack checkout for invoice ${invoice.invoiceNumber} (${money(paymentAmount)}):\n${checkout.authorization_url}\n\nPay only at the secure link. The school records payment after its trusted Paystack webhook confirms it; this chat does not mark invoices paid. Keep your receipt until the portal updates. Do not send card or PIN details in this chat.`;
}

/** Process one authenticated Meta text message. It never settles an invoice. */
export async function processWhatsAppFeeMessage(message: WhatsAppTextMessage): Promise<void> {
  if (
    !message.id ||
    !message.from ||
    !message.text ||
    !customerServiceWindowOpen(message.timestamp)
  )
    return;
  const phone = normaliseWhatsAppPhone(message.from);
  if (!phone) return;
  const configured = await getConfiguredSchool();
  if (!configured || configured.status !== "ACTIVE") return;

  // A worker may disappear while PROCESSING. Claims expire after ten minutes;
  // the random token fences off workers that wake up after another retry owns it.
  const token = randomUUID();
  const staleBefore = new Date(Date.now() - 10 * 60 * 1000);
  let receipt: { id: string; replyText?: string | null; replyAcceptedAt?: Date | null } | null =
    null;
  try {
    receipt = await prisma.whatsAppInboundMessage.create({
      data: {
        schoolId: configured.id,
        providerMessageId: message.id,
        status: "PROCESSING",
        processingToken: token,
      },
      select: { id: true, replyText: true, replyAcceptedAt: true },
    });
  } catch (error) {
    if (!(typeof error === "object" && error !== null && "code" in error && error.code === "P2002"))
      throw error;

    const prior = await prisma.whatsAppInboundMessage.findUnique({
      where: { providerMessageId: message.id },
      select: { id: true, schoolId: true, status: true, replyText: true, replyAcceptedAt: true },
    });
    if (!prior || prior.schoolId !== configured.id) return;
    const claimed = await prisma.whatsAppInboundMessage.updateMany({
      where: {
        id: prior.id,
        OR: [
          { status: { in: ["RECEIVED", "FAILED"] } },
          { status: "PROCESSING", updatedAt: { lt: staleBefore } },
        ],
      },
      data: { status: "PROCESSING", processingToken: token, updatedAt: new Date() },
    });
    if (claimed.count !== 1) return;
    receipt = {
      id: prior.id,
      replyText: prior.replyText,
      replyAcceptedAt: prior.replyAcceptedAt,
    };
  }
  if (!receipt) return;

  const receiptId = receipt.id;
  const finish = async (status: "PROCESSED" | "IGNORED") => {
    await prisma.whatsAppInboundMessage.updateMany({
      where: { id: receiptId, status: "PROCESSING", processingToken: token },
      data: { status, processingToken: null, updatedAt: new Date() },
    });
  };

  try {
    // A prior worker may have obtained provider acceptance but crashed before
    // the final receipt write. Do not deliberately send again after acceptance.
    if (receipt.replyAcceptedAt) {
      await finish("PROCESSED");
      return;
    }

    const parent = await findParentForPhone(configured.id, phone);
    if (!parent) {
      await finish("IGNORED");
      return;
    }

    const isStop = /^(stop|unsubscribe|opt out)$/i.test(message.text.trim());
    const allowed = await hasCommunicationConsent({
      userId: parent.userId,
      channel: AlertChannel.WHATSAPP,
      kind: NotificationKind.FEE_REMINDER,
    });
    if (!allowed && !isStop) {
      await prisma.whatsAppInboundMessage.updateMany({
        where: { id: receiptId, status: "PROCESSING", processingToken: token },
        data: {
          parentProfileId: parent.id,
          status: "IGNORED",
          processingToken: null,
          updatedAt: new Date(),
        },
      });
      return;
    }

    // Persist the generated reply before the network call. If delivery is
    // inconclusive, a duplicate provider delivery retries this exact response
    // rather than repeating business work or losing a one-time checkout URL.
    let responseText = receipt.replyText ?? null;
    if (responseText === null) {
      responseText = await buildReply({
        schoolId: configured.id,
        parent,
        messageId: message.id,
        text: message.text,
      });
      const saved = await prisma.whatsAppInboundMessage.updateMany({
        where: { id: receiptId, status: "PROCESSING", processingToken: token },
        data: {
          parentProfileId: parent.id,
          replyText: responseText,
          updatedAt: new Date(),
        },
      });
      if (saved.count !== 1) return;
    }

    if (!responseText || !customerServiceWindowOpen(message.timestamp)) {
      await finish("PROCESSED");
      return;
    }

    // Refresh the lease immediately before external I/O and verify this worker
    // still owns the receipt. Never use SMS fallback for a WhatsApp reply.
    const refreshed = await prisma.whatsAppInboundMessage.updateMany({
      where: { id: receiptId, status: "PROCESSING", processingToken: token },
      data: { updatedAt: new Date() },
    });
    if (refreshed.count !== 1) return;
    const sent = await sendWhatsapp({ to: phone, text: responseText, allowSmsFallback: false });
    if (sent.channel !== "whatsapp" || !sent.messageId) {
      throw new Error("Meta did not confirm acceptance of the WhatsApp fee-chat reply.");
    }
    await prisma.whatsAppInboundMessage.updateMany({
      where: { id: receiptId, status: "PROCESSING", processingToken: token },
      data: {
        status: "PROCESSED",
        processingToken: null,
        replyText: null,
        replyAcceptedAt: new Date(),
        updatedAt: new Date(),
      },
    });
  } catch (error) {
    // Failed work is retryable. Keep a prepared reply for exact replay, but
    // release the token so the next delivery may claim it immediately.
    await prisma.whatsAppInboundMessage.updateMany({
      where: { id: receiptId, status: "PROCESSING", processingToken: token },
      data: { status: "FAILED", processingToken: null, updatedAt: new Date() },
    });
    throw error;
  }
}
