/**
 * Default branding palette — the client-safe half of lib/branding.ts.
 *
 * Split out during W2: `lib/brand.ts` (read by client components for
 * PRODUCT_NAME) imported these constants from lib/branding.ts, which imports
 * prisma — so importing the product name into a browser bundle dragged the
 * server-only prisma client with it and `npm run check:boundary` failed the
 * build. Constants live here; the database read stays in lib/branding.ts.
 */

/**
 * Default branding/palette used when a tenant hasn't configured their own.
 * Keep these fallback values aligned with the Famex design tokens in
 * app/globals.css; the operational UI uses the fixed product palette.
 */
export const DEFAULT_BRANDING = {
  displayName: "FAMEX SCHOOLS",
  logoUrl: null as string | null,
  faviconUrl: null as string | null,
  primaryColor: "#123a35", // forest dark
  secondaryColor: "#1d4a45", // forest dark-light
  accentColor: "#b6e618", // electric lime
  fontDisplay: null as string | null,
  fontBody: null as string | null,
  heroImageUrl: null as string | null,
  tagline: null as string | null,
} as const;
