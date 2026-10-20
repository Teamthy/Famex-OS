"use client";

// WordCycle — the rotating-word piece of the typographic motion system.
//
// This is separate from AnimatedText/Marquee because it is the only piece
// that needs browser state, an interval, and a reduced-motion media query.
// Keeping the client boundary here lets the CSS-only headline and marquee
// components render on the server without hydrating public pages.

import { useEffect, useState } from "react";

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

export default WordCycle;
