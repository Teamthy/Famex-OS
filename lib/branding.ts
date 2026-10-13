import { prisma } from "@/lib/prisma";

/**
 * Default branding/palette used when a tenant hasn't configured their own.
 * This is the Ykay College identity (green + orange on dark navy) — it must
 * match the palette in app/globals.css so the theming injection is a visual
 * no-op for the single-tenant Ykay deployment.
 */
export const DEFAULT_BRANDING = {
  logoUrl: null as string | null,
  faviconUrl: null as string | null,
  primaryColor: "#0c1824", // brand navy (was EDUos #00072D)
  secondaryColor: "#1a2e4d", // brand navy-light (was EDUos #051650)
  accentColor: "#4ec54d", // brand green (was EDUos #123499 — caused blue UI)
  fontDisplay: null as string | null,
  fontBody: null as string | null,
  heroImageUrl: null as string | null,
  displayName: null as string | null,
  tagline: null as string | null,
} as const;

/**
 * Fetch a tenant's branding row (or null if the tenant hasn't customised yet).
 * The theming layer (server component) merges this with DEFAULT_BRANDING and
 * injects the palette as CSS variables at the root layout.
 */
export async function getTenantBranding(schoolId: string) {
  return prisma.tenantBranding.findUnique({ where: { schoolId } });
}
