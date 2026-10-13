"use client";

// AmbientBackdrop — a site-wide animated background so no page sits on a
// flat color: two large brand-tinted glows drift slowly across the viewport
// and a fine grid breathes behind them. Transform/opacity keyframes only
// (composited, cheap); fully disabled for prefers-reduced-motion users.
// Colors ride the theme tokens, so dark and light both look right.

export function AmbientBackdrop() {
  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
      {/* drifting brand glows */}
      <div className="ambient-blob ambient-blob-a" />
      <div className="ambient-blob ambient-blob-b" />
      {/* breathing hairline grid */}
      <div className="ambient-grid" />
    </div>
  );
}
