/**
 * WhatsApp Business Platform outbound.
 *
 * Official WhatsApp Cloud API (Graph / v20). Supports template messages
 * (for session initiation) and free-form text replies within a 24-hour
 * customer-service window. SMS fallback via `lib/sms.ts` when WhatsApp is
 * not configured or delivery fails.
 *
 * Required env:
 *   WHATSAPP_PHONE_NUMBER_ID  from Meta Business Manager
 *   WHATSAPP_ACCESS_TOKEN     permanent system-user token
 *   WHATSAPP_VERIFY_TOKEN     webhook verify token (not needed for send)
 *
 * If none are set, calls no-op safely so code can run in dev without
 * throwing.
 */
import { sendSms } from "@/lib/sms";

function normalise(to: string): string | null {
  const d = String(to || "").replace(/\D+/g, "");
  if (!d) return null;
  if (d.startsWith("0") && d.length === 11) return `234${d.slice(1)}`;
  return d;
}

type SendResult = { channel: "whatsapp" | "sms" | "none"; messageId?: string; error?: string };

export async function sendWhatsapp(params: {
  to: string;
  templateName?: string;
  templateLang?: string;
  templateParams?: string[];
  text?: string;
  smsFallbackText?: string;
  /**
   * Callers that account per channel (the NotificationJob dispatcher) pass
   * false: a job queued as WHATSAPP must never be marked sent because an SMS
   * went out instead. Direct alert callers keep the fallback.
   */
  allowSmsFallback?: boolean;
}): Promise<SendResult> {
  const to = normalise(params.to);
  if (!to) return { channel: "none", error: "Invalid recipient" };
  const mayFallback = params.allowSmsFallback !== false;

  const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const token = process.env.WHATSAPP_ACCESS_TOKEN;
  if (!phoneId || !token) {
    // Fallback to SMS if a fallback message is provided.
    if (mayFallback && (params.smsFallbackText || params.text)) {
      await sendSms({ to, message: params.smsFallbackText ?? params.text ?? "" });
      return { channel: "sms" };
    }
    if (process.env.NODE_ENV !== "production") {
      console.log(`[whatsapp-dev] → ${to}: ${params.text ?? `template:${params.templateName}`}`);
    }
    return { channel: "none", error: "WhatsApp not configured" };
  }

  const body: any = { messaging_product: "whatsapp", recipient_type: "individual", to };
  if (params.templateName) {
    body.type = "template";
    body.template = {
      name: params.templateName,
      language: { code: params.templateLang || "en" },
      components: params.templateParams?.length
        ? [
            {
              type: "body",
              parameters: params.templateParams.map((p) => ({ type: "text", text: p })),
            },
          ]
        : undefined,
    };
  } else if (params.text) {
    body.type = "text";
    body.text = { preview_url: false, body: params.text };
  } else {
    return { channel: "none", error: "No template or text" };
  }

  try {
    const res = await fetch(`https://graph.facebook.com/v20.0/${phoneId}/messages`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    const j = await res.json().catch(() => ({}));
    if (!res.ok || j.error) {
      // SMS fallback on failure
      if (mayFallback && (params.smsFallbackText || params.text)) {
        await sendSms({ to, message: params.smsFallbackText ?? params.text ?? "" }).catch(() => {});
        return { channel: "sms", error: j.error?.message ?? `HTTP ${res.status}` };
      }
      return { channel: "none", error: j.error?.message ?? `HTTP ${res.status}` };
    }
    return { channel: "whatsapp", messageId: j.messages?.[0]?.id };
  } catch (err: any) {
    if (mayFallback && (params.smsFallbackText || params.text)) {
      await sendSms({ to, message: params.smsFallbackText ?? params.text ?? "" }).catch(() => {});
      return { channel: "sms", error: err.message };
    }
    return { channel: "none", error: err.message };
  }
}
