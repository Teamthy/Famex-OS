/**
 * Full-coverage e2e smoke.
 *
 * Discovers EVERY page and API route from the filesystem (rather than a
 * hand-maintained list, which drifts), logs in as each role, and asserts:
 *
 *   - public pages render 200
 *   - protected pages render 200 for a permitted role
 *   - protected pages redirect/deny for an anonymous visitor  <-- the security check
 *   - GET APIs answer 200 for a permitted role and 401/403 anonymously
 *
 * Usage:
 *   BASE_URL=http://127.0.0.1:3000 npx tsx scripts/e2e-full.ts
 *   npx tsx scripts/e2e-full.ts --list-only
 *   npx tsx scripts/e2e-full.ts --json report.json
 */
import { readdirSync, statSync, writeFileSync } from "fs";
import { join, relative, sep } from "path";
import { logger } from "@/lib/logger";

const BASE = (process.env.BASE_URL || "http://127.0.0.1:3000").replace(/\/$/, "");
const LIST_ONLY = process.argv.includes("--list-only");
const jsonIdx = process.argv.indexOf("--json");
const JSON_OUT = jsonIdx >= 0 ? process.argv[jsonIdx + 1] : null;

// No fallback: this literal also shipped in .env.example, so defaulting to it
// meant the smoke test authenticated with a publicly known password — and
// would keep passing against an environment that still used it.
const PASSWORD = process.env.SEED_PASSWORD || "";
if (!PASSWORD) {
  console.error("\nSEED_PASSWORD is required.\n");
  console.error('  PowerShell:  $env:SEED_PASSWORD="<the seeded password>"');
  console.error('  bash:        SEED_PASSWORD="<the seeded password>" npm run test:e2e:full\n');
  process.exit(1);
}

/** Seeded accounts, one per role. */
const ACCOUNTS: Record<string, string> = {
  SUPER_ADMIN: "superadmin@ykaycollege.com",
  ADMIN: "admin@ykaycollege.com",
  DIRECTOR: "director@ykaycollege.com",
  BURSAR: "bursar@ykaycollege.com",
  COORDINATOR: "coordinator@ykaycollege.com",
  HOD: "hod@ykaycollege.com",
  TEACHER: "teacher1@ykaycollege.com",
  STUDENT: "student1@ykaycollege.com",
  PARENT: "parent1@ykaycollege.com",
  IT_STUDENT: "itstudent@ykaycollege.com",
};

/** Which role should be able to reach a given path prefix. */
function roleForPath(p: string): string | null {
  if (p.startsWith("/super-admin") || p.startsWith("/api/super-admin")) return "SUPER_ADMIN";
  if (p.startsWith("/admin") || p.startsWith("/api/admin")) return "ADMIN";
  if (p.startsWith("/teacher") || p.startsWith("/api/teacher")) return "TEACHER";
  if (p.startsWith("/student") || p.startsWith("/api/student")) return "STUDENT";
  if (p.startsWith("/parent") || p.startsWith("/api/parent")) return "PARENT";
  // /api/it/instructor is for staff who teach IT, not IT students.
  if (p === "/api/it/instructor") return "TEACHER";
  if (p.startsWith("/it-portal") || p.startsWith("/api/it")) return "IT_STUDENT";
  if (p.startsWith("/staff") || p.startsWith("/api/staff")) return "TEACHER";
  // /change-password is reachable by any signed-in role; use a student session.
  if (p === "/change-password") return "STUDENT";
  return null; // public
}

/** Paths inside a protected prefix that are intentionally public. */
const PUBLIC_EXCEPTIONS = new Set(["/it-portal/auth", "/staff/activate"]);

/** Routes that are legitimately not GET-testable, with the reason. */
/**
 * Public by design. Verified individually:
 *   /portal          - sign-in hub, titled "EduPortal - Sign In"
 *   /onboarding      - platform school self-signup
 *   /api/it/catalog  - public IT course catalogue (feeds marketing pages)
 *   /login, /signup  - auth entry points
 */
const INTENTIONALLY_PUBLIC = new Set([
  "/portal",
  "/onboarding",
  "/api/it/catalog",
  "/login",
  "/signup",
  "/reset-password",
]);

const SKIP: Record<string, string> = {
  "/api/auth/logout": "mutates session",
  "/api/payments/paystack/webhook": "POST + signature only",
  "/api/jobs/dispatch-notifications": "cron, bearer-guarded",
  "/api/internal/security-event": "internal, secret-guarded",
  "/api/super-admin/impersonate": "mutates session",
  "/api/push/register": "POST only",
  "/api/platform/signup": "POST only",
  "/api/it/signup": "POST only",
  "/api/it/enroll": "POST only",
  "/api/onboarding": "POST only",
  "/api/auth/change-password": "POST only",
  "/api/auth/password-reset/request": "POST only",
  "/api/auth/password-reset/confirm": "POST only",
  "/api/admissions/apply": "POST only",
  "/api/admissions/submit": "POST only",
  "/api/admissions/draft": "POST only",
  "/api/admissions/upload-url": "POST only",
  "/api/admissions/documents/confirm": "POST only",
  "/api/admissions/payments/start": "POST only",
  "/api/admin/staff/direct": "POST only",
  "/api/admin/report-cards/generate": "POST only",
  "/api/admin/report-cards/release": "POST only",
  "/api/admin/fees/reminders": "POST only",
  "/api/admin/admissions/enroll": "POST only",
  "/api/admin/admissions/paper": "POST only",
  "/api/admin/admissions/record-fee": "POST only",
  "/api/teacher/questions/bulk": "POST only",
  "/api/super-admin/broadcast": "POST only",
  "/api/auth/login": "POST only",
  "/api/it/progress": "POST only",
  "/api/staff/activate": "POST only",
  "/api/parent/fees/payments": "POST only",
  "/api/parent/fees/payment-intents": "POST only",
  "/api/teacher/attendance/correction-request": "POST only",
  "/api/admin/staff/invites/[id]": "POST/DELETE only",
  "/api/student/exams/[id]/attempt": "POST/PATCH only",
  "/api/student/practice/[id]/attempt": "POST/PATCH only",
};

/** Sample values for dynamic segments so a route is at least reachable. */
const SAMPLE = "e2e-sample-id";

type Route = { path: string; kind: "page" | "api"; dynamic: boolean };

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}

function discover(): Route[] {
  const appDir = join(process.cwd(), "app");
  const files = walk(appDir).filter(
    (f) => f.endsWith(`${sep}page.tsx`) || f.endsWith(`${sep}route.ts`),
  );

  const routes: Route[] = [];
  for (const f of files) {
    const rel = relative(appDir, f).split(sep);
    rel.pop(); // drop page.tsx / route.ts
    const segments = rel.filter((s) => !(s.startsWith("(") && s.endsWith(")"))); // route groups
    let p = "/" + segments.join("/");
    if (p === "/") p = "/";
    const dynamic = p.includes("[");
    // Fill dynamic segments with a sample so the request is well-formed.
    const resolved = p.replace(/\[\[?\.\.\.[^\]]+\]?\]/g, SAMPLE).replace(/\[[^\]]+\]/g, SAMPLE);
    routes.push({
      path: resolved || "/",
      kind: f.endsWith("route.ts") ? "api" : "page",
      dynamic,
    });
  }
  return routes.sort((a, b) => a.path.localeCompare(b.path));
}

async function login(email: string): Promise<string | null> {
  try {
    const res = await fetch(`${BASE}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password: PASSWORD }),
      redirect: "manual",
    });
    if (!res.ok) return null;
    const raw = res.headers.get("set-cookie") || "";
    const m = raw.match(/ykay_session=([^;]+)/);
    return m ? m[1] : null;
  } catch {
    return null;
  }
}

type Result = {
  path: string;
  kind: string;
  role: string;
  status: number;
  ok: boolean;
  note: string;
};

async function hit(path: string, cookie?: string): Promise<number> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 30000);
  try {
    const res = await fetch(`${BASE}${path}`, {
      redirect: "manual",
      headers: {
        Accept: "text/html,application/json,*/*",
        ...(cookie ? { Cookie: `ykay_session=${cookie}` } : {}),
      },
      signal: ctrl.signal,
    });
    return res.status;
  } catch {
    return 0;
  } finally {
    clearTimeout(t);
  }
}

async function main() {
  const routes = discover();
  const pages = routes.filter((r) => r.kind === "page");
  const apis = routes.filter((r) => r.kind === "api");

  if (LIST_ONLY) {
    for (const r of routes) console.log(`${r.kind}\t${r.path}`);
    console.log(`\n${routes.length} routes (${pages.length} pages, ${apis.length} APIs)`);
    return;
  }

  console.log(`Discovered ${routes.length} routes: ${pages.length} pages, ${apis.length} APIs`);
  console.log(`Target: ${BASE}\n`);

  // ── Authenticate every role up front ──
  const cookies: Record<string, string> = {};
  for (const [role, email] of Object.entries(ACCOUNTS)) {
    const c = await login(email);
    if (c) cookies[role] = c;
    console.log(`  ${c ? "OK  " : "FAIL"} login ${role.padEnd(12)} ${email}`);
  }
  console.log("");

  const results: Result[] = [];
  const anonLeaks: Result[] = [];

  for (const r of routes) {
    // Match both the resolved path and the original [id] template.
    const template = r.path
      .split("/")
      .map((seg) => (seg === SAMPLE ? "[id]" : seg))
      .join("/");
    const skipReason = SKIP[r.path] || SKIP[template];
    if (skipReason) {
      results.push({
        path: r.path,
        kind: r.kind,
        role: "-",
        status: 0,
        ok: true,
        note: `skipped: ${skipReason}`,
      });
      continue;
    }

    const needed = PUBLIC_EXCEPTIONS.has(r.path) ? null : roleForPath(r.path);
    const cookie = needed ? cookies[needed] : undefined;
    const status = await hit(r.path, cookie);

    let ok: boolean;
    let note = "";

    if (needed) {
      // Authenticated: 200 fine. 404 acceptable on a dynamic route fed a fake id.
      ok = status === 200 || (r.dynamic && [400, 404].includes(status));
      if (!ok && [401, 403, 307, 302].includes(status)) note = `denied for ${needed}`;
      if (r.dynamic && [400, 404].includes(status)) note = "sample id (expected)";

      // Security assertion: the same path must NOT be open anonymously.
      const anon = await hit(r.path);
      const guarded = [301, 302, 307, 308, 401, 403, 404].includes(anon);
      if (!guarded && anon === 200 && !INTENTIONALLY_PUBLIC.has(r.path)) {
        anonLeaks.push({
          path: r.path,
          kind: r.kind,
          role: "ANON",
          status: anon,
          ok: false,
          note: "reachable without auth",
        });
      }
    } else {
      // Auth-aware public endpoints answer 401 to an anonymous caller, and a
      // lookup endpoint answers 422 without its required query param. Both are
      // correct behaviour, not failures.
      ok =
        status === 200 || [401, 422].includes(status) || (r.dynamic && [400, 404].includes(status));
      if (status === 401) note = "401 anon (auth-required, correct)";
      if (status === 422) note = "422 needs query param (correct)";
      if (r.dynamic && [400, 404].includes(status)) note = "sample id (expected)";
    }

    results.push({
      path: r.path,
      kind: r.kind,
      role: needed || "public",
      status,
      ok,
      note,
    });
  }

  // ── Report ──
  const tested = results.filter((r) => !r.note.startsWith("skipped"));
  const failed = tested.filter((r) => !r.ok);
  const skipped = results.filter((r) => r.note.startsWith("skipped"));

  for (const r of results) {
    if (r.note.startsWith("skipped")) continue;
    const mark = r.ok ? "PASS" : "FAIL";
    const extra = r.note ? `  (${r.note})` : "";
    console.log(`${mark}  ${String(r.status).padStart(3)}  ${r.role.padEnd(11)} ${r.path}${extra}`);
  }

  console.log(`\n${"=".repeat(64)}`);
  console.log(`Tested   : ${tested.length}`);
  console.log(`Passed   : ${tested.length - failed.length}`);
  console.log(`Failed   : ${failed.length}`);
  console.log(`Skipped  : ${skipped.length} (POST-only / webhook / session-mutating)`);
  console.log(`Auth leaks: ${anonLeaks.length}`);

  if (failed.length) {
    console.log(`\nFailures:`);
    for (const f of failed) console.log(`  ${String(f.status).padStart(3)}  ${f.path}  ${f.note}`);
  }
  if (anonLeaks.length) {
    console.log(`\nProtected routes reachable ANONYMOUSLY:`);
    for (const f of anonLeaks) console.log(`  200  ${f.path}`);
  }

  if (JSON_OUT) {
    writeFileSync(JSON_OUT, JSON.stringify({ results, anonLeaks }, null, 2));
    console.log(`\nJSON written to ${JSON_OUT}`);
  }

  if (failed.length || anonLeaks.length) process.exit(1);
  console.log(`\nFull e2e passed.`);
}

main().catch((e) => {
  logger.error("Request failed", { error: e instanceof Error ? e.message : String(e) });
  process.exit(1);
});
