import { existsSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect } from "vitest";

/**
 * Release-path hygiene (B-18 / B-09, remediation roadmap Phase 1).
 *
 * Every assertion here is a regression that already happened once, or a
 * safety property that is invisible until it fails in production:
 *
 * - the OCI notification sidecar sent an invented `x-jobs-secret` header and
 *   swallowed the resulting 401s with `|| true` — notifications queued
 *   forever while the container looked healthy (B-09, P0);
 * - migrations ran inside every app boot, racing restarts and hiding their
 *   outcome in app logs (B-18);
 * - compose images used mutable tags, so `docker compose pull` could deploy
 *   code nobody reviewed (B-18);
 * - CI validated the Expo project with `expo-doctor@latest`, a floating
 *   third-party gate whose behaviour could (and did) change silently;
 * - the dependency gate audited only the root lockfile while the mobile one
 *   carried a critical advisory (roadmap Phase 1: "add a mobile dependency
 *   gate").
 *
 * These are source-level guards because all of the above pass every other
 * test while breaking the release path.
 */

const ROOT = process.cwd();

function text(path: string): string {
  return readFileSync(join(ROOT, path), "utf8");
}

/** Compose with whole-line YAML comments removed — the comments legitimately
 * quote the OLD broken forms (`x-jobs-secret`, `|| true`) to explain the fix,
 * so negative assertions must run against the executable content only. */
function composeCode(): string {
  return text("deploy/oci/docker-compose.yml")
    .split("\n")
    .filter((line) => !line.trimStart().startsWith("#"))
    .join("\n");
}

describe("OCI compose: notification sidecar (B-09)", () => {
  const code = composeCode();

  it("authenticates with the header the route actually accepts", () => {
    expect(code).toContain("Authorization: Bearer $$JOBS_SECRET");
    expect(code, "the invented header must not come back").not.toContain("x-jobs-secret");
  });

  it("fails loudly — no silent `|| true` on any compose command", () => {
    expect(code).not.toMatch(/\|\|\s*true/);
    expect(code, "failed ticks must be logged with their HTTP code").toContain("dispatch FAILED");
  });
});

describe("OCI compose: migrations separated from app boot (B-18)", () => {
  const compose = text("deploy/oci/docker-compose.yml");

  it("has a one-shot migrate service that runs prisma migrate deploy", () => {
    expect(compose).toMatch(/\n {2}migrate:\n/);
    expect(compose).toContain('"migrate", "deploy", "--schema", "prisma/schema.prisma"');
    expect(compose, "the migrate service must never restart in a loop").toContain('restart: "no"');
  });

  it("starts the app only after migrations completed successfully", () => {
    expect(compose).toContain("condition: service_completed_successfully");
    expect(compose).toContain('MIGRATE_ON_BOOT: "false"');
  });

  it("entrypoint honours MIGRATE_ON_BOOT so single-container hosts keep working", () => {
    const entry = text("docker-entrypoint.sh");
    expect(entry).toContain("MIGRATE_ON_BOOT:-true");
    expect(entry).toMatch(/if \[ "\$\{MIGRATE_ON_BOOT:-true\}" = "true" \]; then/);
  });
});

describe("OCI compose: digest pinning mechanism (B-18)", () => {
  const compose = text("deploy/oci/docker-compose.yml");

  it("every image line is env-overridable", () => {
    const images = [...compose.matchAll(/^ {4}image: (.+)$/gm)].map((m) => m[1]);
    expect(images.length, "compose should still define its services").toBeGreaterThanOrEqual(7);
    for (const image of images) {
      expect(image, `image not overridable: ${image}`).toMatch(/^\$\{[A-Z_]+:-/);
    }
  });

  it("the app image supports a digest-pinned FAMEX_IMAGE override", () => {
    expect(compose).toContain("${FAMEX_IMAGE:-");
  });

  it("ships an executable pin-image.sh that resolves digests", () => {
    const path = join(ROOT, "deploy/oci/pin-image.sh");
    expect(existsSync(path)).toBe(true);
    expect(statSync(path).mode & 0o111, "pin-image.sh must be executable").not.toBe(0);
    const script = text("deploy/oci/pin-image.sh");
    expect(script).toContain("imagetools inspect");
    expect(script, "must construct an immutable ref@sha256: pin").toContain("@${digest}");
  });
});

describe("Dependabot (B-18)", () => {
  it("covers root npm, mobile npm, github-actions and docker ecosystems", () => {
    const cfg = text(".github/dependabot.yml");
    expect(cfg).toContain("package-ecosystem: npm");
    expect(cfg).toContain('directory: "/"');
    expect(cfg).toContain('directory: "/mobile"');
    expect(cfg).toContain("package-ecosystem: github-actions");
    expect(cfg).toContain("package-ecosystem: docker");
    expect(cfg, "weekly cadence").toContain("interval: weekly");
  });
});

describe("CI gates (B-18)", () => {
  const ci = text(".github/workflows/ci.yml");

  it("pins expo-doctor instead of floating @latest", () => {
    expect(ci).not.toContain("expo-doctor@latest");
    expect(ci).toMatch(/expo-doctor@\d+\.\d+\.\d+/);
  });

  it("audits both dependency scopes through the dual-scope script", () => {
    expect(ci).toContain("npm run audit:deps");
    const script = text("scripts/audit-deps.mjs");
    expect(script).toContain('"--prefix", "mobile"');
  });

  it("keeps every audit-deps exclusion scoped, dated and reasoned", () => {
    const script = text("scripts/audit-deps.mjs");
    // Trailing commas anchor these to real entries — the JSDoc @type line
    // (scope: "root"|"mobile", until: string, …) must not be counted.
    const entries = [...script.matchAll(/advisory: "GHSA-[a-z0-9-]+",/g)].length;
    const scopes = [...script.matchAll(/scope: "(?:root|mobile)",/g)].length;
    const untils = [...script.matchAll(/until: "\d{4}-\d{2}-\d{2}",/g)].length;
    const reasons = [...script.matchAll(/reason:\s*$/gm)].length;
    expect(scopes, "every exclusion names its scope").toBe(entries);
    expect(untils, "every exclusion has a review date").toBe(entries);
    expect(reasons, "every exclusion has a reason").toBeGreaterThanOrEqual(entries);
  });
});

describe("expo-doctor directory check (documented tradeoff)", () => {
  it("is disabled in mobile/package.json only alongside the governance note", () => {
    const pkg = JSON.parse(text("mobile/package.json")) as {
      expo?: { doctor?: { reactNativeDirectoryCheck?: { enabled?: boolean } } };
    };
    expect(pkg.expo?.doctor?.reactNativeDirectoryCheck?.enabled).toBe(false);
    const gov = text("docs/RELEASE-GOVERNANCE.md");
    expect(gov, "the re-enable step must stay documented").toContain(
      "reactNativeDirectoryCheck.enabled:false",
    );
    const ci = text(".github/workflows/ci.yml");
    expect(ci, "the CI comment must keep the dataset-verification record").toContain(
      "react-native-libraries.json",
    );
  });
});
