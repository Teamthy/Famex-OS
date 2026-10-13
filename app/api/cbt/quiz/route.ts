import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { shuffled, type PublicQuestion } from "@/lib/cbt";
import { getClientIp, jsonNoStore } from "@/lib/requests";
import { enforceRateLimit } from "@/lib/rate-limit";

/**
 * Public: fetch a randomized set of published questions for a subject.
 *
 * Query: subject (slug), limit (1-100), difficulty (0 mixed / 1-3), topic.
 *
 * SECURITY: the response NEVER contains correctIndex or explanation —
 * practice answers are checked one at a time via /api/cbt/check, and exam
 * papers are graded server-side at submit. The client cannot read the key.
 */
export async function GET(req: NextRequest) {
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
  const slug = req.nextUrl.searchParams.get("subject") ?? "";
  // Page size (questions to return). Named questionCount, not limit — the
  // rate-limit result above already owns that name in this scope.
  const questionCount = Math.min(
    Math.max(Number(req.nextUrl.searchParams.get("limit") ?? 30) || 30, 1),
    100,
  );
  const difficulty = Number(req.nextUrl.searchParams.get("difficulty") ?? 0) || 0;
  const topic = (req.nextUrl.searchParams.get("topic") ?? "").trim();

  const subject = await prisma.cbtSubject.findUnique({ where: { slug } });
  if (!subject) return NextResponse.json({ error: "Subject not found" }, { status: 404 });

  const rows = await prisma.cbtQuestion.findMany({
    where: {
      subjectId: subject.id,
      status: "published",
      ...(difficulty >= 1 && difficulty <= 3 ? { difficulty } : {}),
      ...(topic ? { topic } : {}),
    },
    select: { id: true, topic: true, difficulty: true, stem: true, options: true },
  });

  const questions: PublicQuestion[] = shuffled(rows)
    .slice(0, questionCount)
    .map((q) => ({
      id: q.id,
      topic: q.topic,
      difficulty: q.difficulty,
      stem: q.stem,
      options: (q.options as string[]).map((o, i) => `${"ABCD"[i]}. ${o}`),
    }));

  return NextResponse.json({
    subject: { slug: subject.slug, name: subject.name },
    questions,
  });
}
