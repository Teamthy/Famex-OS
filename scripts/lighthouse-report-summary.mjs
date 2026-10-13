#!/usr/bin/env node
/**
 * Emits the Lighthouse CI results of this run as GitHub Actions workflow
 * commands so the numbers are attached to the run as annotations and survive
 * even when the raw logs are gone. Errors for failed assertions, notices for
 * everything else. Reads .lighthouseci/ (lighthouserc.json output).
 */
import { readdirSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const DIR = ".lighthouseci";
if (!existsSync(DIR)) {
  console.log(
    "::error title=Lighthouse CI::.lighthouseci/ does not exist — autorun died before collecting. Check the step log for a Chrome/server crash.",
  );
  process.exit(0);
}

const files = readdirSync(DIR).filter((f) => /^lhr-.*\.json$/.test(f));
const lines = [];
for (const f of files) {
  const d = JSON.parse(readFileSync(join(DIR, f), "utf8"));
  const cat = (id) => d.categories?.[id]?.score;
  const num = (id) => d.audits?.[id]?.numericValue;
  lines.push({
    url: d.finalUrl,
    perf: cat("performance"),
    a11y: cat("accessibility"),
    lcp: num("largest-contentful-paint"),
    fcp: num("first-contentful-paint"),
    tbt: num("total-blocking-time"),
    cls: num("cumulative-layout-shift"),
  });
}
for (const l of lines) {
  const msg = `${l.url} perf=${l.perf} a11y=${l.a11y} LCP=${Math.round(
    l.lcp ?? -1,
  )}ms FCP=${Math.round(l.fcp ?? -1)}ms TBT=${Math.round(l.tbt ?? -1)}ms CLS=${(l.cls ?? -1).toFixed(3)}`;
  console.log(`::notice title=Lighthouse CI::${msg}`);
}

if (existsSync(join(DIR, "assertion-results.json"))) {
  const results = JSON.parse(readFileSync(join(DIR, "assertion-results.json"), "utf8"));
  for (const r of results) {
    const msg = `${r.level} ${r.auditId} on ${r.url}: expected ${r.operator} ${r.expected}, found ${r.actual}, values=${JSON.stringify(
      r.values,
    )}`;
    console.log(
      r.level === "error"
        ? `::error title=Lighthouse CI::${msg}`
        : `::warning title=Lighthouse CI::${msg}`,
    );
  }
  if (results.length === 0) console.log("::notice title=Lighthouse CI::all assertions passed");
}
