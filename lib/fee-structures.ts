import { FeeCreditStatus, FeeInvoiceStatus, Prisma, UserRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { postCreditApplication, postInvoiceAccrual } from "@/lib/ledger-postings";
import { nextDocumentNumber } from "@/lib/document-sequence";
import { computeInvoiceStatus } from "@/lib/finance";

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

export const FEE_ADMIN_ROLES: UserRole[] = [UserRole.ADMIN, UserRole.DIRECTOR, UserRole.BURSAR];

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

/** Which index a P2002 came from, across Prisma's shapes for `meta.target`. */
function p2002Targets(error: Prisma.PrismaClientKnownRequestError): string[] {
  const target = (error.meta as { target?: unknown } | undefined)?.target;
  if (Array.isArray(target)) return target.map(String);
  if (typeof target === "string") return [target];
  return [];
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

  // B-16: a zero-total structure used to be created happily and then detonate
  // mid billing-run — the ₦0 accrual is refused by the ledger's zero-leg
  // guard, aborting generation partway through a school. There is also
  // nothing to bill. Refuse it at creation, with the reason.
  if (structureTotal(items) <= 0) {
    throw new Error(
      "A fee structure must total more than ₦0 — add at least one priced item before saving.",
    );
  }

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
      // B-16: the same holds for a structure that totals ₦0 — surfaced as a
      // blocker in the dry-run plan instead of failing the billing run.
      blocker: !structure
        ? `No fee structure for ${level} in ${term.label}. Create one first.`
        : structureTotal(structure.items) <= 0
          ? `The ${level} fee structure totals ₦0 — price its items before billing.`
          : null,
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
}): Promise<{
  created: number;
  skipped: number;
  blocked: number;
  /** B-16: billable rows whose structure totals ₦0 — skipped, never crashed. */
  zeroTotalSkipped: number;
  totalBilled: number;
  creditsAppliedNaira: number;
}> {
  const plan = await planInvoiceGeneration(params);
  const toBill = plan.rows.filter((r) => !r.blocker && !r.alreadyInvoiced);

  if (!toBill.length) {
    return {
      created: 0,
      skipped: plan.summary.skipped,
      blocked: plan.summary.blocked,
      zeroTotalSkipped: 0,
      totalBilled: 0,
      creditsAppliedNaira: 0,
    };
  }

  const structures = await prisma.feeStructure.findMany({
    where: { termId: params.termId, isActive: true },
    include: { items: { orderBy: { sortOrder: "asc" } } },
  });
  const byLevel = new Map(structures.map((s) => [s.level, s]));

  const links = await prisma.parentStudentLink.findMany({
    where: { studentProfileId: { in: toBill.map((r) => r.studentProfileId) }, isPrimary: true },
    select: { studentProfileId: true, parentProfileId: true },
  });
  const parentOf = new Map(links.map((l) => [l.studentProfileId, l.parentProfileId]));

  let creditsApplied = 0;
  let created = 0;
  let totalBilled = 0;
  let zeroTotalSkipped = 0;

  // Chunked rather than one giant transaction: a whole-school run can be
  // hundreds of invoices, and a single transaction that large risks the same
  // timeout that bit repair-labels. Each student's invoice is atomic on its
  // own, and the unique index makes a re-run safe after a partial failure.
  for (const row of toBill) {
    const structure = byLevel.get(row.level);
    if (!structure) continue;

    const total = structureTotal(structure.items);
    // B-16 defence-in-depth: the plan already blocks ₦0 structures, and
    // upsert refuses to create them — but a ₦0 accrual would abort the run
    // mid-school, so generation skips (and reports) rather than crashes.
    if (total <= 0) {
      zeroTotalSkipped += 1;
      continue;
    }
    const dueDate = structure.dueInDays
      ? new Date(Date.now() + structure.dueInDays * 86_400_000)
      : null;

    try {
      // The invoice and its ledger accrual (F5-08: fees receivable up, fee
      // income up) are one transaction. A billed family that is missing from
      // the ledger is an arrears report that cannot be trusted, and RLS/route
      // bugs aside, the only way to guarantee they agree is to write them
      // together.
      await prisma.$transaction(async (tx) => {
        // B-16: the number is drawn from the school's DocumentSequence
        // counter INSIDE this transaction. Count-based numbering raced:
        // two concurrent runs drew the same invoiceNumber, and the P2002
        // was indistinguishable from "student already billed" — silently
        // skipping a billable student. The counter row lock serialises
        // numbering and rolls back with a failed posting.
        const sequence = await nextDocumentNumber(tx, params.schoolId, `invoice:${params.termId}`);
        const invoice = await tx.feeInvoice.create({
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

        await postInvoiceAccrual(tx, {
          schoolId: params.schoolId,
          invoiceId: invoice.id,
          invoiceNumber: invoice.invoiceNumber,
          totalNaira: total,
          termLabel: plan.term.label,
          studentProfileId: row.studentProfileId,
          actorUserId: params.actorUserId,
          postedAt: invoice.issuedAt,
        });

        // F5-11: a credit balance the school holds for this pupil settles
        // the new bill first, oldest credit first. The liability is spent
        // in the same transaction as the accrual, so the pupil's ledger
        // statement shows the new bill arriving already part-settled.
        const credits = await tx.feeCredit.findMany({
          where: {
            schoolId: params.schoolId,
            studentProfileId: row.studentProfileId,
            status: { in: [FeeCreditStatus.OPEN, FeeCreditStatus.PARTIALLY_APPLIED] },
            amountRemainingNaira: { gt: 0 },
          },
          orderBy: { createdAt: "asc" },
        });
        const openCredits = credits ?? [];
        let remaining = total;
        let credited = 0;
        for (const credit of openCredits) {
          if (remaining <= 0) break;
          const spend = Math.min(credit.amountRemainingNaira, remaining);
          if (spend <= 0) continue;
          await postCreditApplication(tx, {
            schoolId: params.schoolId,
            creditId: credit.id,
            invoiceId: invoice.id,
            invoiceNumber: invoice.invoiceNumber,
            amountNaira: spend,
            studentProfileId: row.studentProfileId,
            actorUserId: params.actorUserId,
          });
          const left = credit.amountRemainingNaira - spend;
          await tx.feeCredit.update({
            where: { id: credit.id },
            data: {
              amountRemainingNaira: left,
              status: left === 0 ? FeeCreditStatus.APPLIED : FeeCreditStatus.PARTIALLY_APPLIED,
            },
          });
          remaining -= spend;
          credited += spend;
        }
        if (credited > 0) {
          creditsApplied += credited;
          await tx.feeInvoice.update({
            where: { id: invoice.id },
            data: {
              amountCredited: credited,
              balanceDue: total - credited,
              status: computeInvoiceStatus(total, 0, dueDate, credited),
            },
          });
        }
      });
      created += 1;
      totalBilled += total;
    } catch (error) {
      // P2002 on (studentProfileId, termId) = someone else already raised
      // this student's invoice — the desired outcome, skip and carry on.
      // A collision on invoiceNumber must NOT be read as "already billed"
      // (that was the silent-skip bug); with sequence numbering it cannot
      // happen, so if it ever does, it surfaces as the failure it is.
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002" &&
        !p2002Targets(error).some((target) => target.includes("invoiceNumber"))
      ) {
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
        creditsAppliedNaira: creditsApplied,
      },
    },
  });

  return {
    created,
    skipped: plan.summary.skipped,
    blocked: plan.summary.blocked,
    zeroTotalSkipped,
    totalBilled,
    creditsAppliedNaira: creditsApplied,
  };
}
