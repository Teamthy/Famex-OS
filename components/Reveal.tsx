"use client";

// Reveal — energetic scroll-reveal for marketing sections (CSS-only).
//
// An IntersectionObserver adds a class when the section enters the viewport;
// the spring-like rise/zoom/blur comes from CSS (app/globals.css), so this
// component — which wraps every below-the-fold section on the public pages —
// ships no animation library on the critical path.
//
// Honours the user's reduced-motion preference (renders immediately, no
// transform). `delay` is in milliseconds.

import { useEffect, useRef, useState } from "react";
import type { CSSProperties, ReactNode } from "react";

const CLASSES = {
  up: "reveal-up",
  left: "reveal-left",
  right: "reveal-right",
  zoom: "reveal-zoom",
  blur: "reveal-blur",
} as const;

export function Reveal({
  children,
  delay = 0,
  variant = "up",
  className,
}: {
  children: ReactNode;
  delay?: number;
  /** Motion personality — vary per section so the page never feels uniform. */
  variant?: keyof typeof CLASSES;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setShown(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setShown(true);
            io.disconnect();
          }
        }
      },
      // Slightly before the section scrolls into view, like the old margin.
      { rootMargin: "-60px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const style: CSSProperties | undefined = delay ? { transitionDelay: `${delay}ms` } : undefined;

  return (
    <div
      ref={ref}
      className={`${CLASSES[variant]} ${shown ? "reveal-shown" : ""} ${className ?? ""}`}
      style={style}
    >
      {children}
    </div>
  );
}
