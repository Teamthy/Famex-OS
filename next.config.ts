import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [{ protocol: "https", hostname: "images.unsplash.com" }],
  },

  // ── Security headers applied to every response ──────────────
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-XSS-Protection", value: "1; mode=block" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            // Default: deny every powerful feature. Routes that genuinely need
            // one are re-granted below — see /admin/staff-attendance.
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
          // Content-Security-Policy is set per request in middleware.ts (see lib/csp.ts).
        ],
      },
      {
        // Staff QR attendance needs the camera.
        //
        // The blanket `camera=()` above is an EMPTY allowlist, which per spec
        // denies every origin including 'self' — so components/StaffQrScanner
        // (html5-qrcode) could never open the camera and QR check-in was dead
        // in the browser. A later, more specific entry wins in Next.js, so
        // this re-grants the camera to this route only; microphone and
        // geolocation stay denied.
        //
        // CORS is deliberately NOT declared here — middleware owns it, so the
        // allowed-origin logic lives in exactly one place. Declaring it in
        // both meant a static header from next.config could contradict the
        // dynamic, origin-aware one middleware sets.
        source: "/admin/staff-attendance",
        headers: [
          {
            key: "Permissions-Policy",
            value: "camera=(self), microphone=(), geolocation=()",
          },
        ],
      },
    ];
  },

  // ── TypeScript — build now fails on type errors (no longer suppressed) ──
  typescript: {
    ignoreBuildErrors: false,
  },

  // ── Power the X-Powered-By header ──────────────────────────
  poweredByHeader: false,

  // ── Standalone output for Docker (traced minimal production image) ──
  output: "standalone",

  // ── Performance optimizations for 1K DAU ──────────────────
  compress: true,

  // Experimental features for better performance
  experimental: {
    // Optimize package imports to reduce bundle size
    optimizePackageImports: ["lucide-react", "@radix-ui/react-dialog", "framer-motion"],
  },
};

export default nextConfig;
