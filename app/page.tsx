// Home critical-resource preloads. Two lessons from the 2026-11 Lighthouse
// fight, both verified against CI numbers:
//  1. metadata.other emits <meta> tags — a rel=preload *meta* is inert, which
//     is how the 7.9s LCP regression slipped through: the hero never actually
//     got its preload. React 19 hoists <link rel="preload"> rendered from JSX
//     into the real <head>, so the tags live in the component below.
//  2. next/font emitted no font preload links in this setup, so the browser
//     discovered Fraunces only after parsing the render-blocking CSS; the
//     serif H1 swapped in at ~4.3s and took the text LCP with it. The fonts
//     now live at stable public/fonts URLs (hand-written @font-face in
//     globals.css) so their preloads can be hardcoded here.
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
      <link
        rel="preload"
        as="font"
        type="font/woff2"
        href="/fonts/Fraunces-Variable.woff2"
        crossOrigin="anonymous"
      />
      <link
        rel="preload"
        as="font"
        type="font/woff2"
        href="/fonts/Fraunces-Variable-Italic.woff2"
        crossOrigin="anonymous"
      />
      <SchoolHome />
    </>
  );
}
