/**
 * Orphaned page guard.
 *
 *   npm run check:orphans
 *
 * Fails if a portal page exists but nothing links to it.
 *
 * ── Why this exists ────────────────────────────────────────────────────────
 * A teacher reported they could not find where to upload question files. The
 * page existed, worked, and had been built two drops earlier — it simply was
 * not in the sidebar, and was reachable only by clicking through from an
 * already-created exam. Fifteen teacher pages were in that state.
 *
 * That is the worst kind of bug to find by testing: every automated check
 * passes, because the page renders perfectly. It only surfaces when a real
 * person goes looking for a feature and concludes it was never built.
 *
 * A page is considered reachable if any OTHER file references its route —
 * a sidebar, a dashboard tile, a redirect, a card link. This deliberately
 * does not require sidebar presence: a page linked from a relevant dashboard
 * is genuinely findable.
 *
 * Exits non-zero, listing the orphans, so it can gate a merge.
 */
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = process.cwd();
const APP = join(ROOT, "app");

/**
 * Routes that are legitimately unlinked.
 *
 * Keep this list short and justified — every entry is a place the guard has
 * been told to stop looking.
 */
const ALLOWED_ORPHANS = new Set([
  // Entered by URL from an email, QR code, or an external redirect.
  "/verify/report",
  "/staff/activate",
  "/reset-password",
  "/forgot-password",
  "/login",
  "/logout",
  "/change-password",
  "/download",
  "/it-portal/auth",
  // Landing/marketing routes reached from the public site shell.
  "/",
  // Pure redirect shims kept so old links and bookmarks resolve.
  "/student/e-exams",
  // Reached from /teacher/evaluations, which is itself reached from the
  // teacher dashboard once evaluations are enabled for the term.
  "/teacher/evaluations/create",
  // Opened from an exam's "Add instructions" action, with the exam id.
  "/teacher/add-instructions",
  // Superseded by /teacher/performance-records; kept while staff transition.
  "/teacher/performance",
  // Linked from the class roster's announcement action.
  "/teacher/class/announcements",
  // Reached from the teacher dashboard's evaluation card.
  "/teacher/evaluations",
]);

/** Portal areas where an unreachable page means a lost feature. */
const PORTAL_PREFIXES = ["/teacher", "/admin", "/student", "/parent", "/it-portal", "/super-admin"];

function pageRoutes(dir: string, out: string[] = []): string[] {
  if (!existsSync(dir)) return out;
  for (const entry of readdirSync(dir)) {
    if (entry.startsWith("_") || entry === "api") continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      pageRoutes(full, out);
    } else if (entry === "page.tsx" || entry === "page.jsx") {
      const route = "/" + relative(APP, dir).split("\\").join("/");
      // Route groups like (student) are not part of the URL.
      out.push(route.replace(/\/\([^)]+\)/g, "") || "/");
    }
  }
  return out;
}

function sourceFiles(dir: string, out: string[] = []): string[] {
  if (!existsSync(dir)) return out;
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry.startsWith(".")) continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) sourceFiles(full, out);
    else if (/\.(tsx?|jsx?)$/.test(entry)) out.push(full);
  }
  return out;
}

function main() {
  const routes = [...new Set(pageRoutes(APP))]
    .filter((route) => PORTAL_PREFIXES.some((prefix) => route.startsWith(prefix)))
    .filter((route) => !ALLOWED_ORPHANS.has(route))
    // A dynamic segment is always entered from a link that builds it.
    .filter((route) => !route.includes("["));

  const files = [...sourceFiles(join(ROOT, "app")), ...sourceFiles(join(ROOT, "components"))];

  // Index every file's text once — this runs on every push, so it must be fast.
  const contents = new Map<string, string>();
  for (const file of files) contents.set(file, readFileSync(file, "utf8"));

  const orphans: string[] = [];

  for (const route of routes) {
    const ownPage = join(APP, route.slice(1), "page.tsx");
    let linked = false;

    for (const [file, text] of contents) {
      // A page linking to itself proves nothing.
      if (file === ownPage) continue;
      // Match the route as a quoted string or a template prefix, so
      // /teacher/exam-center does not count as a link to /teacher/exam.
      if (
        text.includes(`"${route}"`) ||
        text.includes(`'${route}'`) ||
        text.includes(`\`${route}\``) ||
        text.includes(`${route}?`) ||
        text.includes(`${route}/`)
      ) {
        linked = true;
        break;
      }
    }

    if (!linked) orphans.push(route);
  }

  if (!orphans.length) {
    console.log(`All ${routes.length} portal pages are reachable.`);
    return;
  }

  console.error(`${orphans.length} portal page(s) exist but nothing links to them:\n`);
  for (const route of orphans.sort()) console.error(`  ✗ ${route}`);
  console.error(
    "\nA page nobody can navigate to is a feature nobody knows was built.\n" +
      "Add it to a sidebar or a dashboard, or list it in ALLOWED_ORPHANS with a reason.",
  );
  process.exitCode = 1;
}

main();
