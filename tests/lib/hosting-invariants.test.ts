import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Hosting invariants.
 *
 * These are not style checks. Each one is a fact a hosting decision rests on,
 * and each was discovered by reading the code rather than assuming it:
 *
 *  1. **The app is single-writer.** Migrations, cron and the disk-backed module
 *     store all assume exactly one process owns the database. Two hosts would
 *     mean two writers. `docs/VERCEL-OCI-DEPLOY.md` says so in prose; the cron
 *     declaration is where it becomes easy to violate by accident.
 *  2. **Three modules write to the local filesystem.** That is why Vercel
 *     Functions cannot serve production traffic for them — the disk is
 *     per-instance and ephemeral. If someone moves them to Prisma, this test
 *     should fail and force the hosting document to be updated.
 *  3. **The runtime is pinned.** Vercel defaults new projects to Node 26.x; every
 *     test and build in this repo ran on 22.x. An unpinned engine means the
 *     deploy runs a runtime nothing was verified on.
 */

const ROOT = process.cwd();
const read = (p: string) => readFileSync(join(ROOT, p), "utf8");

describe("single writer", () => {
  it("declares exactly one cron entry, so the job cannot run on two hosts", () => {
    const vercel = JSON.parse(read("vercel.json")) as {
      crons?: Array<{ path: string; schedule: string }>;
    };
    expect(vercel.crons).toHaveLength(1);
    expect(vercel.crons?.[0].path).toBe("/api/jobs/dispatch-notifications");
  });

  it("the notify job is the same one the OCI timers call", () => {
    // If these drift, one environment silently stops notifying.
    const vercel = JSON.parse(read("vercel.json")) as { crons: Array<{ path: string }> };
    const timer = read("deploy/oci/famex-notify.timer");
    expect(timer.length).toBeGreaterThan(0);
    const service = read("deploy/oci/famex-notify.service");
    expect(vercel.crons[0].path.replace("/api/jobs/", "")).toBe("dispatch-notifications");
    expect(service).toMatch(/dispatch-notifications/);
  });

  it("the health check names migrations, so a second writer would be visible", () => {
    const ready = read("app/api/health/ready/route.ts");
    expect(ready).toMatch(/_prisma_migrations/);
    expect(ready).toMatch(/pending/);
  });
});

describe("local-disk modules are a hosting constraint, not an implementation detail", () => {
  const diskUsers = ["lib/library.ts", "lib/inventory.ts", "lib/clinic.ts"];

  for (const file of diskUsers) {
    it(`${file} persists through module-store`, () => {
      // When this stops being true, move it out of the "Vercel cannot host
      // this" list in docs/HOSTING-DECISION-2K-USERS.md §3.1 at the same time.
      expect(read(file)).toMatch(/module-store/);
    });
  }

  it("module-store writes under process.cwd(), which is read-only on Vercel", () => {
    const store = read("lib/module-store.ts");
    expect(store).toMatch(/process\.cwd\(\)/);
    expect(store).toMatch(/FAMEX_DATA_DIR/);
  });

  it("the hosting doc still explains why that matters", () => {
    const doc = read("docs/HOSTING-DECISION-2K-USERS.md");
    expect(doc).toMatch(/module-store/);
    expect(doc).toMatch(/ephemeral/i);
  });
});

describe("deploy runtime is pinned to the one that was tested", () => {
  it("package.json pins Node", () => {
    const pkg = JSON.parse(read("package.json")) as { engines?: { node?: string } };
    expect(pkg.engines?.node).toBe("22.x");
  });

  it("the hosting document records what is and is not verified", () => {
    const doc = read("docs/HOSTING-DECISION-2K-USERS.md");
    // The distinction that matters: a green build is not a working app.
    expect(doc).toMatch(/Not verified/);
    expect(doc).toMatch(/DATABASE_URL/);
  });
});

describe("the report card prints one sheet per page", () => {
  it("the print route renders the sheet alone, without portal chrome", () => {
    const page = read("app/report-cards/[code]/print/page.tsx");
    expect(page).toMatch(/ReportCardSheet/);
    // No dashboard shell on a printable document.
    expect(page).not.toMatch(/PortalTopbar|PortalSidebar|AdminSidebar/);
  });
});
