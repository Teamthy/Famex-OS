/**
 * Load test — concurrent authenticated traffic against the real app.
 *
 * WHY NOT k6 OR ARTILLERY
 * -----------------------
 * Both are good tools and both are another binary to install, another config
 * language, and another thing that rots. This needs Node and nothing else, so
 * it can run in CI, on a laptop, or against production from an office machine
 * on the morning of results day.
 *
 * WHAT IT ANSWERS
 * ---------------
 * The question a school actually has: "when every parent opens results at the
 * same time, does the site stay up, and how slow does it get?" Ykay is ~800
 * students, so realistic peak is a few hundred concurrent readers — not
 * thousands. This models that, not a synthetic million-user benchmark.
 *
 * Usage:
 *   SEED_PASSWORD=... BASE_URL=http://127.0.0.1:3100 npm run loadtest
 *   ... npm run loadtest -- --users 100 --seconds 60
 */

const args = process.argv.slice(2);
function arg(name: string, fallback: number) {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] ? Number(args[i + 1]) : fallback;
}

const BASE = (process.env.BASE_URL || "http://127.0.0.1:3100").replace(/\/$/, "");
const USERS = arg("users", 50);
const SECONDS = arg("seconds", 30);
const PASSWORD = process.env.E2E_PASSWORD || process.env.SEED_PASSWORD || "";

if (!PASSWORD) {
  console.error("\nSEED_PASSWORD (or E2E_PASSWORD) is required — it signs the virtual users in.");
  console.error("It must match the password the database was seeded with.\n");
  console.error('  PowerShell:  $env:SEED_PASSWORD="<the seeded password>"');
  console.error('  bash:        export SEED_PASSWORD="<the seeded password>"\n');
  console.error("Then start the server in another terminal:\n");
  console.error("  node scripts/e2e-server.mjs 3100\n");
  console.error(
    '(not `next start` — next.config.ts uses output: "standalone", which\n' +
      " next start refuses to serve.)\n",
  );
  process.exit(1);
}

/** Read-heavy journeys, weighted the way a school's traffic actually falls. */
const ACCOUNTS = [
  { email: "parent1@ykaycollege.com", paths: ["/parent/dashboard", "/parent/fees"] },
  { email: "parent2@ykaycollege.com", paths: ["/parent/dashboard", "/parent/report-cards"] },
  { email: "student1@ykaycollege.com", paths: ["/student/dashboard", "/student/exams"] },
  { email: "teacher1@ykaycollege.com", paths: ["/teacher/dashboard", "/teacher/gradebook"] },
  { email: "admin@ykaycollege.com", paths: ["/admin", "/admin/fees"] },
];

type Sample = { ms: number; status: number; path: string };
const samples: Sample[] = [];
let errors = 0;

async function signIn(email: string): Promise<string | null> {
  try {
    const res = await fetch(`${BASE}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password: PASSWORD }),
    });
    if (!res.ok) return null;
    const raw = res.headers.get("set-cookie") || "";
    const match = /ykay_session=([^;]+)/.exec(raw);
    return match ? `ykay_session=${match[1]}` : null;
  } catch {
    return null;
  }
}

async function hit(path: string, cookie: string) {
  const started = Date.now();
  try {
    const res = await fetch(`${BASE}${path}`, {
      headers: { cookie },
      redirect: "manual",
    });
    // Drain the body: without it the timing measures headers only, which
    // flatters the result and hides slow streaming responses.
    await res.text();
    samples.push({ ms: Date.now() - started, status: res.status, path });
    if (res.status >= 500) errors++;
  } catch {
    errors++;
    samples.push({ ms: Date.now() - started, status: 0, path });
  }
}

function percentile(sorted: number[], p: number) {
  if (!sorted.length) return 0;
  const idx = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length));
  return sorted[idx];
}

async function main() {
  console.log(`\nLoad test  ${BASE}`);
  console.log(`  ${USERS} concurrent users for ${SECONDS}s\n`);

  // Sign the virtual users in ONCE up front. Logging in per request would
  // measure the rate limiter rather than the app — /api/auth/login allows 10
  // attempts per 15 min per IP.
  console.log("signing in...");
  const sessions: { cookie: string; paths: string[] }[] = [];
  for (const account of ACCOUNTS) {
    const cookie = await signIn(account.email);
    if (cookie) sessions.push({ cookie, paths: account.paths });
    else console.warn(`  could not sign in ${account.email} (skipping)`);
  }

  if (!sessions.length) {
    console.error("\nNo virtual user could sign in. Is the server up and the database seeded?\n");
    process.exit(1);
  }
  console.log(`  ${sessions.length} sessions ready\n`);

  const deadline = Date.now() + SECONDS * 1000;
  let active = true;
  setTimeout(() => {
    active = false;
  }, SECONDS * 1000);

  const worker = async (id: number) => {
    const session = sessions[id % sessions.length];
    while (active && Date.now() < deadline) {
      const path = session.paths[Math.floor(Math.random() * session.paths.length)];
      await hit(path, session.cookie);
      // A real user reads for a moment between clicks.
      await new Promise((r) => setTimeout(r, 200 + Math.random() * 600));
    }
  };

  const started = Date.now();
  await Promise.all(Array.from({ length: USERS }, (_, i) => worker(i)));
  const elapsed = (Date.now() - started) / 1000;

  const times = samples.map((s) => s.ms).sort((a, b) => a - b);
  const ok = samples.filter((s) => s.status > 0 && s.status < 400).length;
  const rps = samples.length / elapsed;

  console.log("─".repeat(56));
  console.log(`  requests        ${samples.length}`);
  console.log(`  throughput      ${rps.toFixed(1)} req/s`);
  console.log(
    `  success         ${ok}/${samples.length} (${((ok / samples.length) * 100).toFixed(1)}%)`,
  );
  console.log(`  5xx / network   ${errors}`);
  console.log("");
  console.log(`  median          ${percentile(times, 50)}ms`);
  console.log(`  p95             ${percentile(times, 95)}ms`);
  console.log(`  p99             ${percentile(times, 99)}ms`);
  console.log(`  slowest         ${times[times.length - 1]}ms`);
  console.log("─".repeat(56));

  // Slowest routes, because an average hides the one page that falls over.
  const byPath = new Map<string, number[]>();
  for (const s of samples) {
    if (!byPath.has(s.path)) byPath.set(s.path, []);
    byPath.get(s.path)!.push(s.ms);
  }
  console.log("\n  per route (p95):");
  for (const [path, values] of [...byPath.entries()].sort(
    (a, b) =>
      percentile(
        b[1].sort((x, y) => x - y),
        95,
      ) -
      percentile(
        a[1].sort((x, y) => x - y),
        95,
      ),
  )) {
    const sorted = values.sort((a, b) => a - b);
    console.log(`    ${String(percentile(sorted, 95)).padStart(6)}ms  ${path}`);
  }

  // Thresholds. A school portal that answers in under a second at p95 is fine;
  // any 5xx under this little load is not.
  const p95 = percentile(times, 95);
  let failed = false;

  console.log("");
  if (errors > 0) {
    console.error(`  FAIL  ${errors} server/network errors under ${USERS} users`);
    failed = true;
  }
  if (p95 > 3000) {
    console.error(`  FAIL  p95 ${p95}ms exceeds the 3000ms budget`);
    failed = true;
  }
  if (!failed) {
    console.log(`  PASS  no 5xx, p95 ${p95}ms within budget\n`);
  }

  process.exit(failed ? 1 : 0);
}

void main();
