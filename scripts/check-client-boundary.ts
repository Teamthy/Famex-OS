/**
 * Client/server boundary guard.
 *
 *   npm run check:boundary
 *
 * Walks the import graph from every `"use client"` file and fails if it can
 * reach a server-only module (`next/headers`, `@/lib/prisma`, `@/lib/session`,
 * `server-only`, node builtins).
 *
 * ── Why this exists ────────────────────────────────────────────────────────
 * Drop 30 shipped a production build failure. `lib/question-import.ts` is used
 * by the upload page, which is a client component, and it imported
 * `parseBulkQuestions` from `lib/exams` — which imports `lib/session`, which
 * imports `next/headers`:
 *
 *   app/teacher/upload-questions/page.tsx ("use client")
 *     -> lib/question-import.ts -> lib/exams.ts -> lib/session.ts
 *        -> next/headers        (server-only)
 *
 * `tsc --noEmit` passed. `vitest` passed — 525 tests, all green. Neither
 * enforces the App Router's server/client split, so the first thing that knew
 * was Vercel, after a push. This script closes that gap locally, and runs in
 * the same second or two as the other checks.
 *
 * Deliberately a plain regex/graph walk rather than a bundler: it has to be
 * fast enough to run before every push, and `next build` OOMs in the dev
 * sandbox.
 *
 * Exits non-zero with the offending chain so the fix is obvious.
 */
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join, dirname, resolve, relative } from "node:path";

const ROOT = process.cwd();
const SCAN_DIRS = ["app", "components", "lib", "hooks"];
const EXTENSIONS = [".ts", ".tsx", ".js", ".jsx"];

/** Modules that must never end up in a browser bundle. */
const SERVER_ONLY = [
  "next/headers",
  "server-only",
  "@/lib/prisma",
  "@/lib/session",
  "@/lib/db-rls",
  "bcryptjs",
  "node:fs",
  "node:path",
  "node:crypto",
  "fs",
];

function walk(dir: string, out: string[] = []): string[] {
  if (!existsSync(dir)) return out;
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry.startsWith(".")) continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (EXTENSIONS.some((ext) => entry.endsWith(ext))) out.push(full);
  }
  return out;
}

function importsOf(file: string): string[] {
  const source = readFileSync(file, "utf8");
  const specifiers: string[] = [];
  // Static imports, `export ... from`, and dynamic import() alike.
  const patterns = [
    /import\s+(?:[\s\S]*?)\s*from\s*["']([^"']+)["']/g,
    /export\s+(?:[\s\S]*?)\s*from\s*["']([^"']+)["']/g,
    /import\s*\(\s*["']([^"']+)["']\s*\)/g,
  ];
  for (const pattern of patterns) {
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(source)) !== null) specifiers.push(match[1]);
  }
  return specifiers;
}

/** Resolve an import specifier to a file inside the repo, or null. */
function resolveLocal(specifier: string, fromFile: string): string | null {
  let base: string;
  if (specifier.startsWith("@/")) base = join(ROOT, specifier.slice(2));
  else if (specifier.startsWith(".")) base = resolve(dirname(fromFile), specifier);
  else return null;

  for (const ext of EXTENSIONS) {
    if (existsSync(base + ext)) return base + ext;
  }
  for (const ext of EXTENSIONS) {
    const indexFile = join(base, "index" + ext);
    if (existsSync(indexFile)) return indexFile;
  }
  if (existsSync(base) && statSync(base).isFile()) return base;
  return null;
}

function isClientFile(file: string): boolean {
  const head = readFileSync(file, "utf8").slice(0, 200);
  return /^\s*["']use client["']/m.test(head);
}

/**
 * Depth-first search for a server-only import, returning the chain that
 * reaches it. A chain is far more useful than a filename: the offending
 * import is usually three hops from the file you have to change.
 */
function findServerImport(
  file: string,
  seen: Set<string>,
  chain: string[],
): { chain: string[]; culprit: string } | null {
  if (seen.has(file)) return null;
  seen.add(file);

  for (const specifier of importsOf(file)) {
    if (SERVER_ONLY.includes(specifier)) {
      return { chain: [...chain, relative(ROOT, file)], culprit: specifier };
    }
    const next = resolveLocal(specifier, file);
    // Only follow files we own. A "use client" leaf re-entered from elsewhere
    // is still worth walking, since the bundle includes it either way.
    if (next && next.startsWith(ROOT)) {
      const found = findServerImport(next, seen, [...chain, relative(ROOT, file)]);
      if (found) return found;
    }
  }
  return null;
}

function main() {
  const files = SCAN_DIRS.flatMap((dir) => walk(join(ROOT, dir)));
  const clientFiles = files.filter(isClientFile);

  console.log(`Checking ${clientFiles.length} client component(s) for server-only imports...\n`);

  const violations: Array<{ entry: string; chain: string[]; culprit: string }> = [];
  for (const file of clientFiles) {
    // Fresh `seen` per entry point so one client file's traversal cannot mask
    // another's violation.
    const found = findServerImport(file, new Set(), []);
    if (found) {
      violations.push({ entry: relative(ROOT, file), chain: found.chain, culprit: found.culprit });
    }
  }

  if (!violations.length) {
    console.log("No client component reaches a server-only module.");
    return;
  }

  for (const violation of violations) {
    console.error(`✗ ${violation.entry}`);
    violation.chain.forEach((step, index) => {
      console.error(`${"  ".repeat(index + 1)}-> ${step}`);
    });
    console.error(
      `${"  ".repeat(violation.chain.length + 1)}-> ${violation.culprit}  [SERVER ONLY]\n`,
    );
  }
  console.error(
    `${violations.length} client component(s) import server-only code. This fails the production build.`,
  );
  process.exitCode = 1;
}

main();
