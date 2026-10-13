import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRoleOr503 } from "@/lib/session";

/**
 * Teacher/admin CSV import for the CBT bank.
 *
 * CSV columns (header row required):
 *   subjectSlug,subjectName,classLevel,topic,difficulty,stem,optionA,optionB,optionC,optionD,correctIndex,explanation
 *
 * correctIndex is 0-3. Questions whose stem already exists in the subject are
 * skipped, so re-uploading a file is safe.
 */
export async function POST(req: NextRequest) {
  const denied = await requireRoleOr503(["ADMIN", "SUPER_ADMIN"]);
  if (denied) return denied;

  const { csv } = (await req.json()) as { csv?: string };
  if (!csv || typeof csv !== "string") {
    return NextResponse.json({ error: "csv (string) required" }, { status: 400 });
  }

  const lines = csv.trim().split(/\r?\n/);
  if (lines.length < 2)
    return NextResponse.json({ error: "CSV needs a header and at least one row" }, { status: 400 });

  const header = lines[0].split(",").map((h) => h.trim());
  const required = [
    "subjectSlug",
    "subjectName",
    "classLevel",
    "topic",
    "stem",
    "optionA",
    "optionB",
    "optionC",
    "optionD",
    "correctIndex",
    "explanation",
  ];
  const missing = required.filter((r) => !header.includes(r));
  if (missing.length)
    return NextResponse.json({ error: `Missing columns: ${missing.join(", ")}` }, { status: 400 });

  // Minimal CSV parsing (quoted fields with commas supported via a small state machine).
  const parseLine = (line: string): string[] => {
    const out: string[] = [];
    let cur = "";
    let inQuotes = false;
    for (const ch of line) {
      if (ch === '"') inQuotes = !inQuotes;
      else if (ch === "," && !inQuotes) {
        out.push(cur.trim());
        cur = "";
      } else cur += ch;
    }
    out.push(cur.trim());
    return out;
  };

  let imported = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (let i = 1; i < lines.length; i++) {
    const cells = parseLine(lines[i]);
    const row = Object.fromEntries(header.map((h, c) => [h, cells[c] ?? ""]));
    const correctIndex = Number(row.correctIndex);
    if (
      !row.subjectSlug ||
      !row.stem ||
      Number.isNaN(correctIndex) ||
      correctIndex < 0 ||
      correctIndex > 3
    ) {
      errors.push(`Row ${i + 1}: invalid (needs subjectSlug, stem, correctIndex 0-3)`);
      continue;
    }
    const subject = await prisma.cbtSubject.upsert({
      where: { slug: row.subjectSlug },
      update: {},
      create: {
        slug: row.subjectSlug,
        name: row.subjectName || row.subjectSlug,
        classLevel: (row.classLevel || "jss3").toLowerCase(),
      },
    });
    const exists = await prisma.cbtQuestion.findFirst({
      where: { subjectId: subject.id, stem: row.stem },
      select: { id: true },
    });
    if (exists) {
      skipped += 1;
      continue;
    }
    await prisma.cbtQuestion.create({
      data: {
        subjectId: subject.id,
        topic: row.topic || "General",
        difficulty: Math.min(3, Math.max(1, Number(row.difficulty) || 2)),
        stem: row.stem,
        options: [row.optionA, row.optionB, row.optionC, row.optionD],
        correctIndex,
        explanation: row.explanation,
        status: "published",
        source: "curriculum",
      },
    });
    imported += 1;
  }

  return NextResponse.json({ imported, skipped, errors });
}
