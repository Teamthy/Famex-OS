import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getClientIp, jsonNoStore } from "@/lib/requests";
import { enforceRateLimit } from "@/lib/rate-limit";

/**
 * Public: practice-mode answer check for ONE question. Reveals the correct
 * option and explanation only after an answer is committed — the key for the
 * whole paper is never exposed.
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
  const { questionId, selectedIndex } = (await req.json()) as {
    questionId?: string;
    selectedIndex?: number;
  };
  if (!questionId || typeof selectedIndex !== "number" || selectedIndex < 0 || selectedIndex > 3) {
    return NextResponse.json(
      { error: "questionId and selectedIndex (0-3) required" },
      { status: 400 },
    );
  }

  const q = await prisma.cbtQuestion.findUnique({
    where: { id: questionId },
    select: { correctIndex: true, explanation: true },
  });
  if (!q) return NextResponse.json({ error: "Question not found" }, { status: 404 });

  return NextResponse.json({
    correct: selectedIndex === q.correctIndex,
    correctIndex: q.correctIndex,
    explanation: q.explanation,
  });
}
