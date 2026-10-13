import { prisma } from "@/lib/prisma";

export const DEFAULT_SLUG = process.env.SCHOOL_SLUG || "ykay-college";
/** Platform base domain, e.g. "ykay.app" — `<slug>.ykay.app` resolves to a tenant. */
const PLATFORM_DOMAIN = (process.env.PLATFORM_BASE_DOMAIN || "").toLowerCase();

export type ResolvedTenant = {
  id: string;
  slug: string;
  name: string;
  subdomain: string | null;
  customDomain: string | null;
  status: string;
};

export type TenantResolution = {
  tenant: ResolvedTenant | null;
  /** true = a specific school was found via customDomain or subdomain.
   *  false = fell back to the default school (platform / localhost). */
  matched: boolean;
};

const TENANT_SELECT = {
  id: true,
  slug: true,
  name: true,
  subdomain: true,
  customDomain: true,
  status: true,
} as const;

/**
 * Resolve the tenant (School) for a request from its hostname.
 * Order: exact `customDomain` → subdomain of the platform domain → default school.
 *
 * Returns { tenant, matched }. When `matched` is false, the caller is on the
 * platform domain (or localhost) and should show the platform landing — not a
 * specific school portal.
 *
 * Runs in the Node runtime (uses Prisma) — call from API routes / server
 * components / the login flow, NOT from Edge middleware.
 */
export async function resolveTenantFromHost(host: string | null): Promise<TenantResolution> {
  const clean = (host || "").split(":")[0].toLowerCase().trim();

  if (clean) {
    // 1) Custom domain (e.g. portal.stmarys.edu.ng)
    const byCustom = await prisma.school.findFirst({
      where: { customDomain: clean },
      select: TENANT_SELECT,
    });
    if (byCustom) return { tenant: byCustom, matched: true };

    // 2) Subdomain of the platform domain (e.g. stmarys.ykay.app)
    if (PLATFORM_DOMAIN && clean.endsWith(`.${PLATFORM_DOMAIN}`)) {
      const sub = clean.slice(0, clean.length - PLATFORM_DOMAIN.length - 1);
      if (sub && sub !== "www" && !sub.includes(".")) {
        const bySub = await prisma.school.findFirst({
          where: { OR: [{ subdomain: sub }, { slug: sub }] },
          select: TENANT_SELECT,
        });
        if (bySub) return { tenant: bySub, matched: true };
      }
    }

    // 3) If SCHOOL_CUSTOM_DOMAIN is set and matches this host, it's a specific tenant
    const configuredDomain = process.env.SCHOOL_CUSTOM_DOMAIN?.trim().toLowerCase();
    if (configuredDomain && clean === configuredDomain) {
      const byConfig = await prisma.school.findFirst({
        where: { customDomain: clean },
        select: TENANT_SELECT,
      });
      if (byConfig) return { tenant: byConfig, matched: true };
      // customDomain not in DB yet — fall back to default school by slug
      const defaultSchool = await getDefaultTenant();
      if (defaultSchool) return { tenant: defaultSchool, matched: true };
    }
  }

  // Fallback: the configured default school (platform / localhost context)
  const fallback = await getDefaultTenant();
  return { tenant: fallback, matched: false };
}

/** The fallback tenant: the configured default school, else the first school. */
export async function getDefaultTenant(): Promise<ResolvedTenant | null> {
  return (
    (await prisma.school.findFirst({ where: { slug: DEFAULT_SLUG }, select: TENANT_SELECT })) ??
    (await prisma.school.findFirst({ orderBy: { createdAt: "asc" }, select: TENANT_SELECT }))
  );
}
