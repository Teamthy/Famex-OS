/**
 * Tenant-route coverage checker (C-007).
 *
 *   npm run check:tenant-coverage [-- --strict]
 *
 * RLS today is opt-in per route: `withSchool()` sets the tenant context and
 * the DB enforces isolation; every other query relies on application-level
 * schoolId filters. That is a real backstop only while each route actually
 * filters — and the policy is deliberately fail-open when no context is set,
 * so a route that forgets the filter is a silent cross-tenant hole.
 *
 * This script statically scans every API route for tenant-model Prisma access
 * and reports, per route:
 *
 *   RLS-SCOPED  — route runs its tenant access through withSchool()
 *   APP-FILTER  — route touches tenant models and mentions a schoolId filter
 *                 in the same file (app-level defence; acceptable today)
 *   UNCOVERED   — route touches tenant models with neither of the above
 *
 * UNCOVERED routes are the ratchet list: fix them (prefer withSchool) and the
 * list shrinks. Run with --strict to exit non-zero on any UNCOVERED route —
 * wire that into CI once the current list is empty, and only then flip the
 * RLS policies themselves to fail-closed (see lib/db-rls.ts).
 *
 * It is deliberately a heuristic (regex over source, no type analysis):
 * imported helpers that filter internally will read as UNCOVERED here. Treat
 * every finding as "go look", not "this is a bug".
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = process.cwd();
const API_DIR = join(ROOT, "app", "api");
const SCHEMA = join(ROOT, "prisma", "schema.prisma");

/** Models carrying a schoolId column = tenant models. */
function tenantModels(): Set<string> {
  const schema = readFileSync(SCHEMA, "utf8");
  const models = new Set<string>();
  const blocks = schema.split(/^model\s+/m);
  for (const block of blocks.slice(1)) {
    const name = block.split(/\s/)[0];
    if (/^\s*schoolId\s+\w+/m.test(block)) models.add(name);
  }
  return models;
}

function listRouteFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...listRouteFiles(full));
    else if (entry === "route.ts") out.push(full);
  }
  return out;
}

/** Prisma model delegates are camelCase: prisma.admissionApplication.findFirst(...) */
function delegateName(model: string): string {
  return model.charAt(0).toLowerCase() + model.slice(1);
}

/**
 * Routes that legitimately CANNOT scope by schoolId because the caller is an
 * external provider with no tenant context. Each entry needs a reason a
 * reviewer can challenge — this list is the reviewed exception, not a bin
 * for routes that merely forgot to filter. Exempt routes are printed on
 * every run so they stay visible.
 */
const PROVIDER_GLOBAL_ROUTES: Record<string, string> = {
  "app/api/webhooks/whatsapp/route.ts":
    "Meta delivery callbacks carry no tenant context; matching is by providerMessageId (a globally unique wamid) under x-hub-signature-256 HMAC verification, so a callback can only touch the single job Meta issued that id for.",
};

const models = tenantModels();
const routes = listRouteFiles(API_DIR);

let rlsScoped = 0;
let appFiltered = 0;
const uncovered: string[] = [];
const providerGlobal: string[] = [];

const delegateCall = (model: string) =>
  new RegExp(
    "(?:prisma|tx|db|client)\\." +
      delegateName(model) +
      "\\.(?:findFirst|findMany|findUnique|create|createMany|update|updateMany|delete|deleteMany|upsert|count|aggregate|groupBy)",
  );

for (const route of routes) {
  const source = readFileSync(route, "utf8");
  const touched = [...models].filter((model) => delegateCall(model).test(source));
  if (touched.length === 0) continue;

  const exemption = PROVIDER_GLOBAL_ROUTES[relative(ROOT, route)];
  if (exemption) {
    providerGlobal.push(`${relative(ROOT, route)} — ${exemption}`);
    continue;
  }

  if (/withSchool\s*\(/.test(source)) {
    rlsScoped += 1;
    continue;
  }
  if (/schoolId/.test(source)) {
    appFiltered += 1;
    continue;
  }
  uncovered.push(
    `${relative(ROOT, route)}  (models: ${touched.slice(0, 4).join(", ")}${touched.length > 4 ? ", …" : ""})`,
  );
}

console.log(
  `Tenant-model routes: ${rlsScoped + appFiltered + uncovered.length + providerGlobal.length}`,
);
console.log(`  RLS-scoped (withSchool): ${rlsScoped}`);
console.log(`  App-level schoolId filter present: ${appFiltered}`);
console.log(`  Provider-global (reviewed exemption, no tenant context): ${providerGlobal.length}`);
for (const line of providerGlobal) console.log(`    - ${line}`);
console.log(`  UNCOVERED (no withSchool, no schoolId mention): ${uncovered.length}`);
if (uncovered.length) {
  console.log("\nUNCOVERED routes (go verify each — imported helpers may filter internally):");
  for (const line of uncovered) console.log(`  - ${line}`);
}

if (process.argv.includes("--strict")) {
  if (uncovered.length) {
    console.error(
      `\n--strict: ${uncovered.length} uncovered tenant route(s). Fix or scope them before enabling.`,
    );
    process.exit(1);
  }
  console.log("\n--strict: no uncovered tenant routes. The policy can move to fail-closed.");
}

/**
 * --max-uncovered <n> — a RATCHET, for CI.
 *
 * --strict is the end state (zero uncovered) and cannot be turned on until the
 * list is empty, so today it would simply fail on every commit and get ignored.
 * This flag instead fails only when coverage gets WORSE than a recorded
 * baseline, which is enforceable now: it stops new tenant routes landing
 * without a schoolId filter while the existing 18 are worked down.
 *
 * When the count drops below the baseline the check still passes, but nags you
 * to lower the number so the improvement is locked in.
 */
const maxFlagIndex = process.argv.indexOf("--max-uncovered");
if (maxFlagIndex !== -1) {
  const limit = Number.parseInt(process.argv[maxFlagIndex + 1] ?? "", 10);
  if (!Number.isFinite(limit) || limit < 0) {
    console.error("\n--max-uncovered requires a non-negative integer argument.");
    process.exit(2);
  }
  if (uncovered.length > limit) {
    console.error(
      `\nRATCHET FAILED: ${uncovered.length} uncovered tenant route(s) exceeds the baseline of ${limit}.`,
    );
    console.error(
      "A tenant-model route was added (or lost its schoolId filter) without being scoped.",
    );
    console.error(
      "Filter it by schoolId, or better, route it through withSchool() — see docs/TENANCY_RLS_STATUS.md.",
    );
    process.exit(1);
  }
  if (uncovered.length < limit) {
    console.log(
      `\nRATCHET: coverage improved to ${uncovered.length} (baseline ${limit}). ` +
        `Lower --max-uncovered to ${uncovered.length} to lock the gain in.`,
    );
  } else {
    console.log(`\nRATCHET: ${uncovered.length} uncovered, baseline ${limit} — no regression.`);
  }
}
