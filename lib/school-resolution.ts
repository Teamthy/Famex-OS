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
