import { DEFAULT_BRANDING } from "@/lib/branding";

/**
 * Brand tokens — the ONE place the product and school identity is read from
 * (F0-21, W1). Rule 1 of the build: no brand literals. The school's name,
 * colours, logo and contacts come from settings/env and per-tenant branding,
 * never hard-coded into a component.
 *
 * Two distinct identities live here:
 *
 *   PRODUCT_NAME  — the software ("Famex OS"). This IS the product, so it is a
 *                   constant, not a per-school token. It never changes between
 *                   schools.
 *
 *   school tokens — the individual school running this install. On a
 *                   single-school Famex deployment these come from env
 *                   (SCHOOL_NAME, NEXT_PUBLIC_SITE_URL, …) and are overridden
 *                   per request by the resolved School + TenantBranding row
 *                   (see app/layout.tsx and lib/branding.ts). The defaults here
 *                   are deliberately NEUTRAL — never another product's name —
 *                   so an unconfigured boot cannot leak a stale brand.
 *
 * `npm run audit:brand` enforces the ratchet: components must not introduce new
 * hard-coded school names, colours or logo paths; they read from here (or from
 * the tenant branding injected as CSS variables by the root layout).
 */

/** The software product's name. Not a per-school token. */
export const PRODUCT_NAME = "Famex OS";

/** Neutral fallbacks used only when a school token is not configured. */
const NEUTRAL_SCHOOL_NAME = "the school";
const NEUTRAL_SITE_URL = "http://localhost:3000";

export interface SchoolBrandTokens {
  /** School display name from config (env SCHOOL_NAME), else a neutral phrase. */
  schoolName: string;
  /** Canonical site URL from NEXT_PUBLIC_SITE_URL, else localhost. */
  siteUrl: string;
  /** Default palette tokens; TenantBranding overrides these per request. */
  colors: {
    primary: string;
    secondary: string;
    accent: string;
  };
}

/**
 * Server-side brand tokens derived from environment configuration. Call from
 * server components, `generateMetadata`, or API routes — NOT from client
 * bundles (env without NEXT_PUBLIC_ is not inlined there). Client components
 * read the school name from `useSchoolProfile()` and colours from the CSS
 * variables the root layout injects.
 */
export function getSchoolBrandTokens(): SchoolBrandTokens {
  const schoolName = process.env.SCHOOL_NAME?.trim() || NEUTRAL_SCHOOL_NAME;
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim() || NEUTRAL_SITE_URL;
  return {
    schoolName,
    siteUrl,
    colors: {
      primary: DEFAULT_BRANDING.primaryColor,
      secondary: DEFAULT_BRANDING.secondaryColor,
      accent: DEFAULT_BRANDING.accentColor,
    },
  };
}
