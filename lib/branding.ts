import { prisma } from "@/lib/prisma";
import { DEFAULT_BRANDING } from "@/lib/branding-defaults";

// The constants live in lib/branding-defaults.ts (client-safe); re-exported so
// existing imports from "@/lib/branding" keep working on the server.
export { DEFAULT_BRANDING };

/**
 * Fetch a tenant's branding row (or null if the tenant hasn't customised yet).
 * The theming layer (server component) merges this with DEFAULT_BRANDING and
 * injects the palette as CSS variables at the root layout.
 */
export async function getTenantBranding(schoolId: string) {
  return prisma.tenantBranding.findUnique({ where: { schoolId } });
}
