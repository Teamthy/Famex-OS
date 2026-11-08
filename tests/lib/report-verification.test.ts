import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import {
  looksLikeVerificationCode,
  newVerificationCode,
  verificationPath,
} from "@/lib/verification";

/**
 * Public report verification (audit B-08).
 *
 * `/verify/report/<reportNumber>` showed a child's name, student id, class and
 * grades to anyone who requested it. The number is
 * `RC/{year}/T{term}/{studentId}` — readable, printable, and derived entirely
 * from things a classmate knows. Changing one digit reads another child.
 *
 * Cards now carry an unguessable `verificationCode`; the QR code and the public
 * URL use that, and the report number is no longer accepted.
 */

const ROOT = process.cwd();
const read = (path: string) => readFileSync(join(ROOT, path), "utf8");

describe("newVerificationCode", () => {
  it("is long enough not to be guessed", () => {
    // 128 bits. Sixteen base64url characters would already be beyond brute
    // force; this is 22, which is also short enough to type off a QR label.
    for (let i = 0; i < 50; i += 1) {
      expect(newVerificationCode().length).toBeGreaterThanOrEqual(24);
    }
  });

  it("is prefixed, so it is not mistaken for a report number", () => {
    expect(newVerificationCode()).toMatch(/^rc_/);
  });

  it("never repeats", () => {
    const codes = new Set(Array.from({ length: 500 }, () => newVerificationCode()));
    expect(codes.size).toBe(500);
  });

  it("is URL-safe, so the QR code does not need escaping", () => {
    for (let i = 0; i < 20; i += 1) {
      const code = newVerificationCode();
      expect(encodeURIComponent(code)).toBe(code);
    }
  });
});

describe("looksLikeVerificationCode", () => {
  it("recognises a code we issued", () => {
    expect(looksLikeVerificationCode(newVerificationCode())).toBe(true);
  });

  it("rejects a report number, so the two cannot be confused", () => {
    // This is the whole point: a report number must never be routed to the
    // public lookup.
    expect(looksLikeVerificationCode("RC/2026/T2/FIS-0421")).toBe(false);
    expect(looksLikeVerificationCode("RC-2026-0001")).toBe(false);
  });

  it("rejects a bare student id", () => {
    expect(looksLikeVerificationCode("FIS/0421")).toBe(false);
  });

  it("rejects a truncated code", () => {
    expect(looksLikeVerificationCode("rc_abc")).toBe(false);
  });
});

describe("the public page cannot be keyed on a report number", () => {
  it("looks the card up by verificationCode alone", () => {
    const page = read("app/verify/report/[reportNumber]/page.tsx");
    expect(page).toMatch(/where:\s*\{[^}]*verificationCode:/);
    // No fallback. A "try the number too" branch would restore the disclosure
    // while looking like compatibility. Scoped to the lookup itself: the
    // route's own parameter is still called reportNumber, which is a naming
    // wart and not a leak.
    const lookup = page.slice(page.indexOf("prisma.reportCard.findFirst"));
    const where = lookup.slice(lookup.indexOf("where:"), lookup.indexOf("select:"));
    // `reportNumber: true` in the select is fine — it is shown to the verifier.
    // A reportNumber in the WHERE is the oracle.
    expect(where).not.toMatch(/reportNumber/);
  });

  it("the generate route mints a code for every card", () => {
    const generate = read("app/api/admin/report-cards/generate/route.ts");
    expect(generate).toMatch(/verificationCode:\s*newVerificationCode\(\)/);
  });

  it("the schema keeps the code unique", () => {
    const schema = read("prisma/schema.prisma");
    expect(schema).toMatch(/verificationCode\s+String\?\s+@unique/);
  });

  it("existing cards are backfilled, so nothing stops verifying", () => {
    const migration = read(
      "prisma/migrations/20261107120000_report_card_verification_code/migration.sql",
    );
    expect(migration).toMatch(/UPDATE "ReportCard"/);
    expect(migration).toMatch(/verificationCode_key/);
  });

  it("the printed card and the preview carry the code, not the number", () => {
    // Printing "verify at /verify/report/RC/2026/..." would tell a reader to
    // use an identifier the page no longer accepts.
    const preview = read("components/LiveReportCardPreview.tsx");
    expect(preview).toMatch(/verificationCode \|\| reportNumber/);
    const pdf = read("lib/branded-pdf.ts");
    expect(pdf).toMatch(/verificationCode\?: string \| null/);
  });
});

describe("verificationPath", () => {
  it("encodes the code", () => {
    expect(verificationPath("rc_abc")).toBe("/verify/report/rc_abc");
  });
});

describe("the alumni transcript oracle is gone", () => {
  it("no longer accepts a report number from an unauthenticated caller", () => {
    // GET /api/alumni/transcript?reportNumber=... returned the full subject
    // breakdown of any released card to an anonymous caller, keyed on the same
    // guessable number — and it had no callers in the product at all.
    expect(() => read("app/api/alumni/transcript/route.ts")).toThrow();
  });
});
