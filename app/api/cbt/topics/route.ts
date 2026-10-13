import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/** Public: distinct published topics for a subject slug. */
export async function GET(req: NextRequest) {
  const slug = req.nextUrl.searchParams.get("subject") ?? "";
  const subject = await prisma.cbtSubject.findUnique({ where: { slug }, select: { id: true } });
  if (!subject) return NextResponse.json({ error: "Subject not found" }, { status: 404 });

  const rows = await prisma.cbtQuestion.findMany({
    where: { subjectId: subject.id, status: "published" },
    distinct: ["topic"],
    select: { topic: true },
    orderBy: { topic: "asc" },
  });
  return NextResponse.json({ topics: rows.map((r) => r.topic).filter(Boolean) });
}
