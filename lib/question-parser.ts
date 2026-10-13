/**
 * Multi-format question parser for bulk exam question uploads.
 *
 * Supported formats:
 * - CSV (via PapaParse)
 * - JSON (structured array)
 * - XLSX/Excel (via SheetJS)
 * - Plain text (Q/A-D/Correct blocks — existing parser)
 *
 * Each question must have:
 * - type: MCQ | TRUE_FALSE | FILL_BLANK | ESSAY
 * - questionText: the question prompt
 * - options: A-D for MCQ, auto-generated for TRUE_FALSE
 * - correctAnswer: letter key for MCQ, TRUE/FALSE, fill text, or null for essay
 * - marks: integer 1-20 (default 1)
 * - explanation: optional
 */

import Papa from "papaparse";

export type QuestionType = "MCQ" | "TRUE_FALSE" | "FILL_BLANK" | "ESSAY";

export interface ParsedQuestion {
  type: QuestionType;
  questionText: string;
  options: { key: string; text: string }[] | null;
  correctKey: string | null;
  correctText: string | null;
  marks: number;
  explanation?: string;
  topic?: string;
  difficulty?: string;
}

export interface ParseResult {
  questions: ParsedQuestion[];
  errors: { row: number; message: string }[];
  warnings: { row: number; message: string }[];
  stats: {
    total: number;
    valid: number;
    mcq: number;
    trueFalse: number;
    fillBlank: number;
    essay: number;
  };
}

// ── CSV Parser ─────────────────────────────────────────────────────
export function parseCSV(content: string): ParseResult {
  const parsed = Papa.parse<Record<string, string>>(content, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h: string) =>
      h
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]/g, "_"),
  });

  return validateRows(
    parsed.data,
    parsed.errors.map((e) => ({
      row: e.row ?? 0,
      message: e.message ?? "CSV parse error",
    })),
  );
}

// ── JSON Parser ────────────────────────────────────────────────────
export function parseJSON(content: string): ParseResult {
  let data: Record<string, unknown>[];
  try {
    const parsed = JSON.parse(content);
    data = Array.isArray(parsed) ? parsed : (parsed.questions ?? []);
  } catch {
    return {
      questions: [],
      errors: [{ row: 0, message: "Invalid JSON — expected an array of question objects." }],
      warnings: [],
      stats: { total: 0, valid: 0, mcq: 0, trueFalse: 0, fillBlank: 0, essay: 0 },
    };
  }

  return validateRows(
    data.map((row) => {
      const r: Record<string, string> = {};
      for (const [k, v] of Object.entries(row)) {
        r[
          k
            .trim()
            .toLowerCase()
            .replace(/[^a-z0-9]/g, "_")
        ] = String(v ?? "");
      }
      return r;
    }),
    [],
  );
}

// ── Template generators ────────────────────────────────────────────
export const CSV_TEMPLATE = `type,question,option_a,option_b,option_c,option_d,correct,marks,topic,difficulty,explanation
MCQ,What is the capital of Nigeria?,Lagos,Abuja,Kano,Port Harcourt,B,2,Geography,Easy,Abuja became the capital in 1991
MCQ,Which planet is closest to the Sun?,Venus,Mars,Mercury,Jupiter,C,1,Science,Medium,
TRUE_FALSE,Water boils at 100 degrees Celsius at sea level,,,,, TRUE,1,Science,Easy,
FILL_BLANK,The process by which plants make food is called ______,,,,, photosynthesis,2,Science,Medium,Plants use sunlight and CO2
ESSAY,Explain the causes and effects of deforestation in Nigeria,,,,, ,10,Environmental Science,Hard,`;

export const JSON_TEMPLATE = JSON.stringify(
  [
    {
      type: "MCQ",
      question: "What is the capital of Nigeria?",
      option_a: "Lagos",
      option_b: "Abuja",
      option_c: "Kano",
      option_d: "Port Harcourt",
      correct: "B",
      marks: 2,
      topic: "Geography",
      difficulty: "Easy",
      explanation: "Abuja became the capital in 1991",
    },
    {
      type: "TRUE_FALSE",
      question: "Water boils at 100°C at sea level.",
      correct: "TRUE",
      marks: 1,
    },
    {
      type: "FILL_BLANK",
      question: "The process by which plants make food is called ______.",
      correct: "photosynthesis",
      marks: 2,
    },
    {
      type: "ESSAY",
      question: "Explain the causes and effects of deforestation in Nigeria.",
      marks: 10,
    },
  ],
  null,
  2,
);

// ── Shared validation ──────────────────────────────────────────────
function validateRows(
  rows: Record<string, string>[],
  csvErrors: { row: number; message: string }[],
): ParseResult {
  const questions: ParsedQuestion[] = [];
  const errors: { row: number; message: string }[] = [...csvErrors];
  const warnings: { row: number; message: string }[] = [];

  rows.forEach((row, idx) => {
    const rowNum = idx + 2; // +2 for 1-indexed + header row
    const type = (row.type || "").trim().toUpperCase().replace(/[\s-]/g, "_");
    const questionText = (row.question || row.question_text || row.questiontext || "").trim();
    const optionA = (row.option_a || row.optiona || row.a || "").trim();
    const optionB = (row.option_b || row.optionb || row.b || "").trim();
    const optionC = (row.option_c || row.optionc || row.c || "").trim();
    const optionD = (row.option_d || row.optiond || row.d || "").trim();
    const correct = (
      row.correct ||
      row.correct_answer ||
      row.answer ||
      row.correctanswer ||
      ""
    ).trim();
    const marksRaw = parseInt(row.marks || "1", 10);
    const marks = isNaN(marksRaw) ? 1 : Math.max(1, Math.min(20, marksRaw));
    const topic = (row.topic || "").trim();
    const difficulty = (row.difficulty || "").trim();
    const explanation = (row.explanation || "").trim();

    // Skip completely empty rows
    if (!type && !questionText) return;

    // Validate type
    if (!["MCQ", "TRUE_FALSE", "FILL_BLANK", "ESSAY"].includes(type)) {
      errors.push({
        row: rowNum,
        message: `Invalid type "${type}". Must be MCQ, TRUE_FALSE, FILL_BLANK, or ESSAY.`,
      });
      return;
    }

    // Validate question text
    if (!questionText) {
      errors.push({ row: rowNum, message: "Question text is required." });
      return;
    }

    // Parse by type
    switch (type as QuestionType) {
      case "MCQ": {
        const options: { key: string; text: string }[] = [];
        if (optionA) options.push({ key: "A", text: optionA });
        if (optionB) options.push({ key: "B", text: optionB });
        if (optionC) options.push({ key: "C", text: optionC });
        if (optionD) options.push({ key: "D", text: optionD });

        if (options.length < 2) {
          errors.push({ row: rowNum, message: "MCQ needs at least 2 options (A and B)." });
          return;
        }

        const correctKey = correct.toUpperCase();
        if (!["A", "B", "C", "D"].includes(correctKey)) {
          errors.push({
            row: rowNum,
            message: `MCQ correct answer must be A, B, C, or D. Got "${correct}".`,
          });
          return;
        }
        if (!options.some((o) => o.key === correctKey)) {
          errors.push({
            row: rowNum,
            message: `Correct answer "${correctKey}" doesn't match any provided option.`,
          });
          return;
        }

        if (options.length < 4) {
          warnings.push({
            row: rowNum,
            message: `MCQ has only ${options.length} options (recommended: 4).`,
          });
        }

        questions.push({
          type: "MCQ",
          questionText,
          options,
          correctKey,
          correctText: null,
          marks,
          explanation: explanation || undefined,
          topic: topic || undefined,
          difficulty: difficulty || undefined,
        });
        break;
      }

      case "TRUE_FALSE": {
        const correctKey = correct.toUpperCase();
        if (correctKey !== "TRUE" && correctKey !== "FALSE") {
          errors.push({
            row: rowNum,
            message: `TRUE_FALSE correct answer must be TRUE or FALSE. Got "${correct}".`,
          });
          return;
        }

        questions.push({
          type: "TRUE_FALSE",
          questionText,
          options: [
            { key: "TRUE", text: "True" },
            { key: "FALSE", text: "False" },
          ],
          correctKey,
          correctText: null,
          marks,
          explanation: explanation || undefined,
          topic: topic || undefined,
          difficulty: difficulty || undefined,
        });
        break;
      }

      case "FILL_BLANK": {
        if (!correct) {
          errors.push({ row: rowNum, message: "FILL_BLANK requires a correct answer." });
          return;
        }
        if (!questionText.includes("______") && !questionText.includes("___")) {
          warnings.push({
            row: rowNum,
            message: 'FILL_BLANK question should contain "______" as placeholder.',
          });
        }

        questions.push({
          type: "FILL_BLANK",
          questionText,
          options: null,
          correctKey: null,
          correctText: correct,
          marks,
          explanation: explanation || undefined,
          topic: topic || undefined,
          difficulty: difficulty || undefined,
        });
        break;
      }

      case "ESSAY": {
        questions.push({
          type: "ESSAY",
          questionText,
          options: null,
          correctKey: null,
          correctText: null,
          marks: Math.max(marks, 5),
          explanation: explanation || undefined,
          topic: topic || undefined,
          difficulty: difficulty || undefined,
        });
        break;
      }
    }
  });

  const stats = {
    total: rows.filter((r) => r.type || r.question).length,
    valid: questions.length,
    mcq: questions.filter((q) => q.type === "MCQ").length,
    trueFalse: questions.filter((q) => q.type === "TRUE_FALSE").length,
    fillBlank: questions.filter((q) => q.type === "FILL_BLANK").length,
    essay: questions.filter((q) => q.type === "ESSAY").length,
  };

  return { questions, errors, warnings, stats };
}
