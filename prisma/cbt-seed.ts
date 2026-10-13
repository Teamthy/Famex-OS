/**
 * CBT seed — the shared question bank (cbt-bank.csv).
 *
 * 5,000+ NERDC-aligned questions (JSS1–SS3 + BECE/WAEC/NECO/JAMB),
 * single source of truth for BOTH sites: this file and the Go seed in the
 * YK-Virtual repo read the same CSV layout, so both banks stay in sync.
 *
 * Run: npm run cbt:seed
 * Safe to re-run: upserts subjects by slug, skips questions whose stem
 * already exists in the subject.
 */
import { PrismaClient } from "@prisma/client";
import { readFile } from "fs/promises";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

const prisma = new PrismaClient();

type Row = {
  subjectSlug: string;
  subjectName: string;
  classLevel: string;
  department?: string;
  topic: string;
  difficulty: string;
  stem: string;
  optionA: string;
  optionB: string;
  optionC: string;
  optionD: string;
  correctIndex: string;
  explanation: string;
  source?: string;
};

function parseCsv(text: string): Row[] {
  const rows: string[][] = [];
  let field = "";
  let record: string[] = [];
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else inQuotes = false;
      } else field += ch;
    } else if (ch === '"') inQuotes = true;
    else if (ch === ",") {
      record.push(field);
      field = "";
    } else if (ch === "\n") {
      record.push(field);
      rows.push(record);
      record = [];
      field = "";
    } else if (ch !== "\r") field += ch;
  }
  if (field || record.length) {
    record.push(field);
    rows.push(record);
  }
  const header = rows.shift() ?? [];
  return rows
    .filter((r) => r.length > 1 && r.some((c) => c.trim()))
    .map((r) => Object.fromEntries(header.map((h, i) => [h, r[i] ?? ""])) as Row);
}

async function main() {
  const csv = await readFile(join(__dirname, "cbt-bank.csv"), "utf8");
  const rows = parseCsv(csv);
  console.log(`cbt:seed — ${rows.length} rows in the shared bank`);

  if (process.env.CBT_RESET === "1") {
    console.log("CBT_RESET=1 — wiping existing CBT questions/subjects/attempts");
    await prisma.cbtAttempt.deleteMany();
    await prisma.cbtQuestion.deleteMany();
    await prisma.cbtSubject.deleteMany();
  }

  const subjects = new Map<string, Row[]>();
  for (const r of rows) {
    const list = subjects.get(r.subjectSlug) ?? [];
    list.push(r);
    subjects.set(r.subjectSlug, list);
  }

  let created = 0;
  for (const [slug, list] of subjects) {
    const first = list[0];
    await prisma.cbtSubject.upsert({
      where: { slug },
      create: {
        slug,
        name: first.subjectName,
        classLevel: first.classLevel,
        department: first.department || "general",
      },
      update: { name: first.subjectName, department: first.department || "general" },
    });
    const subject = await prisma.cbtSubject.findUniqueOrThrow({ where: { slug } });
    let updated = 0;
    for (const r of list) {
      const exists = await prisma.cbtQuestion.findFirst({
        where: { subjectId: subject.id, stem: r.stem },
        select: { id: true },
      });
      if (exists) {
        // sync in place: the CSV is the single source of truth for bank
        // questions, so a rebuild can re-shuffle option order / fix content
        await prisma.cbtQuestion.update({
          where: { id: exists.id },
          data: {
            options: [r.optionA, r.optionB, r.optionC, r.optionD],
            correctIndex: Number(r.correctIndex),
            explanation: r.explanation,
            source: r.source || "curriculum",
          },
        });
        updated++;
        continue;
      }
      await prisma.cbtQuestion.create({
        data: {
          subjectId: subject.id,
          topic: r.topic,
          difficulty: Math.min(3, Math.max(1, Number(r.difficulty) || 2)),
          stem: r.stem,
          options: [r.optionA, r.optionB, r.optionC, r.optionD],
          correctIndex: Number(r.correctIndex),
          explanation: r.explanation,
          source: r.source || "curriculum",
          status: "published",
        },
      });
      created++;
    }
    const total = await prisma.cbtQuestion.count({ where: { subjectId: subject.id } });
    if (updated) console.log(`  ${slug}: synced ${updated} existing questions`);
    console.log(
      `  ${slug.padEnd(22)} ${String(list.length).padStart(4)} seeded (bank now ${total})`,
    );
  }
  console.log(`done — ${created} new questions inserted (existing stems skipped).`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
