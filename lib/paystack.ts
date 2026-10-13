import { createHmac, timingSafeEqual } from "crypto";
import type { Prisma } from "@prisma/client";

const PAYSTACK_URL = "https://api.paystack.co";

interface PaystackVerificationResponse {
  status: boolean;
  message: string;
  data?: {
    status: string;
    reference: string;
    amount: number;
    currency: string;
    paid_at: string | null;
    customer?: { email?: string | null };
    metadata?: Record<string, string | number | boolean | null>;
  };
}

interface PaystackInitResponse {
  status: boolean;
  message: string;
  data?: {
    authorization_url: string;
    access_code: string;
    reference: string;
  };
}

export function getPaystackPublicKey() {
  const key = process.env.PAYSTACK_PUBLIC_KEY;
  if (!key) throw new Error("PAYSTACK_PUBLIC_KEY is not configured.");
  return key;
}

function getPaystackSecretKey() {
  const key = process.env.PAYSTACK_SECRET_KEY;
  if (!key) throw new Error("PAYSTACK_SECRET_KEY is not configured.");
  return key;
}

/** Deep-clone through JSON so the value is assignable to Prisma.InputJsonValue. */
export function toPrismaJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value ?? null)) as Prisma.InputJsonValue;
}

/**
 * Outcome of a Paystack verify call, split so callers can tell "this payment
 * did not happen" from "we could not find out".
 *
 * `definite` means Paystack answered authoritatively: the transaction is
 * unpaid, or its amount/currency/payer do not match the attempt. The attempt
 * can safely be recorded as FAILED and a fresh checkout started.
 *
 * `!definite` means the verification itself did not complete — a network
 * error, a timeout, a 429, or a malformed response. The payment may well have
 * gone through. Recording FAILED here strands real money: the parent is
 * charged, the invoice still shows a balance, and the bursary sees an
 * "abandoned" attempt that was actually paid.
 */
export class PaystackVerificationError extends Error {
  readonly definite: boolean;

  constructor(message: string, options?: { definite?: boolean; cause?: unknown }) {
    super(message);
    this.name = "PaystackVerificationError";
    this.definite = options?.definite ?? false;
    this.cause = options?.cause;
  }
}

const PAYMENT_UNVERIFIED_MESSAGE =
  "We could not verify this payment. Please contact the bursary if your account was charged.";

export async function initializePaystackTransaction(input: {
  email: string;
  amount: number;
  reference: string;
  callbackUrl: string;
  metadata?: Record<string, string | number | boolean | null>;
}) {
  const response = await fetch(`${PAYSTACK_URL}/transaction/initialize`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${getPaystackSecretKey()}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      email: input.email,
      amount: input.amount,
      reference: input.reference,
      currency: "NGN",
      callback_url: input.callbackUrl,
      metadata: input.metadata || {},
    }),
    cache: "no-store",
  });

  const payload = (await response.json()) as PaystackInitResponse;
  if (!response.ok || !payload.status || !payload.data?.authorization_url) {
    throw new Error(payload.message || "Unable to initialize Paystack checkout.");
  }
  return payload.data;
}

export async function verifyPaystackTransaction(
  reference: string,
  expectedAmountKobo: number,
  expectedEmail: string,
): Promise<Prisma.InputJsonObject> {
  // Resolve configuration BEFORE the try block. A missing secret key is a
  // deployment fault, not an inconclusive verification, and must surface as
  // itself — swallowed into a PaystackVerificationError it would look like a
  // flaky provider while every fee payment silently failed to verify.
  const secretKey = getPaystackSecretKey();

  let response: Response;
  try {
    response = await fetch(`${PAYSTACK_URL}/transaction/verify/${encodeURIComponent(reference)}`, {
      headers: {
        Authorization: `Bearer ${secretKey}`,
        Accept: "application/json",
      },
      cache: "no-store",
    });
  } catch (cause) {
    // fetch threw: DNS failure, TLS error, connection reset, timeout. Nothing
    // is known about the payment either way.
    throw new PaystackVerificationError(PAYMENT_UNVERIFIED_MESSAGE, { cause });
  }

  let payload: PaystackVerificationResponse;
  try {
    payload = (await response.json()) as PaystackVerificationResponse;
  } catch (cause) {
    // A gateway or proxy answered with a non-JSON body. Still inconclusive.
    throw new PaystackVerificationError(PAYMENT_UNVERIFIED_MESSAGE, { cause });
  }

  // Inconclusive: the provider did not give us a usable answer.
  if (!response.ok || !payload.status || !payload.data) {
    throw new PaystackVerificationError(PAYMENT_UNVERIFIED_MESSAGE, {
      cause: { httpStatus: response.status, message: payload.message ?? null },
    });
  }

  // Definitive: Paystack has the transaction and told us its real state. Only
  // from here may a caller record the attempt as FAILED.
  const email = payload.data.customer?.email?.trim().toLowerCase();
  if (
    payload.data.status !== "success" ||
    payload.data.amount !== expectedAmountKobo ||
    payload.data.currency !== "NGN" ||
    email !== expectedEmail.trim().toLowerCase()
  ) {
    throw new PaystackVerificationError(PAYMENT_UNVERIFIED_MESSAGE, {
      definite: true,
      cause: {
        transactionStatus: payload.data.status,
        amount: payload.data.amount,
        currency: payload.data.currency,
      },
    });
  }

  return toPrismaJson({
    status: payload.data.status,
    reference: payload.data.reference,
    amount: payload.data.amount,
    currency: payload.data.currency,
    paid_at: payload.data.paid_at,
    customer: payload.data.customer ? { email: payload.data.customer.email ?? null } : null,
    metadata: payload.data.metadata ?? null,
  }) as Prisma.InputJsonObject;
}

export async function fetchPaystackVerification(
  reference: string,
): Promise<Prisma.InputJsonObject> {
  const response = await fetch(
    `${PAYSTACK_URL}/transaction/verify/${encodeURIComponent(reference)}`,
    {
      headers: {
        Authorization: `Bearer ${getPaystackSecretKey()}`,
        Accept: "application/json",
      },
      cache: "no-store",
    },
  );
  const payload = (await response.json()) as PaystackVerificationResponse;
  if (!response.ok || !payload.status || !payload.data) {
    throw new Error(payload.message || "Paystack verification failed.");
  }
  return toPrismaJson(payload.data) as Prisma.InputJsonObject;
}

export function verifyPaystackWebhookSignature(rawBody: string, signature: string | null) {
  if (!signature) return false;
  const digest = createHmac("sha512", getPaystackSecretKey()).update(rawBody).digest("hex");
  if (digest.length !== signature.length) return false;
  return timingSafeEqual(Buffer.from(digest), Buffer.from(signature));
}
