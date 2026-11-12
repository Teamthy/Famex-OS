// Home critical-resource preloads. Two lessons from the 2026-11 Lighthouse
// fight, both verified against CI numbers:
//  1. metadata.other emits <meta> tags — a rel=preload *meta* is inert, which
//     is how the 7.9s LCP regression slipped through: the hero never actually
//     got its preload. React 19 hoists <link rel="preload"> rendered from JSX
//     into the real <head>, so the tags live in the component below.
//  2. Display and body fonts use self-hosted next/font/local files from the
//     app's font directory; Next emits the needed preload links automatically.
//     The homepage uses Anton display typography to match the new visual system.
import SchoolHome from "@/components/SchoolHome";

/**
 * Root page — Famex OS is a single-school install (W1 / F0-23, F0-26): every
 * host (production, preview, branch, localhost) renders the school's home.
 * The EDUos PLATFORM_MODE landing branch and components/PlatformLanding.tsx
 * are stripped; branding is resolved per request inside the layout/SchoolHome
 * pipeline (lib/brand.ts, lib/branding.ts), never branched on hostname.
 */
export default function HomePage() {
  return (
    <>
      <link
        rel="preload"
        as="image"
        type="image/avif"
        href="/home/hero-campus-750.avif"
        fetchPriority="high"
      />
      <SchoolHome />
    </>
  );
}
