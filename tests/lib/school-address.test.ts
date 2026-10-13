import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";
import { confirmedSchoolAddress } from "@/lib/school-address";

const ROOT = join(__dirname, "..", "..");

describe("confirmedSchoolAddress", () => {
  it("returns null until the school has set an address", () => {
    expect(confirmedSchoolAddress(undefined)).toBeNull();
    expect(confirmedSchoolAddress(null)).toBeNull();
    expect(confirmedSchoolAddress("")).toBeNull();
    expect(confirmedSchoolAddress("   \n\t ")).toBeNull();
  });

  it("returns the address with spacing tidied", () => {
    expect(confirmedSchoolAddress("  12 Example Road,\n  Ibadan,  Oyo State ")).toBe(
      "12 Example Road, Ibadan, Oyo State",
    );
  });
});

/**
 * Regression guard for B7. The school address comes from one place (the School row).
 * This fails if a hard-coded address or town name is put back into product code.
 */
describe("no hard-coded school address in product code", () => {
  const FORBIDDEN = [/km\s*38/i, /lagos-abeokuta/i, /sango\s+ota/i, /alishiba/i];
  const SCANNED_DIRS = ["app", "components", "lib", "public"];
  const SCANNED_EXTENSIONS = /\.(tsx?|jsx?|json|md|html)$/;

  function* walk(dir: string): Generator<string> {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) {
        yield* walk(full);
      } else if (SCANNED_EXTENSIONS.test(entry)) {
        yield full;
      }
    }
  }

  it("finds nothing in app, components, lib or public", () => {
    const hits: string[] = [];
    for (const dir of SCANNED_DIRS) {
      for (const file of walk(join(ROOT, dir))) {
        const text = readFileSync(file, "utf8");
        for (const pattern of FORBIDDEN) {
          if (pattern.test(text)) hits.push(`${relative(ROOT, file)} matches ${pattern}`);
        }
      }
    }
    expect(hits).toEqual([]);
  });
});
