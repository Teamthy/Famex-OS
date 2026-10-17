import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/session";
import { UserRole } from "@prisma/client";
import {
  addBook,
  catalogueStats,
  listBooks,
  listLoans,
  loanBook,
  returnBook,
} from "@/lib/library";
import { getClientIp } from "@/lib/requests";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function adminCtx() {
  const user = await requireRole([UserRole.ADMIN, UserRole.DIRECTOR, UserRole.COORDINATOR, UserRole.HOD, UserRole.TEACHER]);
  if (!user) return null;
  return user;
}

export async function GET() {
  const user = await adminCtx();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const [books, loans] = await Promise.all([listBooks(user.schoolId), listLoans(user.schoolId)]);
  return NextResponse.json({ books, loans, stats: catalogueStats(books, loans) });
}

export async function POST(req: NextRequest) {
  const user = await adminCtx();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  try {
    if (body?.kind === "BOOK") {
      const book = await addBook(user.schoolId, body);
      await prisma.auditLog
        .create({
          data: {
            schoolId: user.schoolId,
            actorUserId: user.id,
            action: "LIBRARY_BOOK_ADDED",
            entityType: "LibraryBook",
            entityId: book.id,
            ipAddress: getClientIp(req),
            metadata: { title: book.data.title },
          },
        })
        .catch(() => {});
      return NextResponse.json({ book }, { status: 201 });
    }
    if (body?.kind === "LOAN") {
      const loan = await loanBook(user.schoolId, body);
      await prisma.auditLog
        .create({
          data: {
            schoolId: user.schoolId,
            actorUserId: user.id,
            action: "LIBRARY_BOOK_LOANED",
            entityType: "LibraryLoan",
            entityId: loan.id,
            ipAddress: getClientIp(req),
          },
        })
        .catch(() => {});
      return NextResponse.json({ loan }, { status: 201 });
    }
    if (body?.kind === "RETURN") {
      const loan = await returnBook(user.schoolId, body.loanId);
      if (!loan) return NextResponse.json({ error: "Loan not found." }, { status: 404 });
      await prisma.auditLog
        .create({
          data: {
            schoolId: user.schoolId,
            actorUserId: user.id,
            action: "LIBRARY_BOOK_RETURNED",
            entityType: "LibraryLoan",
            entityId: loan.id,
            ipAddress: getClientIp(req),
          },
        })
        .catch(() => {});
      return NextResponse.json({ loan });
    }
    return NextResponse.json({ error: "Unknown kind." }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? "Invalid data." }, { status: 400 });
  }
}
