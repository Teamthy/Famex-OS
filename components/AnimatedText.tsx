// AnimatedText — server-safe typographic motion for Famex International Schools (CSS-only).
//
// Two pieces live here:
//   AnimatedText — splits text into per-letter spans and springs each one in
//                  with a small rotate/scale overshoot (the "jumpy" feel).
//   Marquee      — an infinite horizontal band of repeated text.
//
// The animations are plain CSS keyframes (app/globals.css), so these
// components need no browser state and can render on the server. Keeping them
// out of a client boundary avoids hydrating every headline and letter span on
// the public pages — that hydration was measurable Lighthouse main-thread work
// on the home page. WordCycle, the only piece that needs timers and a media
// query, lives in components/WordCycle.tsx.
//
// All animation honours prefers-reduced-motion via the CSS media query. Word
// wrapping is preserved by wrapping each WORD in an inline-block span and only
// splitting letters inside it, so a long headline breaks between words like
// normal text and never mid-word.

import type { CSSProperties, ReactNode } from "react";

/** Elements this component may render as. Kept concrete so the JSX children
 * type stays sound under React 19's stricter intrinsic-element typing. */
type TextTag = "span" | "div" | "p" | "h1" | "h2" | "h3" | "h4";

/** Per-letter springy reveal. Splits on spaces so words never break apart. */
export function AnimatedText({
  text,
  className,
  as: Tag = "span",
  delay = 0,
  stagger = 0.025,
  heavy = false,
  once: _once = true,
  animateOnLoad: _animateOnLoad = false,
}: {
  text: string;
  className?: string;
  /** Element to render as — e.g. "h1", "h2". Defaults to a span. */
  as?: TextTag;
  /** Delay before the first letter, in SECONDS. */
  delay?: number;
  /** Gap between letters, in SECONDS. */
  stagger?: number;
  /** Heavy editorial reveal: letters rise further, overshoot more and blur in. */
  heavy?: boolean;
  once?: boolean;
  /** Animate immediately on mount instead of when scrolled into view. */
  animateOnLoad?: boolean;
}) {
  const words = text.split(" ");
  let index = 0;

  return (
    <Tag className={className}>
      <span style={{ display: "inline" }}>
        {words.map((word, w) => (
          <span
            key={`${word}-${w}`}
            style={{ display: "inline-block", whiteSpace: "nowrap" }}
            aria-hidden="true"
          >
            {Array.from(word).map((char, c) => {
              const i = index++;
              return (
                <span
                  key={`${char}-${c}`}
                  className={heavy ? "anim-char-heavy" : "anim-char"}
                  style={{ animationDelay: `${(delay + i * stagger).toFixed(3)}s` }}
                >
                  {char}
                </span>
              );
            })}
            {w < words.length - 1 ? " " : null}
          </span>
        ))}
      </span>
      {/* Screen readers get the plain text once, not letter by letter. */}
      <span className="sr-only">{text}</span>
    </Tag>
  );
}

/** Infinite horizontal band. Decorative, so it is hidden from screen readers. */
export function Marquee({
  items,
  className,
  itemClassName,
  duration = 26,
  separator = "·",
}: {
  items: string[];
  className?: string;
  itemClassName?: string;
  /** Seconds for one full loop. */
  duration?: number;
  separator?: ReactNode;
}) {
  const run = [...items, ...items];

  const row = (
    <span style={{ display: "inline-flex", alignItems: "center" }}>
      {run.map((item, i) => (
        <span key={`${item}-${i}`} className={itemClassName}>
          {item}
          <span style={{ padding: "0 0.75em", opacity: 0.55 }}>{separator}</span>
        </span>
      ))}
    </span>
  );

  return (
    <div className={className} aria-hidden="true" style={{ overflow: "hidden" }}>
      <div
        className="anim-marquee"
        style={{ "--marquee-duration": `${duration}s` } as CSSProperties}
      >
        {row}
        {row}
      </div>
    </div>
  );
}

export default AnimatedText;
