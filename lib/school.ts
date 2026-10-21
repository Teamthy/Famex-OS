import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { confirmedSchoolAddress } from "@/lib/school-address";
import { schoolCreateDefaultsFromEnv, schoolSlugFromEnv } from "@/lib/school-defaults";
import { resolveSchoolForRequest } from "@/lib/school-resolution";

const schoolSlug = schoolSlugFromEnv();

/**
 * Returns (and auto-creates/updates) the one configured Famex International
 * Schools row. This is the only runtime path that creates a School: FIS is a
 * single personalised school, not a multi-tenant platform.
 *
 * SCHOOL_CUSTOM_DOMAIN is retained as profile metadata for canonical links;
 * it no longer participates in selecting between schools.
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
  const { school: resolvedSchool } = await resolveSchoolForRequest(host);
  if (!resolvedSchool) return null;
  const school = await prisma.school.findUnique({
    where: { id: resolvedSchool.id },
    select: { address: true },
  });
  return confirmedSchoolAddress(school?.address);
}
