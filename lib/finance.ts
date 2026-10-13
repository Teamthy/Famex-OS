import { randomBytes } from "crypto";
import { FeeInvoiceStatus, FeePaymentMethod, FeePaymentStatus, UserRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/session";

export const FINANCE_ADMIN_ROLES = [
  UserRole.ADMIN,
  UserRole.DIRECTOR,
  UserRole.BURSAR,
  UserRole.COORDINATOR,
];

export function computeInvoiceStatus(
  totalAmount: number,
  amountPaid: number,
  dueDate?: Date | null,
) {
  if (amountPaid >= totalAmount) return FeeInvoiceStatus.PAID;
  if (amountPaid > 0) return FeeInvoiceStatus.PARTIAL;
  if (dueDate && dueDate.getTime() < Date.now()) return FeeInvoiceStatus.OVERDUE;
  return FeeInvoiceStatus.UNPAID;
}

/**
 * Receipt number — CSPRNG-based (not Math.random) to avoid birthday collisions on
 * the UNIQUE `receiptNumber` column. Format: YKC-RCP-YYYY-XXXXXXXX (8 hex chars).
 */
export function generateReceiptNumber() {
  const year = new Date().getFullYear();
  const suffix = randomBytes(4).toString("hex").toUpperCase();
  return `YKC-RCP-${year}-${suffix}`;
}

/**
 * Payment reference — CSPRNG-based. Format: YKC-PAY-YYYY-XXXXXXXXXXXX (12 hex chars).
 */
export function generatePaymentReference() {
  const year = new Date().getFullYear();
  const suffix = randomBytes(6).toString("hex").toUpperCase();
  return `YKC-PAY-${year}-${suffix}`;
}

/**
 * Generate a receipt number guaranteed unique against the DB (defence-in-depth on
 * top of the UNIQUE constraint). Retries with fresh entropy until free, then throws.
 */
export async function generateUniqueReceiptNumber(maxRetries = 5): Promise<string> {
  for (let attempt = 0; attempt < maxRetries; attempt += 1) {
    const candidate = generateReceiptNumber();
    const existing = await prisma.feePayment.findUnique({
      where: { receiptNumber: candidate },
      select: { id: true },
    });
    if (!existing) return candidate;
  }
  throw new Error("Failed to generate unique receipt number after retries");
}

export async function getParentFinanceContext() {
  const user = await requireRole([UserRole.PARENT]);
  if (!user) return null;

  const profile = await prisma.parentProfile.findFirst({
    where: {
      schoolId: user.schoolId,
      userId: user.id,
      isActive: true,
    },
    select: {
      id: true,
      displayName: true,
      phone: true,
      user: { select: { email: true } },
      studentLinks: {
        orderBy: [{ isPrimary: "desc" }, { studentProfile: { displayName: "asc" } }],
        select: {
          isPrimary: true,
          relationship: true,
          studentProfile: {
            select: {
              id: true,
              studentId: true,
              displayName: true,
              currentClass: {
                select: {
                  id: true,
                  displayName: true,
                },
              },
            },
          },
        },
      },
    },
  });

  if (!profile) return null;
  return { user, profile };
}

export async function getAdminFinanceContext() {
  const user = await requireRole(FINANCE_ADMIN_ROLES);
  if (!user) return null;
  return { user };
}

export function feeMethodLabel(method: FeePaymentMethod) {
  switch (method) {
    case FeePaymentMethod.BANK_TRANSFER:
      return "Bank Transfer";
    case FeePaymentMethod.CASH:
      return "Cash";
    case FeePaymentMethod.CARD:
      return "Card";
    case FeePaymentMethod.USSD:
      return "USSD";
    default:
      return "Paystack";
  }
}

export function feeStatusLabel(status: FeeInvoiceStatus) {
  return status.replaceAll("_", " ");
}

export function paymentStatusLabel(status: FeePaymentStatus) {
  return status.replaceAll("_", " ");
}
