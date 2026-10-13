"use client";

// AnimatedText — typographic motion system for Ykay College (CSS-only).
//
// Three pieces:
//   AnimatedText — splits text into per-letter spans and springs each one in
//                  with a small rotate/scale overshoot (the "jumpy" feel).
//   WordCycle    — one word at a time from a list, animating in and out.
//   Marquee      — an infinite horizontal band of repeated text.
//
// The animations are plain CSS keyframes (app/globals.css) so this module —
// which renders in the first viewport on the home and virtual pages — ships
// no animation library on the critical path. Below-the-fold sections keep
// framer-motion through LazyMotion and load it after the LCP paint.
//
// All three honour prefers-reduced-motion via the CSS media query (the
// animations switch off; WordCycle also stops cycling). Word wrapping is
// preserved by wrapping each WORD in an inline-block span and only splitting
// letters inside it, so a long headline breaks between words like normal
// text and never mid-word.

import { useEffect, useState } from "react";
import type { CSSProperties, ReactNode } from "react";

/** Elements this component may render as. Kept concrete so the JSX children
 * type stays sound under React 19's stricter intrinsic-element typing. */
type TextTag = "span" | "div" | "p" | "h1" | "h2" | "h3" | "h4";

function usePrefersReducedMotion(): boolean {
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduce(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setReduce(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  return reduce;
}

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

/** Rotating word — animates the current word in; previous word swaps out. */
export function WordCycle({
  words,
  className,
  interval = 2200,
  heavy: _heavy = false,
  smooth = false,
  fitWords = false,
  fitBasis = 100,
  fitMax,
  tracking = 0,
}: {
  words: string[];
  className?: string;
  /** Milliseconds each word stays on screen. */
  interval?: number;
  /** Kept for API compatibility — CSS uses one springy reveal. */
  heavy?: boolean;
  /** Calm swap: plain crossfade with a short eased slide. */
  smooth?: boolean;
  /**
   * Size each word individually so every one spans the same width, however
   * many letters it has. Anton is near-monospaced in caps, so character count
   * is a good enough proxy and needs no measuring in the browser.
   */
  fitWords?: boolean;
  /** Percentage of the container each fitted word should span. */
  fitBasis?: number;
  /** Optional ceiling (any CSS length) so the type stops growing on huge screens. */
  fitMax?: string;
  /** Letter-spacing applied by the caller, in em, so fitting can account for it. */
  tracking?: number;
}) {
  const reduce = usePrefersReducedMotion();
  const [i, setI] = useState(0);
  const count = words.length;

  useEffect(() => {
    if (reduce || count < 2) return;
    const id = window.setInterval(() => setI((prev) => (prev + 1) % count), interval);
    return () => window.clearInterval(id);
  }, [reduce, count, interval]);

  // Per-letter advance widths for Anton caps, as a fraction of the font size.
  // Measured from the rendered face; used so each word can be sized to span
  // the same width without measuring in the browser on every render.
  const ADVANCE: Record<string, number> = {
    A: 0.485,
    B: 0.479,
    C: 0.474,
    D: 0.493,
    E: 0.412,
    F: 0.399,
    G: 0.485,
    H: 0.499,
    I: 0.227,
    J: 0.466,
    K: 0.472,
    L: 0.397,
    M: 0.746,
    N: 0.498,
    O: 0.486,
    P: 0.472,
    Q: 0.494,
    R: 0.477,
    S: 0.461,
    T: 0.396,
    U: 0.474,
    V: 0.469,
    W: 0.712,
    X: 0.484,
    Y: 0.446,
    Z: 0.41,
    " ": 0.234,
  };
  const wordWidth = (word: string) =>
    [...word.toUpperCase()].reduce((sum, ch) => sum + (ADVANCE[ch] ?? 0.47), 0) +
    tracking * word.length;
  const fitSize = (word: string) => {
    const size = `${(fitBasis / wordWidth(word)).toFixed(2)}cqw`;
    return fitMax ? `min(${size}, ${fitMax})` : size;
  };

  if (reduce) {
    return (
      <span className={className} style={fitWords ? { fontSize: fitSize(words[0]) } : undefined}>
        {words[0]}
      </span>
    );
  }

  return (
    <span
      className={className}
      style={{
        display: "inline-grid",
        verticalAlign: "bottom",
        ...(fitWords ? { containerType: "inline-size" as const, width: "100%" } : null),
      }}
    >
      {words.map((word, idx) => (
        <span
          key={word}
          aria-hidden={idx === i ? undefined : "true"}
          className={idx === i ? (smooth ? "anim-rise" : "anim-char") : undefined}
          style={{
            gridArea: "1 / 1",
            display: "inline-block",
            visibility: idx === i ? "visible" : "hidden",
            ...(fitWords ? { fontSize: fitSize(word), whiteSpace: "nowrap" as const } : null),
          }}
        >
          {word}
        </span>
      ))}
    </span>
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
