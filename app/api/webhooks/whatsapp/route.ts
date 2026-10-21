import { createHmac, timingSafeEqual } from "node:crypto";
import { AlertDeliveryStatus } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * WhatsApp Cloud API webhook (L, W4 delivery receipts).
 *
 * GET  — Meta's verification handshake (WHATSAPP_VERIFY_TOKEN).
 * POST — message status callbacks. A job is SENT when Meta accepts it;
 *        only this webhook may promote it to DELIVERED (handset confirmed)
 *        or demote it to FAILED (provider-side delivery failure). Matching
 *        is by the provider message id recorded at dispatch time.
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
    changes?: { value?: { statuses?: MetaStatus[] } }[];
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
  for (const entry of payload.entry ?? []) {
    for (const change of entry.changes ?? []) {
      for (const status of change.value?.statuses ?? []) {
        processed += 1;
        if (await applyWhatsappStatus(status)) updated += 1;
      }
    }
  }

  // Always 200 for well-formed callbacks, including unknown message ids —
  // Meta retries non-200s and a receipt for a purged job is not an error.
  return NextResponse.json({ ok: true, processed, updated });
}
