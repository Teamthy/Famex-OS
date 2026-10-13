/**
 * Removes local inject/build artifacts that should not ship in production deploys.
 * Safe defaults: does not delete .env or prisma data.
 *
 *   npm run cleanup:artifacts
 *   npm run cleanup:artifacts -- --dry-run
 */
import { existsSync, rmSync, statSync, readdirSync } from "fs";
import { join } from "path";

const dry = process.argv.includes("--dry-run");
const root = process.cwd();

const PATTERNS = [
  /^phase-.*ingest.*\.ps1$/i,
  /^phase-.*hotfix.*\.ps1$/i,
  /^Inject-.*\.ps1$/i,
  /^FULL_PHASE.*\.ps1$/i,
  /^YKAY_Phase.*Inject\.ps1$/i,
  /^phase-.*-ingest-b64\.ps1$/i,
];

const DIRS = ["_backups", "screens", "deliverables", ".data"];

function listRootFiles() {
  return readdirSync(root).filter((name) => {
    try {
      return statSync(join(root, name)).isFile();
    } catch {
      return false;
    }
  });
}

let removed = 0;
for (const name of listRootFiles()) {
  if (PATTERNS.some((re) => re.test(name))) {
    const full = join(root, name);
    console.log(`${dry ? "DRY " : ""}DEL file ${name}`);
    if (!dry) rmSync(full, { force: true });
    removed += 1;
  }
}

for (const dir of DIRS) {
  const full = join(root, dir);
  if (existsSync(full)) {
    console.log(`${dry ? "DRY " : ""}DEL dir  ${dir}/`);
    if (!dry) rmSync(full, { recursive: true, force: true });
    removed += 1;
  }
}

console.log(
  dry ? `\nDry-run complete (${removed} targets).` : `\nRemoved ${removed} artifact targets.`,
);
console.log("Kept: source app/, prisma/, public/, .env* (not touched).");
