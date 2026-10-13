import { NextRequest } from "next/server";
import { PaymentProvider, PaymentStatus } from "@prisma/client";
import { z } from "zod";
import { createHash } from "crypto";
import { prisma } from "@/lib/prisma";
import { getParentFinanceContext } from "@/lib/finance";
import { assertNotImpersonating } from "@/lib/session";
import { initializePaystackTransaction } from "@/lib/paystack";
import { getClientIp, jsonNoStore } from "@/lib/requests";
import {
  completeReservedIdempotency,
  idempotencyRequestHash,
  releaseReservedIdempotency,
  requestMethodForIdempotency,
  requestPathForIdempotency,
  reserveIdempotency,
} from "@/lib/idempotency";

export const runtime = "nodejs";

const schema = z.object({
  invoiceId: z.string().min(1),
  amount: z.number().int().positive().optional(),
  method: z.enum(["PAYSTACK", "BANK_TRANSFER"]),
  transferReference: z.string().trim().min(6).max(120).optional(),
  transferDate: z.string().optional(),
  narration: z.string().trim().max(500).optional(),
});

/**
 * Deterministic Paystack reference for an idempotent payment request. Derived
 * from the school + idempotency key (NOT the amount or a random value) so a
 * retry after a crash re-derives the same reference: the DB unique constraint
 * and Paystack's one-transaction-per-reference rule then make a duplicate
 * charge impossible even if two requests race.
 */
function feeReference(invoiceNumber: string, schoolId: string, idemKey: string) {
  const digest = createHash("sha256").update(`${schoolId}:${idemKey}`).digest("hex");
  return `YKC-FEE-${invoiceNumber}-${digest.slice(0, 12).toUpperCase()}`;
}

export async function POST(request: NextRequest) {
  const context = await getParentFinanceContext();
  if (!context) return jsonNoStore({ error: "Parent finance profile not found." }, { status: 403 });
  const impersonating = assertNotImpersonating(context.user);
  if (impersonating) return impersonating;

  // ── Idempotency: a double-click or network retry must NOT create a second
  //    payment attempt (prevents double-charge). The key is RESERVED before
  //    any side effect, so concurrent same-key requests cannot both commit. ──
  const idemKey = request.headers.get("x-idempotency-key")?.trim();
  if (!idemKey || idemKey.length < 16) {
    return jsonNoStore(
      { error: "An x-idempotency-key header (min. 16 chars) is required." },
      { status: 400 },
    );
  }
  let rawBody: unknown;
  let input: z.infer<typeof schema>;
  try {
    rawBody = await request.json();
    input = schema.parse(rawBody);
  } catch {
    return jsonNoStore({ error: "Invalid payment details." }, { status: 400 });
  }
  const requestHash = idempotencyRequestHash({
    method: requestMethodForIdempotency(request),
    path: requestPathForIdempotency(request, "/api/parent/fees/payment-intents"),
    actorId: context.user.id,
    scope: "FEE_PAYMENT",
    body: rawBody,
  });

  const invoice = await prisma.feeInvoice.findFirst({
    where: {
      id: input.invoiceId,
      schoolId: context.user.schoolId,
      OR: [
        { parentProfileId: context.profile.id },
        { studentProfile: { parentLinks: { some: { parentProfileId: context.profile.id } } } },
      ],
    },
    include: { studentProfile: true },
  });

  if (!invoice || invoice.balanceDue <= 0) {
    return jsonNoStore({ error: "Invoice is unavailable or already paid." }, { status: 404 });
  }

  // Reserve BEFORE side effects. Concurrent same-key requests resolve here:
  // replay (completed), 409 conflict (different body) or 409 + Retry-After
  // (another request holds the lease). Only one request ever proceeds.
  const reservation = await reserveIdempotency({
    schoolId: context.user.schoolId,
    scope: "FEE_PAYMENT",
    key: idemKey,
    requestHash,
  });
  if (reservation.outcome !== "reserved") {
    return jsonNoStore(reservation.body, {
      status: reservation.status,
      ...(reservation.outcome === "in-progress"
        ? { headers: { "Retry-After": String(reservation.retryAfterSeconds) } }
        : {}),
    });
  }
  const releaseReservation = () =>
    releaseReservedIdempotency({
      schoolId: context.user.schoolId,
      scope: "FEE_PAYMENT",
      key: idemKey,
      lockedUntil: reservation.lockedUntil,
    });

  const amount = Math.min(input.amount || invoice.balanceDue, invoice.balanceDue);

  if (input.method === "BANK_TRANSFER") {
    if (!input.transferReference) {
      await releaseReservation();
      return jsonNoStore({ error: "Bank transfer reference is required." }, { status: 400 });
    }
    // Capture the narrowed value: property narrowing does not survive into
    // the transaction closure below.
    const transferReference = input.transferReference;

    try {
      const transferResponse = await prisma.$transaction(async (tx) => {
        const duplicate = await tx.feePaymentAttempt.findUnique({
          where: { reference: transferReference },
        });
        if (duplicate) {
          throw new Error("DUPLICATE_TRANSFER_REFERENCE");
        }
        const paidDup = await tx.feePayment.findUnique({
          where: { reference: transferReference },
        });
        if (paidDup) {
          throw new Error("DUPLICATE_TRANSFER_REFERENCE");
        }

        const attempt = await tx.feePaymentAttempt.create({
          data: {
            schoolId: context.user.schoolId,
            invoiceId: invoice.id,
            studentProfileId: invoice.studentProfileId,
            parentProfileId: context.profile.id,
            provider: PaymentProvider.BANK_TRANSFER,
            amount,
            reference: transferReference,
            status: PaymentStatus.PENDING,
            payerEmail: context.profile.user.email,
            transferDate: input.transferDate ? new Date(input.transferDate) : null,
            transferNarration: input.narration || null,
          },
        });

        await tx.auditLog.create({
          data: {
            schoolId: context.user.schoolId,
            actorUserId: context.user.id,
            action: "BANK_TRANSFER_SUBMITTED",
            entityType: "FeePaymentAttempt",
            entityId: attempt.id,
            ipAddress: getClientIp(request),
            metadata: {
              invoiceNumber: invoice.invoiceNumber,
              amount,
              reference: transferReference,
            },
          },
        });

        const responseBody = {
          status: "PENDING_REVIEW",
          message: "Transfer submitted. The bursar will verify it before your invoice is updated.",
          attemptId: attempt.id,
        };
        // Completing inside the transaction means the replayable response
        // commits (or rolls back) with the attempt itself.
        await completeReservedIdempotency(tx, {
          schoolId: context.user.schoolId,
          scope: "FEE_PAYMENT",
          key: idemKey,
          lockedUntil: reservation.lockedUntil,
          response: responseBody,
          statusCode: 201,
        });
        return responseBody;
      });
      return jsonNoStore(transferResponse, { status: 201 });
    } catch (error) {
      if (error instanceof Error && error.message === "DUPLICATE_TRANSFER_REFERENCE") {
        await releaseReservation();
        return jsonNoStore(
          { error: "This bank transfer reference has already been submitted." },
          { status: 409 },
        );
      }
      if (error instanceof Error && error.message === "IDEMPOTENCY_RESERVATION_LOST") {
        return jsonNoStore(
          {
            error:
              "The request outlived its idempotency lease and was rolled back. Please retry the same request.",
          },
          { status: 409 },
        );
      }
      await releaseReservation();
      return jsonNoStore(
        { error: "Could not record the transfer. Please try again." },
        { status: 500 },
      );
    }
  }

  // PAYSTACK: reference is deterministic per (school, idempotency key), so a
  // crash-recovery retry re-binds to the SAME attempt row and Paystack
  // transaction instead of creating a second checkout.
  const reference = feeReference(invoice.invoiceNumber, context.user.schoolId, idemKey);
  const prior = await prisma.feePaymentAttempt.findUnique({ where: { reference } });
  const attempt = prior
    ? await prisma.feePaymentAttempt.update({
        where: { id: prior.id },
        data: {
          invoiceId: invoice.id,
          studentProfileId: invoice.studentProfileId,
          parentProfileId: context.profile.id,
          amount,
          status: PaymentStatus.PENDING,
          payerEmail: context.profile.user.email,
        },
      })
    : await prisma.feePaymentAttempt.create({
        data: {
          schoolId: context.user.schoolId,
          invoiceId: invoice.id,
          studentProfileId: invoice.studentProfileId,
          parentProfileId: context.profile.id,
          provider: PaymentProvider.PAYSTACK,
          amount,
          reference,
          status: PaymentStatus.PENDING,
          payerEmail: context.profile.user.email,
        },
      });

  try {
    const checkout = await initializePaystackTransaction({
      email: context.profile.user.email,
      amount: amount * 100,
      reference,
      callbackUrl: `${request.nextUrl.origin}/parent/fees?verify=${encodeURIComponent(reference)}`,
      metadata: {
        kind: "SCHOOL_FEE",
        paymentAttemptId: attempt.id,
        invoiceId: invoice.id,
        schoolId: context.user.schoolId,
      },
    });
    const paystackResponse = {
      reference,
      authorizationUrl: checkout.authorization_url,
      attemptId: attempt.id,
    };
    await completeReservedIdempotency(prisma, {
      schoolId: context.user.schoolId,
      scope: "FEE_PAYMENT",
      key: idemKey,
      lockedUntil: reservation.lockedUntil,
      response: paystackResponse,
      statusCode: 200,
    });
    return jsonNoStore(paystackResponse);
  } catch (error) {
    if (prior) {
      // A previous run of THIS SAME request already created an attempt (and
      // possibly a Paystack checkout) with this reference. Keep the attempt
      // PENDING — it is reference-bound and the webhook will match it — and
      // tell the parent to retry with a fresh key rather than risk a second
      // checkout for the same reference.
      await releaseReservation();
      return jsonNoStore(
        {
          error:
            "A checkout for this payment was already initiated. Check your payment history or start a new payment in a few seconds.",
        },
        { status: 409 },
      );
    }
    // Fresh attempt whose initialization genuinely failed — no Paystack
    // transaction exists for this reference, so mark it failed, release the
    // key, and let the client retry safely (the row is reused, not duplicated).
    await prisma.feePaymentAttempt.update({
      where: { id: attempt.id },
      data: { status: PaymentStatus.FAILED },
    });
    await releaseReservation();
    return jsonNoStore(
      { error: error instanceof Error ? error.message : "Unable to initialize payment." },
      { status: 502 },
    );
  }
}
