import { describe, it, expect } from "vitest";
import { zipSync, strToU8 } from "fflate";
import {
  extractDocxContent,
  importQuestionsFromDocx,
  importQuestionsFromText,
  looksLikeQuestionTable,
} from "@/lib/question-import";

/**
 * Importing questions from Word and plain text.
 *
 * Teachers do not author questions in a CSV. They have a past paper in Word,
 * or a .txt someone typed. The existing importer accepted .docx but only as a
 * table with exact header columns — which is a spreadsheet wearing a Word
 * costume, and nothing like a real paper.
 *
 * These build genuine .docx files (a docx IS a zip of XML) and push them
 * through the importer, so the tests exercise real OOXML rather than a
 * hand-waved string. If Word's markup shape is misunderstood, these fail.
 */

/* ------------------------------------------------------------------
   Minimal but REAL .docx construction
   ------------------------------------------------------------------ */

function paragraph(text: string, opts: { numbered?: boolean } = {}) {
  const numPr = opts.numbered ? `<w:pPr><w:numPr><w:ilvl w:val="0"/></w:numPr></w:pPr>` : "";
  // Word splits a paragraph across several runs constantly (spellcheck,
  // formatting). Split on spaces to mimic that.
  const runs = text
    .split(" ")
    .map((word, index) =>
      index === 0
        ? `<w:r><w:t xml:space="preserve">${word}</w:t></w:r>`
        : `<w:r><w:t xml:space="preserve"> ${word}</w:t></w:r>`,
    )
    .join("");
  return `<w:p>${numPr}${runs}</w:p>`;
}

function tableXml(rows: string[][]) {
  const trs = rows
    .map((row) => `<w:tr>${row.map((cell) => `<w:tc>${paragraph(cell)}</w:tc>`).join("")}</w:tr>`)
    .join("");
  return `<w:tbl>${trs}</w:tbl>`;
}

function makeDocx(bodyXml: string): Uint8Array {
  const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
<w:body>${bodyXml}</w:body></w:document>`;
  return zipSync({
    "[Content_Types].xml": strToU8("<Types/>"),
    "word/document.xml": strToU8(documentXml),
  });
}

/* ------------------------------------------------------------------
   Text extraction
   ------------------------------------------------------------------ */

describe("extractDocxContent", () => {
  it("joins the runs Word splits a single sentence into", () => {
    const docx = makeDocx(paragraph("What is the capital of Nigeria?"));
    const content = extractDocxContent(docx);

    // Word emits one <w:t> per run; naive extraction yields "Whatisthecapital".
    expect(content.paragraphs).toEqual(["What is the capital of Nigeria?"]);
  });

  it("keeps paragraphs as separate lines", () => {
    const docx = makeDocx(paragraph("Q: Capital?") + paragraph("A) Lagos") + paragraph("B) Abuja"));
    const content = extractDocxContent(docx);

    expect(content.paragraphs).toEqual(["Q: Capital?", "A) Lagos", "B) Abuja"]);
  });

  it("reads tables as rows and cells", () => {
    const docx = makeDocx(
      tableXml([
        ["type", "question", "correct"],
        ["mcq", "2+2?", "B"],
      ]),
    );
    const content = extractDocxContent(docx);

    expect(content.tables).toHaveLength(1);
    expect(content.tables[0][0]).toEqual(["type", "question", "correct"]);
    expect(content.tables[0][1]).toEqual(["mcq", "2+2?", "B"]);
  });

  it("does not repeat table text in the prose paragraphs", () => {
    const docx = makeDocx(
      paragraph("Intro line") +
        tableXml([
          ["a", "b"],
          ["c", "d"],
        ]),
    );
    const content = extractDocxContent(docx);

    // Cell text lives inside <w:p> too, so a careless reader double-counts it.
    expect(content.paragraphs).toEqual(["Intro line"]);
  });

  it("treats a line break inside a paragraph as a new line", () => {
    const docx = makeDocx(`<w:p><w:r><w:t>A) Lagos</w:t><w:br/><w:t>B) Abuja</w:t></w:r></w:p>`);
    const content = extractDocxContent(docx);

    // A teacher pressing shift+enter between options is extremely common.
    expect(content.paragraphs).toEqual(["A) Lagos", "B) Abuja"]);
  });

  it("decodes XML entities", () => {
    const docx = makeDocx(
      `<w:p><w:r><w:t>Rock &amp; Roll &lt;b&gt; &quot;x&quot;</w:t></w:r></w:p>`,
    );
    const content = extractDocxContent(docx);

    expect(content.paragraphs).toEqual(['Rock & Roll <b> "x"']);
  });

  it("flags Word auto-numbering, whose numbers are not in the text", () => {
    const docx = makeDocx(paragraph("What is 2+2?", { numbered: true }));
    const content = extractDocxContent(docx);

    // Auto-numbered list markers live in numbering.xml, never in <w:t>. A
    // teacher's "1." or "a)" is simply absent from the extracted text, so the
    // importer has to warn rather than silently lose the option letters.
    expect(content.usesAutoNumbering).toBe(true);
  });

  it("rejects a file that is not a docx", () => {
    expect(() => extractDocxContent(zipSync({ "hello.txt": strToU8("hi") }))).toThrow(
      /not a valid \.docx/i,
    );
  });

  it("rejects a file that is not even a zip", () => {
    expect(() => extractDocxContent(strToU8("this is a plain text file"))).toThrow(
      /not a valid \.docx/i,
    );
  });
});

/* ------------------------------------------------------------------
   Prose import — the format teachers actually have
   ------------------------------------------------------------------ */

describe("importQuestionsFromDocx — prose", () => {
  it("imports a Word document written as a normal question paper", () => {
    const docx = makeDocx(
      paragraph("1. What is the capital of Nigeria?") +
        paragraph("A) Lagos") +
        paragraph("B) Abuja") +
        paragraph("C) Kano") +
        paragraph("ANSWER: B") +
        paragraph("") +
        paragraph("2. Water boils at ___ degrees Celsius.") +
        paragraph("FILL: 100"),
    );

    const result = importQuestionsFromDocx(docx);

    expect(result.source).toBe("PROSE");
    expect(result.errors).toEqual([]);
    expect(result.questions).toHaveLength(2);
    expect(result.questions[0].questionText).toBe("What is the capital of Nigeria?");
    expect(result.questions[0].correctKey).toBe("B");
    expect(result.questions[1].type).toBe("FILL_BLANK");
  });

  /**
   * The separator case that matters most. Teachers do not reliably leave a
   * blank line between questions in Word — they just start the next number.
   */
  it("splits consecutive questions with no blank line between them", () => {
    const docx = makeDocx(
      paragraph("1. First question?") +
        paragraph("A) yes") +
        paragraph("B) no") +
        paragraph("Answer: A") +
        paragraph("2. Second question?") +
        paragraph("A) yes") +
        paragraph("B) no") +
        paragraph("Answer: B"),
    );

    const result = importQuestionsFromDocx(docx);

    expect(result.errors).toEqual([]);
    expect(result.questions).toHaveLength(2);
    expect(result.questions[0].correctKey).toBe("A");
    expect(result.questions[1].correctKey).toBe("B");
  });

  /**
   * Every real paper has a header — school name, subject, "Answer all
   * questions." Those lines sit before the first numbered question and are
   * not a question. Worse, "Answer all questions." parses as an answer
   * marker, so the preamble was reported as a broken block and every teacher
   * would have seen an error on a perfectly good document.
   */
  it("ignores the paper's header instead of reporting it as broken", () => {
    const docx = makeDocx(
      paragraph("YKAY COLLEGE — SS 2 BIOLOGY — MIDTERM TEST") +
        paragraph("Answer all questions.") +
        paragraph("Time allowed: 45 minutes") +
        paragraph("1. What is 2+2?") +
        paragraph("A) 3") +
        paragraph("B) 4") +
        paragraph("Answer: B"),
    );

    const result = importQuestionsFromDocx(docx);

    expect(result.errors).toEqual([]);
    expect(result.questions).toHaveLength(1);
    expect(result.questions[0].questionText).toBe("What is 2+2?");
  });

  it("still reports a broken block that comes AFTER the first question", () => {
    const docx = makeDocx(
      paragraph("Cover page") +
        paragraph("1. Fine?") +
        paragraph("A) yes") +
        paragraph("B) no") +
        paragraph("Answer: A") +
        paragraph("2. Broken?") +
        paragraph("A) yes") +
        paragraph("B) no") +
        paragraph("Answer: Z"),
    );

    const result = importQuestionsFromDocx(docx);

    // Skipping the preamble must not become "swallow all errors".
    expect(result.questions).toHaveLength(1);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toMatch(/does not match any option/i);
  });

  it("reports an error when a document has a header and nothing else", () => {
    const docx = makeDocx(paragraph("YKAY COLLEGE") + paragraph("Answer all questions."));

    const result = importQuestionsFromDocx(docx);

    expect(result.questions).toHaveLength(0);
    expect(result.errors[0]).toMatch(/no questions/i);
  });

  it("warns when auto-numbering means the letters were never in the file", () => {
    const docx = makeDocx(
      paragraph("What is 2+2?", { numbered: true }) +
        paragraph("three", { numbered: true }) +
        paragraph("four", { numbered: true }) +
        paragraph("Answer: B"),
    );

    const result = importQuestionsFromDocx(docx);

    expect(result.warnings.join(" ")).toMatch(/automatic numbering/i);
  });
});

/* ------------------------------------------------------------------
   Table import — the existing format must keep working
   ------------------------------------------------------------------ */

describe("importQuestionsFromDocx — table", () => {
  it("still imports the documented table layout", () => {
    const docx = makeDocx(
      tableXml([
        ["type", "question", "option_a", "option_b", "correct", "marks"],
        ["mcq", "Capital of Nigeria?", "Lagos", "Abuja", "B", "2"],
        ["truefalse", "The sky is blue.", "", "", "TRUE", "1"],
      ]),
    );

    const result = importQuestionsFromDocx(docx);

    expect(result.source).toBe("TABLE");
    expect(result.errors).toEqual([]);
    expect(result.questions).toHaveLength(2);
    expect(result.questions[0].correctKey).toBe("B");
    expect(result.questions[0].marks).toBe(2);
    expect(result.questions[1].type).toBe("TRUE_FALSE");
  });

  it("tolerates header casing and spacing", () => {
    const docx = makeDocx(
      tableXml([
        ["Type", "Question", "Option A", "Option B", "Correct Answer", "Marks"],
        ["mcq", "2+2?", "3", "4", "B", "1"],
      ]),
    );

    const result = importQuestionsFromDocx(docx);

    expect(result.source).toBe("TABLE");
    expect(result.questions).toHaveLength(1);
    expect(result.questions[0].correctKey).toBe("B");
  });

  /**
   * A document can contain a table that is not a question bank — a cover sheet,
   * a mark scheme, a rubric. Treating any table as the question source would
   * import nonsense and ignore the real questions below it.
   */
  it("ignores a table that is not a question bank and reads the prose instead", () => {
    const docx = makeDocx(
      tableXml([
        ["School", "Ykay College"],
        ["Term", "First Term"],
      ]) +
        paragraph("1. What is 2+2?") +
        paragraph("A) 3") +
        paragraph("B) 4") +
        paragraph("Answer: B"),
    );

    const result = importQuestionsFromDocx(docx);

    expect(result.source).toBe("PROSE");
    expect(result.questions).toHaveLength(1);
    expect(result.questions[0].questionText).toBe("What is 2+2?");
  });

  it("reports the row number of a broken table row", () => {
    const docx = makeDocx(
      tableXml([
        ["type", "question", "option_a", "option_b", "correct"],
        ["mcq", "Fine?", "yes", "no", "A"],
        ["mcq", "Broken?", "yes", "no", "Z"],
      ]),
    );

    const result = importQuestionsFromDocx(docx);

    expect(result.questions).toHaveLength(1);
    expect(result.errors[0]).toMatch(/row 3/i);
  });
});

describe("looksLikeQuestionTable", () => {
  it("accepts a header row with question and answer columns", () => {
    expect(looksLikeQuestionTable(["type", "question", "option_a", "correct"])).toBe(true);
  });

  it("rejects a cover-sheet table", () => {
    expect(looksLikeQuestionTable(["school", "ykay college"])).toBe(false);
  });

  it("rejects an empty header row", () => {
    expect(looksLikeQuestionTable([])).toBe(false);
  });
});

/* ------------------------------------------------------------------
   Plain text
   ------------------------------------------------------------------ */

describe("importQuestionsFromText", () => {
  it("imports a .txt paper", () => {
    const result = importQuestionsFromText(
      `1. What is 2+2?\r\nA) 3\r\nB) 4\r\nAnswer: B\r\n\r\n2. Discuss photosynthesis.\r\nESSAY`,
    );

    expect(result.errors).toEqual([]);
    expect(result.questions).toHaveLength(2);
    expect(result.questions[1].type).toBe("ESSAY");
  });

  it("handles Windows line endings and a UTF-8 BOM", () => {
    const result = importQuestionsFromText(`\uFEFF1. What is 2+2?\r\nA) 3\r\nB) 4\r\nAnswer: B`);

    expect(result.errors).toEqual([]);
    expect(result.questions[0].questionText).toBe("What is 2+2?");
  });

  it("returns an explicit error for an empty file rather than silence", () => {
    const result = importQuestionsFromText("   \n\n  ");

    expect(result.questions).toHaveLength(0);
    expect(result.errors[0]).toMatch(/no questions/i);
  });
});
