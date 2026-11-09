/**
 * Shared display-serif class for the public home redesign (2026-11-10).
 *
 * The Fraunces variable font is self-hosted from public/fonts via
 * hand-written @font-face rules in app/globals.css (its --font-fraunces
 * variable is defined on :root there), so every home section can opt into
 * the editorial serif (with true italics) without touching the portal's
 * type system. app/page.tsx preloads the upright woff2 explicitly (the
 * italic face stays a CSS-discovered second wave — see the comment there).
 */
export const SERIF = "font-[family-name:var(--font-fraunces)]";

/** The warm paper palette of the home redesign, as Tailwind-ready literals. */
export const HOME_BG = "#f6f1e8";
export const HOME_INK = "#211d19";
export const HOME_SAGE = "#7fb069";
export const HOME_SAGE_DEEP = "#5d8f4e";
export const HOME_CLAY = "#c96f4a";
export const HOME_CARD = "#fffdf8";
export const HOME_DARK = "#20261f";
