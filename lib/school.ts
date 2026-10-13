import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { confirmedSchoolAddress } from "@/lib/school-address";
import { resolveTenantFromHost } from "@/lib/tenant";

const schoolSlug = process.env.SCHOOL_SLUG || "ykay-college";

/**
 * Returns (and auto-creates/updates) the default school for single-tenant
 * deployments. For multi-tenancy, each school is created via onboarding.
 *
 * When SCHOOL_CUSTOM_DOMAIN is set (e.g. "portal.ykaycollege.edu.ng"), the
 * school's customDomain is kept in sync so that resolveTenantFromHost finds
 * this school directly — even before the platform has a domain.
 */
export async function getSchool() {
  const customDomain = process.env.SCHOOL_CUSTOM_DOMAIN?.trim() || undefined;

  return prisma.school.upsert({
    where: { slug: schoolSlug },
    update: {
      ...(customDomain ? { customDomain } : {}),
    },
    create: {
      slug: schoolSlug,
      subdomain: schoolSlug,
      customDomain,
      name: process.env.SCHOOL_NAME || "Ykay College & Leadership Academy",
      // Empty until the school confirms it (School profile). Nothing is printed meanwhile.
      address: process.env.SCHOOL_ADDRESS?.trim() || "",
      phone: process.env.SCHOOL_PHONE || "+2347015374411",
      email: process.env.SCHOOL_EMAIL || "info@ykaycollege.com",
      motto: process.env.SCHOOL_MOTTO || "Raising Role Models",
    },
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
