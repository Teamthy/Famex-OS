import type { MetadataRoute } from "next";
import { PRODUCT_NAME, getSchoolBrandTokens } from "@/lib/brand";

/**
 * Web app manifest — token-driven (F0-21/F0-24/F18-06, W1).
 *
 * Replaces the old static public/manifest.json, which hard-coded the previous
 * product's name, brand colours and an "IT Education" shortcut to a route that
 * no longer exists. The school's name and palette now come from brand tokens
 * (env → per-tenant branding), so this install rebrands by configuration, not
 * by editing a committed file. Icons remain the committed PWA asset set until
 * the brand-asset registry (F0-24) lands.
 */
export default function manifest(): MetadataRoute.Manifest {
  const { schoolName, colors } = getSchoolBrandTokens();
  return {
    name: schoolName,
    short_name: schoolName,
    description: `${schoolName} school portal — results, attendance, fees and notices. Powered by ${PRODUCT_NAME}.`,
    start_url: "/portal",
    scope: "/",
    display: "standalone",
    display_override: ["standalone", "minimal-ui"],
    orientation: "portrait",
    background_color: colors.primary,
    theme_color: colors.primary,
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      {
        src: "/icons/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
    shortcuts: [
      {
        name: "Portal",
        url: "/portal",
        icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }],
      },
      {
        name: "Admissions",
        url: "/admissions",
        icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }],
      },
    ],
  };
}
