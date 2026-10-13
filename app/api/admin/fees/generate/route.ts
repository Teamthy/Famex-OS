import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { NoCurrentTermError, requireCurrentLabels } from "@/lib/academic-session";
import { FEE_ADMIN_ROLES, generateInvoices, planInvoiceGeneration } from "@/lib/fee-structures";
import { prisma } from "@/lib/prisma";
import { assertNotImpersonating, requireRole } from "@/lib/session";

export const dynamic = "force-dynamic";

/**
 * Raise fee invoices for a term.
 *
 * GET previews, POST commits — the same propose-then-commit shape as
 * end-of-session promotion. Billing several hundred families is not something
 * to discover the shape of afterwards.
 */

const generateSchema = z.object({
  termId: z.string().trim().min(1).optional(),
  classId: z.string().trim().min(1).nullable().optional(),
});

export async function GET(request: NextRequest) {
  const user = await requireRole(FEE_ADMIN_ROLES);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let termId = request.nextUrl.searchParams.get("termId");
  if (!termId) {
    try {
      ({ termId } = await requireCurrentLabels(user.schoolId));
    } catch (error) {
      if (error instanceof NoCurrentTermError) {
        return NextResponse.json({ error: error.message }, { status: 409 });
      }
      throw error;
    }
  }

  const classId = request.nextUrl.searchParams.get("classId");

  const [plan, classes] = await Promise.all([
    planInvoiceGeneration({ schoolId: user.schoolId, termId, classId }),
    prisma.schoolClass.findMany({
      where: { schoolId: user.schoolId, isActive: true },
      select: { id: true, displayName: true, level: true },
      orderBy: { displayName: "asc" },
    }),
  ]);

  return NextResponse.json({ ...plan, classes, selectedClassId: classId });
}

export async function POST(request: NextRequest) {
  const user = await requireRole(FEE_ADMIN_ROLES);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const impersonating = assertNotImpersonating(user);
  if (impersonating) return impersonating;

  let input: z.infer<typeof generateSchema>;
  try {
    input = generateSchema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  let termId = input.termId;
  if (!termId) {
    try {
      ({ termId } = await requireCurrentLabels(user.schoolId));
    } catch (error) {
      if (error instanceof NoCurrentTermError) {
        return NextResponse.json({ error: error.message }, { status: 409 });
      }
      throw error;
    }
  }

  // Belt and braces: the term must belong to the caller's school. Without this
  // an admin could bill against another school's term id.
  const term = await prisma.term.findFirst({
    where: { id: termId, schoolId: user.schoolId },
    select: { id: true },
  });
  if (!term) return NextResponse.json({ error: "Term not found." }, { status: 404 });

  if (input.classId) {
    const schoolClass = await prisma.schoolClass.findFirst({
      where: { id: input.classId, schoolId: user.schoolId },
      select: { id: true },
    });
    if (!schoolClass) return NextResponse.json({ error: "Class not found." }, { status: 404 });
  }

  const result = await generateInvoices({
    schoolId: user.schoolId,
    termId,
    classId: input.classId ?? null,
    actorUserId: user.id,
  });

  const parts = [`${result.created} invoice(s) raised`];
  if (result.skipped) parts.push(`${result.skipped} already invoiced`);
  if (result.blocked) parts.push(`${result.blocked} blocked (no fee structure)`);

  return NextResponse.json({
    ok: true,
    ...result,
    message: `${parts.join(" · ")}. Total billed ₦${result.totalBilled.toLocaleString()}.`,
  });
}
