"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

/**
 * Last-resort error boundary — catches failures in the root layout itself,
 * which app/error.tsx cannot.
 *
 * Also the only place a hydration or layout crash gets reported at all. Before
 * this, such a failure showed the user a blank page and told nobody.
 */
export default function GlobalError({
  error,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          fontFamily: "system-ui, -apple-system, sans-serif",
          display: "flex",
          minHeight: "100vh",
          alignItems: "center",
          justifyContent: "center",
          margin: 0,
          padding: "1.5rem",
          background: "#f8fafc",
          color: "#0f172a",
        }}
      >
        <div style={{ maxWidth: "32rem", textAlign: "center" }}>
          <h1 style={{ fontSize: "1.5rem", marginBottom: "0.75rem" }}>Something went wrong</h1>
          <p style={{ color: "#475569", lineHeight: 1.6 }}>
            The page could not be displayed. The problem has been reported to the school&apos;s
            technical team.
          </p>
          {error.digest ? (
            <p style={{ color: "#94a3b8", fontSize: "0.8rem", marginTop: "1rem" }}>
              Reference: {error.digest}
            </p>
          ) : null}
          <a
            href="/"
            style={{
              display: "inline-block",
              marginTop: "1.5rem",
              padding: "0.75rem 1.5rem",
              borderRadius: "9999px",
              background: "#0f5132",
              color: "#fff",
              textDecoration: "none",
              fontWeight: 600,
            }}
          >
            Back to the homepage
          </a>
        </div>
      </body>
    </html>
  );
}
