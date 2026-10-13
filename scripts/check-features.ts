/**
 * Feature-catalogue consistency gate.
 *
 *   npm run check:features
 *
 * The feature catalogue (docs/famex/08-feature-catalogue.md) is the contract for
 * this rebuild: every screen ties back to an F##-## id, and every commit / PR
 * cites the ids it delivers. This gate keeps that honest without a database:
 *
 *   1. Parse the catalogue's feature rows into a canonical id set + status tag.
 *   2. Scan the source tree for cited feature ids (in comments / strings) and
 *      FAIL if any cited id does NOT exist in the catalogue — that catches a
 *      typo, a stale id from a renamed feature, or a citation to something the
 *      catalogue never promised.
 *   3. Report the catalogue totals and cross-check its own §25 TOTAL row, so a
 *      catalogue edit that drops or duplicates a row is visible.
 *
 * Exits non-zero on an unknown cited id, an unparseable catalogue, or a TOTAL
 * row that disagrees with the parsed feature count.
 */
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join, relative, sep } from "node:path";

const ROOT = process.cwd();
const CATALOGUE = join(ROOT, "docs", "famex", "08-feature-catalogue.md");

/**
 * A feature id looks like F5-04 (module 5, feature 4). Feature numbers are
 * zero-padded to two digits in the catalogue, so requiring \d{2} here keeps the
 * scanner from matching hex character classes like [A-F0-9] in test regexes.
 */
const ID_RE = /\bF\d{1,2}-\d{2}\b/g;
/** A catalogue feature row: | F0-01 | description | ✅ | notes | */
const ROW_RE = /^\|\s*(F\d+-\d+)\s*\|/;
/** The §25 declared-total row: | **TOTAL** | **331** | ... */
const TOTAL_RE = /^\|\s*\*\*TOTAL\*\*\s*\|\s*\*\*(\d+)\*\*/;

const STATUS_TAGS = ["✅", "🔧", "🆕", "✂️", "⏸"] as const;

/** Directories skipped when scanning code for citations. */
const SKIP_DIRS = new Set([
  "node_modules",
  ".next",
  ".git",
  ".turbo",
  "dist",
  "build",
  "coverage",
  "out",
  "target",
  ".arena",
]);
/** Path prefixes skipped (docs discuss ids freely; migrations are frozen). */
const SKIP_PREFIXES = ["docs/", "prisma/migrations/"];
/** This script cites example ids in its own comments — don't scan itself. */
const SKIP_FILES = new Set(["scripts/check-features.ts", "scripts/brand-baseline.json"]);
const CODE_EXT = /\.(ts|tsx|js|jsx|mjs|cjs)$/;

function toPosix(p: string): string {
  return p.split(sep).join("/");
}

function walkCode(dir: string, out: string[] = []): string[] {
  if (!existsSync(dir)) return out;
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    let st;
    try {
      st = statSync(full);
    } catch {
      continue;
    }
    const rel = toPosix(relative(ROOT, full));
    if (st.isDirectory()) {
      if (SKIP_DIRS.has(entry) || entry.startsWith(".")) continue;
      if (SKIP_PREFIXES.some((p) => rel === p.slice(0, -1) || rel.startsWith(p))) continue;
      walkCode(full, out);
    } else if (st.isFile()) {
      if (SKIP_FILES.has(rel)) continue;
      if (!CODE_EXT.test(entry)) continue;
      out.push(full);
    }
  }
  return out;
}

function parseCatalogue(): {
  ids: Set<string>;
  statusById: Map<string, string>;
  declaredTotal: number | null;
} {
  const ids = new Set<string>();
  const statusById = new Map<string, string>();
  let declaredTotal: number | null = null;

  const text = readFileSync(CATALOGUE, "utf8");
  for (const rawLine of text.split("\n")) {
    const line = rawLine.trimEnd();
    const totalMatch = line.match(TOTAL_RE);
    if (totalMatch) declaredTotal = Number(totalMatch[1]);
    const rowMatch = line.match(ROW_RE);
    if (rowMatch) {
      const id = rowMatch[1];
      ids.add(id);
      // Primary status tag = the first status emoji on the row.
      const tag = STATUS_TAGS.find((t) => line.includes(t));
      if (tag && !statusById.has(id)) statusById.set(id, tag);
    }
  }
  return { ids, statusById, declaredTotal };
}

function main(): void {
  if (!existsSync(CATALOGUE)) {
    console.error(`Feature catalogue not found at ${toPosix(relative(ROOT, CATALOGUE))}.`);
    process.exitCode = 1;
    return;
  }

  const { ids, statusById, declaredTotal } = parseCatalogue();
  if (ids.size === 0) {
    console.error("Parsed 0 feature rows from the catalogue — is the table format intact?");
    process.exitCode = 1;
    return;
  }

  // Scan code for cited ids and flag any that the catalogue does not define.
  const unknown = new Map<string, string[]>(); // id -> files citing it
  const cited = new Set<string>();
  for (const file of walkCode(ROOT)) {
    const rel = toPosix(relative(ROOT, file));
    let text = "";
    try {
      text = readFileSync(file, "utf8");
    } catch {
      continue;
    }
    for (const m of text.match(ID_RE) ?? []) {
      cited.add(m);
      if (!ids.has(m)) {
        const list = unknown.get(m) ?? [];
        if (!list.includes(rel)) list.push(rel);
        unknown.set(m, list);
      }
    }
  }

  // Per-tag tally (informational).
  const tally: Record<string, number> = {};
  for (const tag of statusById.values()) tally[tag] = (tally[tag] ?? 0) + 1;

  console.log(`Catalogue: ${ids.size} features parsed from ${toPosix(relative(ROOT, CATALOGUE))}.`);
  if (declaredTotal !== null) {
    const ok = declaredTotal === ids.size;
    console.log(
      `  §25 declares TOTAL ${declaredTotal} — ${ok ? "matches" : `MISMATCH (parsed ${ids.size})`}.`,
    );
    if (!ok) {
      console.error("  ✗ The catalogue's declared TOTAL disagrees with the parsed feature rows.");
      process.exitCode = 1;
    }
  }
  const tallyStr = STATUS_TAGS.map((t) => `${t} ${tally[t] ?? 0}`).join("  ");
  console.log(`  by tag: ${tallyStr}`);
  console.log(`Citations: ${cited.size} distinct feature id(s) referenced in code.`);

  if (unknown.size) {
    console.error(`\ncheck:features FAILED — ${unknown.size} cited id(s) are not in the catalogue:`);
    for (const [id, files] of [...unknown.entries()].sort()) {
      console.error(`  ✗ ${id} — cited in: ${files.slice(0, 4).join(", ")}${files.length > 4 ? ", …" : ""}`);
    }
    console.error(
      "\nA cited id must exist in docs/famex/08-feature-catalogue.md. Fix the citation,\n" +
        "or add the feature to the catalogue if it is genuinely new.",
    );
    process.exitCode = 1;
    return;
  }

  console.log("check:features OK — every cited feature id resolves to the catalogue.");
}

main();
