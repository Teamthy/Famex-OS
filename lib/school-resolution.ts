import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export const DEFAULT_SLUG = process.env.SCHOOL_SLUG || "famex-international-schools";

export type ResolvedSchool = {
  id: string;
  slug: string;
  name: string;
  subdomain: string | null;
  customDomain: string | null;
  status: string;
};

export type SchoolResolution = {
  school: ResolvedSchool | null;
  /** True when the one configured school exists. Kept explicit so callers
   * never accidentally treat "no school configured" as a usable context. */
  configured: boolean;
};

const SCHOOL_SELECT = {
  id: true,
  slug: true,
  name: true,
  subdomain: true,
  customDomain: true,
  status: true,
} as const;

/**
 * Famex OS for Famex International Schools is a single-school installation.
 *
 * There is deliberately no tenant discovery, school switcher, platform
 * subdomain directory, or public school sign-up flow. Every request belongs
 * to the one configured School row (SCHOOL_SLUG). The retained schoolId
 * columns and Postgres RLS policies are database integrity guardrails; they
 * do not make this deployment a multi-tenant product.
 *
 * If the configured slug has not been reconciled yet, a database containing
 * exactly one school resolves to that school. A database containing several
 * schools does NOT silently guess the first one — that would be unsafe and
 * would hide a configuration error.
 */
export async function getConfiguredSchool(): Promise<ResolvedSchool | null> {
  const bySlug = await prisma.school.findFirst({
    where: { slug: DEFAULT_SLUG },
    select: SCHOOL_SELECT,
  });
  if (bySlug) return bySlug;

  const schools = await prisma.school.findMany({
    orderBy: { createdAt: "asc" },
    take: 2,
    select: SCHOOL_SELECT,
  });
  return schools.length === 1 ? schools[0] : null;
}

/**
 * Resolve the school for a request. The host argument is accepted for call-site
 * clarity, but it is intentionally not used to select another school. A
 * staging hostname, Vercel preview hostname, OCI IP hostname, school custom
 * domain, and localhost all address the same single FIS installation (with
 * staging using its own separate database).
 */
export async function resolveSchoolForRequest(_host?: string | null): Promise<SchoolResolution> {
  const school = await getConfiguredSchool();
  return { school, configured: Boolean(school) };
}

/**
 * A resolution result that distinguishes "the database is fine but no school
 * is configured" from "the database itself is unreachable or unmigrated".
 *
 * `databaseError` is diagnostic text for logs only — it is never rendered to
 * visitors (it can contain connection details). The UI shows a generic,
 * honest "setup incomplete" state instead.
 */
export type SafeSchoolResolution = SchoolResolution & {
  databaseError: string | null;
};

/**
 * True only for errors that mean "this environment's database is not usable":
 * the server cannot be reached / DATABASE_URL is missing or invalid
 * (PrismaClientInitializationError, e.g. P1001), or the schema has not been
 * migrated yet (P2021 table / P2022 column does not exist).
 *
 * Everything else (query bugs, constraint violations, serialization failures)
 * is a real application error and must keep propagating — silently degrading
 * those would hide bugs and could fake an "empty" state that is actually a
 * broken write path.
 */
export function isDatabaseInfrastructureError(error: unknown): boolean {
  if (error instanceof Prisma.PrismaClientInitializationError) return true;
  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    (error.code === "P2021" || error.code === "P2022")
  ) {
    return true;
  }
  return false;
}

/**
 * `resolveSchoolForRequest` that never throws for an unusable database. Used
 * by the root layout so a deployment whose staging database has not been
 * provisioned/migrated yet (see docs/HOSTING-DECISION-2K-USERS.md §9) renders
 * an honest "setup incomplete" page from environment brand tokens instead of
 * crashing every route at the layout level with a blank 500.
 */
export async function resolveSchoolForRequestSafe(
  host?: string | null,
): Promise<SafeSchoolResolution> {
  try {
    const resolution = await resolveSchoolForRequest(host);
    return { ...resolution, databaseError: null };
  } catch (error) {
    if (!isDatabaseInfrastructureError(error)) throw error;
    return {
      school: null,
      configured: false,
      databaseError:
        error instanceof Error ? error.message.split("\n")[0].slice(0, 300) : "unknown",
    };
  }
}
