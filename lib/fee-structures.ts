import { FeeInvoiceStatus, Prisma, UserRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";

/**
 * Fee structures and invoice generation.
 *
 * The template ("JSS1 pays 85,000 tuition + 15,000 development levy this
 * term") lives in FeeStructure; raising invoices copies those lines onto each
 * student as FeeInvoiceItem rows.
 *
 * The copy is deliberate, not a join. An invoice is a statement of what a
 * family was actually billed on a given day. If it read live from the
 * structure, editing next term's fees would silently rewrite every invoice
 * ever issued — including paid ones.
 */

export const FEE_ADMIN_ROLES: UserRole[] = [
  UserRole.ADMIN,
  UserRole.DIRECTOR,
  UserRole.BURSAR,
  UserRole.SUPER_ADMIN,
];

export type StructureItemInput = {
  label: string;
  amount: number;
  mandatory?: boolean;
  sortOrder?: number;
};

/** A sensible starting point for a Nigerian secondary school. */
export const DEFAULT_FEE_ITEMS: StructureItemInput[] = [
  { label: "Tuition Fee", amount: 0, mandatory: true, sortOrder: 1 },
  { label: "Development Levy", amount: 0, mandatory: true, sortOrder: 2 },
  { label: "Exam Fee", amount: 0, mandatory: true, sortOrder: 3 },
  { label: "ICT Levy", amount: 0, mandatory: true, sortOrder: 4 },
  { label: "PTA Levy", amount: 0, mandatory: true, sortOrder: 5 },
];

/** Total of the mandatory lines, plus any optional ones explicitly included. */
export function structureTotal(
  items: Array<{ amount: number; mandatory: boolean }>,
  includeOptional = true,
): number {
  return items
    .filter((item) => item.mandatory || includeOptional)
    .reduce((sum, item) => sum + item.amount, 0);
}

/**
 * Invoice number: YKC-INV-<session>-<term index>-<sequence>.
 *
 * Session and term are in the number because a bursar reads these aloud on the
 * phone and needs to know which term is being discussed. The sequence is
 * per-term, so numbering restarts cleanly each term rather than growing
 * forever.
 */
export function buildInvoiceNumber(
  sessionLabel: string,
  termIndex: number,
  sequence: number,
): string {
  return `YKC-INV-${sessionLabel.replace("/", "-")}-T${termIndex}-${String(sequence).padStart(4, "0")}`;
}

export async function upsertFeeStructure(params: {
  schoolId: string;
  termId: string;
  level: string;
  title: string;
  dueInDays?: number | null;
  items: StructureItemInput[];
  createdByUserId?: string | null;
}) {
  const term = await prisma.term.findFirst({
    where: { id: params.termId, schoolId: params.schoolId },
    include: { session: true },
  });
  if (!term) throw new Error("Term not found for this school.");

  const items = params.items
    .filter((item) => item.label.trim().length > 0)
    .map((item, index) => ({
      label: item.label.trim(),
      // Reject negatives outright rather than letting a typo become a credit.
      amount: Math.max(0, Math.round(item.amount)),
      mandatory: item.mandatory ?? true,
      sortOrder: item.sortOrder ?? index + 1,
    }));

  return prisma.$transaction(async (tx) => {
    const existing = await tx.feeStructure.findUnique({
      where: { termId_level: { termId: params.termId, level: params.level } },
    });

    if (existing) {
      // Replace the lines wholesale — editing in place would need stable ids
      // the UI does not carry, and a structure is small enough that this is
      // cheaper than reconciling.
      await tx.feeStructureItem.deleteMany({ where: { structureId: existing.id } });
      return tx.feeStructure.update({
        where: { id: existing.id },
        data: {
          title: params.title.trim(),
          dueInDays: params.dueInDays ?? null,
          isActive: true,
          items: { createMany: { data: items } },
        },
        include: { items: { orderBy: { sortOrder: "asc" } } },
      });
    }

    return tx.feeStructure.create({
      data: {
        schoolId: params.schoolId,
        sessionId: term.sessionId,
        termId: params.termId,
        level: params.level,
        title: params.title.trim(),
        dueInDays: params.dueInDays ?? null,
        createdByUserId: params.createdByUserId ?? null,
        items: { createMany: { data: items } },
      },
      include: { items: { orderBy: { sortOrder: "asc" } } },
    });
  });
}

export type GenerationPlanRow = {
  studentProfileId: string;
  studentId: string;
  displayName: string;
  className: string;
  level: string;
  amount: number;
  /** Set when this student cannot be invoiced, with the reason why. */
  blocker: string | null;
  /** True when an invoice for this student and term already exists. */
  alreadyInvoiced: boolean;
};

/**
 * Work out who would be invoiced, without writing anything.
 *
 * Separate from the commit so an admin sees the bill before it lands in
 * parents' inboxes. Billing the wrong amount is expensive to unwind socially,
 * not just technically.
 */
export async function planInvoiceGeneration(params: {
  schoolId: string;
  termId: string;
  /** Restrict to one class; omit for the whole school. */
  classId?: string | null;
}): Promise<{
  term: { id: string; label: string; index: number; sessionLabel: string };
  rows: GenerationPlanRow[];
  summary: { total: number; billable: number; skipped: number; blocked: number; amount: number };
}> {
  const term = await prisma.term.findFirst({
    where: { id: params.termId, schoolId: params.schoolId },
    include: { session: true },
  });
  if (!term) throw new Error("Term not found for this school.");

  const structures = await prisma.feeStructure.findMany({
    where: { termId: term.id, isActive: true },
    include: { items: true },
  });
  const byLevel = new Map(structures.map((s) => [s.level, s]));

  const students = await prisma.studentProfile.findMany({
    where: {
      schoolId: params.schoolId,
      isActive: true,
      ...(params.classId ? { currentClassId: params.classId } : {}),
    },
    select: {
      id: true,
      studentId: true,
      displayName: true,
      currentClass: { select: { displayName: true, level: true } },
    },
    orderBy: [{ currentClass: { displayName: "asc" } }, { displayName: "asc" }],
  });

  const existing = await prisma.feeInvoice.findMany({
    where: { termId: term.id, studentProfileId: { in: students.map((s) => s.id) } },
    select: { studentProfileId: true },
  });
  const invoiced = new Set(existing.map((e) => e.studentProfileId));

  const rows: GenerationPlanRow[] = students.map((student) => {
    const level = student.currentClass.level;
    const structure = byLevel.get(level);
    const alreadyInvoiced = invoiced.has(student.id);

    return {
      studentProfileId: student.id,
      studentId: student.studentId,
      displayName: student.displayName,
      className: student.currentClass.displayName,
      level,
      amount: structure ? structureTotal(structure.items) : 0,
      // A missing structure is surfaced, never guessed at. Billing a student
      // zero because nobody set their level's fees is worse than refusing.
      blocker: structure
        ? null
        : `No fee structure for ${level} in ${term.label}. Create one first.`,
      alreadyInvoiced,
    };
  });

  const billable = rows.filter((r) => !r.blocker && !r.alreadyInvoiced);

  return {
    term: {
      id: term.id,
      label: term.label,
      index: term.index,
      sessionLabel: term.session.label,
    },
    rows,
    summary: {
      total: rows.length,
      billable: billable.length,
      skipped: rows.filter((r) => r.alreadyInvoiced).length,
      blocked: rows.filter((r) => r.blocker).length,
      amount: billable.reduce((sum, r) => sum + r.amount, 0),
    },
  };
}

/**
 * Raise the invoices.
 *
 * Idempotent by construction: students who already have an invoice for this
 * term are skipped, and the unique index on (studentProfileId, termId) is the
 * backstop if two admins click at once. Re-running after adding a student
 * bills only the new student.
 */
export async function generateInvoices(params: {
  schoolId: string;
  termId: string;
  classId?: string | null;
  actorUserId: string;
}): Promise<{ created: number; skipped: number; blocked: number; totalBilled: number }> {
  const plan = await planInvoiceGeneration(params);
  const toBill = plan.rows.filter((r) => !r.blocker && !r.alreadyInvoiced);

  if (!toBill.length) {
    return {
      created: 0,
      skipped: plan.summary.skipped,
      blocked: plan.summary.blocked,
      totalBilled: 0,
    };
  }

  const structures = await prisma.feeStructure.findMany({
    where: { termId: params.termId, isActive: true },
    include: { items: { orderBy: { sortOrder: "asc" } } },
  });
  const byLevel = new Map(structures.map((s) => [s.level, s]));

  // Continue the term's numbering rather than restarting at 1 — otherwise a
  // second run collides with the first run's invoice numbers.
  const issued = await prisma.feeInvoice.count({ where: { termId: params.termId } });

  const links = await prisma.parentStudentLink.findMany({
    where: { studentProfileId: { in: toBill.map((r) => r.studentProfileId) }, isPrimary: true },
    select: { studentProfileId: true, parentProfileId: true },
  });
  const parentOf = new Map(links.map((l) => [l.studentProfileId, l.parentProfileId]));

  let created = 0;
  let totalBilled = 0;
  let sequence = issued;

  // Chunked rather than one giant transaction: a whole-school run can be
  // hundreds of invoices, and a single transaction that large risks the same
  // timeout that bit repair-labels. Each student's invoice is atomic on its
  // own, and the unique index makes a re-run safe after a partial failure.
  for (const row of toBill) {
    const structure = byLevel.get(row.level);
    if (!structure) continue;

    sequence += 1;
    const total = structureTotal(structure.items);
    const dueDate = structure.dueInDays
      ? new Date(Date.now() + structure.dueInDays * 86_400_000)
      : null;

    try {
      await prisma.feeInvoice.create({
        data: {
          schoolId: params.schoolId,
          studentProfileId: row.studentProfileId,
          parentProfileId: parentOf.get(row.studentProfileId) ?? null,
          invoiceNumber: buildInvoiceNumber(plan.term.sessionLabel, plan.term.index, sequence),
          title: structure.title,
          termLabel: plan.term.label,
          termId: params.termId,
          status: FeeInvoiceStatus.UNPAID,
          totalAmount: total,
          amountPaid: 0,
          balanceDue: total,
          dueDate,
          items: {
            createMany: {
              data: structure.items.map((item) => ({
                label: item.label,
                amount: item.amount,
                mandatory: item.mandatory,
                sortOrder: item.sortOrder,
              })),
            },
          },
        },
      });
      created += 1;
      totalBilled += total;
    } catch (error) {
      // P2002 = someone else already raised this student's invoice. That is
      // the desired outcome, not a failure — skip and carry on.
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        continue;
      }
      throw error;
    }
  }

  await prisma.auditLog.create({
    data: {
      schoolId: params.schoolId,
      actorUserId: params.actorUserId,
      action: "FEE_INVOICES_GENERATED",
      entityType: "Term",
      entityId: params.termId,
      metadata: {
        termLabel: plan.term.label,
        sessionLabel: plan.term.sessionLabel,
        classId: params.classId ?? null,
        created,
        totalBilled,
      },
    },
  });

  return {
    created,
    skipped: plan.summary.skipped,
    blocked: plan.summary.blocked,
    totalBilled,
  };
}
