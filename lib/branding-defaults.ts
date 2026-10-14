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
 * Must match the palette in app/globals.css so the theming injection is a
 * visual no-op for a school that has not customised anything.
 */
export const DEFAULT_BRANDING = {
  logoUrl: null as string | null,
  faviconUrl: null as string | null,
  primaryColor: "#0c1824", // brand navy
  secondaryColor: "#1a2e4d", // brand navy-light
  accentColor: "#4ec54d", // brand green
  fontDisplay: null as string | null,
  fontBody: null as string | null,
  heroImageUrl: null as string | null,
  displayName: null as string | null,
  tagline: null as string | null,
} as const;
