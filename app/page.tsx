import { headers } from "next/headers";

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
import { resolveTenantFromHost } from "@/lib/tenant";
import SchoolHome from "@/components/SchoolHome";
import PlatformLanding from "@/components/PlatformLanding";

/**
 * Root page — for this single-tenant Ykay College deployment, the Ykay portal
 * home page is shown by default on every host (production, preview, branch,
 * localhost). The generic Ykay Platform landing is only shown when
 * PLATFORM_MODE=true is explicitly set (future multi-tenant SaaS use).
 *
 * Tenant/branding resolution still runs so authenticated users get their own
 * school's palette — but the *landing* is always Ykay here.
 */
export default async function HomePage() {
  const host = (await headers()).get("host");
  const { matched } = await resolveTenantFromHost(host);

  // Single-tenant Ykay deployment: show the Ykay portal unless platform mode
  // is explicitly enabled. matched is ignored as a gate — SchoolHome renders
  // fine with the default Ykay tenant regardless.
  const platformMode = process.env.PLATFORM_MODE === "true";

  if (platformMode && !matched) {
    // Platform context — show the Ykay Platform landing page
    return <PlatformLanding />;
  }

  // Ykay College portal (default for this deployment)
  return <SchoolHome />;
}
