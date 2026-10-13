import type { MetadataRoute } from "next";
import { getSchoolBrandTokens } from "@/lib/brand";

/**
 * Token-driven robots.txt (F0-21 / W1). The sitemap host comes from brand
 * tokens; the disallow list covers every private/authenticated route of this
 * single-school install (the retired /it-portal and /super-admin are gone).
 *
 * Next.js serves this at /robots.txt.
 */
export default function robots(): MetadataRoute.Robots {
  const { siteUrl } = getSchoolBrandTokens();
  const base = siteUrl.replace(/\/$/, "");

  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/admin",
        "/admin-admissions",
        "/teacher",
        "/student",
        "/parent",
        "/staff",
        "/portal",
        "/login",
        "/logout",
        "/verify",
        "/reset-password",
        "/change-password",
        "/forgot-password",
        "/onboarding",
        "/application-status",
        "/api/",
      ],
    },
    sitemap: `${base}/sitemap.xml`,
  };
}
