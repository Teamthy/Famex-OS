/**
 * Dead-UI guard.
 *
 *   npm run check:dead-ui
 *
 * Finds pages that LOOK functional and are not: an action button with no way
 * to send anything, or a screen built on hardcoded arrays instead of data.
 *
 * ── Why this exists ────────────────────────────────────────────────────────
 * Three separate reports have now traced back to the same thing:
 *
 *   /teacher/messages      rendered a full inbox over `useState<any[]>([])`
 *   /teacher/test-courses  hardcoded Mathematics and Physics, "Save" wrote to
 *                          React state and nothing else
 *   /teacher/send-results  a four-step wizard whose send was
 *                          `Math.random() > 0.1 ? "delivered" : "sent"`
 *
 * Every one passed `tsc`, the test suite, the orphan check and the boundary
 * check, because the code is valid and the component renders. They are only
 * discoverable by a person using the product and noticing nothing happened —
 * which is the worst way to find out, and the way it happened three times.
 *
 * This is a heuristic, not a proof. It reports SUSPICIONS with a reason, and
 * everything it flags is either fixed or listed in ALLOWED with a note. The
 * value is that a NEW dead screen shows up in the diff rather than in a
 * support message six weeks later.
 */
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = process.cwd();
const PORTALS = ["teacher", "admin", "student", "parent", "it-portal", "super-admin"];

/**
 * Known-good pages that trip a heuristic for a legitimate reason.
 * Every entry needs a justification — this list is where dead UI would hide.
 */
const ALLOWED: Record<string, string> = {
  "app/teacher/messages/page.tsx": "delegates to <MessagesInbox>, which owns the fetching",
  "app/parent/messages/page.tsx": "delegates to <MessagesInbox>",
  "app/student/messages/page.tsx": "delegates to <MessagesInbox>",
  "app/admin/messages/page.tsx": "delegates to <MessagesInbox>",
  "app/super-admin/portals/page.tsx":
    "a static launcher: links to other portals, no data of its own",
  "app/teacher/evaluations/page.tsx": "redirect shim",
  "app/teacher/evaluations/create/page.tsx": "redirect shim",
  "app/student/e-exams/page.tsx": "redirect shim",
  "app/teacher/attendance/page.tsx": "redirect shim",
};

type Finding = { file: string; reason: string; detail: string };

function walk(dir: string, out: string[] = []): string[] {
  if (!existsSync(dir)) return out;
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry.startsWith(".")) continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (entry === "page.tsx") out.push(full);
  }
  return out;
}

/**
 * Action verbs that promise a write.
 *
 * Anchored to a JSX text boundary — `>Save` or `>{" "}Save` — because a loose
 * word match is worse than no check. The first version matched "Record" inside
 * "Report Records" and "Enroll" inside a marketing sentence, flagging nine
 * healthy pages. A guard that cries wolf gets ignored, which would leave the
 * real dead screens exactly as hidden as before.
 */
const ACTION_LABEL =
  /(?:>|>\{" "\}|>\s*\n\s*)\s*(Save|Send|Submit|Publish|Approve|Reject|Update|Record|Assign|Enrol|Generate|Grant|Release|Delete|Remove)(?:\s+\w+)?\s*(?:<|\{)/;

const WRITE_CALL = /method:\s*["'`](POST|PATCH|PUT|DELETE)["'`]/;
const DELEGATES = /<(MessagesInbox|[A-Z]\w*Form|[A-Z]\w*Manager|[A-Z]\w*Editor)\b/;

function main() {
  const files = PORTALS.flatMap((portal) => walk(join(ROOT, "app", portal)));
  const findings: Finding[] = [];

  for (const file of files) {
    const rel = relative(ROOT, file).split("\\").join("/");
    if (ALLOWED[rel]) continue;

    const source = readFileSync(file, "utf8");
    // A tiny file is a redirect or a shell, not a screen.
    if (source.split("\n").length < 25) continue;

    const hasAction = ACTION_LABEL.test(source);
    const hasWrite = WRITE_CALL.test(source);
    const hasRead = /fetch\(|useApi|useQuery/.test(source);
    const delegates = DELEGATES.test(source);

    if (hasAction && !hasWrite && !delegates) {
      const match = source.match(ACTION_LABEL);
      findings.push({
        file: rel,
        reason: "action button with no write call",
        detail: `found "${match?.[1]}" but no POST/PATCH/PUT/DELETE in this file`,
      });
      continue;
    }

    if (!hasRead && !delegates) {
      findings.push({
        file: rel,
        reason: "no data call",
        detail: "renders without fetching anything — check for hardcoded state",
      });
      continue;
    }

    // A simulated action: sleeping and inventing a result instead of calling
    // the server. This is exactly what send-results did.
    if (/setTimeout\([^)]*\d{3,}\)/.test(source) && /Math\.random\(\)/.test(source)) {
      findings.push({
        file: rel,
        reason: "looks simulated",
        detail: "a long setTimeout next to Math.random() — a fake result, not a real one",
      });
    }
  }

  console.log(`Checked ${files.length} portal pages.\n`);

  if (!findings.length) {
    console.log("No dead UI found.");
    return;
  }

  for (const finding of findings) {
    console.error(`✗ ${finding.file}`);
    console.error(`    ${finding.reason} — ${finding.detail}\n`);
  }
  console.error(
    `${findings.length} page(s) look functional but may do nothing.\n` +
      "Wire them up, or add them to ALLOWED in this script with a reason.",
  );
  process.exitCode = 1;
}

main();
