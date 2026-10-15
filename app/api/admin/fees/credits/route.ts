import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { z } from "zod";
import { getAdminFinanceContext } from "@/lib/finance";
import { listOpenCredits, transferFeeCredit } from "@/lib/fee-adjustments";
import { requireModule } from "@/lib/module-guard";

export const runtime = "nodejs";

/**
 * Credit balances (F5-11) and transfers between pupils (F5-14).
 *
 * Credits are born inside the payment posting (a deliberate overpayment)
 * and spent automatically when the pupil's next invoice is generated.
 * A TRANSFER moves settled money from one invoice to another — one
 * journal, one idempotency key; the caller supplies the transfer id so a
 * retried request is the same transfer, not a second one.
 */
const transferSchema = z.object({
  action: z.literal("TRANSFER"),
  transferId: z.string().min(8).max(64).optional(),
  fromInvoiceId: z.string().min(1),
  toInvoiceId: z.string().min(1),
  amountNaira: z.number().int().positive(),
});

export async function GET() {
  const context = await getAdminFinanceContext();
  if (!context) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const moduleCheck = await requireModule("fees");
  if (!moduleCheck.ok) return moduleCheck.response;

  const credits = await listOpenCredits(context.user.schoolId);
  return NextResponse.json({
    credits: credits.map((c) => ({
      id: c.id,
      studentProfileId: c.studentProfileId,
      studentName: c.studentProfile.displayName,
      amountNaira: c.amountNaira,
      amountRemainingNaira: c.amountRemainingNaira,
      status: c.status,
      createdAt: c.createdAt.toISOString(),
    })),
    totalHeldNaira: credits.reduce((sum, c) => sum + c.amountRemainingNaira, 0),
  });
}

export async function POST(request: NextRequest) {
  const context = await getAdminFinanceContext();
  if (!context) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const moduleCheck = await requireModule("fees", ["ADMIN", "DIRECTOR", "BURSAR"]);
  if (!moduleCheck.ok) return moduleCheck.response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  try {
    const input = transferSchema.parse(body);
    const result = await transferFeeCredit({
      schoolId: context.user.schoolId,
      transferId: input.transferId ?? randomUUID(),
      fromInvoiceId: input.fromInvoiceId,
      toInvoiceId: input.toInvoiceId,
      amountNaira: input.amountNaira,
      actor: { userId: context.user.id, role: context.user.role },
    });
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid request", details: error.flatten() },
        { status: 400 },
      );
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "The transfer could not be completed." },
      { status: 400 },
    );
  }
}
