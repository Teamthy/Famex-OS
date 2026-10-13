/**
 * Automated restore drill.
 *
 * WHY
 * ---
 * docs/backup-restore.md describes a quarterly drill. A documented drill that
 * nobody runs is not a backup strategy — it is a plan to discover, during an
 * actual incident, that the dump was truncated. This makes the drill a command.
 *
 * It is deliberately destructive ONLY to a scratch database it creates itself,
 * and it refuses to touch anything that looks live.
 *
 * WHAT IT PROVES
 * --------------
 *   1. pg_dump completes and the archive is readable (not silently truncated —
 *      FORCE ROW LEVEL SECURITY can make pg_dump exit 0 with a partial file)
 *   2. The dump restores into an empty database
 *   3. Row counts match the source, table by table
 *   4. RLS policies survive the round trip
 *
 * Usage:
 *   DATABASE_URL=... npx tsx scripts/restore-drill.ts
 *   DATABASE_URL=... npx tsx scripts/restore-drill.ts --keep   (keep the scratch DB)
 */

import { execFileSync, spawnSync } from "child_process";
import { existsSync, mkdirSync, statSync, unlinkSync } from "fs";
import { join } from "path";

const KEEP = process.argv.includes("--keep");
const SOURCE_URL = process.env.DATABASE_URL || "";

if (!SOURCE_URL) {
  console.error("\nDATABASE_URL is required.\n");
  process.exit(1);
}

/** Tables whose row counts must match exactly after a restore. */
const CRITICAL_TABLES = [
  "School",
  "User",
  "StudentProfile",
  "ParentProfile",
  "TeacherProfile",
  "SchoolClass",
  "FeeInvoice",
  "FeePayment",
  "AttendanceEntry",
  "ReportCard",
  "Exam",
  "ExamAttempt",
  "AdmissionApplication",
];

function psql(url: string, sql: string): string {
  const res = spawnSync("psql", [url, "-tAc", sql], { encoding: "utf8" });
  if (res.status !== 0) {
    throw new Error(`psql failed: ${(res.stderr || "").trim()}`);
  }
  return (res.stdout || "").trim();
}

function requireTool(name: string) {
  try {
    execFileSync(name, ["--version"], { stdio: "ignore" });
  } catch {
    console.error(`\n${name} is not installed or not on PATH.\n`);
    console.error("  macOS:   brew install libpq && brew link --force libpq");
    console.error("  Ubuntu:  sudo apt-get install postgresql-client\n");
    process.exit(1);
  }
}

function main() {
  requireTool("pg_dump");
  requireTool("psql");
  requireTool("pg_restore");

  console.log("\nRestore drill");
  console.log("─".repeat(56));

  // ── 1. Dump ───────────────────────────────────────────────────────────
  const dir = join(process.cwd(), "_backups");
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  const file = join(dir, `drill-${Date.now()}.dump`);

  console.log("\n1. Dumping source database...");
  const dump = spawnSync(
    "pg_dump",
    [SOURCE_URL, "-Fc", "--no-owner", "--no-privileges", "-f", file],
    { encoding: "utf8" },
  );

  if (dump.status !== 0) {
    console.error("   FAILED:", (dump.stderr || "").trim().split("\n")[0]);
    console.error(
      "\n   If this mentions row-level security, the dump role needs BYPASSRLS.\n" +
        "   See docs/backup-restore.md — create a dedicated ykay_backup role.\n",
    );
    process.exit(1);
  }

  const bytes = statSync(file).size;
  console.log(`   wrote ${(bytes / 1024 / 1024).toFixed(2)} MB`);

  // pg_dump can exit 0 with a truncated archive under FORCE RLS, so read the
  // table of contents back — that is what actually proves it is intact.
  const toc = spawnSync("pg_restore", ["--list", file], { encoding: "utf8" });
  if (toc.status !== 0) {
    console.error("   FAILED: the archive is not readable — it is truncated or corrupt.");
    process.exit(1);
  }
  const tocLines = (toc.stdout || "").split("\n").filter((l) => l && !l.startsWith(";")).length;
  console.log(`   archive readable, ${tocLines} objects`);

  // ── 2. Count the source ───────────────────────────────────────────────
  console.log("\n2. Counting source rows...");
  const sourceCounts = new Map<string, number>();
  for (const table of CRITICAL_TABLES) {
    try {
      const n = Number(psql(SOURCE_URL, `SELECT count(*) FROM "${table}";`));
      sourceCounts.set(table, n);
    } catch {
      // A table absent from this schema version is not a drill failure.
    }
  }
  const sourcePolicies = Number(psql(SOURCE_URL, "SELECT count(*) FROM pg_policies;"));
  console.log(`   ${sourceCounts.size} tables, ${sourcePolicies} RLS policies`);

  // ── 3. Restore into a scratch database ────────────────────────────────
  const scratch = `ykay_drill_${Date.now()}`;
  const adminUrl = SOURCE_URL.replace(/\/[^/?]+(\?|$)/, "/postgres$1");
  const scratchUrl = SOURCE_URL.replace(/\/[^/?]+(\?|$)/, `/${scratch}$1`);

  console.log(`\n3. Restoring into scratch database ${scratch}...`);
  try {
    psql(adminUrl, `CREATE DATABASE "${scratch}";`);
  } catch (error) {
    console.error("   Could not create a scratch database:", String(error).split("\n")[0]);
    console.error("   On Neon, create a branch instead — see docs/backup-restore.md.\n");
    unlinkSync(file);
    process.exit(1);
  }

  const restore = spawnSync(
    "pg_restore",
    ["--no-owner", "--no-privileges", "-d", scratchUrl, file],
    { encoding: "utf8" },
  );
  // pg_restore warns about extensions it cannot recreate; only a hard failure
  // with no tables restored actually matters.
  if (restore.status !== 0) {
    console.log("   (pg_restore reported warnings — verifying by row count)");
  }

  // ── 4. Verify ─────────────────────────────────────────────────────────
  console.log("\n4. Verifying...");
  let mismatches = 0;
  for (const [table, expected] of sourceCounts) {
    let actual = -1;
    try {
      actual = Number(psql(scratchUrl, `SELECT count(*) FROM "${table}";`));
    } catch {
      actual = -1;
    }
    const ok = actual === expected;
    if (!ok) mismatches++;
    console.log(
      `   ${ok ? "ok  " : "FAIL"}  ${table.padEnd(22)} ${String(expected).padStart(6)} -> ${
        actual < 0 ? "missing" : actual
      }`,
    );
  }

  let restoredPolicies = 0;
  try {
    restoredPolicies = Number(psql(scratchUrl, "SELECT count(*) FROM pg_policies;"));
  } catch {
    /* counted as zero */
  }
  const policiesOk = restoredPolicies === sourcePolicies;
  console.log(
    `   ${policiesOk ? "ok  " : "WARN"}  RLS policies          ${sourcePolicies} -> ${restoredPolicies}`,
  );

  // ── 5. Clean up ───────────────────────────────────────────────────────
  if (!KEEP) {
    console.log("\n5. Cleaning up...");
    try {
      psql(
        adminUrl,
        `SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '${scratch}';`,
      );
      psql(adminUrl, `DROP DATABASE "${scratch}";`);
      console.log("   scratch database dropped");
    } catch {
      console.log(`   could not drop ${scratch} — drop it by hand`);
    }
    unlinkSync(file);
    console.log("   dump removed");
  } else {
    console.log(`\n5. Kept: database ${scratch}, dump ${file}`);
  }

  console.log("\n" + "─".repeat(56));
  if (mismatches > 0) {
    console.error(`  FAIL  ${mismatches} table(s) did not restore correctly\n`);
    process.exit(1);
  }
  if (!policiesOk) {
    console.error(
      `  WARN  RLS policies differ (${sourcePolicies} -> ${restoredPolicies}).\n` +
        "        Tenant isolation would not be enforced on a restored copy.\n",
    );
    process.exit(1);
  }
  console.log("  PASS  dump readable, all rows restored, RLS intact\n");
}

main();
