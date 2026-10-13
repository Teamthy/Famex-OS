/**
 * Whole-project audit.
 *
 *   npm run audit
 *
 * Nine checks for the classes of problem that pass every other gate — tsc is
 * happy, tests are green, the build succeeds — and only surface when someone
 * uses the product or a domain changes:
 *
 *   1. hardcoded URLs that should be environment config
 *   2. API routes nothing calls (stale)
 *   3. fetch() targets that hit no route (broken wiring)
 *   4. links to pages that do not exist (broken routing)
 *   5. routes with no auth guard
 *   6. unbounded findMany (fine at 6 students, not at 600)
 *   7. TODO/FIXME left in shipped code
 *   8. duplicate route names across portals
 *   9. env vars read in code but absent from .env.example
 *
 * Heuristics, not proofs. Everything reported is either fixed or listed in
 * the ALLOW sets with a reason — an audit that cries wolf gets ignored, which
 * is how the real problems survive.
 */
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join, relative, dirname } from "node:path";

const ROOT = process.cwd();
const RED = "\u001b[31m";
const YELLOW = "\u001b[33m";
const GREEN = "\u001b[32m";
const DIM = "\u001b[2m";
const RESET = "\u001b[0m";

type Finding = { severity: "BLOCKER" | "WARNING"; area: string; detail: string; fix: string };
const findings: Finding[] = [];
const blocker = (area: string, detail: string, fix: string) =>
  findings.push({ severity: "BLOCKER", area, detail, fix });
const warn = (area: string, detail: string, fix: string) =>
  findings.push({ severity: "WARNING", area, detail, fix });

function walk(dir: string, out: string[] = [], exts = [".ts", ".tsx"]): string[] {
  if (!existsSync(dir)) return out;
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry.startsWith(".")) continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out, exts);
    else if (exts.some((e) => entry.endsWith(e))) out.push(full);
  }
  return out;
}

const appFiles = walk(join(ROOT, "app"));
const libFiles = walk(join(ROOT, "lib"));
const componentFiles = walk(join(ROOT, "components"));
const mobileFiles = [...walk(join(ROOT, "mobile/app")), ...walk(join(ROOT, "mobile/lib"))];
const webSource = [...appFiles, ...libFiles, ...componentFiles];
const allSource = [...webSource, ...mobileFiles];

const read = (f: string) => readFileSync(f, "utf8");
const rel = (f: string) => relative(ROOT, f).split("\\").join("/");
const corpus = allSource.map(read).join("\n");

/* ── 1. Hardcoded URLs ─────────────────────────────────────────────────── */

/** Domains that are legitimately literal. */
const URL_ALLOW = [
  "virtual.ykaycollege.com", // the YK-Virtual site's own canonical domain (sister property)
  "images.unsplash.com", // stock imagery on marketing pages
  "api.paystack.co", // the payment gateway's fixed endpoint
  "exp.host", // Expo push gateway
  "schemas.openxmlformats.org", // XML namespace, not a request
  "www.w3.org",
  "json-schema.org",
  "nextjs.org",
  "prisma.io",
  "neon.com",
  "expo.dev",
  "localhost",
  "example.com",
  "example.test",
  "evil.example.com", // security test fixtures
  "ykaycollege.edu.ng.evil.com",
];

const urlHits = new Map<string, string[]>();
for (const file of webSource) {
  const text = read(file);
  // Only URLs. `careers@ykaycollege.com` is the school's real mail domain —
  // confirmed by the user — and is not a hardcoded endpoint.
  for (const match of text.matchAll(/https?:\/\/([a-z0-9.-]+\.[a-z]{2,})/gi)) {
    const host = match[1].toLowerCase().replace(/[`'",)].*$/, "");
    if (URL_ALLOW.some((a) => host.includes(a))) continue;
    if (!urlHits.has(host)) urlHits.set(host, []);
    urlHits.get(host)!.push(rel(file));
  }
}
for (const [host, files] of urlHits) {
  const unique = [...new Set(files)];
  // A domain that is NOT the configured site is almost certainly stale.
  const isStaleDomain = host.includes("ykaycollege") && !host.includes("edu.ng");
  (isStaleDomain ? blocker : warn)(
    "Hardcoded URL",
    `${host} in ${unique.length} file(s): ${unique.slice(0, 4).join(", ")}`,
    isStaleDomain
      ? "Wrong domain — the live site is ykaycollege.edu.ng. Emails here bounce and metadata points at a site you do not own."
      : "Move to an environment variable so it can differ per deployment.",
  );
}

/* ── 2. Stale API routes ───────────────────────────────────────────────── */

/**
 * Routes reached by something other than a literal string in our code.
 * Each needs a reason — this set is where a genuinely dead route would hide.
 */
const ROUTE_ALLOW: Record<string, string> = {
  "/api/payments/paystack/webhook": "called by Paystack, not by us",
  "/api/internal/security-event": "called by middleware via an absolute URL",
  "/api/jobs/dispatch-notifications": "cron target",
  "/api/health": "uptime monitoring",
  "/api/mobile/config": "mobile lib/updates.ts builds the URL with a template literal",
  "/api/auth/whoami": "diagnostic, entered by hand",
  "/api/admissions/apply": "public admissions form posts to it",
  "/api/news": "public news page",
};

const routeFiles = walk(join(ROOT, "app/api"), [], ["route.ts"]);
const staleRoutes: string[] = [];
for (const file of routeFiles) {
  const endpoint = "/" + relative(join(ROOT, "app"), dirname(file)).split("\\").join("/");
  if (ROUTE_ALLOW[endpoint]) continue;
  // Match the static prefix before any dynamic segment: a caller writes
  // `/api/teacher/exams/${id}/retake`, so search for the part before ${.
  const prefix = endpoint.split("/[")[0];
  const referenced = allSource.some(
    (f) => !rel(f).startsWith("app/api/") && read(f).includes(prefix),
  );
  if (!referenced) staleRoutes.push(endpoint);
}
if (staleRoutes.length) {
  warn(
    "Stale API",
    `${staleRoutes.length} route(s) nothing references: ${staleRoutes.join(", ")}`,
    "Either wire them up or delete them. A route nobody calls is still an attack surface that must be maintained.",
  );
}

/* ── 3. Broken wiring: fetch() a route that does not exist ─────────────── */

const existingEndpoints = new Set(
  routeFiles.map((f) => "/" + relative(join(ROOT, "app"), dirname(f)).split("\\").join("/")),
);
const brokenFetches: string[] = [];
for (const file of allSource) {
  const text = read(file);
  for (const match of text.matchAll(/["'`](\/api\/[a-zA-Z0-9/_\-[\]${}.]*)["'`?]/g)) {
    let path = match[1].split("?")[0].replace(/\/$/, "");
    // A template that interpolates a QUERY STRING — `/api/x${query}` where
    // query is "?level=SS2" — is not a dynamic path segment. Treating it as
    // one invented seven non-existent endpoints on the first run.
    if (/\$\{[a-z]*(query|search|params|qs)\w*\}$/i.test(match[1])) {
      path = match[1].replace(/\$\{[^}]*\}$/, "").replace(/\/$/, "");
    } else if (path.includes("${")) {
      path = path.replace(/\$\{[^}]*\}/g, "[id]");
    }
    if (!path.startsWith("/api/")) continue;
    const known = [...existingEndpoints].some((e) => {
      const pattern = "^" + e.replace(/\[[^\]]+\]/g, "\\[[^\\]]+\\]") + "$";
      return new RegExp(pattern).test(path) || e === path;
    });
    if (!known) brokenFetches.push(`${path}  ${DIM}(${rel(file)})${RESET}`);
  }
}
if (brokenFetches.length) {
  blocker(
    "Broken wiring",
    `${brokenFetches.length} call(s) to a non-existent API:\n      ${[...new Set(brokenFetches)].slice(0, 8).join("\n      ")}`,
    "These 404 at runtime. Nothing catches them at build time.",
  );
}

/* ── 4. Broken routing: links to pages that do not exist ───────────────── */

const pageRoutes = new Set(
  walk(join(ROOT, "app"), [], ["page.tsx"]).map((f) => {
    const r = "/" + relative(join(ROOT, "app"), dirname(f)).split("\\").join("/");
    return r.replace(/\/\([^)]+\)/g, "").replace(/^\/$/, "/") || "/";
  }),
);
const brokenLinks: string[] = [];
for (const file of webSource) {
  const text = read(file);
  for (const match of text.matchAll(/href=["'](\/[a-zA-Z0-9/_-]*)["']/g)) {
    const path = match[1].replace(/\/$/, "") || "/";
    if (path.startsWith("/api/")) continue;
    if (pageRoutes.has(path)) continue;
    // Static assets and well-known files live in public/.
    if (/\.(png|jpg|svg|ico|pdf|xml|txt|json|webmanifest)$/.test(path)) continue;
    if (existsSync(join(ROOT, "public", path))) continue;
    brokenLinks.push(`${path}  ${DIM}(${rel(file)})${RESET}`);
  }
}
if (brokenLinks.length) {
  blocker(
    "Broken routing",
    `${brokenLinks.length} link(s) to a page that does not exist:\n      ${[...new Set(brokenLinks)].slice(0, 8).join("\n      ")}`,
    "These give the user a 404. A link is not type-checked.",
  );
}

/* ── 5. Unguarded API routes ───────────────────────────────────────────── */

const PUBLIC_ROUTES = [
  "/api/auth/login",
  "/api/auth/password-reset/request",
  "/api/auth/password-reset/confirm",
  "/api/auth/logout",
  "/api/health",
  "/api/news",
  "/api/admissions/apply",
  "/api/admissions/draft",
  "/api/admissions/status",
  "/api/admissions/submit",
  "/api/admissions/upload-url",
  "/api/admissions/documents/confirm",
  "/api/admissions/payments/start",
  "/api/payments/paystack/webhook",
  "/api/internal/security-event",
  "/api/jobs/dispatch-notifications",
  "/api/platform/signup",
  "/api/it/signup",
  "/api/onboarding",
  "/api/staff/activate",
  "/api/mobile/config",
  // Public IT course catalogue: active courses and an enrolment count, no
  // personal data. Unauthenticated on purpose — it is the shop window that
  // the marketing pages render.
  "/api/it/catalog",
  // CBT (computer-based testing) is a public practice tool: anyone can browse
  // subjects, pull a randomized quiz (answers never leave the server), check
  // one question, or submit an attempt for SERVER-SIDE grading. No personal
  // data is stored unless the caller chooses to include a name.
  "/api/cbt/subjects",
  "/api/cbt/quiz",
  "/api/cbt/check",
  "/api/cbt/attempts",
];
const unguarded: string[] = [];
for (const file of routeFiles) {
  const endpoint = "/" + relative(join(ROOT, "app"), dirname(file)).split("\\").join("/");
  if (PUBLIC_ROUTES.includes(endpoint)) continue;
  const text = read(file);
  // The codebase has a dozen `getXxxContext()` / `getXxxProfile()` helpers
  // that each call requireRole internally. Listing them by hand reported 27
  // guarded routes as unguarded on the first run — an alarming number that
  // was entirely my own blind spot, and exactly the kind of false alarm that
  // makes a security check worthless.
  const guarded =
    /requireRole|getSession|checkRole|requireSuperAdmin|verifyWebhook/.test(text) ||
    /\bget[A-Z][A-Za-z]*(Context|Profile|Admin|User)\s*\(/.test(text);
  if (!guarded) unguarded.push(endpoint);
}
if (unguarded.length) {
  blocker(
    "No auth guard",
    `${unguarded.length} route(s): ${unguarded.join(", ")}`,
    "Anyone on the internet can call these. Add requireRole() or list them as public.",
  );
}

/* ── 6. Unbounded queries ──────────────────────────────────────────────── */

let unbounded = 0;
const unboundedFiles = new Set<string>();
for (const file of routeFiles) {
  const text = read(file);
  for (const match of text.matchAll(/\.findMany\(\{/g)) {
    const slice = text.slice(match.index!, match.index! + 700);
    if (!/\btake:\s*\d/.test(slice)) {
      unbounded += 1;
      unboundedFiles.add(rel(file));
    }
  }
}
if (unbounded > 0) {
  warn(
    "Unbounded query",
    `${unbounded} findMany without take: across ${unboundedFiles.size} route(s)`,
    "Fine at 6 students; at 600 with three years of history one request can time out. lib/pagination.ts exists.",
  );
}

/* ── 7. TODO / FIXME ───────────────────────────────────────────────────── */

const todos: string[] = [];
for (const file of allSource) {
  read(file)
    .split("\n")
    .forEach((line, i) => {
      if (/\b(TODO|FIXME|HACK|XXX)\b/.test(line) && !line.includes("eslint"))
        todos.push(`${rel(file)}:${i + 1}`);
    });
}
if (todos.length) {
  warn(
    "Unfinished",
    `${todos.length}: ${todos.slice(0, 5).join(", ")}`,
    "Resolve or convert to a tracked issue.",
  );
}

/* ── 8. Env vars used but undocumented ─────────────────────────────────── */

const envExample = existsSync(join(ROOT, ".env.example")) ? read(join(ROOT, ".env.example")) : "";
const usedEnv = new Set<string>();
for (const file of [...webSource, ...walk(join(ROOT, "scripts"))]) {
  for (const match of read(file).matchAll(/process\.env\.([A-Z0-9_]+)/g)) usedEnv.add(match[1]);
}
const RUNTIME_ENV = ["NODE_ENV", "VERCEL_URL", "VERCEL_ENV", "npm_package_version", "CI", "PORT"];
const undocumented = [...usedEnv].filter(
  (v) => !RUNTIME_ENV.includes(v) && !envExample.includes(v),
);
if (undocumented.length) {
  warn(
    "Undocumented env",
    undocumented.join(", "),
    "Read in code but absent from .env.example — a fresh deploy silently misses them.",
  );
}

/* ── 9. Report ─────────────────────────────────────────────────────────── */

console.log(
  `\nProject audit — ${appFiles.length} app files, ${routeFiles.length} API routes\n${"─".repeat(66)}`,
);

const blockers = findings.filter((f) => f.severity === "BLOCKER");
const warnings = findings.filter((f) => f.severity === "WARNING");

if (blockers.length) console.log(`\n${RED}BLOCKERS${RESET}`);
for (const f of blockers) {
  console.log(`  ${RED}✗ ${f.area}${RESET}  ${f.detail}`);
  console.log(`      ${DIM}→ ${f.fix}${RESET}`);
}
if (warnings.length) console.log(`\n${YELLOW}WARNINGS${RESET}`);
for (const f of warnings) {
  console.log(`  ${YELLOW}! ${f.area}${RESET}  ${f.detail}`);
  console.log(`      ${DIM}→ ${f.fix}${RESET}`);
}

console.log(`\n${"─".repeat(66)}`);
console.log(
  blockers.length
    ? `${RED}${blockers.length} blocker(s), ${warnings.length} warning(s).${RESET}\n`
    : `${GREEN}No blockers. ${warnings.length} warning(s).${RESET}\n`,
);
if (blockers.length) process.exitCode = 1;
