import { NextRequest, NextResponse } from "next/server";
import { PaymentProvider, PaymentStatus } from "@prisma/client";
import { z } from "zod";
import { APPLICATION_FEE_KOBO } from "@/lib/admissions";
import { prisma } from "@/lib/prisma";
import { PEOPLE_ADMIN_ROLES } from "@/lib/people";
import { getClientIp } from "@/lib/requests";
import { requireModule } from "@/lib/module-guard";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Record an application fee paid offline — cash, bank transfer or POS.
 *
 * The enrolment endpoint refuses any applicant whose paymentStatus is not PAID,
 * and until now the ONLY thing that could set that was the Paystack webhook
 * (lib/admission-service.ts -> markApplicationPaid). So a family who paid at
 * the bursary in cash could be reviewed and pass the entrance exam, and then
 * hit a hard "Admission payment has not been verified" wall with no way past
 * it. During a paper-to-online transition that is most of the intake.
 *
 * This closes the loop for:
 *   • paper applications entered without payment (feePaid: false)
 *   • online applicants who abandoned Paystack and paid at the school instead
 *
 * Restricted to PEOPLE_ADMIN_ROLES (Admin / Director / Coordinator /
 * Super Admin) and fully audit-logged — it is a money-affecting manual
 * override, so who did it and on what evidence both matter.
 */
const schema = z.object({
  applicationId: z.string().trim().min(1),
  method: z.enum(["CASH", "BANK_TRANSFER", "POS"]),
  /** Teller number, POS slip reference or transfer narration. */
  reference: z.string().trim().min(2).max(120),
  note: z.string().trim().max(300).optional(),
});

export async function POST(request: NextRequest) {
  const guard = await requireModule("admissions", PEOPLE_ADMIN_ROLES);
  if (!guard.ok) return guard.response;
  // Rule 13: auth → role → module. A module this school switched off is a 403.
  const user = guard.user;

  let input: z.infer<typeof schema>;
  try {
    input = schema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: "Invalid payment details." }, { status: 400 });
  }

  const application = await prisma.admissionApplication.findFirst({
    where: { schoolId: user.schoolId, applicationId: input.applicationId },
    include: { payment: true },
  });
  if (!application) {
    return NextResponse.json({ error: "Application not found." }, { status: 404 });
  }

  // Idempotent by outcome: recording a fee twice is a no-op rather than an
  // error, so a double-click cannot create a second PaymentTransaction.
  if (application.paymentStatus === PaymentStatus.PAID) {
    return NextResponse.json({
      alreadyRecorded: true,
      applicationId: application.applicationId,
      paymentStatus: application.paymentStatus,
      message: "This application fee was already recorded as paid.",
    });
  }

  const offlineReference = `OFFLINE-${application.applicationId}-${input.reference.slice(0, 40)}`;

  try {
    const recorded = await prisma.$transaction(async (tx) => {
      // Compare-and-set the payment transition so concurrent retries or a
      // Paystack webhook can win only once; the loser must not overwrite the
      // trusted provider's reference or emit a second manual-payment audit.
      const transition = await tx.admissionApplication.updateMany({
        where: {
          id: application.id,
          schoolId: user.schoolId,
          paymentStatus: { not: PaymentStatus.PAID },
        },
        data: { paymentStatus: PaymentStatus.PAID, paymentReference: offlineReference },
      });
      if (transition.count !== 1) {
        const current = await tx.admissionApplication.findFirst({
          where: { id: application.id, schoolId: user.schoolId },
          select: { paymentStatus: true },
        });
        return current?.paymentStatus === PaymentStatus.PAID ? "already" : "conflict";
      }

      const providerData = {
        method: input.method,
        recordedBy: user.id,
        recordedByName: user.name,
        officeReference: input.reference,
        note: input.note || null,
      };
      const provider =
        input.method === "BANK_TRANSFER" ? PaymentProvider.BANK_TRANSFER : PaymentProvider.CASH;

      // The unique applicationId upsert preserves an abandoned Paystack row
      // and is safe if a retry races the first manual confirmation.
      await tx.paymentTransaction.upsert({
        where: { applicationId: application.id },
        create: {
          applicationId: application.id,
          provider,
          reference: offlineReference,
          amountKobo: APPLICATION_FEE_KOBO,
          status: PaymentStatus.PAID,
          paidAt: new Date(),
          providerData,
        },
        update: {
          provider,
          reference: offlineReference,
          amountKobo: APPLICATION_FEE_KOBO,
          status: PaymentStatus.PAID,
          paidAt: new Date(),
          providerData,
        },
      });

      await tx.auditLog.create({
        data: {
          schoolId: user.schoolId,
          actorUserId: user.id,
          action: "ADMISSION_FEE_RECORDED_OFFLINE",
          entityType: "AdmissionApplication",
          entityId: application.applicationId,
          ipAddress: getClientIp(request),
          metadata: {
            method: input.method,
            reference: input.reference,
            amountKobo: APPLICATION_FEE_KOBO,
            note: input.note || null,
          },
        },
      });
      return "recorded" as const;
    });

    if (recorded === "already") {
      return NextResponse.json({
        alreadyRecorded: true,
        applicationId: application.applicationId,
        paymentStatus: PaymentStatus.PAID,
        message: "This application fee was already recorded as paid.",
      });
    }
    if (recorded === "conflict") {
      return NextResponse.json(
        { error: "Payment state changed while recording. Refresh and check the application." },
        { status: 409 },
      );
    }

    return NextResponse.json({
      applicationId: application.applicationId,
      paymentStatus: PaymentStatus.PAID,
      reference: offlineReference,
      message: "Application fee recorded. This applicant can now be enrolled.",
    });
  } catch (error) {
    logger.error("Offline fee recording failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { error: "Could not record the payment. Nothing was changed." },
      { status: 500 },
    );
  }
}
