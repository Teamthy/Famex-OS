import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { gradeAttempt, type CbtAnswer } from "@/lib/cbt";
import { getClientIp, jsonNoStore } from "@/lib/requests";
import { enforceRateLimit } from "@/lib/rate-limit";

/**
 * Public: submit a finished attempt.
 *
 * Grading happens SERVER-SIDE against the stored questions — the client only
 * sends its answers, so scores cannot be forged from a tampered payload of
 * answers alone (the key never left the server).
 */
export async function POST(req: NextRequest) {
  const limit = await enforceRateLimit("cbt", getClientIp(req));
  if (!limit.success) {
    return jsonNoStore(
      { error: "Too many practice requests. Please slow down and try again." },
      {
        status: limit.configurationError ? 503 : 429,
        headers: { "Retry-After": String(limit.retryAfterSeconds) },
      },
    );
  }
  const body = (await req.json()) as {
    subjectSlug?: string;
    mode?: "practice" | "exam";
    durationSeconds?: number;
    studentName?: string;
    studentEmail?: string;
    answers?: CbtAnswer[];
  };

  const { subjectSlug, mode = "practice", answers = [] } = body;
  if (!subjectSlug || !Array.isArray(answers)) {
    return NextResponse.json({ error: "subjectSlug and answers required" }, { status: 400 });
  }

  const subject = await prisma.cbtSubject.findUnique({ where: { slug: subjectSlug } });
  if (!subject) return NextResponse.json({ error: "Subject not found" }, { status: 404 });

  const answeredIds = new Set(answers.map((a) => a.questionId));
  const questions = await prisma.cbtQuestion.findMany({
    where: { subjectId: subject.id, status: "published", id: { in: [...answeredIds] } },
    select: {
      id: true,
      topic: true,
      correctIndex: true,
      stem: true,
      options: true,
      explanation: true,
    },
  });

  const graded = gradeAttempt(
    questions.map((q) => ({ id: q.id, topic: q.topic, correctIndex: q.correctIndex })),
    answers,
  );

  const attempt = await prisma.cbtAttempt.create({
    data: {
      subjectId: subject.id,
      mode,
      total: graded.total,
      correct: graded.correct,
      skipped: graded.skipped,
      scorePct: graded.scorePct,
      durationSeconds: Math.max(0, Math.round(body.durationSeconds ?? 0)),
      studentName: body.studentName?.slice(0, 80) ?? null,
      studentEmail: body.studentEmail?.slice(0, 120) ?? null,
      answers,
    },
  });

  const byId = new Map(answers.map((a) => [a.questionId, a.selectedIndex]));
  return NextResponse.json({
    attemptId: attempt.id,
    result: graded,
    review: questions.map((q) => ({
      questionId: q.id,
      topic: q.topic,
      stem: q.stem,
      options: q.options as string[],
      correctIndex: q.correctIndex,
      selectedIndex: byId.get(q.id) ?? null,
      explanation: q.explanation,
    })),
  });
}
