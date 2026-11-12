import localFont from "next/font/local";
import type { Metadata, Viewport } from "next";
import "./globals.css";
import { ThemeProvider } from "@/components/ThemeProvider";
import { ToastProvider } from "@/components/Toast";
import { SchoolProfileProvider } from "@/components/SchoolProfileContext";
import { confirmedSchoolAddress } from "@/lib/school-address";
import { AuthProvider } from "@/components/AuthProvider";
import CookieConsent from "@/components/CookieConsent";
import WhatsAppFloat from "@/components/WhatsAppFloat";
import DemoIndicator from "@/components/DemoIndicator";
import OfflineIndicator from "@/components/OfflineIndicator";
import { MotionProvider } from "@/components/MotionProvider";
import { AmbientBackdrop } from "@/components/AmbientBackdrop";
import { RegisterSW } from "@/components/RegisterSW";
import { InstallPrompt } from "@/components/InstallPrompt";
import { Analytics } from "@/components/Analytics";

/**
 * Fonts are self-hosted, not fetched from Google at build time.
 *
 * `next/font/google` downloads the font files during `next build`. That makes
 * every build depend on reaching fonts.googleapis.com, and when the network
 * hiccups the build does not degrade — it FAILS:
 *
 *   next/font: error: Failed to fetch `Anton` from Google Fonts.
 *   > Build error occurred
 *
 * That happened on a real machine on a Nigerian connection, and it would
 * happen just as easily in CI or on a Vercel build. A school's deploy should
 * not be able to fail because a font CDN was briefly unreachable.
 *
 * These are the same files Google serves for the `latin` subset, committed to
 * the repo (55 KB total). Self-hosting also removes a third-party request from
 * every page load, which is faster on mobile data and avoids sending visitor
 * IPs to Google — worth having for a site used by children's parents.
 *
 * To update: fetch the woff2 URLs from the Google CSS and replace the files.
 */
const anton = localFont({
  src: "./fonts/Anton-Regular.woff2",
  weight: "400",
  style: "normal",
  variable: "--font-display",
  display: "swap",
  // Matches the metrics Google's own CSS declares, so the fallback swap does
  // not shift the layout while the font loads.
  fallback: ["system-ui", "sans-serif"],
});

const dmSans = localFont({
  // Variable font: one file covers the whole 300-700 range the site uses.
  src: "./fonts/DMSans-Variable.woff2",
  weight: "300 700",
  style: "normal",
  variable: "--font-body",
  display: "swap",
  fallback: ["system-ui", "sans-serif"],
});

export function generateMetadata(): Metadata {
  // Token-driven (F0-21, W1): the school name and canonical URL come from brand
  // tokens (env → the configured school's branding), never a hard-coded literal. The logo
  // asset paths stay the committed set until the brand-asset registry (F0-24).
  const { schoolName, siteUrl } = getSchoolBrandTokens();
  return {
    metadataBase: new URL(siteUrl),
    title: {
      default: `${schoolName} — Excellence in Education`,
      template: `%s | ${schoolName}`,
    },
    description: `A premium day secondary school (JSS1–SS3). NERDC-aligned curriculum, digital learning, leadership development. Powered by ${PRODUCT_NAME}.`,
    keywords: "secondary school, NERDC, WAEC, BECE, JSS, SS",
    openGraph: {
      title: schoolName,
      description: "Excellence in education for JSS1 to SS3.",
      siteName: schoolName,
      locale: "en_NG",
      type: "website",
      url: siteUrl,
      images: [{ url: "/logo.png", width: 800, height: 800, alt: `${schoolName} logo` }],
    },
    twitter: {
      card: "summary_large_image",
      title: schoolName,
      description: "Excellence in education for JSS1 to SS3.",
      images: ["/logo.png"],
    },
    robots: { index: true, follow: true },
    icons: {
      icon: [
        { url: "/logo.png", sizes: "any", type: "image/png" },
        { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      ],
      apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
      shortcut: "/icons/icon-192.png",
    },
    manifest: "/manifest",
    appleWebApp: {
      capable: true,
      statusBarStyle: "black-translucent",
      title: schoolName,
    },
  };
}

export const viewport: Viewport = {
  themeColor: "#1D4A45",
  width: "device-width",
  initialScale: 1,
};

import { headers } from "next/headers";
import { Prisma } from "@prisma/client";
import { getSession, IdentityCheckUnavailableError } from "@/lib/session";
import {
  isDatabaseInfrastructureError,
  resolveSchoolForRequestSafe,
} from "@/lib/school-resolution";
import { getTenantBranding } from "@/lib/branding";
import SetupIncompleteBanner from "@/components/SetupIncompleteBanner";
import { PRODUCT_NAME, getSchoolBrandTokens } from "@/lib/brand";
import { prisma } from "@/lib/prisma";

const SCHOOL_IDENTITY_SELECT = {
  slug: true,
  name: true,
  address: true,
  phone: true,
  email: true,
} as const;

type SchoolIdentity = Prisma.SchoolGetPayload<{ select: typeof SCHOOL_IDENTITY_SELECT }>;

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // ── Resolve branding for the one configured school ──
  // Authenticated pages use the session schoolId; public pages resolve the
  // same single FIS school. Hostnames never switch schools.
  //
  // An environment whose database is unusable — e.g. staging while
  // DATABASE_URL is still the documented placeholder
  // (docs/HOSTING-DECISION-2K-USERS.md §9) — renders an honest "setup
  // incomplete" state from environment brand tokens instead of crashing every
  // route at the layout level with a blank 500. Only infrastructure errors
  // degrade; every other error keeps propagating (fail closed, never fake).
  const host = (await headers()).get("host");

  let databaseDegraded = false;
  let session: Awaited<ReturnType<typeof getSession>> = null;
  try {
    session = await getSession();
  } catch (error) {
    // Identity state lookup could not reach the database. Fail closed — treat
    // the visitor as signed out (authenticated routes stay guarded by
    // requireRole/503) — but keep the page shell renderable.
    if (!(error instanceof IdentityCheckUnavailableError)) throw error;
    databaseDegraded = true;
  }

  let schoolId: string | null = null;

  if (session) {
    schoolId = session.schoolId;
  } else if (!databaseDegraded) {
    const resolution = await resolveSchoolForRequestSafe(host);
    if (resolution.databaseError) databaseDegraded = true;
    schoolId = resolution.school?.id ?? null;
  }

  let branding: Awaited<ReturnType<typeof getTenantBranding>> = null;

  // AUD-F5 / W1: the schema.org structured-data block below must never hardcode
  // one school's identity — not in the HTML and not fed to search engines. It
  // describes the resolved school (or brand-token fallback) only, and publishes
  // contacts solely when THIS school has configured them.
  let school: SchoolIdentity | null = null;
  if (schoolId && !databaseDegraded) {
    try {
      branding = await getTenantBranding(schoolId);
      school = await prisma.school.findUnique({
        where: { id: schoolId },
        select: SCHOOL_IDENTITY_SELECT,
      });
    } catch (error) {
      if (!isDatabaseInfrastructureError(error)) throw error;
      databaseDegraded = true;
      branding = null;
      school = null;
    }
  }

  // W1: single-school install — identity comes from the resolved School row,
  // falling back to brand tokens (env). No hard-coded school name, contacts or
  // platform-default branch (F0-21, F0-23).
  const tokens = getSchoolBrandTokens();
  // Empty until the school confirms its address (School profile in the admin area).
  const publicAddress = confirmedSchoolAddress(school?.address);
  const schoolName = school?.name ?? tokens.schoolName;
  const siteUrl = tokens.siteUrl;

  const faviconUrl = branding?.faviconUrl ?? "/logo.png";

  return (
    <html
      lang="en"
      data-theme="light"
      className={`${anton.variable} ${dmSans.variable}`}
      suppressHydrationWarning
    >
      <head>
        <link rel="icon" href={faviconUrl} type="image/png" />
        <link rel="apple-touch-icon" href={faviconUrl} />
        {/* ANTI-FLASH: honor saved preference; otherwise use the botanical light default. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
          (function() {
            try {
              var saved = localStorage.getItem('famex-theme');
              // Famex defaults to its clean botanical light workspace; retain an explicit choice.
              var resolved = (saved === 'dark') ? 'dark' : 'light';
              document.documentElement.setAttribute('data-theme', resolved);
            } catch (e) {
              document.documentElement.setAttribute('data-theme', 'light');
            }
          })();
        `,
          }}
        />
        {/* Structured data — tells Google this is a real school (rich results). */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "School",
              name: schoolName,
              alternateName: schoolName.split("&")[0].trim(),
              description: `${schoolName} — a NERDC-aligned day secondary school (JSS1 to SS3). Powered by ${PRODUCT_NAME}.`,
              url: siteUrl,
              logo: `${siteUrl.replace(/\/$/, "")}/logo.png`,
              // Published only once the school has confirmed its address.
              ...(publicAddress
                ? {
                    address: {
                      "@type": "PostalAddress",
                      streetAddress: publicAddress,
                      addressCountry: "NG",
                    },
                  }
                : {}),
              // AUD-F5 / W1: publish only what THIS school has configured —
              // never another install's phone or email as a fallback.
              ...(school?.phone ? { telephone: school.phone } : {}),
              ...(school?.email ? { email: school.email } : {}),
            }),
          }}
        />
      </head>
      <body className="min-h-screen antialiased bg-[var(--bg-primary)] text-[var(--text-primary)] theme-transition">
        <ThemeProvider>
          <AuthProvider>
            <ToastProvider>
              <AmbientBackdrop />
              <MotionProvider>
                <SchoolProfileProvider
                  value={{
                    name: schoolName,
                    address: publicAddress,
                    phone: school?.phone ?? null,
                    email: school?.email ?? null,
                  }}
                >
                  <div className="relative z-10">
                    {databaseDegraded ? <SetupIncompleteBanner /> : null}
                    {children}
                  </div>
                </SchoolProfileProvider>
              </MotionProvider>
              <CookieConsent />
              <WhatsAppFloat />
              <DemoIndicator />
              <OfflineIndicator />
              <InstallPrompt />
              <RegisterSW />
              <Analytics />
            </ToastProvider>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
