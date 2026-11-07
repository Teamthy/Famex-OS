import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import {
  documentCompleteness,
  documentCounts,
  documentRefusalMessage,
} from "@/lib/admissions-documents";

/**
 * Whether an uploaded document actually counts (audit B-03).
 *
 * Both `payments/start` and `submit` decided completeness from the TYPES of the
 * documents attached to an application:
 *
 *     const uploaded = new Set(application.documents.map((d) => d.type));
 *
 * A row is written as soon as an upload is confirmed, before any scan has run.
 * So a document still PENDING — or one already marked INFECTED — satisfied the
 * requirement exactly as a clean one did. The application advanced to payment
 * and submission, and the admissions office was told the file was in order.
 *
 * An infected birth certificate is worse than a missing one, because a missing
 * one is obvious.
 */

const REQUIRED = ["BIRTH_CERTIFICATE", "PRIMARY_SCHOOL_REPORT"] as const;

function doc(type: string, scanStatus: string) {
  return { type, scanStatus };
}

describe("documentCounts", () => {
  it("counts a clean file", () => {
    expect(documentCounts("CLEAN")).toBe(true);
  });

  it("counts a skipped scan — no scanner is configured", () => {
    // An accepted deployment decision, recorded on the row. Refusing every
    // application would make the product unusable where no scanner exists.
    expect(documentCounts("SKIPPED")).toBe(true);
  });

  it("does NOT count a pending scan", () => {
    expect(documentCounts("PENDING")).toBe(false);
  });

  it("does NOT count an infected file", () => {
    expect(documentCounts("INFECTED")).toBe(false);
  });

  it("does not count a status nobody has defined", () => {
    // Allow-listing rather than "anything but INFECTED": a new verdict added
    // later must be considered, not silently trusted.
    expect(documentCounts("QUARANTINED_BY_ANTIVIRUS")).toBe(false);
    expect(documentCounts("")).toBe(false);
  });
});

describe("documentCompleteness", () => {
  it("is complete when every required type is clean", () => {
    const result = documentCompleteness(REQUIRED, [
      doc("BIRTH_CERTIFICATE", "CLEAN"),
      doc("PRIMARY_SCHOOL_REPORT", "CLEAN"),
    ]);
    expect(result.complete).toBe(true);
    expect(documentRefusalMessage(result)).toBeNull();
  });

  it("is incomplete when a required type is absent", () => {
    const result = documentCompleteness(REQUIRED, [doc("BIRTH_CERTIFICATE", "CLEAN")]);
    expect(result.complete).toBe(false);
    expect(result.missing).toEqual(["PRIMARY_SCHOOL_REPORT"]);
  });

  it("is incomplete while a required file is still being scanned", () => {
    const result = documentCompleteness(REQUIRED, [
      doc("BIRTH_CERTIFICATE", "CLEAN"),
      doc("PRIMARY_SCHOOL_REPORT", "PENDING"),
    ]);
    expect(result.complete).toBe(false);
    expect(result.scanning).toEqual(["PRIMARY_SCHOOL_REPORT"]);
    // Not reported as missing: the parent did upload it, and telling them it is
    // missing sends them to re-upload a file that is already there.
    expect(result.missing).toEqual([]);
  });

  it("is incomplete when a required file failed its scan", () => {
    const result = documentCompleteness(REQUIRED, [
      doc("BIRTH_CERTIFICATE", "INFECTED"),
      doc("PRIMARY_SCHOOL_REPORT", "CLEAN"),
    ]);
    expect(result.complete).toBe(false);
    expect(result.rejected).toEqual(["BIRTH_CERTIFICATE"]);
    expect(result.scanning).toEqual([]);
  });

  it("does not let an extra document type stand in for a required one", () => {
    const result = documentCompleteness(["BIRTH_CERTIFICATE"], [
      doc("BIRTH_CERTIFICATE", "PENDING"),
      doc("PRIMARY_SCHOOL_REPORT", "CLEAN"),
    ]);
    expect(result.complete).toBe(false);
  });

  it("is complete with no requirements at all", () => {
    expect(documentCompleteness([], []).complete).toBe(true);
  });

  it("judges a re-uploaded type on its best row, not whichever was read last", () => {
    // The schema makes (applicationId, type) unique, so this cannot happen
    // today — but taking the best row rather than the first keeps a future
    // re-upload from being judged on read order.
    const result = documentCompleteness(["BIRTH_CERTIFICATE"], [
      doc("BIRTH_CERTIFICATE", "INFECTED"),
      doc("BIRTH_CERTIFICATE", "CLEAN"),
    ]);
    expect(result.complete).toBe(true);
  });

  it("blocks when ANY required file is infected, even if others are clean", () => {
    const result = documentCompleteness(["A", "B", "C"], [
      doc("A", "CLEAN"),
      doc("B", "INFECTED"),
      doc("C", "CLEAN"),
    ]);
    expect(result.complete).toBe(false);
    expect(result.rejected).toEqual(["B"]);
  });
});

describe("documentRefusalMessage", () => {
  it("does not say 'upload' when the file is already uploaded", () => {
    // The old message was "Please upload all required documents" whatever the
    // problem, which sent a parent to re-upload a file being scanned.
    const message = documentRefusalMessage(
      documentCompleteness(REQUIRED, [
        doc("BIRTH_CERTIFICATE", "CLEAN"),
        doc("PRIMARY_SCHOOL_REPORT", "PENDING"),
      ]),
    );
    expect(message).toMatch(/still being checked/i);
    expect(message).not.toMatch(/^please upload/i);
  });

  it("tells the parent an infected file must be replaced", () => {
    const message = documentRefusalMessage(
      documentCompleteness(["BIRTH_CERTIFICATE"], [doc("BIRTH_CERTIFICATE", "INFECTED")]),
    );
    expect(message).toMatch(/security check/i);
    expect(message).toMatch(/different copy/i);
  });

  it("names what is actually missing", () => {
    const message = documentRefusalMessage(
      documentCompleteness(["BIRTH_CERTIFICATE"], []),
    );
    expect(message).toMatch(/birth certificate/i);
  });
});

describe("both routes use the rule", () => {
  const ROOT = process.cwd();

  for (const file of [
    "app/api/admissions/payments/start/route.ts",
    "app/api/admissions/submit/route.ts",
  ]) {
    it(`${file} does not judge completeness from types alone`, () => {
      const text = readFileSync(join(ROOT, file), "utf8");
      expect(text).toMatch(/documentCompleteness\(/);
      // The old shape: a Set of types, and `every(... uploaded.has(...))`.
      expect(text).not.toMatch(/new Set<AdmissionDocumentType>/);
      expect(text).not.toMatch(/uploaded\.has\(/);
    });
  }
});
