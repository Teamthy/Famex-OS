/**
 * Env-derived defaults for auto-creating this install's School row.
 *
 * Split out of lib/school.ts so the first-admin seed (prisma/seed.ts) can use
 * the exact same defaults when it is bundled to a plain node script for the
 * slim production image (`node prisma/seed-admin.mjs`). lib/school.ts itself
 * imports next/headers, which only exists inside a Next.js request — anything
 * the seed imports must stay dependency-free like this file.
 *
 * The hard-coded fallbacks describe the base school this codebase was built
 * for and only apply while SCHOOL_* are unset *and* no School row exists yet;
 * every real deployment sets SCHOOL_* in its environment (see .env.example).
 * This file is their single home — do not copy them elsewhere
 * (`npm run audit:brand` ratchets exactly that).
 */

export function schoolSlugFromEnv(env: NodeJS.ProcessEnv = process.env): string {
  return env.SCHOOL_SLUG || "famex-international-schools";
}

/** The `create` half of the School upsert in getSchool() / prisma/seed.ts. */
export function schoolCreateDefaultsFromEnv(env: NodeJS.ProcessEnv = process.env) {
  const slug = schoolSlugFromEnv(env);
  return {
    slug,
    subdomain: slug,
    customDomain: env.SCHOOL_CUSTOM_DOMAIN?.trim() || undefined,
    name: env.SCHOOL_NAME || "Famex International Schools",
    // Empty until the school confirms it (School profile). Nothing is printed meanwhile.
    address: env.SCHOOL_ADDRESS?.trim() || "",
    phone: env.SCHOOL_PHONE || "+2347015374411",
    email: env.SCHOOL_EMAIL || "info@ykaycollege.com",
    motto: env.SCHOOL_MOTTO || "Raising Role Models",
  };
}
