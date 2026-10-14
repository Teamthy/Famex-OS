import { NextRequest, NextResponse } from "next/server";
import { ExamQuestionType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { PEOPLE_ADMIN_ROLES } from "@/lib/people";
import { requireModule } from "@/lib/module-guard";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/questions — browse every exam question across the school
 * (joined to its exam for subject / class / title). Supports ?subject=&type=&q=.
 */
export async function GET(request: NextRequest) {
  const guard = await requireModule("exams", PEOPLE_ADMIN_ROLES);
  if (!guard.ok) return guard.response;
  // Rule 13: auth → role → module. A module this school switched off is a 403.
  const user = guard.user;

  const sp = request.nextUrl.searchParams;
  const subject = sp.get("subject")?.trim() || null;
  const type = sp.get("type")?.trim().toUpperCase() || null;
  const q = sp.get("q")?.trim() || null;

  const questions = await prisma.examQuestion.findMany({
    where: {
      exam: { schoolId: user.schoolId, ...(subject ? { subjectName: subject } : {}) },
      ...(type && ["MCQ", "TRUE_FALSE", "FILL_BLANK", "ESSAY"].includes(type)
        ? { type: type as ExamQuestionType }
        : {}),
      ...(q ? { questionText: { contains: q, mode: "insensitive" } } : {}),
    },
    select: {
      id: true,
      questionText: true,
      type: true,
      correctKey: true,
      sortOrder: true,
      exam: {
        select: {
          title: true,
          subjectName: true,
          classroom: { select: { displayName: true } },
        },
      },
    },
    orderBy: { sortOrder: "asc" },
    take: 500,
  });

  const subjects = [
    ...new Set(questions.map((qu) => qu.exam.subjectName).filter(Boolean) as string[]),
  ].sort();

  return NextResponse.json({
    subjects,
    questions: questions.map((qu) => ({
      id: qu.id,
      questionText: qu.questionText,
      type: qu.type,
      correctKey: qu.correctKey,
      subject: qu.exam.subjectName,
      className: qu.exam.classroom?.displayName ?? null,
      examTitle: qu.exam.title,
    })),
  });
}
