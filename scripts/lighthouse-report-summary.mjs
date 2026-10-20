#!/usr/bin/env node
/**
 * Emits the Lighthouse CI results of this run as GitHub Actions workflow
 * commands so the numbers are attached to the run as annotations and survive
 * even when the raw logs are gone.
 *
 * Failed assertions are emitted first, and both assertions and metrics are
 * aggregated by URL. GitHub only keeps a small number of annotations per job,
 * so one message per Lighthouse run would push the actual failures out of the
 * visible set. With the public URLs in lighthouserc.json this stays compact:
 * at most one error, one warning, and one metrics notice per URL.
 * Reads .lighthouseci/ (lighthouserc.json output).
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const DIR = ".lighthouseci";

function escapeData(value) {
  return String(value).replaceAll("%", "%25").replaceAll("\r", "%0D").replaceAll("\n", "%0A");
}

function emit(level, message) {
  console.log(`::${level} title=Lighthouse CI::${escapeData(message)}`);
}

function formatValue(value) {
  if (value === undefined) return "n/a";
  return typeof value === "string" ? value : JSON.stringify(value);
}

if (!existsSync(DIR)) {
  emit(
    "error",
    ".lighthouseci/ does not exist — autorun died before collecting. Check the step log for a Chrome/server crash.",
  );
  process.exit(0);
}

const assertionPath = join(DIR, "assertion-results.json");
if (existsSync(assertionPath)) {
  const parsed = JSON.parse(readFileSync(assertionPath, "utf8"));
  const results = Array.isArray(parsed) ? parsed : [];

  if (results.length === 0) {
    emit("notice", "all assertions passed");
  } else {
    const groups = new Map();

    for (const result of results) {
      const level = result.level ?? "warning";
      const url = result.url ?? "unknown URL";
      const key = `${level}\0${url}`;
      const detail = `${result.auditId}: expected ${result.operator} ${formatValue(
        result.expected,
      )}, found ${formatValue(result.actual)}, values=${formatValue(result.values)}`;

      if (!groups.has(key)) groups.set(key, { level, url, details: [] });
      groups.get(key).details.push(detail);
    }

    const levelRank = { error: 0, warning: 1 };
    const sortedGroups = [...groups.values()].sort((a, b) => {
      const rankDelta = (levelRank[a.level] ?? 2) - (levelRank[b.level] ?? 2);
      return rankDelta === 0 ? a.url.localeCompare(b.url) : rankDelta;
    });

    for (const group of sortedGroups) {
      emit(
        group.level === "error" ? "error" : "warning",
        `${group.url}: ${group.details.join("; ")}`,
      );
    }
  }
} else {
  emit("warning", "assertion-results.json is missing; collected metrics only are shown below.");
}

const files = readdirSync(DIR)
  .filter((file) => /^lhr-.*\.json$/.test(file))
  .sort();

if (files.length === 0) {
  emit("error", "No lhr-*.json reports exist — autorun died before producing metrics.");
  process.exit(0);
}

const reportsByUrl = new Map();
for (const file of files) {
  const report = JSON.parse(readFileSync(join(DIR, file), "utf8"));
  const category = (id) => report.categories?.[id]?.score;
  const numeric = (id) => report.audits?.[id]?.numericValue;
  const url = report.finalDisplayedUrl ?? report.finalUrl ?? report.requestedUrl ?? "unknown URL";

  if (!reportsByUrl.has(url)) reportsByUrl.set(url, []);
  reportsByUrl.get(url).push({
    perf: category("performance"),
    a11y: category("accessibility"),
    lcp: numeric("largest-contentful-paint"),
    fcp: numeric("first-contentful-paint"),
    tbt: numeric("total-blocking-time"),
    cls: numeric("cumulative-layout-shift"),
  });
}

function median(values) {
  const middle = Math.floor(values.length / 2);
  return values.length % 2 === 0 ? (values[middle - 1] + values[middle]) / 2 : values[middle];
}

function formatMetric(values, formatter) {
  const numbers = values.filter(Number.isFinite).sort((a, b) => a - b);
  if (numbers.length === 0) return "n/a";

  const middle = formatter(median(numbers));
  const first = numbers[0];
  const last = numbers[numbers.length - 1];
  return first === last ? middle : `${middle} (${formatter(first)}-${formatter(last)})`;
}

const formatScore = (value) => value.toFixed(2);
const formatMs = (value) => `${Math.round(value)}ms`;
const formatCls = (value) => value.toFixed(3);

for (const [url, reports] of [...reportsByUrl.entries()].sort(([a], [b]) => a.localeCompare(b))) {
  const values = (key) => reports.map((report) => report[key]);
  const runLabel = reports.length === 1 ? "1 run" : `${reports.length} runs`;

  emit(
    "notice",
    `${url} (${runLabel}) perf=${formatMetric(values("perf"), formatScore)} a11y=${formatMetric(
      values("a11y"),
      formatScore,
    )} LCP=${formatMetric(values("lcp"), formatMs)} FCP=${formatMetric(
      values("fcp"),
      formatMs,
    )} TBT=${formatMetric(values("tbt"), formatMs)} CLS=${formatMetric(values("cls"), formatCls)}`,
  );
}
