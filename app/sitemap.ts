import type { MetadataRoute } from "next";
import { getSchoolBrandTokens } from "@/lib/brand";

/**
 * Token-driven sitemap (F0-21 / W1). The domain comes from the resolved brand
 * tokens, never a hard-coded host, and the route list reflects the pages this
 * single-school install actually serves — the retired IT-education and virtual
 * gateway routes are gone.
 *
 * Next.js serves this at /sitemap.xml.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const { siteUrl } = getSchoolBrandTokens();
  const base = siteUrl.replace(/\/$/, "");

  // Public marketing / information routes. Portal, auth and all role dashboards
  // are private and excluded (and Disallowed in app/robots.ts).
  const routes: [string, number][] = [
    ["", 1.0],
    ["/admissions", 0.9],
    ["/about", 0.8],
    ["/academics", 0.8],
    ["/campus-life", 0.7],
    ["/news-events", 0.7],
    ["/contact", 0.6],
    ["/download", 0.6],
    ["/gallery", 0.6],
    ["/academics/primary", 0.7],
    ["/academics/junior-secondary", 0.6],
    ["/academics/ss-science", 0.6],
    ["/academics/ss-commercial", 0.6],
    ["/academics/ss-arts", 0.6],
    ["/academics/calendar", 0.7],
    ["/staff-directory", 0.6],
    ["/alumni", 0.5],
    ["/testimonials", 0.5],
    ["/faq", 0.5],
    ["/whats-new", 0.5],
    ["/careers", 0.4],
    ["/privacy-policy", 0.3],
  ];

  return routes.map(([path, priority]) => ({
    url: `${base}${path || "/"}`,
    lastModified: new Date(),
    changeFrequency: "weekly",
    priority,
  }));
}
