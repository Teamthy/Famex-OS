import Script from "next/script";

// Analytics — privacy-friendly, cookieless, and OFF until configured.
// Set NEXT_PUBLIC_PLAUSIBLE_DOMAIN (e.g. ykaycollege.edu.ng) in the environment
// and page views are measured. Without the env var this renders nothing
// (no scripts, no requests, no consent banner needed — Plausible sets no
// cookies and collects no personal data).
//
// The matching CSP allowances (script-src / connect-src plausible.io) are
// added in next.config.ts only when the same env var is set.
export function Analytics() {
  const domain = process.env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN;
  if (!domain) return null;
  return (
    <Script
      src="https://plausible.io/js/script.js"
      strategy="afterInteractive"
      data-domain={domain}
      defer
    />
  );
}

export default Analytics;
