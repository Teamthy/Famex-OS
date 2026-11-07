import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Static RLS coverage — every tenant table must be secured by a migration.
 *
 * `scripts/verify-rls-coverage.ts` answers this against a live database, and it
 * is the authoritative check. It needs Postgres, though, so it cannot run on
 * every commit or in a sandbox without one — which is precisely how a tenant
 * table shipped with no policy twice in this repository's history
 * (`DeviceToken`, and then `StudentProfile.photoUrl`'s neighbours).
 *
 * This test answers the same question from the files alone: read the tenant
 * tables out of `schema.prisma`, read every `eduos_apply_tenant_rls(...)` call
 * out of the migration history, and fail on a difference. It is a subset of the
 * live check — it proves the CALL exists, not that the policy is correct — but
 * it runs everywhere and catches the exact regression that keeps happening.
 *
 * The rule it encodes: a model with a `schoolId` column is a tenant table, and
 * a new tenant table is not finished until a migration calls the helper for it.
 */

const SCHEMA = readFileSync(join(process.cwd(), "prisma/schema.prisma"), "utf8");
const MIGRATIONS_DIR = join(process.cwd(), "prisma/migrations");

/** Every model in schema.prisma that carries a `schoolId` column. */
function tenantModels(): string[] {
  const models: string[] = [];
  const blocks = SCHEMA.split(/\nmodel /).slice(1);
  for (const block of blocks) {
    const name = block.slice(0, block.indexOf(" ")).trim();
    const body = block.slice(0, block.indexOf("\n}"));
    if (/^\s*schoolId\s+String/m.test(body)) models.push(name);
  }
  return models.sort();
}

/** Every table name passed to eduos_apply_tenant_rls in any migration. */
function securedTables(): Set<string> {
  const secured = new Set<string>();
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) {
        walk(full);
        continue;
      }
      if (!entry.endsWith(".sql")) continue;
      const sql = readFileSync(full, "utf8");
      for (const match of sql.matchAll(/eduos_apply_tenant_rls\(\s*'([^']+)'\s*\)/g)) {
        secured.add(match[1]);
      }
    }
  };
  walk(MIGRATIONS_DIR);
  return secured;
}

describe("RLS coverage in the migration history", () => {
  const models = tenantModels();
  const secured = securedTables();

  it("finds tenant models to check", () => {
    // A parser regression would silently pass everything below.
    expect(models.length).toBeGreaterThan(50);
    expect(models).toContain("StudentProfile");
    expect(models).toContain("Exam");
  });

  it("secures every model that carries a schoolId", () => {
    const missing = models.filter((model) => !secured.has(model));
    expect(
      missing,
      `These models have a schoolId but no migration calls eduos_apply_tenant_rls for them. ` +
        `Add: SELECT eduos_apply_tenant_rls('<table>'); to a NEW migration ` +
        `(never edit an applied one).`,
    ).toEqual([]);
  });

  it("secures the tables added by the result-compilation migration", () => {
    // Named explicitly: these are the newest tenant tables in the product and
    // the ones a future refactor is most likely to rename without carrying the
    // policy across.
    expect(secured.has("TermResult")).toBe(true);
    expect(secured.has("ClassTermResult")).toBe(true);
    expect(secured.has("PromotionRecord")).toBe(true);
  });

  it("does not name a table that no longer exists in the schema", () => {
    const modelNames = new Set(
      SCHEMA.split(/\nmodel /)
        .slice(1)
        .map((block) => block.slice(0, block.indexOf(" ")).trim()),
    );
    // Not every secured table is a Prisma model (a join table can be raw), so
    // this only fails for names that look like stale Prisma models — we simply
    // report anything not found so a rename is visible rather than silent.
    const unknown = [...secured].filter((table) => !modelNames.has(table));
    expect(
      unknown,
      `eduos_apply_tenant_rls is called for tables that are not Prisma models: ` +
        `${unknown.join(", ")}. If a model was renamed, add a new migration that ` +
        `secures the new name; do not edit the old one.`,
    ).toEqual([]);
  });

  it("never drops or disables a tenant policy it established", () => {
    const walk = (dir: string) => {
      for (const entry of readdirSync(dir)) {
        const full = join(dir, entry);
        if (statSync(full).isDirectory()) {
          walk(full);
          continue;
        }
        if (!entry.endsWith(".sql")) continue;
        const sql = readFileSync(full, "utf8");
        for (const statement of sql.split(";")) {
          const lowered = statement.toLowerCase();
          // A migration that removes isolation from a tenant table is either a
          // mistake or a deliberate act that needs its own review. There is no
          // legitimate reason for one to appear quietly here.
          expect(
            lowered.includes("drop policy") && lowered.includes("eduos_tenant_isolation"),
            `A migration drops eduos_tenant_isolation in ${full}. Tenant isolation must not be removed by a migration.`,
          ).toBe(false);
          expect(
            lowered.includes("disable row level security"),
            `A migration disables row level security in ${full}.`,
          ).toBe(false);
        }
      }
    };
    walk(MIGRATIONS_DIR);
  });
});
