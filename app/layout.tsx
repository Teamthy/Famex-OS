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

export const metadata: Metadata = {
  // Derived from env so a preview deployment does not advertise production
  // URLs. The literal was ykaycollege.com — a domain the school does not own,
  // which made every canonical link and social card point at the wrong site.
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "https://ykaycollege.edu.ng"),
  title: {
    default: "Ykay College & Leadership Academy — Excellence in Education",
    template: "%s | Ykay College",
  },
  description:
    "A premium day secondary school (JSS1–SS3). NERDC-aligned curriculum, digital learning, leadership development.",
  keywords: "Ykay College, secondary school, NERDC, WAEC, BECE, JSS, SS",
  openGraph: {
    title: "Ykay College & Leadership Academy",
    description: "Excellence in education for JSS1 to SS3.",
    siteName: "Ykay College",
    locale: "en_NG",
    type: "website",
    url: process.env.NEXT_PUBLIC_SITE_URL || "https://ykaycollege.edu.ng",
    images: [{ url: "/ykay-logo.png", width: 800, height: 800, alt: "Ykay College Logo" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Ykay College & Leadership Academy",
    description: "Excellence in education for JSS1 to SS3.",
    images: ["/ykay-logo.png"],
  },
  robots: { index: true, follow: true },
  icons: {
    icon: [
      { url: "/ykay-logo.png", sizes: "any", type: "image/png" },
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
    ],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
    shortcut: "/icons/icon-192.png",
  },
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Ykay College",
  },
};

export const viewport: Viewport = {
  themeColor: "#0c1824",
  width: "device-width",
  initialScale: 1,
};

import { headers } from "next/headers";
import { getSession } from "@/lib/session";
import { resolveTenantFromHost } from "@/lib/tenant";
import { getTenantBranding, DEFAULT_BRANDING } from "@/lib/branding";
import { prisma } from "@/lib/prisma";
import { DEFAULT_SLUG } from "@/lib/tenant";

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // ── Resolve branding (per tenant) ──
  // For AUTHENTICATED users, use THEIR school's branding (from the session's
  // schoolId — so a new school's colours show immediately after signup, even
  // on localhost where host resolution falls back to the default school).
  // For PUBLIC pages (no session), resolve from hostname.
  const host = (await headers()).get("host");
  const session = await getSession();

  let schoolId: string | null = null;

  if (session) {
    schoolId = session.schoolId;
  } else {
    const { tenant } = await resolveTenantFromHost(host);
    schoolId = tenant?.id ?? null;
  }

  const branding = schoolId ? await getTenantBranding(schoolId) : null;

  // AUD-F5: the schema.org structured-data block below used to hardcode YKAY
  // College's identity on EVERY tenant's pages — in the HTML itself and fed
  // to search engines. Describe the resolved school instead; the YKAY values
  // remain the platform defaults for the default/unmatched case so tenant A's
  // markup is unchanged.
  const school = schoolId
    ? await prisma.school.findUnique({
        where: { id: schoolId },
        select: { slug: true, name: true, address: true, phone: true, email: true },
      })
    : null;
  const isPlatformDefaultSchool = !school || school.slug === DEFAULT_SLUG;
  // Empty until the school confirms its address (School profile in the admin area).
  const publicAddress = confirmedSchoolAddress(school?.address);
  const schoolName = school?.name ?? "Ykay College & Leadership Academy";
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://ykaycollege.edu.ng";

  const primary = branding?.primaryColor ?? DEFAULT_BRANDING.primaryColor;
  const secondary = branding?.secondaryColor ?? DEFAULT_BRANDING.secondaryColor;
  const accent = branding?.accentColor ?? DEFAULT_BRANDING.accentColor;
  const faviconUrl = branding?.faviconUrl ?? "/ykay-logo.png";

  return (
    <html
      lang="en"
      data-theme="dark"
      className={`${anton.variable} ${dmSans.variable}`}
      suppressHydrationWarning
    >
      <head>
        <link rel="icon" href={faviconUrl} type="image/png" />
        <link rel="apple-touch-icon" href={faviconUrl} />
        {/* Inject per-tenant brand palette as CSS variable overrides.
            Only navy / navy-light / green are driven by tenant branding so the
            nuanced green-dark/light + full orange shades in globals.css are
            preserved (gives Ykay its proper depth, not flat blue). */}
        <style
          dangerouslySetInnerHTML={{
            __html: `:root{--color-brand-navy:${primary};--color-brand-navy-light:${secondary};--color-brand-green:${accent};}`,
          }}
        />
        {/* ANTI-FLASH: force dark mode as default before hydration */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
          (function() {
            try {
              var saved = localStorage.getItem('ykay-theme');
              // Default to dark unless user explicitly chose light
              var resolved = (saved === 'light') ? 'light' : 'dark';
              document.documentElement.setAttribute('data-theme', resolved);
            } catch (e) {
              document.documentElement.setAttribute('data-theme', 'dark');
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
              description: isPlatformDefaultSchool
                ? "Premium day secondary school (JSS1 to SS3) — NERDC-aligned academics, IT education and leadership training."
                : `${schoolName} — school portal powered by YKAY EDUportal.`,
              url: siteUrl,
              logo: `${siteUrl.replace(/\/$/, "")}/ykay-logo.png`,
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
              telephone: school?.phone ?? "+2347015374411",
              // AUD-F5: never publish another school's email — omit the field
              // when this school has none.
              ...(school?.email
                ? { email: school.email }
                : isPlatformDefaultSchool
                  ? { email: "info@ykaycollege.com" }
                  : {}),
              // Platform-default extras (no per-tenant source for these).
              ...(isPlatformDefaultSchool
                ? { openingHours: "Mo-Fr 07:30-14:30", sameAs: ["https://virtual.ykaycollege.com"] }
                : {}),
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
                <SchoolProfileProvider value={{ name: schoolName, address: publicAddress }}>
                  <div className="relative z-10">{children}</div>
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
