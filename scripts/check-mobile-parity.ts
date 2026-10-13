/**
 * Mobile parity guard.
 *
 *   npm run check:mobile
 *
 * The mobile app is a separate codebase against the same API, so a web feature
 * can ship, work perfectly, and never reach the phone — with nothing failing
 * anywhere. Two real examples found by hand:
 *
 *   - Students got messaging on the web (drop 36). `mobile/app/messages.tsx`
 *     already existed and the student dashboard never linked to it, so the
 *     screen was unreachable for exactly the role that had just been given
 *     access. Parents and teachers had the link; students did not.
 *
 *   - `/api/student/exams` has returned `availabilityLabel`, `scheduledFor`
 *     and `availableUntil` since drop 26. The mobile exam list ignored all
 *     three and rendered a bare "LOCKED" chip — no reason, no date.
 *
 * This checks three things that have each already gone wrong:
 *   1. every mobile screen is reachable from somewhere
 *   2. fields the API sends are actually read by the screen that shows them
 *   3. the OTA channel and version gate are still wired
 *
 * Heuristic, not proof. Everything it flags is either fixed or listed with a
 * reason.
 */
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = process.cwd();
const MOBILE = join(ROOT, "mobile");

/** Screens entered by the router or a deep link rather than a tap. */
const ALLOWED_UNREACHABLE = new Set([
  "index",
  "landing",
  "login",
  "logout",
  "onboarding",
  "forgot-password",
  "_layout",
  // Opened with params from the screen above it.
  "exam-runner",
  "practice-runner",
  "message-thread",
]);

let failures = 0;
const fail = (message: string, detail = "") => {
  console.error(`  ✗ ${message}`);
  if (detail) console.error(`      ${detail}`);
  failures += 1;
};
const ok = (message: string) => console.log(`  ✓ ${message}`);

function walk(dir: string, out: string[] = []): string[] {
  if (!existsSync(dir)) return out;
  for (const entry of readdirSync(dir)) {
    if (entry.startsWith(".")) continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (entry.endsWith(".tsx")) out.push(full);
  }
  return out;
}

function main() {
  if (!existsSync(MOBILE)) {
    console.log("No mobile/ directory — nothing to check.");
    return;
  }

  const screens = walk(join(MOBILE, "app"));
  const sources = [...screens, ...walk(join(MOBILE, "components")), ...walk(join(MOBILE, "src"))];
  const corpus = sources.map((f) => readFileSync(f, "utf8")).join("\n");

  /* ── 1. Reachability ─────────────────────────────────────────────── */
  console.log("\nReachability");
  const unreachable: string[] = [];

  for (const screen of screens) {
    const rel = relative(join(MOBILE, "app"), screen).replace(/\\/g, "/");
    const name = rel.replace(/\.tsx$/, "");
    const base = name.split("/").pop() || name;
    if (ALLOWED_UNREACHABLE.has(base) || base === "_layout") continue;

    // A tab-group screen is reachable through its own _layout's Tabs.Screen.
    const inGroup = name.includes("(");
    const routeName = name.replace(/\([^)]+\)\//g, "");

    // Match the route however it is written. Screens are frequently opened
    // with a template literal carrying query params —
    // `/admin-student-detail?id=${...}` — which a plain quoted-string match
    // misses entirely. That produced two false positives on the first run,
    // and a guard that cries wolf is one people stop reading.
    const referenced =
      corpus.includes(`"/${routeName}"`) ||
      corpus.includes(`"/${name}"`) ||
      corpus.includes(`'/${routeName}'`) ||
      corpus.includes(`\`/${routeName}`) ||
      corpus.includes(`/${routeName}?`) ||
      corpus.includes(`pathname: "/${routeName}"`) ||
      (inGroup && corpus.includes(`name="${base}"`));

    if (!referenced) unreachable.push(routeName);
  }

  if (unreachable.length) {
    fail(
      `${unreachable.length} mobile screen(s) nothing navigates to`,
      unreachable.join(", ") + "\n      A screen nobody can open is a feature nobody knows exists.",
    );
  } else {
    ok(`all ${screens.length} screens reachable`);
  }

  /* ── 2. API fields the screens ignore ────────────────────────────── */
  console.log("\nAPI fields reaching the UI");

  const checks: Array<{ api: string; screen: string; fields: string[] }> = [
    {
      api: "app/api/student/exams/route.ts",
      screen: "mobile/app/(student)/exams.tsx",
      // Added in drop 26 and ignored by mobile until drop 41.
      fields: ["availabilityLabel", "scheduledFor"],
    },
  ];

  for (const check of checks) {
    const apiPath = join(ROOT, check.api);
    const screenPath = join(ROOT, check.screen);
    if (!existsSync(apiPath) || !existsSync(screenPath)) continue;

    const apiSrc = readFileSync(apiPath, "utf8");
    const screenSrc = readFileSync(screenPath, "utf8");
    const missing = check.fields.filter((f) => apiSrc.includes(f) && !screenSrc.includes(f));

    if (missing.length) {
      fail(
        `${check.screen} ignores ${missing.join(", ")}`,
        `The API sends these and the screen never reads them — the user sees less than the server knows.`,
      );
    } else {
      ok(`${check.screen.replace("mobile/app/", "")} reads what the API sends`);
    }
  }

  /* ── 3. Distribution wiring ──────────────────────────────────────── */
  console.log("\nDistribution");

  const easPath = join(MOBILE, "eas.json");
  if (existsSync(easPath)) {
    const eas = readFileSync(easPath, "utf8");
    // Without a channel, an OTA update publishes to nothing.
    if (!eas.includes('"channel"')) {
      fail("eas.json has no channel", "OTA updates would publish to nothing.");
    } else {
      ok("EAS channels configured");
    }
    if (!eas.includes("EXPO_PUBLIC_API_URL")) {
      fail("eas.json does not set EXPO_PUBLIC_API_URL", "The built APK would call localhost.");
    } else {
      ok("API URL baked into the build profiles");
    }
  }

  const updates = join(MOBILE, "lib/updates.ts");
  if (existsSync(updates)) {
    const src = readFileSync(updates, "utf8");
    const wired = corpus.includes("checkMinimumVersion");
    if (!src.includes("/api/mobile/config")) {
      fail("the version gate does not call /api/mobile/config");
    } else if (!wired) {
      fail(
        "checkMinimumVersion() is never called",
        "A sideloaded APK cannot be force-updated if nothing checks the minimum.",
      );
    } else {
      ok("version gate wired and called");
    }
  }

  console.log("");
  if (failures) {
    console.error(`${failures} mobile parity issue(s).\n`);
    process.exitCode = 1;
  } else {
    console.log("Mobile is in parity with the API.\n");
  }
}

main();
