/**
 * Brand audit — a ratchet against re-introducing the old brand.
 *
 *   npm run audit:brand            # fail if the tree is worse than the baseline
 *   npm run audit:brand -- --update # re-cut scripts/brand-baseline.json to today
 *
 * ── Why this exists ────────────────────────────────────────────────────────
 * Famex OS is rebuilt from a single-school EduPortal base that carried a lot of
 * old-brand chrome: the school name in headers/footers/metadata, a hard-coded
 * logo, cookie and cache keys, seed emails, marketing copy. Rule 1 forbids new
 * brand literals — the product name and the school's own tokens come from
 * lib/brand.ts, never typed into a component.
 *
 * The old brand cannot be scrubbed in one pass (asset files, demo seed data and
 * a few frozen identifiers are still legitimately named for the base school), so
 * instead of a hard "zero" gate this is a RATCHET: the baseline records every
 * occurrence that is allowed to remain today, and the gate fails the moment a
 * file gains MORE of them, or a new file/token appears. Burn-down only ever
 * moves the number down; run with --update to bank the improvement.
 *
 * ── What it flags ──────────────────────────────────────────────────────────
 * Old-brand tokens (case-insensitive) in TEXT source files, plus any file whose
 * NAME carries an old-brand token. It deliberately does NOT flag the Famex OS
 * product name or neutral defaults ("the school", "School") — those are correct.
 *
 * Docs (*.md, docs/), frozen migration history (prisma/migrations/), generated
 * lockfiles, data dumps (*.csv) and binaries are out of scope: they are not
 * shipped product chrome, and migrations must stay immutable (Rule 11).
 */
import { readFileSync, readdirSync, statSync, existsSync, writeFileSync } from "node:fs";
import { join, relative, basename, sep } from "node:path";

const ROOT = process.cwd();
const BASELINE_PATH = join(ROOT, "scripts", "brand-baseline.json");

/** Old-brand tokens. Each is matched case-insensitively across file text. */
const PATTERNS: { token: string; re: RegExp }[] = [
  { token: "ykay", re: /ykay/gi },
  { token: "eduportal", re: /edu[\s_-]?portal/gi },
  { token: "eduos", re: /edu[\s_-]?os/gi },
  { token: "leadership-academy", re: /leadership[\s_-]?academy/gi },
  { token: "yk-virtual", re: /yk[\s_-]?virtual/gi },
];

/** File-name token check (a file literally named for the old brand). */
const NAME_RE = /ykay|edu[\s_-]?portal|edu[\s_-]?os|leadership[\s_-]?academy|yk[\s_-]?virtual/i;

/** Text extensions worth grepping. Anything else is binary or out of scope. */
const TEXT_EXT = /\.(ts|tsx|js|jsx|mjs|cjs|json|css|scss|prisma|sql|html|svg|ya?ml|sh|env|toml)$/i;

/** Directory names skipped anywhere in the tree. */
const SKIP_DIRS = new Set([
  "node_modules",
  ".next",
  ".git",
  ".turbo",
  ".cache",
  "dist",
  "build",
  "coverage",
  "out",
  "target",
  ".arena",
]);

/** Path prefixes (relative to ROOT, posix separators) skipped entirely. */
const SKIP_PREFIXES = [
  "docs/", // engineering pack + governing docs legitimately discuss the base brand
  "prisma/migrations/", // frozen, immutable history (Rule 11)
];

/** Individual files skipped (the audit's own machinery). */
const SKIP_FILES = new Set([
  "scripts/audit-brand.ts",
  "scripts/brand-baseline.json",
  "package-lock.json",
]);

type Allow = Record<string, Record<string, number>>; // file -> token -> count
type Baseline = { generatedAt: string; totalFindings: number; files: number; allow: Allow };

function toPosix(p: string): string {
  return p.split(sep).join("/");
}

function walk(dir: string, out: string[] = []): string[] {
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
      walk(full, out);
    } else if (st.isFile()) {
      if (SKIP_FILES.has(rel)) continue;
      if (!TEXT_EXT.test(entry) && !/(^|\/)\.env/.test(rel)) continue;
      // .md is out of scope (docs/README discuss history) unless it's config-ish.
      if (/\.md$/i.test(entry)) continue;
      out.push(full);
    }
  }
  return out;
}

/** Count every old-brand occurrence per file per token, plus a "filename" token. */
function audit(): { allow: Allow; total: number; files: number } {
  const allow: Allow = {};
  let total = 0;
  let files = 0;
  for (const full of walk(ROOT)) {
    const rel = toPosix(relative(ROOT, full));
    const per: Record<string, number> = {};

    // File-name findings (e.g. public/ykay-logo.png referenced by name, or a
    // seed file literally named for the base school).
    if (NAME_RE.test(basename(full))) per.filename = (per.filename ?? 0) + 1;

    let text = "";
    try {
      text = readFileSync(full, "utf8");
    } catch {
      text = "";
    }
    for (const { token, re } of PATTERNS) {
      const matches = text.match(re);
      if (matches && matches.length) per[token] = (per[token] ?? 0) + matches.length;
    }

    const sum = Object.values(per).reduce((a, b) => a + b, 0);
    if (sum > 0) {
      allow[rel] = per;
      total += sum;
      files += 1;
    }
  }
  return { allow, total, files };
}

function loadBaseline(): Baseline | null {
  if (!existsSync(BASELINE_PATH)) return null;
  try {
    return JSON.parse(readFileSync(BASELINE_PATH, "utf8")) as Baseline;
  } catch {
    return null;
  }
}

function writeBaseline(current: { allow: Allow; total: number; files: number }): void {
  const baseline: Baseline = {
    generatedAt: new Date().toISOString(),
    totalFindings: current.total,
    files: current.files,
    allow: current.allow,
  };
  writeFileSync(BASELINE_PATH, JSON.stringify(baseline, null, 2) + "\n", "utf8");
}

function main(): void {
  const args = process.argv.slice(2);
  const update = args.includes("--update");
  const current = audit();

  if (update) {
    writeBaseline(current);
    console.log(
      `Baseline re-cut: ${current.total} finding(s) across ${current.files} file(s) → scripts/brand-baseline.json`,
    );
    return;
  }

  const baseline = loadBaseline();
  if (!baseline) {
    // No baseline yet — create one so the ratchet has a starting point.
    writeBaseline(current);
    console.log(
      `No baseline found. Created scripts/brand-baseline.json with ${current.total} finding(s) across ${current.files} file(s).\n` +
        `This is the starting point; the gate now fails only if the count grows.`,
    );
    return;
  }

  // Worsened = a file/token count above baseline, or a brand-new file/token.
  const worse: string[] = [];
  for (const [file, tokens] of Object.entries(current.allow)) {
    for (const [token, count] of Object.entries(tokens)) {
      const allowed = baseline.allow[file]?.[token] ?? 0;
      if (count > allowed) {
        worse.push(`  ✗ ${file} — "${token}" ${count}× (baseline allows ${allowed})`);
      }
    }
  }

  // Improved = below baseline (informational; bank it with --update).
  const improved = baseline.totalFindings - current.total;

  if (worse.length) {
    console.error(
      `Brand audit FAILED — ${worse.length} file/token count(s) exceed the baseline:\n`,
    );
    for (const line of worse.sort()) console.error(line);
    console.error(
      `\nRule 1: no new brand literals. Take the school name / logo / colour from lib/brand.ts\n` +
        `(server) or useSchoolProfile() + CSS vars (client). If an occurrence is genuinely\n` +
        `allowed to stay for now, re-cut with:  npm run audit:brand -- --update`,
    );
    process.exitCode = 1;
    return;
  }

  console.log(
    `Brand audit OK — ${current.total} finding(s) across ${current.files} file(s); ` +
      `baseline allows ${baseline.totalFindings}.` +
      (improved > 0
        ? `\n  ↓ ${improved} fewer than baseline — run "npm run audit:brand -- --update" to bank the burn-down.`
        : ""),
  );
}

main();
