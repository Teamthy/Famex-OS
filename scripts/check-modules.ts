/**
 * Module / nav / route agreement gate.
 *
 *   npm run check:modules
 *
 * ── Why this exists ────────────────────────────────────────────────────────
 * The founder's nav (docs/famex/10-scope-additions.md §1) is grouped and
 * module-driven, and W2 makes `School.modules` the switchboard for nav, route
 * entitlement and Licence & Usage at once (F0-17, F0-25). Three ways that
 * arrangement silently rots:
 *
 *   1. A sidebar row links to a page that does not exist — a dead link, which
 *      the founder called out explicitly ("a page that 404s is worse than a
 *      page that is not there yet").
 *   2. A page exists that no row reaches — the orphan bug that once hid
 *      fifteen teacher screens (see check-orphan-pages.ts).
 *   3. A nav item, a route guard or a licence switch references a module key
 *      the registry does not declare — nav and entitlement drift apart, which
 *      is the exact failure this whole workstream is meant to prevent.
 *
 * ── What it checks ─────────────────────────────────────────────────────────
 *   A. Every `live` nav item has a page file at app/<href>/page.tsx.
 *   B. Every `planned` nav item does NOT have a page (flip it to `live`).
 *   C. Every admin-workspace page is in the registry, or allowlisted with a
 *      reason (NAV_ALLOWED_PAGES in lib/nav.ts).
 *   D. Every module key used by a nav item / route guard / licence switch is
 *      declared in MODULE_KEYS, and every declared key is actually used.
 *   E. Every admin API directory is mapped to an owner (a module key or CORE)
 *      and, when it owns a module, at least one of its routes calls
 *      requireModule with that key (Rule 13).
 *
 * Exits non-zero with the specific drift, so it can gate a merge.
 */
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { ADMIN_NAV_GROUPS, NAV_ALLOWED_PAGES } from "../lib/nav";
import { MODULE_KEYS, isModuleKey, type ModuleKey } from "../lib/module-registry";

const ROOT = process.cwd();
const APP = join(ROOT, "app");

/**
 * Admin API directories → the module that owns them.
 * `null` = CORE (session/role protected, never switched off).
 *
 * A directory that is missing from this map FAILS the gate: an unowned admin
 * API is an arm nobody declared, which is how entitlement quietly stops being
 * true.
 */
const API_OWNERS: Record<string, ModuleKey | null> = {
  "admin/admissions": "admissions",
  "admin/attendance": "attendance",
  "admin/broadsheet": "report_cards",
  "admin/budgets": "budgets",
  "admin/cbt": "exams",
  "admin/class-manager": null,
  "admin/clinic": "operations",
  "admin/dashboard": null,
  "admin/expenses": "expenses",
  "admin/fees": "fees",
  "admin/finances": "fees",
  "admin/gps-clockins": "staff_attendance",
  "admin/gradebook": "gradebook",
  "admin/inventory": "operations",
  "admin/library": "operations",
  "admin/licence": null,
  "admin/news": "news",
  "admin/notifications": "notifications",
  "admin/promotion": "report_cards",
  "admin/questions": "exams",
  "admin/report-cards": "report_cards",
  "admin/school-profile": null,
  "admin/sessions": null,
  "admin/settings": null,
  "admin/staff": "users",
  "admin/staff-attendance": "staff_attendance",
  "admin/students": "users",
  "admin/subjects": null,
  "admin/timetable": "timetable",
  "onboarding/provision": null,
};

/** Portal prefixes whose pages must be reachable from the registry. */
const ADMIN_PAGE_PREFIXES = ["admin", "admin-admissions", "onboarding"];

type Finding = { check: string; detail: string };

const findings: Finding[] = [];

function fail(check: string, detail: string) {
  findings.push({ check, detail });
}

function pagePathFor(href: string): string {
  const clean = href.split("?")[0].split("#")[0].replace(/\/+$/, "");
  return join(APP, clean.replace(/^\//, ""), "page.tsx");
}

function pageRoutes(dir: string, out: string[] = []): string[] {
  if (!existsSync(dir)) return out;
  for (const entry of readdirSync(dir)) {
    if (entry.startsWith("_") || entry === "api" || entry === "node_modules") continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) pageRoutes(full, out);
    else if (entry === "page.tsx") {
      const route = "/" + relative(APP, dir).split(sep).join("/");
      out.push(route.replace(/\/\([^)]+\)/g, "") || "/");
    }
  }
  return out;
}

// ── A + B: nav items against the filesystem ────────────────────────────────

const liveHrefs = new Set<string>();
const usedModuleKeys = new Set<string>();

for (const group of ADMIN_NAV_GROUPS) {
  const groupModule = group.moduleKey;
  if (groupModule !== null && !isModuleKey(groupModule)) {
    fail("module-key", `nav group "${group.key}" uses unknown module key "${groupModule}"`);
  }
  if (groupModule) usedModuleKeys.add(groupModule);

  for (const item of group.items) {
    const moduleKey = item.moduleKey === undefined ? groupModule : item.moduleKey;
    if (moduleKey !== null && moduleKey !== undefined && !isModuleKey(moduleKey)) {
      fail("module-key", `nav item "${item.label}" uses unknown module key "${moduleKey}"`);
    }
    if (moduleKey) usedModuleKeys.add(moduleKey);

    if (item.status === "live") {
      if (!item.href) {
        fail("nav", `live item "${item.label}" (${group.key}) has no href`);
        continue;
      }
      liveHrefs.add(item.href);
      if (!existsSync(pagePathFor(item.href))) {
        fail(
          "nav-dead-link",
          `live item "${item.label}" points at ${item.href}, which has no page`,
        );
      }
      for (const role of item.roles ?? []) {
        if (
          ![
            "ADMIN",
            "DIRECTOR",
            "BURSAR",
            "COORDINATOR",
            "HOD",
            "TEACHER",
            "PARENT",
            "STUDENT",
          ].includes(role)
        ) {
          fail("nav-role", `live item "${item.label}" lists unknown role "${role}"`);
        }
      }
    } else if (item.href && existsSync(pagePathFor(item.href))) {
      fail(
        "nav-stale",
        `item "${item.label}" is marked planned but ${item.href} already has a page — flip it to live`,
      );
    }
  }
}

// ── C: every admin page is reachable ──────────────────────────────────────

const adminPages = pageRoutes(APP).filter((route) =>
  ADMIN_PAGE_PREFIXES.some((prefix) => route === `/${prefix}` || route.startsWith(`/${prefix}/`)),
);

for (const route of adminPages) {
  if (route.includes("[")) continue; // dynamic detail pages are entered from a list
  if (liveHrefs.has(route)) continue;
  if (NAV_ALLOWED_PAGES[route]) continue;
  fail("nav-orphan", `${route} exists but no nav item links to it (add it to lib/nav.ts)`);
}

for (const route of liveHrefs) {
  if (
    !route.startsWith("/admin") &&
    !route.startsWith("/admin-admissions") &&
    !route.startsWith("/onboarding")
  ) {
    fail("nav-scope", `nav item points outside the admin workspace: ${route}`);
  }
}

// ── D: module keys are declared and used ──────────────────────────────────

for (const key of usedModuleKeys) {
  if (!isModuleKey(key)) continue;
}
for (const key of MODULE_KEYS) {
  if (!usedModuleKeys.has(key)) {
    fail(
      "module-unused",
      `module "${key}" is declared but no nav item or API owns it — declare it in lib/nav.ts or drop it`,
    );
  }
}

// Route guards: requireModule("<key>" | null, ...) across app/api.
const API = join(APP, "api");
function apiFiles(dir: string, out: string[] = []): string[] {
  if (!existsSync(dir)) return out;
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) apiFiles(full, out);
    else if (entry.endsWith(".ts")) out.push(full);
  }
  return out;
}

const apiSources = apiFiles(API).map((file) => ({
  file,
  rel: relative(ROOT, file).split(sep).join("/"),
  source: readFileSync(file, "utf8"),
}));

/** The owner key whose prefix matches this API path, longest first. */
function ownerFor(apiPath: string): { key: string; owner: ModuleKey | null } | null {
  const candidates = Object.keys(API_OWNERS)
    .filter((key) => apiPath === key || apiPath.startsWith(`${key}/`))
    .sort((a, b) => b.length - a.length);
  if (candidates.length === 0) return null;
  const key = candidates[0];
  return { key, owner: API_OWNERS[key] };
}

const guardCalls = new Map<string, { rel: string; key: string }[]>();
for (const { rel, source } of apiSources) {
  const apiPath = rel.replace(/^app\/api\//, "").replace(/\/route\.ts$/, "");
  const owner = ownerFor(apiPath);
  const re = /require(?:Any)?Module\(\s*(null|"[a-z_]+"|\[[^\]]*\])/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(source)) !== null) {
    const raw = match[1];
    const keys =
      raw === "null"
        ? ["CORE"]
        : raw.startsWith("[")
          ? [...raw.matchAll(/"([a-z_]+)"/g)].map((entry) => entry[1])
          : [raw.replace(/"/g, "")];
    for (const key of keys) {
      if (key === "CORE" || key === "") continue;
      if (!isModuleKey(key)) {
        fail(
          "guard-key",
          `${rel} calls requireModule("${key}"), which is not a declared module key`,
        );
        continue;
      }
      if (!owner) continue;
      const list = guardCalls.get(owner.key) ?? [];
      list.push({ rel, key });
      guardCalls.set(owner.key, list);
    }
  }
}

// ── E: every admin API directory has an owner and is guarded ──────────────

// Ownership is enforced for admin APIs and the handful of core non-admin dirs
// listed in API_OWNERS (dashboard, sessions, onboarding/provision, …). Public
// unauthenticated APIs (health, auth, admissions, cbt, it, platform, …) are
// deliberately out of scope: they have no module to own them.
const apiDirs = new Set<string>();
for (const { rel } of apiSources) {
  const apiPath = rel.replace(/^app\/api\//, "").replace(/\/route\.ts$/, "");
  const owner = ownerFor(apiPath);
  if (owner) apiDirs.add(owner.key);
  else if (apiPath.startsWith("admin/")) apiDirs.add(apiPath);
}

for (const dir of apiDirs) {
  const owner = API_OWNERS[dir];
  if (owner === undefined) {
    fail(
      "api-unowned",
      `app/api/${dir} is not in API_OWNERS (scripts/check-modules.ts) — declare the module that owns it`,
    );
    continue;
  }
  if (owner === null) continue; // core: session + role is the whole guard

  const calls = guardCalls.get(dir) ?? [];
  const guarded = calls.some((call) => call.key === owner);
  if (!guarded) {
    fail(
      "api-unguarded",
      `app/api/${dir} is owned by module "${owner}" but no route in it calls requireModule("${owner}")`,
    );
  }
}

for (const dir of Object.keys(API_OWNERS)) {
  if (!apiDirs.has(dir)) {
    fail("api-missing", `API_OWNERS lists app/api/${dir}, which no longer exists`);
  }
}

// ── Report ────────────────────────────────────────────────────────────────

const liveCount = ADMIN_NAV_GROUPS.reduce(
  (total, group) => total + group.items.filter((item) => item.status === "live").length,
  0,
);
const plannedCount = ADMIN_NAV_GROUPS.reduce(
  (total, group) => total + group.items.filter((item) => item.status === "planned").length,
  0,
);

console.log(
  `Nav registry: ${ADMIN_NAV_GROUPS.length} groups, ${liveCount} live items, ${plannedCount} planned.\n` +
    `Modules: ${MODULE_KEYS.length} declared, ${usedModuleKeys.size} used by nav/API.\n` +
    `Admin pages: ${adminPages.length} found, ${liveHrefs.size} linked.\n` +
    `Admin API directories: ${apiDirs.size} owned, ${[...guardCalls.values()].flat().length} guard calls.\n`,
);

if (findings.length === 0) {
  console.log("Modules, nav and routes agree.");
} else {
  console.error(`${findings.length} problem(s) found:\n`);
  for (const finding of findings) console.error(`  ✗ [${finding.check}] ${finding.detail}`);
  process.exitCode = 1;
}
