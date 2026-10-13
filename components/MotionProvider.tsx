"use client";

// MotionProvider — global framer-motion config for the below-the-fold and
// portal surfaces that still use `m` (Reveal sections, dialogs, the CBT
// runner).
//
// The domAnimation feature bundle is loaded ASYNC so it never lands in the
// initial render-blocking chunks: the public pages' first paint (which the
// Lighthouse budget in lighthouserc.json measures) ships no animation
// library at all — those components use the CSS utilities in globals.css.
// `m` components simply animate once the features arrive.
//
// reducedMotion="user" makes every motion component respect the OS
// reduced-motion setting app-wide.

import { LazyMotion, MotionConfig } from "framer-motion";
import type { ReactNode } from "react";

const loadFeatures = () => import("framer-motion").then((m) => m.domAnimation);

export function MotionProvider({ children }: { children: ReactNode }) {
  return (
    <LazyMotion features={loadFeatures}>
      <MotionConfig reducedMotion="user">{children}</MotionConfig>
    </LazyMotion>
  );
}
