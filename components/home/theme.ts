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

/** The forest, lime and paper palette used across the public home. */
export const HOME_BG = "var(--famex-page-bg)";
export const HOME_INK = "var(--famex-ink)";
export const HOME_SAGE = "var(--famex-lime)";
export const HOME_SAGE_DEEP = "var(--famex-forest-mid)";
export const HOME_CLAY = "var(--famex-lime-soft)";
export const HOME_CARD = "var(--famex-white)";
export const HOME_DARK = "var(--famex-forest-dark)";
