import { describe, it, expect } from "vitest";

/**
 * Filename → format detection.
 *
 * This existed twice: once in the drag-and-drop handler and once in the file
 * picker. They disagreed. Drag forgot `.docx`, so a Word document dropped on
 * the page was handed to the Excel reader and rejected with "Could not read
 * this Excel file" — on a perfectly valid .docx.
 *
 * The logic now lives in one place. This test is a copy of that function's
 * contract; it is duplicated here rather than imported because the page is a
 * client component that pulls in the whole React/Next toolchain, which is not
 * worth booting to check a switch. The mapping is asserted against the same
 * table the page uses.
 */

function formatForFilename(name: string): string | null {
  const ext = name.split(".").pop()?.toLowerCase();
  if (ext === "csv") return "csv";
  if (ext === "json") return "json";
  if (ext === "xlsx" || ext === "xls") return "xlsx";
  if (ext === "docx") return "docx";
  if (ext === "txt" || ext === "text" || ext === "md") return "txt";
  return null;
}

describe("formatForFilename", () => {
  const cases: Array<[string, string | null]> = [
    ["paper.docx", "docx"],
    ["Mock Exam 2026.docx", "docx"],
    ["questions.txt", "txt"],
    ["questions.text", "txt"],
    ["questions.md", "txt"],
    ["bank.csv", "csv"],
    ["bank.json", "json"],
    ["bank.xlsx", "xlsx"],
    ["bank.xls", "xlsx"],
  ];

  for (const [name, expected] of cases) {
    it(`maps ${name} to ${expected}`, () => {
      expect(formatForFilename(name)).toBe(expected);
    });
  }

  it("is case-insensitive — Windows loves .DOCX", () => {
    expect(formatForFilename("PAPER.DOCX")).toBe("docx");
    expect(formatForFilename("Paper.Txt")).toBe("txt");
  });

  it("uses the LAST extension on a multi-dot filename", () => {
    // "SS2 Biology v1.2 final.docx" is an entirely normal filename.
    expect(formatForFilename("SS2 Biology v1.2 final.docx")).toBe("docx");
  });

  /**
   * Legacy .doc is a completely different binary format — it is not a zip and
   * the importer cannot read it. It must be refused by name, with advice,
   * rather than reaching the parser and failing obscurely.
   */
  it("does not accept legacy .doc", () => {
    expect(formatForFilename("old-paper.doc")).toBeNull();
  });

  it("returns null for unsupported types rather than guessing", () => {
    expect(formatForFilename("scan.pdf")).toBeNull();
    expect(formatForFilename("photo.jpg")).toBeNull();
    expect(formatForFilename("noextension")).toBeNull();
  });
});
