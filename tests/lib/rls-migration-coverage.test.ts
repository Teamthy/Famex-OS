import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Static RLS coverage — is every tenant table secured by a migration?
 *
 * `scripts/verify-rls-coverage.ts` answers this against a live database and is
 * the authoritative check, but it needs Postgres, so it cannot run on every
 * commit or in a sandbox without one. That gap is exactly how this bug shipped
 * twice: `DeviceToken` had a `schoolId`, no migration gave it a policy, and
 * cross-tenant reads and writes were both possible on push tokens until someone
 * noticed by hand.
 *
 * This test answers the same question from the files, so it runs everywhere.
 *
 * ── The rule, precisely
 *
 * The policy loop in `20260727000000_eduos_rls` walks `information_schema` and
 * secures every table carrying a `schoolId` that exists AT THAT MOMENT. A later
 * migration that creates a tenant table does not re-run the loop, so the table
 * arrives with no policy. Coverage therefore has two legitimate forms:
 *
 *   1. an `eduos_apply_tenant_rls('<table>')` call in a migration that runs
 *      after the table is created;
 *   2. an inline `CREATE POLICY eduos_tenant_isolation ON "<table>"`, which is
 *      the same policy written out by hand (how the timetable migration did it);
 *   3. a full `information_schema` sweep in a LATER migration, which picks the
 *      table up without naming it.
 *
 * A model is a gap when neither exists. That is the check below, and it is what
 * would have caught DeviceToken in review.
 */

const ROOT = process.cwd();
const SCHEMA = readFileSync(join(ROOT, "prisma/schema.prisma"), "utf8");
const MIGRATIONS_DIR = join(ROOT, "prisma/migrations");

type Migration = { name: string; sql: string };

function migrations(): Migration[] {
  return readdirSync(MIGRATIONS_DIR)
    .filter((entry) => statSync(join(MIGRATIONS_DIR, entry)).isDirectory())
    .sort()
    .map((name) => ({
      name,
      sql: readFileSync(join(MIGRATIONS_DIR, name, "migration.sql"), "utf8"),
    }));
}

type Model = { name: string; table: string; schoolId: boolean };

/** Every model in schema.prisma, with whether it carries a schoolId. */
function models(): Model[] {
  return SCHEMA.split(/\nmodel /)
    .slice(1)
    .map((block) => {
      const name = block.slice(0, block.indexOf(" ")).trim();
      const body = block.slice(0, block.indexOf("\n}"));
      // Prisma table names default to the model name; @@map would change that.
      const mapped = body.match(/@@map\(\s*"([^"]+)"\s*\)/);
      return {
        name,
        table: mapped ? mapped[1] : name,
        schoolId: /^\s*schoolId\s+String/m.test(body),
      };
    });
}

/** Tables a migration creates. */
function createdTables(sql: string): Set<string> {
  const created = new Set<string>();
  for (const match of sql.matchAll(/CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?"?([A-Za-z0-9_]+)"?/gi)) {
    created.add(match[1]);
  }
  return created;
}

/** Tables a migration secures by name. */
function namedSecures(sql: string): Set<string> {
  const secured = new Set<string>();
  for (const match of sql.matchAll(/eduos_apply_tenant_rls\(\s*'([^']+)'\s*\)/g)) {
    secured.add(match[1]);
  }
  return secured;
}

/**
 * Tables a migration secures INLINE — a full `CREATE POLICY` written out by hand
 * against a named table instead of calling the helper.
 *
 * Legitimate (some earlier migrations shipped this way), but it has to count:
 * the policy is real whether or not the helper was used.
 */
function inlineSecuredTables(sql: string): Set<string> {
  const secured = new Set<string>();
  for (const match of sql.matchAll(
    /CREATE\s+POLICY\s+"?eduos_tenant_isolation"?\s+ON\s+"?([A-Za-z0-9_]+)"?/gi,
  )) {
    secured.add(match[1]);
  }
  return secured;
}

/**
 * Does this migration re-sweep information_schema for every schoolId table?
 *
 * Both the original policy migration and the empty-context fix do this; it is
 * how a table that was never named explicitly still gets a policy.
 */
function sweepsAllTenantTables(sql: string): boolean {
  return (
    /information_schema\.columns/i.test(sql) &&
    /column_name\s*=\s*'schoolId'/i.test(sql)
  );
}

describe("RLS coverage in the migration history", () => {
  const all = migrations();
  const allModels = models();
  const tenantModels = allModels.filter((model) => model.schoolId);

  it("finds a plausible set of tenant models", () => {
    // A parser regression would make every check below pass vacuously.
    expect(all.length).toBeGreaterThan(20);
    expect(tenantModels.length).toBeGreaterThan(50);
    expect(tenantModels.map((model) => model.name)).toContain("StudentProfile");
    expect(tenantModels.map((model) => model.name)).toContain("Exam");
  });

  it("secures every tenant table, by name or by a later sweep", () => {
    const gaps: string[] = [];

    for (const model of tenantModels) {
      // The migration that creates the table (if we can find it) is the point
      // from which coverage is needed. A table created before every sweep is
      // covered by the sweep; one created after needs an explicit call.
      const creator = all.find((migration) => createdTables(migration.sql).has(model.table));
      const creatorIndex = creator ? all.indexOf(creator) : -1;

      const secured = all.some((migration, index) => {
        if (index < creatorIndex) return false;
        if (namedSecures(migration.sql).has(model.table)) return true;
        if (inlineSecuredTables(migration.sql).has(model.table)) return true;
        // A sweep covers everything that exists when it runs.
        return sweepsAllTenantTables(migration.sql) && index > creatorIndex;
      });

      if (!secured) gaps.push(`${model.name} (table "${model.table}")`);
    }

    expect(
      gaps,
      "These tenant tables have a schoolId but no migration secures them. " +
        "Add a NEW migration calling SELECT eduos_apply_tenant_rls('<table>'); " +
        "never edit an applied migration.",
    ).toEqual([]);
  });

  it("secures the tables added by the result-compilation migration", () => {
    // Named explicitly: the newest tenant tables, and the ones a future
    // refactor is most likely to rename without carrying the policy across.
    const secured = new Set(all.flatMap((migration) => [...namedSecures(migration.sql)]));
    for (const table of ["TermResult", "ClassTermResult", "PromotionRecord"]) {
      expect(secured.has(table), `${table} must be secured by name`).toBe(true);
    }
  });

  it("leaves no stray schoolId column on an unlisted table", () => {
    // Inverse of the check above: a migration that adds a schoolId to an
    // EXISTING table creates a tenant table without a CREATE TABLE, which the
    // creator lookup would miss entirely.
    const addedColumns = all.flatMap((migration) => {
      const rows: Array<{ table: string; migration: string }> = [];
      for (const match of migration.sql.matchAll(
        /ALTER\s+TABLE\s+"?([A-Za-z0-9_]+)"?\s+ADD\s+(?:COLUMN\s+)?"?schoolId"?/gi,
      )) {
        rows.push({ table: match[1], migration: migration.name });
      }
      return rows;
    });

    // Every table that gained a schoolId this way must also be secured by a
    // later migration.
    for (const added of addedColumns) {
      const secured = all.some(
        (migration) =>
          migration.name >= added.migration &&
          (namedSecures(migration.sql).has(added.table) ||
            inlineSecuredTables(migration.sql).has(added.table) ||
            sweepsAllTenantTables(migration.sql)),
      );
      expect(
        secured,
        `${added.table} gained a schoolId in ${added.migration} but no migration secures it.`,
      ).toBe(true);
    }
  });

  it("never removes tenant isolation once established", () => {
    // `DROP POLICY IF EXISTS eduos_tenant_isolation` is legitimate inside the
    // helper, immediately before recreating the policy — that is how an
    // idempotent re-apply works. What must never appear is a policy dropped and
    // NOT recreated in the same migration.
    for (const migration of all) {
      expect(
        /DISABLE\s+ROW\s+LEVEL\s+SECURITY/i.test(migration.sql),
        `${migration.name} disables row level security. Tenant isolation must not be switched off.`,
      ).toBe(false);

      const drops = [...migration.sql.matchAll(/DROP\s+POLICY\s+(?:IF\s+EXISTS\s+)?eduos_tenant_isolation/gi)];
      if (!drops.length) continue;
      const recreates = /CREATE\s+POLICY[\s\S]{0,200}eduos_tenant_isolation/i.test(migration.sql);
      expect(
        recreates,
        `${migration.name} drops eduos_tenant_isolation without recreating it.`,
      ).toBe(true);
    }
  });
});
