import { createHmac, timingSafeEqual } from "node:crypto";
import { AlertDeliveryStatus } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { processWhatsAppFeeMessage } from "@/lib/whatsapp-fee-chat";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * WhatsApp Cloud API webhook (L, W4 delivery receipts).
 *
 * GET  — Meta's verification handshake (WHATSAPP_VERIFY_TOKEN).
 * POST — delivery-status callbacks plus signed, configured-number inbound
 *        text messages. A job is SENT when Meta accepts it; only this webhook
 *        may promote it to DELIVERED (handset confirmed) or demote it to FAILED.
 *        Inbound fee chat is session-only and creates pending Paystack attempts;
 *        settlement remains exclusively on the Paystack webhook path.
 *
 * Signatures: when WHATSAPP_APP_SECRET is set, every POST must carry a
 * valid `x-hub-signature-256`. In production an unset secret fails closed —
 * an unsigned endpoint would let anyone forge delivery receipts.
 */

function verifyMetaSignature(rawBody: string, header: string | null): boolean {
  const secret = process.env.WHATSAPP_APP_SECRET;
  if (!secret) return process.env.NODE_ENV !== "production";
  if (!header?.startsWith("sha256=")) return false;
  const expected = createHmac("sha256", secret).update(rawBody).digest();
  let provided: Buffer;
  try {
    provided = Buffer.from(header.slice("sha256=".length), "hex");
  } catch {
    return false;
  }
  return provided.length === expected.length && timingSafeEqual(provided, expected);
}

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const mode = params.get("hub.mode");
  const token = params.get("hub.verify_token");
  const challenge = params.get("hub.challenge");
  const expected = process.env.WHATSAPP_VERIFY_TOKEN;
  if (mode === "subscribe" && expected && token === expected && challenge) {
    return new NextResponse(challenge, { status: 200 });
  }
  return NextResponse.json({ error: "Verification failed." }, { status: 403 });
}

type MetaStatus = {
  id?: string;
  status?: string;
  timestamp?: string;
  errors?: { code?: number; title?: string; message?: string }[];
};

type MetaWebhookPayload = {
  entry?: {
    changes?: {
      value?: {
        metadata?: { phone_number_id?: string };
        statuses?: MetaStatus[];
        messages?: {
          id?: string;
          from?: string;
          timestamp?: string;
          type?: string;
          text?: { body?: string };
        }[];
      };
    }[];
  }[];
};

/**
 * Apply one provider status to the matching job. Exported for tests.
 * Returns true when a row changed. Only SENT jobs transition: a late or
 * duplicate callback must never resurrect a FAILED/DELIVERED job.
 */
export async function applyWhatsappStatus(status: MetaStatus): Promise<boolean> {
  if (!status.id || !status.status) return false;
  const at = status.timestamp ? new Date(Number(status.timestamp) * 1000) : new Date();
  const deliveredAt = Number.isNaN(at.getTime()) ? new Date() : at;

  if (status.status === "delivered" || status.status === "read") {
    const result = await prisma.notificationJob.updateMany({
      where: { providerMessageId: status.id, status: AlertDeliveryStatus.SENT },
      data: { status: AlertDeliveryStatus.DELIVERED, deliveredAt, lastError: null },
    });
    return result.count > 0;
  }
  if (status.status === "failed") {
    const detail = status.errors
      ?.map((e) => e.message || e.title || (e.code ? `Meta error ${e.code}` : ""))
      .filter(Boolean)
      .join("; ");
    const result = await prisma.notificationJob.updateMany({
      where: { providerMessageId: status.id, status: AlertDeliveryStatus.SENT },
      data: {
        status: AlertDeliveryStatus.FAILED,
        lastError: detail || "WhatsApp reported a delivery failure.",
      },
    });
    return result.count > 0;
  }
  // "sent" needs no change (dispatch already recorded acceptance).
  return false;
}

export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  if (!verifyMetaSignature(rawBody, request.headers.get("x-hub-signature-256"))) {
    return NextResponse.json({ error: "Invalid webhook signature." }, { status: 401 });
  }

  let payload: MetaWebhookPayload;
  try {
    payload = JSON.parse(rawBody) as MetaWebhookPayload;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  let processed = 0;
  let updated = 0;
  let inbound = 0;
  let inboundFailed = false;
  const expectedPhoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  for (const entry of payload.entry ?? []) {
    for (const change of entry.changes ?? []) {
      const value = change.value;
      for (const status of value?.statuses ?? []) {
        processed += 1;
        if (await applyWhatsappStatus(status)) updated += 1;
      }
      // Only accept inbound chat for this configured school number. A signed
      // status callback remains usable if Meta omits metadata on that variant.
      if (!expectedPhoneId || value?.metadata?.phone_number_id !== expectedPhoneId) continue;
      for (const message of value?.messages ?? []) {
        if (message.type !== "text" || !message.id || !message.from || !message.timestamp) continue;
        const text = message.text?.body?.trim();
        if (!text || text.length > 1000) continue;
        inbound += 1;
        try {
          await processWhatsAppFeeMessage({
            id: message.id,
            from: message.from,
            timestamp: message.timestamp,
            text,
          });
        } catch (error) {
          // Return a retryable failure to Meta. The receipt claim/recovery
          // protocol makes redelivery safe, and keeping this non-2xx avoids
          // acknowledging work that failed before its reply was accepted.
          inboundFailed = true;
          console.error("WhatsApp inbound fee chat processing failed", {
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }
    }
  }

  // Unknown and already-completed receipts are acknowledged. A processing
  // exception returns a retryable response; duplicate ids can reclaim FAILED
  // receipts and stale PROCESSING leases without repeating successful replies.
  return NextResponse.json(
    { ok: !inboundFailed, processed, updated, inbound },
    { status: inboundFailed ? 503 : 200 },
  );
}
