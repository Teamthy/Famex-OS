import { unzipSync, strFromU8 } from "fflate";
// Must be @/lib/exam-questions, NOT @/lib/exams: this module is imported by a
// client component, and lib/exams pulls in lib/session -> next/headers, which
// fails the production build.
import { parseBulkQuestions, type ParsedQuestion } from "@/lib/exam-questions";

/**
 * Importing questions from Word (.docx) and plain text.
 *
 * Teachers do not author exams in a CSV. They have a past paper in Word, or a
 * .txt someone typed out. The previous importer accepted .docx but only as a
 * table with exact header columns — a spreadsheet wearing a Word costume, and
 * nothing like the documents that actually exist in a school.
 *
 * This reads both shapes and decides which one it is looking at:
 *   - a table that looks like a question bank  -> read the table
 *   - anything else                            -> read the prose, through the
 *     same permissive parser the paste box uses
 *
 * Deliberately dependency-free beyond `fflate` (already a dependency) and
 * regex, with no `DOMParser`: this has to run in the browser for instant
 * preview AND under Node for tests. Word's XML is machine-generated and
 * regular, so regex extraction is safe here in a way it would not be for
 * arbitrary HTML.
 */

export type ImportSource = "PROSE" | "TABLE";

export type ImportResult = {
  source: ImportSource;
  questions: ParsedQuestion[];
  errors: string[];
  warnings: string[];
};

export type DocxContent = {
  paragraphs: string[];
  tables: string[][][];
  /** Word auto-numbering: the visible "1." is not in the file's text. */
  usesAutoNumbering: boolean;
};

/* ------------------------------------------------------------------
   XML helpers
   ------------------------------------------------------------------ */

function decodeEntities(value: string): string {
  return (
    value
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&apos;/g, "'")
      .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
      // Ampersand last, or "&amp;lt;" would double-decode.
      .replace(/&amp;/g, "&")
  );
}

/**
 * The text of one `<w:p>`.
 *
 * Word splits a single sentence across many `<w:r><w:t>` runs — a spellcheck
 * mark or a bold word is enough. Concatenating only `<w:t>` contents without
 * handling `<w:br/>` and `<w:tab/>` yields "AbujaB) Kano" style joins, so both
 * are turned into real breaks first.
 */
function paragraphText(xml: string): string[] {
  const withBreaks = xml
    .replace(/<w:br\s*\/?>/g, "\n")
    .replace(/<w:cr\s*\/?>/g, "\n")
    .replace(/<w:tab\s*\/?>/g, "\t");

  // Walk text runs and hard breaks together, in document order, so a break
  // between two runs survives into the output. Collecting <w:t> contents
  // first and splitting afterwards loses the break position entirely.
  let out = "";
  const tokenRegex = /<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>|\n/g;
  let match: RegExpExecArray | null;
  while ((match = tokenRegex.exec(withBreaks)) !== null) {
    out += match[1] === undefined ? "\n" : decodeEntities(match[1]);
  }
  return out
    .split("\n")
    .map((piece) => piece.replace(/[^\S\n]+/g, " ").trim())
    .filter(Boolean);
}

/** Every `<w:p>` inside a fragment, in document order. */
function paragraphsIn(xml: string): string[] {
  const result: string[] = [];
  const regex = /<w:p(?:\s[^>]*)?>([\s\S]*?)<\/w:p>/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(xml)) !== null) {
    result.push(...paragraphText(match[0]));
  }
  return result;
}

/* ------------------------------------------------------------------
   .docx -> content
   ------------------------------------------------------------------ */

export function extractDocxContent(data: Uint8Array): DocxContent {
  let documentXml: string;
  try {
    const files = unzipSync(data);
    const entry = files["word/document.xml"];
    if (!entry) throw new Error("missing document.xml");
    documentXml = strFromU8(entry);
  } catch {
    throw new Error(
      "That is not a valid .docx file. If it is an older .doc, open it in Word and use File → Save As → Word Document (.docx).",
    );
  }

  const body = documentXml.match(/<w:body>([\s\S]*)<\/w:body>/)?.[1] ?? documentXml;

  // Tables first, so their text can be removed before reading prose —
  // table cells contain <w:p> too, and would otherwise be counted twice.
  const tables: string[][][] = [];
  const tableRegex = /<w:tbl>([\s\S]*?)<\/w:tbl>/g;
  let tableMatch: RegExpExecArray | null;
  while ((tableMatch = tableRegex.exec(body)) !== null) {
    const rows: string[][] = [];
    const rowRegex = /<w:tr(?:\s[^>]*)?>([\s\S]*?)<\/w:tr>/g;
    let rowMatch: RegExpExecArray | null;
    while ((rowMatch = rowRegex.exec(tableMatch[1])) !== null) {
      const cells: string[] = [];
      const cellRegex = /<w:tc(?:\s[^>]*)?>([\s\S]*?)<\/w:tc>/g;
      let cellMatch: RegExpExecArray | null;
      while ((cellMatch = cellRegex.exec(rowMatch[1])) !== null) {
        cells.push(paragraphsIn(cellMatch[0]).join(" ").trim());
      }
      if (cells.length) rows.push(cells);
    }
    if (rows.length) tables.push(rows);
  }

  const withoutTables = body.replace(/<w:tbl>[\s\S]*?<\/w:tbl>/g, "");

  return {
    paragraphs: paragraphsIn(withoutTables),
    tables,
    usesAutoNumbering: /<w:numPr>/.test(withoutTables),
  };
}

/* ------------------------------------------------------------------
   Is this table a question bank?
   ------------------------------------------------------------------ */

const HEADER_ALIASES: Record<string, string> = {
  type: "type",
  questiontype: "type",
  question: "question",
  questiontext: "question",
  optiona: "option_a",
  a: "option_a",
  optionb: "option_b",
  b: "option_b",
  optionc: "option_c",
  c: "option_c",
  optiond: "option_d",
  d: "option_d",
  optione: "option_e",
  e: "option_e",
  correct: "correct",
  correctanswer: "correct",
  answer: "correct",
  marks: "marks",
  mark: "marks",
  score: "marks",
};

function normaliseHeader(value: string): string {
  const key = value.toLowerCase().replace(/[^a-z]/g, "");
  return HEADER_ALIASES[key] ?? key;
}

/**
 * A document may contain tables that are not question banks — a cover sheet,
 * a rubric, a mark scheme. Importing one of those would produce nonsense AND
 * skip the real questions, so a table has to earn the right to be the source.
 */
export function looksLikeQuestionTable(headerRow: string[]): boolean {
  if (!headerRow || headerRow.length < 2) return false;
  const headers = headerRow.map(normaliseHeader);
  const hasQuestion = headers.includes("question");
  const hasAnswer = headers.includes("correct");
  const hasOptionOrType =
    headers.includes("type") || headers.some((header) => header.startsWith("option_"));
  return hasQuestion && (hasAnswer || hasOptionOrType);
}

/* ------------------------------------------------------------------
   Table -> questions
   ------------------------------------------------------------------ */

function questionsFromTable(rows: string[][]): ImportResult {
  const headers = rows[0].map(normaliseHeader);
  const errors: string[] = [];
  const warnings: string[] = [];
  const questions: ParsedQuestion[] = [];

  for (let index = 1; index < rows.length; index += 1) {
    const cells = rows[index];
    if (!cells.some((cell) => cell.trim())) continue; // blank spacer row

    const get = (name: string) => {
      const at = headers.indexOf(name);
      return at === -1 ? "" : (cells[at] ?? "").trim();
    };

    // Word tables are 1-indexed for a human, and the header is row 1.
    const rowLabel = `row ${index + 1}`;
    const questionText = get("question");
    if (!questionText) {
      errors.push(`Table ${rowLabel}: no question text.`);
      continue;
    }

    const declaredType = get("type")
      .toLowerCase()
      .replace(/[^a-z]/g, "");
    const marksRaw = parseInt(get("marks"), 10);
    const marks = Number.isFinite(marksRaw) ? Math.max(1, Math.min(20, marksRaw)) : 1;
    const answer = get("correct").trim();

    if (declaredType === "essay") {
      questions.push({
        type: "ESSAY",
        questionText,
        options: null,
        correctKey: null,
        correctText: null,
        marks: Math.max(marks, 5),
      });
      continue;
    }

    if (
      declaredType === "fill" ||
      declaredType === "fillblank" ||
      declaredType === "fillintheblank"
    ) {
      if (!answer) {
        errors.push(`Table ${rowLabel}: a fill-in-the-blank needs an answer.`);
        continue;
      }
      questions.push({
        type: "FILL_BLANK",
        questionText,
        options: null,
        correctKey: null,
        correctText: answer,
        marks,
      });
      continue;
    }

    const upperAnswer = answer.toUpperCase();
    if (declaredType === "truefalse" || upperAnswer === "TRUE" || upperAnswer === "FALSE") {
      if (upperAnswer !== "TRUE" && upperAnswer !== "FALSE") {
        errors.push(`Table ${rowLabel}: a true/false answer must be TRUE or FALSE.`);
        continue;
      }
      questions.push({
        type: "TRUE_FALSE",
        questionText,
        options: [
          { key: "TRUE", text: "True" },
          { key: "FALSE", text: "False" },
        ],
        correctKey: upperAnswer,
        correctText: null,
        marks,
      });
      continue;
    }

    const options: Array<{ key: string; text: string }> = [];
    for (const letter of ["A", "B", "C", "D", "E"]) {
      const text = get(`option_${letter.toLowerCase()}`);
      if (text) options.push({ key: letter, text });
    }
    if (options.length < 2) {
      errors.push(`Table ${rowLabel}: needs at least options A and B.`);
      continue;
    }

    let correctKey: string | null = null;
    if (/^[A-E]$/.test(upperAnswer) && options.some((option) => option.key === upperAnswer)) {
      correctKey = upperAnswer;
    } else {
      const byText = options.find(
        (option) => option.text.trim().toLowerCase() === answer.toLowerCase(),
      );
      if (byText) correctKey = byText.key;
    }
    if (!correctKey) {
      errors.push(`Table ${rowLabel}: answer "${answer}" does not match any option.`);
      continue;
    }

    questions.push({ type: "MCQ", questionText, options, correctKey, correctText: null, marks });
  }

  if (!questions.length && !errors.length) {
    errors.push("That table has no question rows.");
  }

  return { source: "TABLE", questions, errors, warnings };
}

/* ------------------------------------------------------------------
   Prose -> questions
   ------------------------------------------------------------------ */

/** `1.` `1)` `Q:` `Q1.` — the start of a new question. */
const NEW_QUESTION = /^(?:Q\s*\d*\s*[:.)\-–]|\d{1,3}\s*[.)])\s*\S/i;

/**
 * Group loose lines into question blocks.
 *
 * `parseBulkQuestions` separates questions on blank lines, which is right for
 * the paste box. In Word, teachers very often just start the next number with
 * no blank line at all — so blocks are also broken whenever a line looks like
 * the start of a new question.
 */
function blocksFromLines(lines: string[]): string {
  const blocks: string[][] = [];
  let current: string[] = [];

  /**
   * Drop the paper's header.
   *
   * Every real paper opens with a school name, a subject, "Answer all
   * questions.", a time allowance. None of that is a question — and
   * "Answer all questions." parses as an answer marker, so the preamble was
   * reported as a malformed block and every teacher would have seen an error
   * on a perfectly good document.
   *
   * Only content before the FIRST question marker is discarded. Anything
   * after it is real content and its errors must still be reported.
   */
  const firstQuestion = lines.findIndex((line) => NEW_QUESTION.test(line.trim()));
  const relevant = firstQuestion > 0 ? lines.slice(firstQuestion) : lines;

  for (const line of relevant) {
    if (!line.trim()) {
      if (current.length) {
        blocks.push(current);
        current = [];
      }
      continue;
    }
    if (NEW_QUESTION.test(line) && current.length) {
      blocks.push(current);
      current = [];
    }
    current.push(line.trim());
  }
  if (current.length) blocks.push(current);

  return blocks.map((block) => block.join("\n")).join("\n\n");
}

function questionsFromProse(lines: string[], warnings: string[]): ImportResult {
  const grouped = blocksFromLines(lines);
  const parsed = parseBulkQuestions(grouped);

  // A document with no question marker anywhere is a cover sheet, a syllabus,
  // or the wrong file. Saying "no questions found" is honest; passing along
  // "needs at least options A and B" would send the teacher hunting for an
  // options problem in a file that has no questions in it at all.
  if (!parsed.questions.length && !lines.some((line) => NEW_QUESTION.test(line.trim()))) {
    return {
      source: "PROSE",
      questions: [],
      errors: ["No questions were found in that file."],
      warnings,
    };
  }

  return {
    source: "PROSE",
    questions: parsed.questions,
    errors: parsed.errors,
    warnings,
  };
}

/* ------------------------------------------------------------------
   Public entry points
   ------------------------------------------------------------------ */

export function importQuestionsFromDocx(data: Uint8Array): ImportResult {
  const content = extractDocxContent(data);

  const questionTable = content.tables.find((rows) => looksLikeQuestionTable(rows[0] ?? []));
  if (questionTable) return questionsFromTable(questionTable);

  const warnings: string[] = [];
  if (content.usesAutoNumbering) {
    warnings.push(
      "This document uses Word's automatic numbering, so the numbers and letters you see are not stored in the file itself. If options came through wrong, select the list in Word and use Home → Numbering to turn it off, then re-save.",
    );
  }
  if (content.tables.length) {
    warnings.push(
      `Ignored ${content.tables.length} table${content.tables.length === 1 ? "" : "s"} that did not look like a question bank.`,
    );
  }

  const result = questionsFromProse(content.paragraphs, warnings);
  if (!result.questions.length && !result.errors.length) {
    result.errors.push("No questions were found in that document.");
  }
  return result;
}

export function importQuestionsFromText(text: string): ImportResult {
  // Strip a UTF-8 BOM (Notepad adds one). Belt-and-braces rather than
  // load-bearing: JS treats \uFEFF as whitespace, so `trim()` in the parser
  // already absorbs it. Verified by mutation — removing this changes no test.
  // Kept because it makes the intent explicit and survives a future parser
  // that trims less eagerly.
  const cleaned = text.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n");
  const result = questionsFromProse(cleaned.split("\n"), []);
  if (!result.questions.length && !result.errors.length) {
    result.errors.push("No questions were found in that file.");
  }
  return result;
}
