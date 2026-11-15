import { createHmac } from "node:crypto";
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { processWhatsAppFeeMessage } = vi.hoisted(() => ({
  processWhatsAppFeeMessage: vi.fn(),
}));

vi.mock("@/lib/whatsapp-fee-chat", () => ({ processWhatsAppFeeMessage }));

import { POST } from "@/app/api/webhooks/whatsapp/route";

function signedRequest(payload: unknown) {
  const raw = JSON.stringify(payload);
  const signature = createHmac("sha256", "test-app-secret").update(raw).digest("hex");
  return new NextRequest("https://school.example/api/webhooks/whatsapp", {
    method: "POST",
    headers: { "x-hub-signature-256": `sha256=${signature}` },
    body: raw,
  });
}

describe("WhatsApp inbound webhook routing", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.WHATSAPP_PHONE_NUMBER_ID = "phone-number-1";
    process.env.WHATSAPP_APP_SECRET = "test-app-secret";
  });

  it("routes signed text messages only when the configured Meta number matches", async () => {
    const request = signedRequest({
      entry: [
        {
          changes: [
            {
              value: {
                metadata: { phone_number_id: "phone-number-1" },
                messages: [
                  {
                    id: "wamid.1",
                    from: "2348031234567",
                    timestamp: "2000000000",
                    type: "text",
                    text: { body: "INVOICES" },
                  },
                ],
              },
            },
          ],
        },
      ],
    });

    const response = await POST(request);

    expect(response.status).toBe(200);
    expect(processWhatsAppFeeMessage).toHaveBeenCalledWith({
      id: "wamid.1",
      from: "2348031234567",
      timestamp: "2000000000",
      text: "INVOICES",
    });
  });

  it("returns a retryable failure when inbound processing fails", async () => {
    processWhatsAppFeeMessage.mockRejectedValueOnce(new Error("temporary provider failure"));
    const request = signedRequest({
      entry: [
        {
          changes: [
            {
              value: {
                metadata: { phone_number_id: "phone-number-1" },
                messages: [
                  {
                    id: "wamid.retry",
                    from: "2348031234567",
                    timestamp: "2000000000",
                    type: "text",
                    text: { body: "INVOICES" },
                  },
                ],
              },
            },
          ],
        },
      ],
    });

    const response = await POST(request);

    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({ ok: false, inbound: 1 });
  });

  it("ignores messages for other phone-number ids and non-text message types", async () => {
    const request = signedRequest({
      entry: [
        {
          changes: [
            {
              value: {
                metadata: { phone_number_id: "other-number" },
                messages: [
                  {
                    id: "wamid.other",
                    from: "2348031234567",
                    timestamp: "2000000000",
                    type: "text",
                    text: { body: "INVOICES" },
                  },
                ],
              },
            },
            {
              value: {
                metadata: { phone_number_id: "phone-number-1" },
                messages: [
                  {
                    id: "wamid.image",
                    from: "2348031234567",
                    timestamp: "2000000000",
                    type: "image",
                  },
                ],
              },
            },
          ],
        },
      ],
    });

    const response = await POST(request);

    expect(response.status).toBe(200);
    expect(processWhatsAppFeeMessage).not.toHaveBeenCalled();
  });
});
