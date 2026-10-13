import { describe, expect, it } from "vitest";
import { contactEnquirySchema } from "@/lib/contact-enquiry";

const valid = {
  name: "Ada Okafor",
  email: "Ada.Okafor@example.com",
  phone: "+234 701 537 4411",
  message: "Do you have places in JSS1 for the next session?",
  website: "",
};

describe("contactEnquirySchema", () => {
  it("accepts a complete enquiry and normalises the email", () => {
    const parsed = contactEnquirySchema.parse(valid);
    expect(parsed.email).toBe("ada.okafor@example.com");
    expect(parsed.phone).toBe("+234 701 537 4411");
  });

  it("treats the phone number as optional", () => {
    const parsed = contactEnquirySchema.parse({ ...valid, phone: undefined });
    expect(parsed.phone).toBe("");
  });

  it("refuses an empty form, with a message for each field", () => {
    const result = contactEnquirySchema.safeParse({ name: "", email: "", message: "" });
    expect(result.success).toBe(false);
    const messages = result.success ? [] : result.error.issues.map((issue) => issue.message);
    expect(messages).toContain("Please enter your name.");
    expect(messages).toContain("Please enter a valid email address.");
    expect(messages.some((m) => m.startsWith("Please tell us a little more"))).toBe(true);
  });

  it("rejects a malformed email and a phone number with letters in it", () => {
    expect(contactEnquirySchema.safeParse({ ...valid, email: "not-an-email" }).success).toBe(false);
    expect(contactEnquirySchema.safeParse({ ...valid, phone: "call me 0800" }).success).toBe(false);
  });

  it("caps the message length", () => {
    expect(contactEnquirySchema.safeParse({ ...valid, message: "x".repeat(2001) }).success).toBe(
      false,
    );
  });
});
