import { describe, expect, it } from "vitest";
import { qrDataUrl } from "@/lib/qr";

describe("qrDataUrl", () => {
  it("returns a PNG data URL generated locally", async () => {
    const url = await qrDataUrl("YKAY|YKC/2026/001|Emmanuel Adebayo", 180);
    expect(url.startsWith("data:image/png;base64,")).toBe(true);
    // A real PNG; the payload is never placed in a URL that points at another host.
    expect(url).not.toContain("qrserver");
    expect(Buffer.from(url.split(",")[1], "base64").subarray(1, 4).toString("ascii")).toBe("PNG");
  });

  it("encodes different payloads to different images", async () => {
    const a = await qrDataUrl("STAFF|one", 96);
    const b = await qrDataUrl("STAFF|two", 96);
    expect(a).not.toBe(b);
  });
});
