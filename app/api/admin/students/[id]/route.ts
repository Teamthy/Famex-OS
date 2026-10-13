import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { PEOPLE_ADMIN_ROLES } from "@/lib/people";
import { requireRole } from "@/lib/session";
import { getClientIp } from "@/lib/requests";

export const dynamic = "force-dynamic";

export async function GET(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const user = await requireRole(PEOPLE_ADMIN_ROLES);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await context.params;
  const student = await prisma.studentProfile.findFirst({
    where: { id, schoolId: user.schoolId },
    include: {
      currentClass: { select: { id: true, displayName: true } },
      parentLinks: {
        include: {
          parentProfile: {
            select: { id: true, displayName: true, phone: true, user: { select: { email: true } } },
          },
        },
      },
      // The subjects this child actually offers. An admin looking at a
      // profile needs the list, not a count.
      studentSubjects: {
        where: { isActive: true },
        select: { subject: { select: { id: true, name: true, category: true } } },
        orderBy: { subject: { name: "asc" } },
      },
      // Enough to state the fee position. `_count.feeInvoices: 3` answers
      // nothing when a parent is on the phone asking what they owe.
      feeInvoices: {
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          termLabel: true,
          totalAmount: true,
          amountPaid: true,
          balanceDue: true,
          status: true,
          dueDate: true,
        },
      },
      _count: {
        select: {
          attendanceEntries: true,
          reportCards: true,
          feeInvoices: true,
          gradebookEntries: true,
          examAttempts: true,
        },
      },
    },
  });
  if (!student) return NextResponse.json({ error: "Student not found." }, { status: 404 });

  const invoices = student.feeInvoices ?? [];
  const totalBilled = invoices.reduce((sum, i) => sum + (i.totalAmount ?? 0), 0);
  const totalPaid = invoices.reduce((sum, i) => sum + (i.amountPaid ?? 0), 0);
  const outstanding = invoices.reduce((sum, i) => sum + (i.balanceDue ?? 0), 0);

  return NextResponse.json({
    student,
    subjects: (student.studentSubjects ?? []).map((e) => e.subject),
    fees: {
      totalBilled,
      totalPaid,
      outstanding,
      invoices,
      /**
       * NOT_BILLED is deliberately distinct from PAID. A student with no
       * invoice owes nothing, but nobody has billed them either — reporting
       * that as "paid" hides a billing gap until the end of term.
       */
      status: invoices.length === 0 ? "NOT_BILLED" : outstanding > 0 ? "OWING" : "PAID",
    },
  });
}

const patchSchema = z.object({
  firstName: z.string().trim().min(2).max(80).optional(),
  lastName: z.string().trim().min(2).max(80).optional(),
  otherNames: z.string().trim().max(120).optional(),
  gender: z.string().trim().max(30).optional(),
  guardianName: z.string().trim().min(2).max(160).optional(),
  guardianPhone: z.string().trim().min(7).max(30).optional(),
  guardianEmail: z.preprocess(
    (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
    z.string().trim().toLowerCase().email().optional(),
  ),
  currentClassId: z.string().min(1).optional(),
  isActive: z.boolean().optional(),
});

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const user = await requireRole(PEOPLE_ADMIN_ROLES);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await context.params;
  let input: z.infer<typeof patchSchema>;
  try {
    input = patchSchema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: "Invalid student details." }, { status: 400 });
  }
  const existing = await prisma.studentProfile.findFirst({
    where: { id, schoolId: user.schoolId },
  });
  if (!existing) return NextResponse.json({ error: "Student not found." }, { status: 404 });
  if (input.currentClassId && input.currentClassId !== existing.currentClassId) {
    const cls = await prisma.schoolClass.findFirst({
      where: { id: input.currentClassId, schoolId: user.schoolId, isActive: true },
    });
    if (!cls) return NextResponse.json({ error: "Class not found." }, { status: 404 });
  }
  const firstName = input.firstName ?? existing.firstName;
  const lastName = input.lastName ?? existing.lastName;
  const otherNames =
    input.otherNames !== undefined ? input.otherNames.trim() || null : existing.otherNames;
  const displayName = [firstName, otherNames, lastName].filter(Boolean).join(" ");
  const updated = await prisma.studentProfile.update({
    where: { id },
    data: {
      ...(input.firstName !== undefined ? { firstName } : {}),
      ...(input.lastName !== undefined ? { lastName } : {}),
      otherNames,
      displayName,
      ...(input.gender !== undefined ? { gender: input.gender.trim() || null } : {}),
      ...(input.guardianName !== undefined ? { guardianName: input.guardianName } : {}),
      ...(input.guardianPhone !== undefined ? { guardianPhone: input.guardianPhone } : {}),
      ...(input.guardianEmail !== undefined ? { guardianEmail: input.guardianEmail ?? null } : {}),
      ...(input.currentClassId !== undefined ? { currentClassId: input.currentClassId } : {}),
      ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
    },
  });
  await prisma.auditLog.create({
    data: {
      schoolId: user.schoolId,
      actorUserId: user.id,
      action: "STUDENT_UPDATED",
      entityType: "StudentProfile",
      entityId: id,
      ipAddress: getClientIp(request),
      metadata: { studentId: existing.studentId, fields: Object.keys(input) } as never,
    },
  });
  return NextResponse.json({ student: { id: updated.id, displayName: updated.displayName } });
}
