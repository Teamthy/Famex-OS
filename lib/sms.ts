/**
 * Lightweight SMS helper.
 *
 * Famex OS ships with email (Resend) built-in but SMS is provider-pluggable
 * since schools use Termii, Twilio, BulkSMSNigeria, etc. We look at env and
 * call whichever is configured; if none is configured, callers can inspect
 * the result instead of silently claiming delivery.
 *
 * Supported providers:
 *   TERMII_API_KEY + TERMII_SENDER_ID  → Termii (Nigeria, default for this install)
 *   TWILIO_ACCOUNT_SID + TWILIO_AUTH_TOKEN + TWILIO_FROM
 *   BULKSMSN_API_TOKEN
 */

type SmsPayload = { to: string; message: string };

export type SmsSendResult =
  | { accepted: true; provider: "TERMII" | "TWILIO" }
  | { accepted: false; provider: "TERMII" | "TWILIO" | null; error: string };

function normalise(phone: string): string | null {
  const digits = String(phone || "").replace(/\D+/g, "");
  if (!digits) return null;
  if (digits.startsWith("0") && digits.length === 11) return `234${digits.slice(1)}`;
  return digits;
}

/** `accepted` means the gateway accepted the API request, not handset delivery. */
export async function sendSmsWithResult(payload: SmsPayload): Promise<SmsSendResult> {
  const to = normalise(payload.to);
  if (!to) return { accepted: false, provider: null, error: "Invalid recipient." };

  if (process.env.TERMII_API_KEY && process.env.TERMII_SENDER_ID) {
    try {
      const res = await fetch("https://api.ng.termii.com/api/sms/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to,
          from: process.env.TERMII_SENDER_ID,
          sms: payload.message,
          type: "plain",
          channel: "generic",
          api_key: process.env.TERMII_API_KEY,
        }),
      });
      if (!res.ok) {
        console.warn(`[sms] Termii rejected request: ${res.status}`);
        return { accepted: false, provider: "TERMII", error: `HTTP ${res.status}` };
      }
      return { accepted: true, provider: "TERMII" };
    } catch (error) {
      console.warn("[sms] Termii request failed:", error);
      return {
        accepted: false,
        provider: "TERMII",
        error: error instanceof Error ? error.message : "Termii request failed.",
      };
    }
  }

  if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_FROM) {
    try {
      const body = new URLSearchParams({
        To: `+${to}`,
        From: process.env.TWILIO_FROM,
        Body: payload.message,
      });
      const res = await fetch(
        `https://api.twilio.com/2010-04-01/Accounts/${process.env.TWILIO_ACCOUNT_SID}/Messages.json`,
        {
          method: "POST",
          headers: {
            Authorization: `Basic ${Buffer.from(`${process.env.TWILIO_ACCOUNT_SID}:${process.env.TWILIO_AUTH_TOKEN}`).toString("base64")}`,
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: body.toString(),
        },
      );
      if (!res.ok) {
        console.warn(`[sms] Twilio rejected request: ${res.status}`);
        return { accepted: false, provider: "TWILIO", error: `HTTP ${res.status}` };
      }
      return { accepted: true, provider: "TWILIO" };
    } catch (error) {
      console.warn("[sms] Twilio request failed:", error);
      return {
        accepted: false,
        provider: "TWILIO",
        error: error instanceof Error ? error.message : "Twilio request failed.",
      };
    }
  }

  if (process.env.NODE_ENV !== "production") {
    console.log(`[sms-dev] → ${to}: ${payload.message}`);
  }
  return { accepted: false, provider: null, error: "No SMS provider is configured." };
}

/** Compatibility wrapper for callers that only need best-effort dispatch. */
export async function sendSms(payload: SmsPayload): Promise<void> {
  await sendSmsWithResult(payload);
}
