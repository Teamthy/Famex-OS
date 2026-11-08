#!/usr/bin/env node
/**
 * CI dependency-audit gate.
 *
 *   npm run audit:deps   (or: node scripts/audit-deps.mjs)
 *
 * Runs `npm audit --audit-level=high --json` for BOTH dependency scopes —
 * the root web app and the Expo mobile app (`--prefix mobile`, added
 * 2026-11-08 for remediation-roadmap Phase 1: "triage mobile advisories by
 * runtime/build reachability; add a mobile dependency gate") — and fails if
 * any high- or critical-severity advisory remains, except the scoped, dated
 * exclusions below. npm has no per-advisory ignore flag, so this script is
 * the npm equivalent of `pnpm.auditConfig.ignoreCves`: it filters the audit
 * report before deciding pass/fail, and it never silences the whole audit.
 *
 * Every exclusion must:
 *   - name the exact advisory (GHSA id), module and scope ("root"|"mobile"),
 *   - say why it is safe to ship (the `reason`), including reachability,
 *   - carry a review date (`until`). When the date passes, the gate fails
 *     until the exclusion is re-justified or removed. When the advisory
 *     disappears from the report (fixed upstream), the gate warns until the
 *     stale entry is removed. Exclusions are reviewed, not forgotten.
 */
import { spawnSync } from "node:child_process";

/** Advisory severities that fail the build. Matches `npm audit --audit-level=high`. */
const GATE_SEVERITIES = new Set(["high", "critical"]);

/** The two lockfiles this gate covers. */
const SCOPES = [
  { label: "root", npmArgs: ["audit", "--audit-level=high", "--json"] },
  { label: "mobile", npmArgs: ["audit", "--prefix", "mobile", "--audit-level=high", "--json"] },
];

/**
 * Scoped, dated exclusions.
 * @type {Array<{ advisory: string, module: string, scope: "root"|"mobile", until: string, reason: string }>}
 *
 * Root is kept EMPTY on purpose: the previous braces exclusion went stale
 * once the ESLint chain stopped pulling a vulnerable braces, and the gate
 * warns on stale entries. Add an exclusion only when no patched release
 * exists AND the reachability argument is written down; re-review it before
 * `until`.
 */
const EXCLUSIONS = [
  {
    // decode-uri-component DoS advisories, reachable only through
    // query-string <- expo-router. expo-router is pinned to the Expo SDK 54
    // line (~6.0.x); npm's only fix is expo-router 58.x, a semver-major that
    // drags the whole Expo SDK stack with it — that is the planned SDK
    // upgrade workstream, not a security patch this gate can take in-place.
    // Reachability: expo-router parses deep links / route params with
    // query-string on the USER'S OWN DEVICE. A crafted link can at worst
    // hang that one app instance until restart — no server, money, exam or
    // child-data path touches this decoder, and the web app uses Node/Next
    // URL parsing, not this package. Re-review at the SDK upgrade and before
    // `until`; remove immediately if a 6.x-line fix ships.
    advisory: "GHSA-vcc3-ghjq-m6fr",
    module: "decode-uri-component",
    scope: "mobile",
    until: "2027-01-08",
    reason:
      "Transitive via query-string <- expo-router (pinned to SDK 54 line); only fix is the expo-router 58.x semver-major (whole-SDK upgrade workstream). Reachability limited to on-device deep-link parsing — worst case a transient hang of the user's own app instance.",
  },
  {
    advisory: "GHSA-qr28-fpjm-wq7f",
    module: "decode-uri-component",
    scope: "mobile",
    until: "2027-01-08",
    reason:
      "Same chain and reachability as GHSA-vcc3-ghjq-m6fr (quadratic-replacement variant); blocked on the same expo-router SDK-major upgrade.",
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

function runAudit({ label, npmArgs }) {
  const result = spawnSync("npm", npmArgs, {
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  });
  const stdout = result.stdout || "";

  let report;
  try {
    report = JSON.parse(stdout);
  } catch {
    console.error(`Could not parse \`npm audit --json\` output for scope "${label}":`);
    console.error(stdout.slice(0, 4000));
    console.error(result.stderr?.slice(0, 2000));
    process.exit(1);
  }

  const vulnerabilities = report.vulnerabilities || {};
  const entries = Object.values(vulnerabilities);
  const scopeExclusions = EXCLUSIONS.filter((e) => e.scope === label);

  const allowlisted = new Map(); // GHSA id -> exclusion
  for (const exclusion of scopeExclusions) {
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
  const today = new Date();
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
  for (const exclusion of scopeExclusions) {
    if (today.toISOString().slice(0, 10) > exclusion.until) {
      expired.push(exclusion);
    } else if (!seenAdvisories.has(exclusion.advisory)) {
      stale.push(exclusion);
    }
  }

  return {
    label,
    meta: report.metadata?.vulnerabilities || {},
    failures,
    excludedShown,
    expired,
    stale,
  };
}

function main() {
  const results = SCOPES.map(runAudit);
  let failing = false;

  for (const r of results) {
    console.log(
      `[${r.label}] Dependency audit: ${r.meta.high ?? 0} high, ${r.meta.critical ?? 0} critical, ` +
        `${r.meta.moderate ?? 0} moderate, ${r.meta.low ?? 0} low (npm audit --audit-level=high).`,
    );

    for (const entry of r.excludedShown) {
      console.log(
        `  excluded (scoped): ${entry.name} (${entry.severity}) — see scripts/audit-deps.mjs`,
      );
    }
    for (const exclusion of r.stale) {
      const msg = `[${r.label}] Exclusion for ${exclusion.advisory} (${exclusion.module}) is stale — the advisory no longer appears in the audit. Remove it from scripts/audit-deps.mjs.`;
      console.log(`  warning: ${msg}`);
      annotate("warning", msg);
    }

    if (r.failures.length > 0) {
      console.log(`\n[${r.label}] Failing advisories (high/critical):`);
      for (const f of r.failures) {
        console.log(`  ${f.severity.toUpperCase()}  ${f.module}@${f.range} — ${f.title}`);
        console.log(`         ${f.url}`);
        console.log(`         ${f.fixText} (${f.nodes} install path(s))`);
        annotate(
          "error",
          `${r.label} ${f.severity} ${f.module}: ${f.title} (${f.url}) — ${f.fixText}`,
        );
      }
      console.log(
        `\nFix with \`npm audit fix${r.label === "mobile" ? " --prefix mobile" : ""}\` (review semver-major bumps first). ` +
          "If an advisory genuinely has no safe fix, add a scoped, dated exclusion in scripts/audit-deps.mjs with a reason.",
      );
    }

    if (r.expired.length > 0) {
      for (const exclusion of r.expired) {
        const msg = `[${r.label}] Exclusion for ${exclusion.advisory} (${exclusion.module}) expired on ${exclusion.until} — re-review it in scripts/audit-deps.mjs.`;
        console.log(`\nerror: ${msg}`);
        annotate("error", msg);
      }
    }

    if (r.failures.length > 0 || r.expired.length > 0) failing = true;
  }

  if (failing) {
    process.exit(1);
  }

  console.log("\nDependency audit passed (root + mobile).");
}

main();
