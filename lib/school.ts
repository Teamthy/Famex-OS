import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { confirmedSchoolAddress } from "@/lib/school-address";
import { schoolCreateDefaultsFromEnv, schoolSlugFromEnv } from "@/lib/school-defaults";
import { resolveTenantFromHost } from "@/lib/tenant";

const schoolSlug = schoolSlugFromEnv();

/**
 * Returns (and auto-creates/updates) the default school for single-tenant
 * deployments. For multi-tenancy, each school is created via onboarding.
 *
 * When SCHOOL_CUSTOM_DOMAIN is set (e.g. "portal.ykaycollege.edu.ng"), the
 * school's customDomain is kept in sync so that resolveTenantFromHost finds
 * this school directly — even before the platform has a domain.
 */
export async function getSchool() {
  // Create-defaults live in lib/school-defaults.ts so the bundled first-admin
  // seed (prisma/seed.ts) creates the row identically without importing this
  // module's next/headers dependency.
  const create = schoolCreateDefaultsFromEnv();
  const { customDomain } = create;

  return prisma.school.upsert({
    where: { slug: schoolSlug },
    update: {
      ...(customDomain ? { customDomain } : {}),
    },
    create,
  });
}

/**
 * The confirmed address of the school this request is for, for server-rendered pages.
 * Reads only, never writes. Null while the school has not set one.
 */
export async function getPublicSchoolAddress(): Promise<string | null> {
  const host = (await headers()).get("host");
  const { tenant } = await resolveTenantFromHost(host);
  if (!tenant) return null;
  const school = await prisma.school.findUnique({
    where: { id: tenant.id },
    select: { address: true },
  });
  return confirmedSchoolAddress(school?.address);
}
