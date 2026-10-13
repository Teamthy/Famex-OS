import { z } from "zod";

export const APPLICATION_FEE_KOBO = 500_000;
export const APPLICATION_FEE_NAIRA = APPLICATION_FEE_KOBO / 100;

export const DOCUMENT_TYPES = [
  "BIRTH_CERTIFICATE",
  "PASSPORT_PHOTO",
  "REPORT_CARD",
  "TRANSFER_CERTIFICATE",
] as const;

export type AdmissionDocumentType = (typeof DOCUMENT_TYPES)[number];

export const DOCUMENT_RULES: Record<
  AdmissionDocumentType,
  {
    label: string;
    required: boolean;
    maxBytes: number;
    acceptedTypes: readonly string[];
    help: string;
  }
> = {
  BIRTH_CERTIFICATE: {
    label: "Birth certificate or age declaration",
    required: true,
    maxBytes: 5 * 1024 * 1024,
    acceptedTypes: ["application/pdf", "image/jpeg", "image/png", "image/webp"],
    help: "PDF, JPG, PNG or WEBP · maximum 5 MB",
  },
  PASSPORT_PHOTO: {
    label: "Recent passport photograph",
    required: true,
    maxBytes: 2 * 1024 * 1024,
    acceptedTypes: ["image/jpeg", "image/png", "image/webp"],
    help: "JPG, PNG or WEBP · maximum 2 MB",
  },
  REPORT_CARD: {
    label: "Most recent school report card",
    required: true,
    maxBytes: 5 * 1024 * 1024,
    acceptedTypes: ["application/pdf", "image/jpeg", "image/png", "image/webp"],
    help: "PDF, JPG, PNG or WEBP · maximum 5 MB",
  },
  TRANSFER_CERTIFICATE: {
    label: "Transfer certificate",
    required: false,
    maxBytes: 5 * 1024 * 1024,
    acceptedTypes: ["application/pdf", "image/jpeg", "image/png", "image/webp"],
    help: "Only for transfer applicants · maximum 5 MB",
  },
};

const requiredText = (label: string, max = 120) =>
  z.string().trim().min(2, `${label} is required.`).max(max, `${label} is too long.`);

const optionalText = (max = 240) =>
  z
    .string()
    .trim()
    .max(max, "This value is too long.")
    .optional()
    .or(z.literal(""))
    .transform((value) => value || undefined);

const normalizePhone = (value: unknown) =>
  typeof value === "string" ? value.trim().replace(/[\s()-]/g, "") : value;

const nigerianPhone = z.preprocess(
  normalizePhone,
  z.string().regex(/^(?:\+234|234|0)[789][01]\d{8}$/, "Enter a valid Nigerian mobile number."),
);

export const admissionDraftSchema = z
  .object({
    firstName: requiredText("First name", 60),
    middleName: optionalText(60),
    lastName: requiredText("Surname", 60),
    dateOfBirth: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Enter a valid date of birth.")
      .refine(
        (value) => !Number.isNaN(Date.parse(value)) && new Date(value) < new Date(),
        "Enter a valid date of birth.",
      ),
    gender: z.enum(["Female", "Male", "Prefer not to say"], {
      errorMap: () => ({ message: "Select the applicant's gender." }),
    }),
    stateOfOrigin: requiredText("State of origin", 80),
    lga: requiredText("Local Government Area", 100),
    religion: optionalText(80),
    bloodGroup: z
      .enum(["", "A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"])
      .transform((value) => value || undefined),
    genotype: z.enum(["", "AA", "AS", "AC", "SS", "SC"]).transform((value) => value || undefined),
    classApplying: z.enum(["JSS1", "JSS2", "JSS3", "SS1", "SS2", "SS3"], {
      errorMap: () => ({ message: "Select the class the applicant is applying for." }),
    }),
    preferredArm: optionalText(20),
    fatherName: optionalText(120),
    motherName: requiredText("Mother's or primary carer's name", 120),
    guardianName: optionalText(120),
    guardianRelationship: optionalText(60),
    primaryContact: z.enum(["MOTHER", "FATHER", "GUARDIAN"], {
      errorMap: () => ({ message: "Choose the primary contact person." }),
    }),
    parentPhone: nigerianPhone,
    whatsappPhone: z.preprocess(
      normalizePhone,
      z
        .string()
        .refine(
          (value) => value === "" || /^(?:\+234|234|0)[789][01]\d{8}$/.test(value),
          "Enter a valid Nigerian WhatsApp number.",
        )
        .transform((value) => value || undefined),
    ),
    parentEmail: z.string().trim().toLowerCase().email("Enter a valid email address.").max(254),
    parentAddress: requiredText("Home address", 300),
    occupation: optionalText(120),
    previousSchool: requiredText("Previous school", 160),
    previousClass: requiredText("Previous class", 80),
    reasonForLeaving: optionalText(500),
    achievements: optionalText(500),
  })
  .superRefine((data, ctx) => {
    if (data.primaryContact === "FATHER" && !data.fatherName) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["fatherName"],
        message: "Add the father's name or select a different primary contact.",
      });
    }
    if (data.primaryContact === "GUARDIAN") {
      if (!data.guardianName) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["guardianName"],
          message: "Add the guardian's name.",
        });
      }
      if (!data.guardianRelationship) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["guardianRelationship"],
          message: "Add the guardian's relationship to the applicant.",
        });
      }
    }
  });

export type AdmissionDraft = z.infer<typeof admissionDraftSchema>;

export const createDraftSchema = admissionDraftSchema;

export const draftAccessSchema = z.object({
  applicationId: z
    .string()
    .trim()
    .regex(/^YKCAPP\d{4}[A-Z0-9]{6}$/, "Invalid application reference."),
  uploadToken: z.string().trim().min(32).max(256),
});

export const uploadUrlSchema = draftAccessSchema.extend({
  documentType: z.enum(DOCUMENT_TYPES),
  fileName: z.string().trim().min(1).max(180),
  contentType: z.string().trim().min(1).max(100),
  sizeBytes: z.number().int().positive(),
});

export const confirmDocumentSchema = uploadUrlSchema.extend({
  storageKey: z.string().trim().min(1).max(500),
});

export const startPaymentSchema = draftAccessSchema;

export const submitApplicationSchema = draftAccessSchema.extend({
  paymentReference: z.string().trim().min(8).max(120),
});

export const applicationStatusSchema = z.object({
  applicationId: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^YKCAPP\d{4}[A-Z0-9]{6}$/, "Enter a valid Application ID."),
});

export function formatApplicationId(value: string) {
  return value.replace(/[^a-z0-9]/gi, "").toUpperCase();
}
