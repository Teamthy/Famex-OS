// The home hero backdrop is the LCP element. metadata.other emits <meta>
// tags — a rel=preload *meta* is inert, which is exactly how the 7.9s LCP
// regression slipped through: the image never got its preload. React 19
// hoists <link rel="preload"> rendered from JSX into the real <head>, so
// the tag lives in the component below.
import localFont from "next/font/local";
import SchoolHome from "@/components/SchoolHome";

/**
 * The editorial display serif of the public home redesign (2026-11-10),
 * self-hosted per the layout's next/font/local convention — next/font/google
 * fetches at build time and both the sandbox and CI-adjacent environments must
 * never depend on that. Scoped to the home wrapper via its CSS variable.
 */
const fraunces = localFont({
  src: [
    { path: "./fonts/Fraunces-Variable.woff2", style: "normal", weight: "100 900" },
    { path: "./fonts/Fraunces-Variable-Italic.woff2", style: "italic", weight: "100 900" },
  ],
  variable: "--font-fraunces",
  display: "swap",
});

/**
 * Root page — Famex OS is a single-school install (W1 / F0-23, F0-26): every
 * host (production, preview, branch, localhost) renders the school's home.
 * The EDUos PLATFORM_MODE landing branch and components/PlatformLanding.tsx
 * are stripped; branding is resolved per request inside the layout/SchoolHome
 * pipeline (lib/brand.ts, lib/branding.ts), never branched on hostname.
 */
export default function HomePage() {
  return (
    <div className={fraunces.variable}>
      <link rel="preload" as="image" href="/home/hero-campus-750.webp" fetchPriority="high" />
      <SchoolHome />
    </div>
  );
}
