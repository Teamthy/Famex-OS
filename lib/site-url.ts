/**
 * Canonical site-URL resolution — one chain, every consumer.
 *
 * Password-reset links, staff-activation links, CORS origins, CSP storage
 * origins, mobile deep-link config and QR codes all need "the URL of this
 * deployment". Historically each of them read `NEXT_PUBLIC_SITE_URL` with its
 * own `|| "http://localhost:3000"` fallback, and production boot treated the
 * variable as fatal — which took the whole Vercel staging deployment down at
 * startup on 2026-11-09 (NODE_ENV=production there, variable absent, and the
 * platform was perfectly capable of telling us our own URL).
 *
 * Resolution order:
 *   1. `NEXT_PUBLIC_SITE_URL` — explicit configuration (OCI production, local
 *      .env). Wins everywhere.
 *   2. Vercel **preview** deployments: `VERCEL_URL` — this deployment's own
 *      hostname, so preview links and CORS origins point at the preview, not
 *      at production.
 *   3. `NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL` — the project's production
 *      domain, inlined at build time by Vercel.
 *   4. `VERCEL_URL` at runtime (production deployment on Vercel).
 *   5. `""` — the caller keeps its own development fallback.
 *
 * Pure string logic with no imports on purpose: middleware (edge runtime) and
 * server components share it, and it must never pull zod or Prisma into the
 * edge bundle.
 */
export function resolveSiteUrl(source: NodeJS.ProcessEnv = process.env): string {
  const normalise = (value: string): string => value.trim().replace(/\/+$/, "");
  const withScheme = (value: string): string =>
    /^https?:\/\//i.test(value) ? normalise(value) : `https://${normalise(value)}`;

  const explicit = source.NEXT_PUBLIC_SITE_URL?.trim();
  if (explicit) return withScheme(explicit);

  const vercelUrl = source.VERCEL_URL?.trim();
  if (source.VERCEL_ENV === "preview" && vercelUrl) return withScheme(vercelUrl);

  const projectProduction = source.NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL?.trim();
  if (projectProduction) return withScheme(projectProduction);

  if (vercelUrl) return withScheme(vercelUrl);

  return "";
}
