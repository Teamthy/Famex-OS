#!/usr/bin/env node
/**
 * CI dependency-audit gate.
 *
 *   npm run audit:deps   (or: node scripts/audit-deps.mjs)
 *
 * Runs `npm audit --audit-level=high --json` and fails if any high- or
 * critical-severity advisory remains — except the scoped, dated exclusions
 * below. npm has no per-advisory ignore flag, so this script is the npm
 * equivalent of `pnpm.auditConfig.ignoreCves`: it filters the audit report
 * before deciding pass/fail, and it never silences the whole audit.
 *
 * Every exclusion must:
 *   - name the exact advisory (GHSA id) and module,
 *   - say why it is safe to ship (the `reason`),
 *   - carry a review date (`until`). When the date passes, the gate fails
 *     until the exclusion is re-justified or removed. When the advisory
 *     disappears from the report (fixed upstream), the gate warns until the
 *     stale entry is removed. Exclusions are reviewed, not forgotten.
 */
import { spawnSync } from "node:child_process";

/** Advisory severities that fail the build. Matches `npm audit --audit-level=high`. */
const GATE_SEVERITIES = new Set(["high", "critical"]);

/**
 * Scoped, dated exclusions.
 * @type {Array<{ advisory: string, module: string, until: string, reason: string }>}
 */
const EXCLUSIONS = [
  {
    // GHSA-vfj7-8cjw-p6xm — braces stack-exhaustion DoS. Every published
    // braces version (<= 3.0.3) is vulnerable and upstream has published no
    // patched release, so no version bump can fix it. The vulnerable code is
    // reached only via micromatch <- fast-glob <- @next/eslint-plugin-next:
    // the ESLint toolchain, which is dev-only and never shipped to users.
    // The brace patterns are compiled from the plugin's own internal glob
    // lists, not from attacker-controlled input, so the DoS is not
    // reachable in production. The only remediation npm offers downgrades
    // eslint-config-next 16.x -> 14.x, which breaks linting for Next 16.
    advisory: "GHSA-vfj7-8cjw-p6xm",
    module: "braces",
    until: "2027-01-09",
    reason:
      "No upstream fix exists (all braces <= 3.0.3 vulnerable); dev-only ESLint toolchain path with non-attacker-controlled patterns. npm's only fix downgrades eslint-config-next to 14.x (breaking).",
  },
];

const GHSA_RE = /GHSA-[a-z0-9]{4}-[a-z0-9]{4}-[a-z0-9]{4}/g;

function ghsaIds(url) {
  return url ? [...String(url).matchAll(GHSA_RE)].map((m) => m[0]) : [];
}

function annotate(level, message) {
  // GitHub Actions workflow command — surfaced in the PR/commit UI and in
  // `gh run view`, which is how this gate is debugged.
  const text = message.replace(/\r?\n/g, "%0A");
  console.log(`::${level} title=Dependency audit::${text}`);
}

function main() {
  const result = spawnSync("npm", ["audit", "--audit-level=high", "--json"], {
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  });
  const stdout = result.stdout || "";

  let report;
  try {
    report = JSON.parse(stdout);
  } catch {
    console.error("Could not parse `npm audit --json` output:");
    console.error(stdout.slice(0, 4000));
    console.error(result.stderr?.slice(0, 2000));
    process.exit(1);
  }

  const vulnerabilities = report.vulnerabilities || {};
  const entries = Object.values(vulnerabilities);

  const allowlisted = new Map(); // GHSA id -> exclusion
  for (const exclusion of EXCLUSIONS) {
    allowlisted.set(exclusion.advisory, exclusion);
  }

  // Resolve exclusions through dependency chains: a module is excluded when
  // every advisory it is vulnerable to is allowlisted and every module it
  // depends on (that is part of the chain) is itself excluded.
  const excluded = new Set();
  let changed = true;
  while (changed) {
    changed = false;
    for (const entry of entries) {
      if (excluded.has(entry.name)) continue;
      const via = Array.isArray(entry.via) ? entry.via : [];
      const advisories = via.filter((v) => typeof v === "object" && v !== null);
      const chainModules = via.filter((v) => typeof v === "string");
      if (advisories.length === 0 && chainModules.length === 0) continue;
      const allAdvisoriesAllowed = advisories.every((v) =>
        ghsaIds(v.url).every((id) => allowlisted.has(id)),
      );
      const chainExcluded = chainModules.every((m) => excluded.has(m));
      if (allAdvisoriesAllowed && chainExcluded) {
        excluded.add(entry.name);
        changed = true;
      }
    }
  }

  const today = new Date();
  const failures = [];
  const excludedShown = [];

  for (const entry of entries) {
    if (excluded.has(entry.name)) {
      excludedShown.push(entry);
      continue;
    }
    if (!GATE_SEVERITIES.has(entry.severity)) continue; // info only (moderate/low)
    const advisories = (Array.isArray(entry.via) ? entry.via : []).filter(
      (v) => typeof v === "object" && v !== null,
    );
    const title = advisories[0]?.title || entry.name;
    const url = advisories[0]?.url || "";
    const fix = entry.fixAvailable;
    const fixText =
      fix && typeof fix === "object"
        ? `fix available: ${fix.name}@${fix.version}${fix.isSemVerMajor ? " (semver-major — review before applying)" : ""}`
        : "no fix available";
    failures.push({
      module: entry.name,
      severity: entry.severity,
      title,
      url,
      fixText,
      range: entry.range,
      nodes: entry.nodes?.length ?? 0,
    });
  }

  // Exclusion hygiene: expired exclusions fail; vanished advisories warn.
  const seenAdvisories = new Set();
  for (const entry of entries) {
    for (const v of Array.isArray(entry.via) ? entry.via : []) {
      if (typeof v === "object" && v !== null) {
        for (const id of ghsaIds(v.url)) seenAdvisories.add(id);
      }
    }
  }
  const expired = [];
  const stale = [];
  for (const exclusion of EXCLUSIONS) {
    if (today.toISOString().slice(0, 10) > exclusion.until) {
      expired.push(exclusion);
    } else if (!seenAdvisories.has(exclusion.advisory)) {
      stale.push(exclusion);
    }
  }

  // ---- report ----
  const meta = report.metadata?.vulnerabilities || {};
  console.log(
    `Dependency audit: ${meta.high ?? 0} high, ${meta.critical ?? 0} critical, ` +
      `${meta.moderate ?? 0} moderate, ${meta.low ?? 0} low (npm audit --audit-level=high).`,
  );

  for (const entry of excludedShown) {
    console.log(
      `  excluded (scoped): ${entry.name} (${entry.severity}) — see scripts/audit-deps.mjs`,
    );
  }
  for (const exclusion of stale) {
    const msg = `Exclusion for ${exclusion.advisory} (${exclusion.module}) is stale — the advisory no longer appears in the audit. Remove it from scripts/audit-deps.mjs.`;
    console.log(`  warning: ${msg}`);
    annotate("warning", msg);
  }

  if (failures.length > 0) {
    console.log("\nFailing advisories (high/critical):");
    for (const f of failures) {
      console.log(`  ${f.severity.toUpperCase()}  ${f.module}@${f.range} — ${f.title}`);
      console.log(`         ${f.url}`);
      console.log(`         ${f.fixText} (${f.nodes} install path(s))`);
      annotate("error", `${f.severity} ${f.module}: ${f.title} (${f.url}) — ${f.fixText}`);
    }
    console.log(
      "\nFix with `npm audit fix` (review semver-major bumps first). If an advisory genuinely " +
        "has no safe fix, add a scoped, dated exclusion in scripts/audit-deps.mjs with a reason.",
    );
  }

  if (expired.length > 0) {
    for (const exclusion of expired) {
      const msg = `Exclusion for ${exclusion.advisory} (${exclusion.module}) expired on ${exclusion.until} — re-review it in scripts/audit-deps.mjs.`;
      console.log(`\nerror: ${msg}`);
      annotate("error", msg);
    }
  }

  if (failures.length > 0 || expired.length > 0) {
    process.exit(1);
  }

  console.log("\nDependency audit passed.");
}

main();
