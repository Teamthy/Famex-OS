import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { resolveCurrentLabels } from "@/lib/academic-session";
import { FEE_ADMIN_ROLES, structureTotal, upsertFeeStructure } from "@/lib/fee-structures";
import { prisma } from "@/lib/prisma";
import { getClientIp } from "@/lib/requests";
import { assertNotImpersonating, requireRole } from "@/lib/session";

export const dynamic = "force-dynamic";

/**
 * Fee structures — what each level costs in a given term.
 *
 * This is the missing half of the fee system: everything else (payments,
 * Paystack, receipts, the CBT gate, report-card balances) was already wired to
 * FeeInvoice, but nothing outside a demo seed could create one.
 */

const itemSchema = z.object({
  label: z.string().trim().min(1).max(80),
  amount: z.number().int().min(0).max(100_000_000),
  mandatory: z.boolean().optional(),
  sortOrder: z.number().int().min(0).max(999).optional(),
});

const upsertSchema = z.object({
  termId: z.string().trim().min(1),
  level: z.string().trim().min(1).max(20),
  title: z.string().trim().min(2).max(120),
  dueInDays: z.number().int().min(0).max(365).nullable().optional(),
  items: z.array(itemSchema).min(1).max(30),
});

export async function GET(request: NextRequest) {
  const user = await requireRole(FEE_ADMIN_ROLES);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const requestedTermId = request.nextUrl.searchParams.get("termId");
  const current = await resolveCurrentLabels(user.schoolId);

  const terms = await prisma.term.findMany({
    where: { schoolId: user.schoolId },
    include: { session: { select: { label: true, startsOn: true } } },
    orderBy: [{ session: { startsOn: "desc" } }, { index: "asc" }],
    take: 30,
  });

  const termId = requestedTermId || current.termId || terms[0]?.id || null;

  const [structures, classes] = await Promise.all([
    termId
      ? prisma.feeStructure.findMany({
          where: { schoolId: user.schoolId, termId },
          include: { items: { orderBy: { sortOrder: "asc" } } },
          orderBy: { level: "asc" },
        })
      : Promise.resolve([]),
    prisma.schoolClass.findMany({
      where: { schoolId: user.schoolId, isActive: true },
      select: { level: true },
      distinct: ["level"],
      orderBy: { level: "asc" },
    }),
  ]);

  return NextResponse.json({
    selectedTermId: termId,
    labelSource: current.source,
    terms: terms.map((t) => ({
      id: t.id,
      label: t.label,
      index: t.index,
      sessionLabel: t.session.label,
      isCurrent: t.isCurrent,
    })),
    // Levels that actually have classes — offering SS4 because someone typed
    // it once is how you get an unbillable cohort.
    levels: classes.map((c) => c.level),
    structures: structures.map((s) => ({
      id: s.id,
      level: s.level,
      title: s.title,
      dueInDays: s.dueInDays,
      total: structureTotal(s.items),
      items: s.items.map((i) => ({
        label: i.label,
        amount: i.amount,
        mandatory: i.mandatory,
        sortOrder: i.sortOrder,
      })),
    })),
  });
}

export async function POST(request: NextRequest) {
  const user = await requireRole(FEE_ADMIN_ROLES);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const impersonating = assertNotImpersonating(user);
  if (impersonating) return impersonating;

  let input: z.infer<typeof upsertSchema>;
  try {
    input = upsertSchema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: "Invalid fee structure." }, { status: 400 });
  }

  const total = input.items.reduce((sum, i) => sum + i.amount, 0);
  if (total <= 0) {
    return NextResponse.json(
      { error: "A fee structure must total more than ₦0." },
      { status: 400 },
    );
  }

  try {
    const structure = await upsertFeeStructure({
      schoolId: user.schoolId,
      termId: input.termId,
      level: input.level,
      title: input.title,
      dueInDays: input.dueInDays ?? null,
      items: input.items,
      createdByUserId: user.id,
    });

    await prisma.auditLog.create({
      data: {
        schoolId: user.schoolId,
        actorUserId: user.id,
        action: "FEE_STRUCTURE_SAVED",
        entityType: "FeeStructure",
        entityId: structure.id,
        ipAddress: getClientIp(request),
        metadata: { level: input.level, total },
      },
    });

    return NextResponse.json({ ok: true, structure, total }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to save the fee structure." },
      { status: 400 },
    );
  }
}

export async function DELETE(request: NextRequest) {
  const user = await requireRole(FEE_ADMIN_ROLES);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const impersonating = assertNotImpersonating(user);
  if (impersonating) return impersonating;

  const id = request.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Missing structure id." }, { status: 400 });

  const structure = await prisma.feeStructure.findFirst({
    where: { id, schoolId: user.schoolId },
  });
  if (!structure) return NextResponse.json({ error: "Not found." }, { status: 404 });

  // Retire rather than delete: invoices already raised from it are a record of
  // what a family was billed, and the structure is their provenance.
  await prisma.feeStructure.update({ where: { id }, data: { isActive: false } });

  return NextResponse.json({ ok: true, message: "Fee structure retired." });
}
