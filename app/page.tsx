// Preload the home hero backdrop — the LCP element — as its exact static
// WebP so the browser can start it with the document response, before it
// parses the hero markup.
export const metadata = {
  other: [
    {
      rel: "preload",
      as: "image",
      href: "/home/hero-campus-750.webp",
      fetchpriority: "high",
    },
  ],
};
import SchoolHome from "@/components/SchoolHome";

/**
 * Root page — Famex OS is a single-school install (W1 / F0-23, F0-26): every
 * host (production, preview, branch, localhost) renders the school's home.
 * The EDUos PLATFORM_MODE landing branch and components/PlatformLanding.tsx
 * are stripped; branding is resolved per request inside the layout/SchoolHome
 * pipeline (lib/brand.ts, lib/branding.ts), never branched on hostname.
 */
export default function HomePage() {
  return <SchoolHome />;
}
