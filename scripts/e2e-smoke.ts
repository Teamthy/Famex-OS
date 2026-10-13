/**
 * Lightweight e2e smoke — no browser dependency.
 * Usage:
 *   BASE_URL=http://localhost:3000 npm run test:e2e
 *   npm run test:e2e -- --base-url=https://staging.example.com
 *   npm run test:e2e -- --list-only
 */
import { spawn } from "child_process";
import { logger } from "@/lib/logger";

type Check = {
  name: string;
  path: string;
  expectStatus?: number[];
  method?: string;
  body?: unknown;
  headers?: Record<string, string>;
};

const PUBLIC_PAGES: Check[] = [
  { name: "Home", path: "/" },
  { name: "About", path: "/about" },
  { name: "Academics", path: "/academics" },
  { name: "IT Education hub", path: "/it-education" },
  { name: "IT Python", path: "/it-education/python" },
  { name: "IT AI", path: "/it-education/ai" },
  { name: "IT Cybersecurity", path: "/it-education/cybersecurity" },
  { name: "IT Digital Literacy", path: "/it-education/digital-literacy" },
  { name: "IT Word", path: "/it-education/microsoft-word" },
  { name: "IT Excel", path: "/it-education/microsoft-excel" },
  { name: "IT PowerPoint", path: "/it-education/microsoft-powerpoint" },
  { name: "IT Excel Expert", path: "/it-education/excel-expert" },
  { name: "Admissions", path: "/admissions" },
  { name: "Admissions status", path: "/admissions/status" },
  { name: "Campus life", path: "/campus-life" },
  { name: "News", path: "/news-events" },
  { name: "FAQ", path: "/faq" },
  { name: "Contact", path: "/contact" },
  { name: "Gallery", path: "/gallery" },
  { name: "Alumni", path: "/alumni" },
  { name: "Testimonials", path: "/testimonials" },
  { name: "Login", path: "/login" },
  { name: "Portal hub", path: "/portal" },
  { name: "IT portal auth", path: "/it-portal/auth" },
  { name: "Privacy", path: "/privacy-policy" },
  { name: "Robots", path: "/robots.txt" },
  { name: "Sitemap", path: "/sitemap.xml" },
];

const PUBLIC_APIS: Check[] = [
  { name: "IT catalog API", path: "/api/it/catalog", expectStatus: [200] },
  { name: "News API", path: "/api/news", expectStatus: [200] },
  { name: "Auth me (anon)", path: "/api/auth/me", expectStatus: [200, 401] },
];

const PROTECTED_REDIRECTS: Check[] = [
  { name: "Admin guard", path: "/admin", expectStatus: [200, 307, 302, 401] },
  { name: "Teacher guard", path: "/teacher/dashboard", expectStatus: [200, 307, 302, 401] },
  { name: "Student guard", path: "/student/dashboard", expectStatus: [200, 307, 302, 401] },
  { name: "Parent guard", path: "/parent/dashboard", expectStatus: [200, 307, 302, 401] },
  { name: "Staff attendance guard", path: "/staff/attendance", expectStatus: [200, 307, 302, 401] },
  { name: "IT dashboard guard", path: "/it-portal/dashboard", expectStatus: [200, 307, 302, 401] },
  { name: "Super admin guard", path: "/super-admin", expectStatus: [200, 307, 302, 401] },
];

function argValue(flag: string) {
  const idx = process.argv.indexOf(flag);
  if (idx >= 0 && process.argv[idx + 1]) return process.argv[idx + 1];
  const pref = process.argv.find((a) => a.startsWith(`${flag}=`));
  return pref ? pref.split("=").slice(1).join("=") : undefined;
}

const baseUrl = (argValue("--base-url") || process.env.BASE_URL || "http://127.0.0.1:3000").replace(
  /\/$/,
  "",
);
const listOnly = process.argv.includes("--list-only");
const skipServer = process.argv.includes("--no-server") || process.env.E2E_NO_SERVER === "1";

async function hit(check: Check) {
  const expect = check.expectStatus || [200];
  const url = `${baseUrl}${check.path}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 25000);
  try {
    const res = await fetch(url, {
      method: check.method || "GET",
      redirect: "manual",
      headers: {
        Accept: "text/html,application/json,*/*",
        ...(check.headers || {}),
      },
      body: check.body ? JSON.stringify(check.body) : undefined,
      signal: controller.signal,
    });
    const ok = expect.includes(res.status);
    return { ok, status: res.status, name: check.name, path: check.path };
  } catch (error) {
    return {
      ok: false,
      status: 0,
      name: check.name,
      path: check.path,
      error: error instanceof Error ? error.message : String(error),
    };
  } finally {
    clearTimeout(timer);
  }
}

async function waitForServer(timeoutMs = 120000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(baseUrl, { redirect: "manual" });
      if (res.status > 0) return;
    } catch {
      /* retry */
    }
    await new Promise((r) => setTimeout(r, 1500));
  }
  throw new Error(`Server did not become ready at ${baseUrl}`);
}

async function main() {
  const all = [...PUBLIC_PAGES, ...PUBLIC_APIS, ...PROTECTED_REDIRECTS];
  if (listOnly) {
    for (const c of all) console.log(`${c.path}\t${c.name}`);
    console.log(`\n${all.length} checks listed.`);
    return;
  }

  let child: ReturnType<typeof spawn> | null = null;
  if (!skipServer && /localhost|127\.0\.0\.1/.test(baseUrl)) {
    console.log(`Starting next start against existing build (cwd=${process.cwd()})…`);
    // Prefer already-built app
    child = spawn("npm", ["run", "start", "--", "-p", new URL(baseUrl).port || "3000"], {
      cwd: process.cwd(),
      stdio: ["ignore", "pipe", "pipe"],
      env: { ...process.env, PORT: new URL(baseUrl).port || "3000" },
    });
    child.stdout?.on("data", (d) => process.stdout.write(`[next] ${d}`));
    child.stderr?.on("data", (d) => process.stderr.write(`[next] ${d}`));
    try {
      await waitForServer();
    } catch (e) {
      child.kill("SIGTERM");
      throw e;
    }
  } else {
    console.log(`Using existing server at ${baseUrl}`);
    await waitForServer(30000).catch(() => {
      console.warn("Warning: could not pre-ping server; continuing anyway.");
    });
  }

  console.log(`\nRunning ${all.length} smoke checks on ${baseUrl}\n`);
  const results = [];
  for (const check of all) {
    const result = await hit(check);
    results.push(result);
    const mark = result.ok ? "PASS" : "FAIL";
    const err = "error" in result && result.error ? ` — ${result.error}` : "";
    console.log(
      `${mark}  ${String(result.status).padStart(3)}  ${check.path}  (${check.name})${err}`,
    );
  }

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} passed.`);
  if (child) {
    child.kill("SIGTERM");
  }
  if (failed.length) {
    console.error("\nFailed checks:");
    for (const f of failed)
      console.error(
        ` - ${f.path} status=${f.status}${"error" in f && f.error ? " " + f.error : ""}`,
      );
    process.exit(1);
  }
  console.log("\nE2E smoke passed.");
}

main().catch((error) => {
  logger.error("Request failed", { error: error instanceof Error ? error.message : String(error) });
  process.exit(1);
});
