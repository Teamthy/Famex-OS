import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Printable report card.
 *
 * A parent printed a five-subject report card and got THREE pages, with the
 * first and last nearly empty and headings shattered into "O F F I C I A L".
 *
 * Two independent causes, both invisible on screen:
 *
 *  1. The page's own chrome had no `no-print`. The hero band and the whole
 *     "Available Report Cards" chooser — heading, child tabs, and a
 *     five-column table of every card — printed as page 1, pushing the actual
 *     document onto pages 2 and 3.
 *
 *  2. `LiveReportCardPreview` never carried the `report-card-sheet` class, so
 *     none of the print rules in globals.css applied to it. Its on-screen
 *     padding (px-8 py-10 across five stacked sections) and display type
 *     (text-5xl) went to paper at full size.
 *
 * Print layout has no runtime assertion available to us — there is no browser
 * here — so these tests pin the STRUCTURE the print CSS depends on. They would
 * have caught both causes.
 */

const ROOT = process.cwd();
const read = (p: string) => readFileSync(join(ROOT, p), "utf8");

describe("report card is printable on one sheet", () => {
  const css = read("app/globals.css");
  const preview = read("components/LiveReportCardPreview.tsx");
  const parentPage = read("app/parent/report-cards/page.tsx");

  it("the preview component carries the print hook class", () => {
    // Without this, every rule below targets nothing.
    expect(preview).toContain("report-card-sheet");
  });

  it("the parent page hides its hero from print", () => {
    const heroLine = parentPage
      .split("\n")
      .find((line) => line.includes("bg-brand-navy") && line.includes("<section"));
    expect(heroLine, "hero <section> not found").toBeTruthy();
    expect(heroLine).toContain("no-print");
  });

  it("the parent page hides the card chooser from print", () => {
    // The chooser wraps the table of available cards. It was page 1.
    // Matched on the element that CONTAINS the chooser heading rather than by
    // line, because the class list wraps across lines in the source.
    const headingAt = parentPage.indexOf("Available Report Cards");
    expect(headingAt, "chooser heading not found").toBeGreaterThan(-1);
    // The nearest wrapper opened before the heading must be no-print.
    const before = parentPage.slice(0, headingAt);
    const lastPanel = before.lastIndexOf("rounded-[2rem] border");
    expect(lastPanel).toBeGreaterThan(-1);
    expect(before.slice(lastPanel - 40, lastPanel)).toContain("no-print");
  });

  it("print CSS collapses the on-screen padding", () => {
    // px-8 py-10 over five sections is ~9cm of whitespace on paper.
    expect(css).toMatch(/\.report-card-sheet \[class\*="px-8"\]/);
    expect(css).toMatch(/\.report-card-sheet \[class\*="py-10"\]/);
  });

  it("print CSS shrinks the display type", () => {
    // text-5xl at 48px is a fifth of an A4 page.
    expect(css).toMatch(/\.report-card-sheet \[class\*="text-5xl"\]/);
  });

  /**
   * The "O F F I C I A L" symptom. Wide tracking gives the line breaker a
   * break opportunity between every glyph, so a narrow print column splits
   * the word into individual letters.
   */
  it("print CSS neutralises letter-spacing so headings do not shatter", () => {
    const block = css.slice(css.indexOf("@media print"));
    expect(block).toMatch(/letter-spacing:\s*normal\s*!important/);
    expect(block).toMatch(/word-break:\s*keep-all/);
  });

  it("the card is never split across sheets", () => {
    const block = css.slice(css.indexOf("@media print"));
    const sheet = block.slice(block.indexOf(".report-card-sheet {"));
    expect(sheet).toMatch(/break-inside:\s*avoid/);
  });

  it("keeps the marks table intact and legible", () => {
    expect(css).toMatch(/\.report-card-sheet table/);
    const table = css.slice(css.indexOf(".report-card-sheet table"));
    expect(table).toMatch(/break-inside:\s*avoid/);
  });

  /**
   * A guard against re-introducing the bug by adding a new full-bleed section
   * to the page. Every <section> on a printable page should either be the
   * document or be hidden.
   */
  it("every hero-style section on the parent page is no-print", () => {
    const offenders = parentPage
      .split("\n")
      .filter((line) => line.includes("<section") && line.includes("bg-brand-navy"))
      .filter((line) => !line.includes("no-print"));
    expect(offenders).toEqual([]);
  });
});
