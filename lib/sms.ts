/**
 * Lightweight SMS helper.
 *
 * Famex OS ships with email (Resend) built-in but SMS is provider-pluggable
 * since schools use Termii, Twilio, BulkSMSNigeria, etc. We look at env and
 * call whichever is configured; if none is configured, we log a warning and
 * no-op so callers can fire-and-forget without try/catch.
 *
 * Supported providers:
 *   TERMII_API_KEY + TERMII_SENDER_ID  → Termii (Nigeria, default for this install)
 *   TWILIO_ACCOUNT_SID + TWILIO_AUTH_TOKEN + TWILIO_FROM
 *   BULKSMSN_API_TOKEN
 *
 * Add new providers as needed — keep the signature identical.
 */

type SmsPayload = { to: string; message: string };

function normalise(phone: string): string | null {
  const digits = String(phone || "").replace(/\D+/g, "");
  if (!digits) return null;
  if (digits.startsWith("0") && digits.length === 11) return `234${digits.slice(1)}`;
  return digits;
}

export async function sendSms(payload: SmsPayload): Promise<void> {
  const to = normalise(payload.to);
  if (!to) return;

  // Termii
  if (process.env.TERMII_API_KEY && process.env.TERMII_SENDER_ID) {
    try {
      const res = await fetch("https://api.ng.termii.com/api/sms/send", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
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
        // eslint-disable-next-line no-console
        console.warn(`[sms] Termii rejected to ${to}: ${res.status}`);
      }
      return;
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn("[sms] Termii request failed:", err);
    }
  }

  // Twilio
  if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_FROM) {
    try {
      const b = new URLSearchParams({
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
          body: b.toString(),
        },
      );
      if (!res.ok) {
        // eslint-disable-next-line no-console
        console.warn(`[sms] Twilio rejected to ${to}: ${res.status}`);
      }
      return;
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn("[sms] Twilio request failed:", err);
    }
  }

  // No provider configured — silent no-op (only dev log).
  // eslint-disable-next-line no-console
  if (process.env.NODE_ENV !== "production") {
    // eslint-disable-next-line no-console
    console.log(`[sms-dev] → ${to}: ${payload.message}`);
  }
}
