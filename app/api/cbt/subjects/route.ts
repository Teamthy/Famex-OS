import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/** Public: subjects with published question counts, for the /cbt picker. */
export async function GET() {
  const subjects = await prisma.cbtSubject.findMany({
    orderBy: [{ classLevel: "asc" }, { name: "asc" }],
    select: {
      id: true,
      slug: true,
      name: true,
      classLevel: true,
      department: true,
      _count: { select: { questions: { where: { status: "published" } } } },
    },
  });
  return NextResponse.json({
    subjects: subjects.map((s) => ({
      id: s.id,
      slug: s.slug,
      name: s.name,
      classLevel: s.classLevel,
      department: s.department,
      questionCount: s._count.questions,
    })),
  });
}
