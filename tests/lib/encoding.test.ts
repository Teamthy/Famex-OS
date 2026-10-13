import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join, relative } from "node:path";

/**
 * Mojibake guard.
 *
 * UTF-8 text written, then re-read as CP1252 and saved again, produces a
 * recognisable corruption: `·` becomes `Â·`, `₦` becomes `â‚¦`, `—` becomes
 * `â€"`. It renders as garbage on screen and nowhere else, so it survives
 * every type check and unit test and is only ever caught by a human reading
 * the page.
 *
 * We have now shipped this twice. Drop 24 fixed 11 files — but that sweep
 * searched only for `Â`, so `â‚¦` (a corrupted naira sign) survived in the
 * PARENT DASHBOARD and the report-card preview. A parent looking at a fee
 * balance saw `â‚¦45,000`, which the user reported as "the crown".
 *
 * Searching for one corruption pattern is what let the second one through, so
 * this scans for the whole family across every source file.
 */

const ROOT = process.cwd();
const SCAN = ["app", "components", "lib", "scripts", "mobile/app", "mobile/src", "mobile/lib"];
/**
 * Root-level files, scanned individually.
 *
 * The directory walk missed these entirely, which is how `.env.example` kept
 * a mangled em dash ("Paystack â€” use test keys") through two encoding
 * sweeps. A guard that only looks where you expect the bug is how the bug
 * survives.
 */
const SCAN_FILES = [".env.example", "README.md", "package.json"];
const EXTENSIONS = /\.(tsx?|jsx?|css|md|json)$/;

/**
 * Each entry is the CP1252 misreading of a common UTF-8 character.
 * The `Ã¢â‚¬` style sequences are what a double-encoded em dash looks like.
 */
const MOJIBAKE: Array<{ pattern: string; meaning: string }> = [
  { pattern: "\u00c3\u00a2\u00e2\u201a\u00ac", meaning: "€ / — (double-encoded)" },
  { pattern: "\u00e2\u201a\u00a6", meaning: "₦ naira sign" },
  { pattern: "\u00c2\u00b7", meaning: "· middle dot" },
  { pattern: "\u00e2\u20ac\u201c", meaning: "– en dash" },
  { pattern: "\u00e2\u20ac\u201d", meaning: "— em dash" },
  { pattern: "\u00e2\u20ac\u2122", meaning: "’ apostrophe" },
  { pattern: "\u00e2\u20ac\u0153", meaning: "\u201c opening quote" },
  { pattern: "\u00c2\u00a0", meaning: "non-breaking space" },
  { pattern: "\u00e2\u2026", meaning: "… ellipsis" },
];

function walk(dir: string, out: string[] = []): string[] {
  if (!existsSync(dir)) return out;
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry.startsWith(".")) continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (EXTENSIONS.test(entry)) out.push(full);
  }
  return out;
}

describe("source files are valid UTF-8, not mojibake", () => {
  const files = [
    ...SCAN.flatMap((dir) => walk(join(ROOT, dir))),
    ...SCAN_FILES.map((f) => join(ROOT, f)).filter((f) => existsSync(f)),
  ];

  it("scans a meaningful number of files", () => {
    // Guards the guard: a broken walk would make every assertion below pass.
    expect(files.length).toBeGreaterThan(100);
  });

  for (const { pattern, meaning } of MOJIBAKE) {
    it(`contains no corrupted ${meaning}`, () => {
      const hits: string[] = [];
      for (const file of files) {
        const text = readFileSync(file, "utf8");
        if (text.includes(pattern)) {
          const line = text.split("\n").findIndex((l) => l.includes(pattern)) + 1;
          hits.push(`${relative(ROOT, file)}:${line}`);
        }
      }
      expect(hits, `Mojibake (${meaning}) found in:\n  ${hits.join("\n  ")}`).toEqual([]);
    });
  }

  /**
   * The naira sign specifically, because it is money on a parent's screen and
   * it is the one that got through the last sweep.
   */
  it("writes the naira sign correctly wherever currency is shown", () => {
    const offenders: string[] = [];
    for (const file of files) {
      const text = readFileSync(file, "utf8");
      // A literal ₦ is fine. A ₦ preceded by the corruption marker is not.
      if (/\u00e2\u201a\u00a6/.test(text)) offenders.push(relative(ROOT, file));
    }
    expect(offenders).toEqual([]);
  });
});
