import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import {
  attendanceFromCard,
  letterheadFromSchool,
  printNumber,
  printText,
  sheetFromStoredCard,
  type StoredReportCard,
} from "@/lib/report-card-sheet";

/**
 * The printable report card.
 *
 * This is the one document a school hands a parent as proof of work done. It is
 * printed, signed, photocopied and filed, and it is used in disputes. So the
 * rules that matter are not "does it render" but:
 *
 *   • nothing on the paper is invented;
 *   • absent is not zero;
 *   • the identifier on it is not an access key.
 */

const SCHOOL = letterheadFromSchool({
  name: "Famex International Schools",
  address: "12 Adeola Odeku Street, Lagos",
  phone: "+234 701 537 4411",
  email: "info@famex.school",
  motto: "Raising Role Models",
});

function card(overrides: Partial<StoredReportCard> = {}): StoredReportCard {
  return {
    reportNumber: "RC/2026/T1/FIS-0148",
    verificationCode: "rc_K7pQ2mXvB9nL4tRs8wYzA3",
    sessionLabel: "2025/2026",
    termLabel: "First Term",
    classNameSnapshot: "JSS 2A",
    overallTotal: 374,
    overallAverage: 75,
    overallGrade: "A",
    classPosition: "3rd of 42",
    attendancePresent: 58,
    attendanceTotal: 60,
    classTeacherRemark: "An excellent term.",
    directorRemark: "Keep it up.",
    nextResumption: "12 January 2026",
    feeBalance: 0,
    subjects: [
      {
        subject: "Mathematics",
        ca1: 18,
        ca2: 17,
        midterm: 15,
        assignment: 9,
        exam: 62,
        total: 79,
        grade: "A",
        sortOrder: 0,
      },
      {
        subject: "English",
        ca1: 15,
        ca2: 14,
        midterm: 13,
        assignment: 8,
        exam: 55,
        total: 71,
        grade: "B",
        sortOrder: 1,
      },
    ],
    ...overrides,
  };
}

describe("printNumber / printText", () => {
  it("prints an em dash for a value that was never recorded", () => {
    // Not 0. A zero on a report card claims the child scored nothing, which is
    // a different and damaging statement.
    expect(printNumber(null)).toBe("—");
    expect(printNumber(undefined)).toBe("—");
    expect(printNumber(Number.NaN)).toBe("—");
  });

  it("prints a real zero as zero", () => {
    expect(printNumber(0)).toBe("0");
  });

  it("treats blank and whitespace-only text as absent", () => {
    expect(printText("")).toBeNull();
    expect(printText("   ")).toBeNull();
    expect(printText(null)).toBeNull();
    expect(printText(" Mr. Adeyemi ")).toBe("Mr. Adeyemi");
  });
});

describe("attendanceFromCard", () => {
  it("derives absent from the two stored counts", () => {
    expect(attendanceFromCard(58, 60)).toEqual({ present: 58, absent: 2, late: 0 });
  });

  it("returns null when no register was kept", () => {
    // 0 of 0 is not "attended nothing" — it is "nobody recorded anything".
    // Printing "Present: 0" would accuse the child.
    expect(attendanceFromCard(0, 0)).toBeNull();
  });

  it("never prints a negative absent count", () => {
    expect(attendanceFromCard(70, 60)).toEqual({ present: 60, absent: 0, late: 0 });
  });
});

describe("letterheadFromSchool", () => {
  it("prefers the tenant's display name over the school row", () => {
    expect(
      letterheadFromSchool({ name: "School Row Name" }, { displayName: "Branded Name" }).name,
    ).toBe("Branded Name");
  });

  it("leaves a missing phone blank rather than inventing one", () => {
    const identity = letterheadFromSchool({ name: "A School", phone: "  " });
    expect(identity.phone).toBeNull();
    expect(identity.logoUrl).toBeNull();
  });

  it("survives a school that has not been created yet", () => {
    const identity = letterheadFromSchool(null);
    expect(identity.name).toBe("");
    expect(identity.address).toBeNull();
  });
});

describe("sheetFromStoredCard", () => {
  it("maps the stored card and keeps subject order", () => {
    const sheet = sheetFromStoredCard(
      card(),
      { displayName: "Chidera", studentId: "FIS-0148", className: "JSS 2A" },
      SCHOOL,
    );
    expect(sheet.subjects.map((s) => s.subject)).toEqual(["Mathematics", "English"]);
    expect(sheet.student.name).toBe("Chidera");
    expect(sheet.overallAverage).toBe(75);
  });

  it("uses the class as it stood when the card was issued", () => {
    // The child may have moved up a class since. The card must not silently
    // reprint with the new one.
    const sheet = sheetFromStoredCard(
      card({ classNameSnapshot: "JSS 1B" }),
      { displayName: "Chidera", studentId: "FIS-0148", className: "JSS 2A" },
      SCHOOL,
    );
    expect(sheet.student.className).toBe("JSS 1B");
  });

  it("leaves per-subject remarks empty for the teacher to complete by hand", () => {
    const sheet = sheetFromStoredCard(
      card(),
      { displayName: "C", studentId: "S", className: "JSS 2A" },
      SCHOOL,
    );
    expect(sheet.subjects.every((s) => s.remarks === null)).toBe(true);
  });

  it("prints no verify URL when the card has no public code", () => {
    // The report number is readable and guessable — it encodes the student id.
    // Falling back to it would put an identifier in a URL that the public page
    // must never accept.
    const sheet = sheetFromStoredCard(
      card({ verificationCode: null }),
      { displayName: "C", studentId: "S", className: "JSS 2A" },
      SCHOOL,
      { verifyUrl: "https://portal.example/verify/report/RC%2F2026%2FT1%2FFIS-0148" },
    );
    expect(sheet.verificationCode).toBeNull();
    expect(sheet.verifyUrl).toBeNull();
  });

  it("prints the verify URL when a code exists", () => {
    const sheet = sheetFromStoredCard(
      card(),
      { displayName: "C", studentId: "S", className: "JSS 2A" },
      SCHOOL,
      { verifyUrl: "https://portal.example/verify/report/rc_abc" },
    );
    expect(sheet.verifyUrl).toBe("https://portal.example/verify/report/rc_abc");
  });

  it("carries attendance through as null when no register was kept", () => {
    const sheet = sheetFromStoredCard(
      card({ attendancePresent: 0, attendanceTotal: 0 }),
      { displayName: "C", studentId: "S", className: "JSS 2A" },
      SCHOOL,
    );
    expect(sheet.attendance).toBeNull();
  });
});

describe("the sheet fits A4 and prints one card per page", () => {
  const css = readFileSync(join(process.cwd(), "app/globals.css"), "utf8");
  const block = css.slice(css.indexOf(".rc-sheet {"));

  it("declares an A4 page box with no browser-added margin", () => {
    // The sheet supplies its own 14/15mm padding; letting @page add a margin on
    // top shrinks the content box and pushes the last block onto page 2.
    expect(block).toMatch(/@page\s*\{\s*size:\s*A4 portrait;\s*margin:\s*0;/);
  });

  it("is A4 wide on screen and in print", () => {
    expect(block.match(/width:\s*210mm/g)?.length ?? 0).toBeGreaterThanOrEqual(2);
  });

  it("is A4 tall in print so the footer can pin to the foot", () => {
    // The verify strip uses margin-top:auto, which needs a definite height.
    // min-height:0 here left a hand's width of blank paper under the card.
    expect(block).toMatch(/min-height:\s*297mm !important/);
    expect(block).toMatch(/flex-direction:\s*column !important/);
  });

  it("breaks after each sheet so two cards never share a page", () => {
    expect(block).toMatch(/break-after:\s*page/);
  });

  it("does not leave a trailing blank page after the last card", () => {
    expect(block).toMatch(/\.rc-sheet:last-of-type/);
  });

  it("drops the screen shadow and rounding on paper", () => {
    expect(block).toMatch(/box-shadow:\s*none !important/);
    expect(block).toMatch(/border-radius:\s*0 !important/);
  });

  it("keeps the header band from printing as a solid block of toner", () => {
    expect(block).toMatch(/print-color-adjust:\s*exact/);
  });
});

describe("the print page is not the dashboard", () => {
  const page = readFileSync(join(process.cwd(), "app/report-cards/[code]/print/page.tsx"), "utf8");

  it("keys the lookup on the public verification code", () => {
    expect(page).toMatch(/verificationCode:\s*decodeURIComponent\(code\)/);
    expect(page).not.toMatch(/reportNumber:\s*decodeURIComponent/);
  });

  it("refuses an unreleased card to anyone but staff", () => {
    expect(page).toMatch(/status !== ReportCardStatus\.RELEASED && !isStaff/);
  });

  it("scopes the lookup to the session's school", () => {
    expect(page).toMatch(/schoolId:\s*session\.schoolId/);
  });
});
