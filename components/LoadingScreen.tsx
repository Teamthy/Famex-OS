"use client";

// Branded splash shown while the app hydrates. CSS-only animations (see
// app/globals.css) — this renders in the first viewport, so it must not put
// an animation library on the critical path.

import { useState, useEffect } from "react";

export default function LoadingScreen() {
  const [phase, setPhase] = useState<"visible" | "leaving" | "gone">("visible");

  useEffect(() => {
    const leave = setTimeout(() => setPhase("leaving"), 3000);
    const gone = setTimeout(() => setPhase("gone"), 3800);
    return () => {
      clearTimeout(leave);
      clearTimeout(gone);
    };
  }, []);

  if (phase === "gone") return null;

  return (
    <div
      className={`fixed inset-0 z-[100] flex flex-col items-center justify-center overflow-hidden ${
        phase === "leaving" ? "anim-fade-out" : ""
      }`}
      style={{ backgroundColor: "#050C14" }}
      aria-hidden="true"
    >
      {/* Container to center ring + logo + text vertically */}
      <div className="flex flex-col items-center justify-center gap-16">
        {/* Ring + Logo (perfectly centered) */}
        <div className="relative w-[320px] h-[320px] md:w-[420px] md:h-[420px] flex items-center justify-center">
          {/* Rotating ring text */}
          <div className="absolute inset-0 animate-[rotate-ring_30s_linear_infinite]">
            <svg viewBox="0 0 420 420" width="100%" height="100%" className="overflow-visible">
              <defs>
                <path id="ring-path" d="M 210 36 A 174 174 0 1 1 209.99 36" fill="none" />
              </defs>
              <text
                fill="#4EC54D"
                fillOpacity="0.6"
                fontSize="15"
                fontFamily="var(--font-body), sans-serif"
                fontWeight="700"
                letterSpacing="8"
              >
                <textPath href="#ring-path" startOffset="0%">
                  YKAY COLLEGE · EXCELLENCE · LEADERSHIP · YKAY COLLEGE ·
                </textPath>
              </text>
            </svg>
          </div>

          {/* Logo in center */}
          <div
            className="anim-pop relative z-10 bg-white rounded-3xl p-6 shadow-2xl"
            style={{ animationDelay: "0.3s" }}
          >
            {/* Static WebP — no on-demand /_next/image conversion on a cold
                server (the splash shows on first paint). */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/ykay-logo-280.webp"
              alt="Ykay College Logo"
              width={140}
              height={140}
              decoding="async"
              className="w-24 h-24 md:w-32 md:h-32 object-contain"
            />
          </div>
        </div>

        {/* Reveal text (properly aligned below) */}
        <div className="anim-rise text-center" style={{ animationDelay: "1s" }}>
          <div className="font-display text-2xl md:text-3xl tracking-[6px] text-white mb-3">
            EXCELLENCE IN EDUCATION
          </div>
          <div className="font-body text-[11px] tracking-[4px] text-brand-green font-bold">
            LEADERSHIP · CHARACTER · KNOWLEDGE
          </div>
        </div>

        {/* Progress bar */}
        <div
          className="anim-rise w-48 h-1 rounded-full bg-white/10 overflow-hidden"
          style={{ animationDelay: "1.5s" }}
        >
          <div className="anim-progress h-full bg-gradient-to-r from-brand-green to-brand-orange" />
        </div>
      </div>
    </div>
  );
}
