/**
 * Logical database backup.
 *
 *   DATABASE_URL="postgresql://..." npm run db:backup
 *   DATABASE_URL="..." npm run db:backup -- --out ./backups
 *
 * Writes a compressed pg_dump custom-format archive, then verifies it by
 * listing its contents — a dump that cannot be listed cannot be restored, and
 * an unverified backup is not a backup.
 *
 * ── Why this script exists rather than a bare pg_dump ──────────────────────
 *
 * The RLS migration sets FORCE ROW LEVEL SECURITY on all 29 tenant tables.
 * FORCE applies to the table OWNER too, so a plain pg_dump as the application
 * role FAILS mid-stream:
 *
 *   pg_dump: error: query failed: ERROR: query would be affected by
 *   row-level security policy for table "AdmissionApplication"
 *
 * Worse, pg_dump can exit 0 having written a truncated file, so the failure is
 * easy to miss in a cron log. The fix is a role with BYPASSRLS (see
 * docs/backup-restore.md); this script checks for that up front and explains
 * the remedy instead of producing a silently broken archive.
 */
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, statSync } from "node:fs";
import path from "node:path";

function fail(message: string): never {
  console.error(`\n${message}\n`);
  process.exit(1);
}

function parseArgs() {
  const args = process.argv.slice(2);
  const outIndex = args.indexOf("--out");
  return { outDir: outIndex >= 0 ? args[outIndex + 1] : "backups" };
}

function main() {
  const url = process.env.DATABASE_URL;
  if (!url) fail("DATABASE_URL is required.");

  try {
    execFileSync("pg_dump", ["--version"], { stdio: "ignore" });
  } catch {
    fail(
      "pg_dump is not installed or not on PATH.\n" +
        "  macOS:  brew install libpq && brew link --force libpq\n" +
        "  Ubuntu: sudo apt-get install postgresql-client\n" +
        "  Windows: install PostgreSQL and add its bin/ folder to PATH",
    );
  }

  const { outDir } = parseArgs();
  if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });

  const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const file = path.join(outDir, `ykay-${stamp}.dump`);

  console.log(`Backing up to ${file} ...`);

  // -Fc  custom format: compressed, and restorable table-by-table
  // --no-owner / --no-privileges: restore into any role (e.g. a Neon branch)
  const dump = spawnSync("pg_dump", [url, "-Fc", "--no-owner", "--no-privileges", "-f", file], {
    encoding: "utf8",
  });

  if (dump.status !== 0 || /row-level security/i.test(dump.stderr || "")) {
    const rls = /row-level security/i.test(dump.stderr || "");
    fail(
      (dump.stderr || "pg_dump failed.").trim() +
        (rls
          ? "\n\nThis is the FORCE ROW LEVEL SECURITY problem. Use a dedicated,\n" +
            "read-only backup role that has BYPASSRLS:\n\n" +
            "    CREATE ROLE ykay_backup LOGIN PASSWORD '<pw>' BYPASSRLS;\n" +
            "    GRANT SELECT ON ALL TABLES IN SCHEMA public TO ykay_backup;\n\n" +
            "Do NOT add BYPASSRLS to the application role — that disables tenant\n" +
            "isolation for every request. See docs/backup-restore.md."
          : ""),
    );
  }

  // A dump that cannot be listed cannot be restored. Verify before reporting success.
  const list = spawnSync("pg_restore", ["--list", file], { encoding: "utf8" });
  if (list.status !== 0) {
    fail(`Backup file is unreadable — treat it as failed.\n${list.stderr}`);
  }

  const entries = (list.stdout || "").split("\n").filter((l) => l && !l.startsWith(";")).length;
  const sizeMb = (statSync(file).size / 1024 / 1024).toFixed(2);

  console.log(`\nBackup complete.`);
  console.log(`  file     ${file}`);
  console.log(`  size     ${sizeMb} MB`);
  console.log(`  objects  ${entries}`);
  console.log(`\nVerify a restore periodically — see docs/backup-restore.md.\n`);
}

main();
