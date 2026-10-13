import { z } from "zod";

const PHONE_PATTERN = /^\+?[0-9 ()-]{7,20}$/;

/** Validation for the public contact form. Shared by the API route and its tests. */
export const contactEnquirySchema = z.object({
  name: z.string().trim().min(2, "Please enter your name.").max(120, "Your name is too long."),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email("Please enter a valid email address.")
    .max(200, "Your email address is too long."),
  phone: z
    .string()
    .trim()
    .max(20, "Your phone number is too long.")
    .refine(
      (value) => value === "" || PHONE_PATTERN.test(value),
      "Please enter a valid phone number.",
    )
    .optional()
    .default(""),
  message: z
    .string()
    .trim()
    .min(10, "Please tell us a little more (at least 10 characters).")
    .max(2000, "Your message is too long (2,000 characters at most)."),
  // A hidden field. Real visitors never see or fill it; automated form-fillers do.
  website: z.string().max(500).optional().default(""),
});

export type ContactEnquiryInput = z.infer<typeof contactEnquirySchema>;

export const CONTACT_THANKS =
  "Thank you. Your enquiry has been sent to the school office, and someone will reply to the email address you gave.";
