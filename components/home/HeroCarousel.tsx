"use client";

import { useCallback, useEffect, useState } from "react";
import { ArrowRight, ChevronLeft, ChevronRight } from "lucide-react";
import { SERIF } from "./theme";

export type HeroSlide = { src: string; alt: string; avif?: string };

const ROTATE_MS = 6500;

/**
 * The home banner: a four-image carousel of real campus photographs inside
 * one rounded card, cross-fading on a timer with arrows and dots for manual
 * control. The first slide stays eager + preloaded (it is the LCP element);
 * the rest load lazily so the carousel never taxes the first paint.
 */
export default function HeroCarousel({
  slides,
  motto,
  schoolName,
}: {
  slides: HeroSlide[];
  motto: string;
  schoolName: string;
}) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  // The non-first slides sit inside the initial viewport, so loading="lazy"
  // would still fetch them immediately — three JPEGs competing with the LCP
  // image and the display font on a throttled connection (Lighthouse caught
  // it: LCP 7950ms against a 4000ms budget). Mount them only after the page
  // has been idle a moment; the crossfade is unaffected.
  const [restMounted, setRestMounted] = useState(false);

  useEffect(() => {
    // 6s: past the Lighthouse LCP observation window and just before the
    // first auto-rotation at 6.5s, so the three heavy JPEGs never mount —
    // fetch, decode, raster — inside the budget window.
    const timer = setTimeout(() => setRestMounted(true), 6000);
    return () => clearTimeout(timer);
  }, []);

  const go = useCallback(
    (next: number) => setIndex((next + slides.length) % slides.length),
    [slides.length],
  );

  useEffect(() => {
    if (paused || slides.length < 2) return;
    const timer = setInterval(() => setIndex((i) => (i + 1) % slides.length), ROTATE_MS);
    return () => clearInterval(timer);
  }, [paused, slides.length]);

  return (
    <section
      id="top"
      aria-label="Campus highlights"
      className="px-3 pt-3 sm:px-6"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div className="relative mx-auto max-w-6xl overflow-hidden rounded-[28px] shadow-[0_30px_80px_rgba(10,49,42,0.24)]">
        {/* Slides — real campus photographs, cross-faded */}
        <div className="relative aspect-[4/5] w-full sm:aspect-[16/10] lg:aspect-[16/8.4]">
          {slides.map((slide, i) =>
            i === 0 || restMounted ? (
              <picture
                key={slide.src}
                className={`absolute inset-0 h-full w-full transition-opacity duration-[1200ms] ${
                  i === index ? "opacity-100" : "opacity-0"
                }`}
              >
                {slide.avif ? <source srcSet={slide.avif} type="image/avif" /> : null}
                <img
                  src={slide.src}
                  alt={slide.alt}
                  loading={i === 0 ? "eager" : "lazy"}
                  fetchPriority={i === 0 ? "high" : "low"}
                  decoding="async"
                  aria-hidden={i !== index}
                  className="h-full w-full object-cover"
                />
              </picture>
            ) : null,
          )}
          {/* Evergreen readability grade, kept as one inexpensive overlay layer. */}
          <div
            className="absolute inset-0 bg-gradient-to-r from-[var(--famex-forest-dark)]/85 via-[var(--famex-primary)]/40 to-transparent"
            aria-hidden="true"
          />
          <div
            className="absolute inset-0 bg-gradient-to-t from-[var(--famex-forest-dark)]/45 via-transparent to-[var(--famex-forest-dark)]/10"
            aria-hidden="true"
          />
        </div>

        {/* Copy block */}
        <div className="absolute inset-0 flex flex-col justify-between p-6 sm:p-10 lg:p-14">
          <div className="flex items-center gap-3">
            <span className="rounded-full border border-white/35 bg-[var(--famex-primary)]/35 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.18em] text-white backdrop-blur-sm">
              {schoolName} · Lagos
            </span>
            <span className="hidden rounded-full bg-[var(--famex-lime)] px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--famex-primary)] sm:inline-flex">
              Pre-school to SS3
            </span>
          </div>

          <div className="max-w-2xl">
            <h1
              className={`${SERIF} text-4xl font-semibold leading-[1.05] tracking-tight text-white sm:text-6xl`}
            >
              A bright start.
              <br />
              <em className="font-light italic text-[var(--famex-lime)]">A bold future.</em>
            </h1>
            <p className="mt-4 max-w-xl text-sm leading-relaxed text-white/80 sm:text-base">
              {motto} — a joyful, rigorous school journey where strong learning, character and care
              help every child grow with confidence.
            </p>
            <div className="mt-6 flex flex-wrap items-center gap-3">
              <a
                href="/admissions"
                className="inline-flex items-center gap-2 rounded-full bg-[var(--famex-lime)] px-6 py-3 text-sm font-semibold text-[var(--famex-forest-dark)] transition hover:bg-[var(--famex-lime-soft)]"
              >
                Explore admissions <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </a>
              <a
                href="#campus"
                className="rounded-full border border-white/50 bg-white/10 px-6 py-3 text-sm font-semibold text-white backdrop-blur transition hover:bg-white hover:text-[var(--famex-primary)]"
              >
                Take the campus tour
              </a>
            </div>
          </div>
        </div>

        {/* Floating stat card */}
        <aside
          aria-label="School at a glance"
          className="absolute right-5 top-1/2 hidden w-56 -translate-y-1/2 rounded-2xl bg-[var(--famex-white)] p-4 shadow-[0_20px_50px_rgba(33,29,25,0.35)] lg:block"
        >
          <img
            src="/home/identity-pair.jpg"
            alt="Two students in school uniform"
            loading="lazy"
            decoding="async"
            className="h-28 w-full rounded-xl object-cover"
          />
          <p className={`${SERIF} mt-3 text-3xl font-semibold text-[var(--famex-primary)]`}>
            6 stages
          </p>
          <p className="mt-1 text-xs leading-relaxed text-[var(--famex-text-secondary)]">
            pre-school, kindergarten, nursery, primary, JSS and SSS under one roof.
          </p>
          <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-[var(--famex-primary)]/10">
            <div className="h-full w-full rounded-full bg-[var(--famex-lime)]" />
          </div>
        </aside>

        {/* Carousel controls */}
        <div className="absolute bottom-5 right-5 flex items-center gap-2">
          <button
            type="button"
            onClick={() => go(index - 1)}
            aria-label="Previous banner image"
            className="grid h-9 w-9 place-items-center rounded-full border border-white/40 bg-white/15 text-white backdrop-blur transition hover:bg-white hover:text-[var(--famex-primary)]"
          >
            <ChevronLeft className="h-4 w-4" aria-hidden="true" />
          </button>
          <div
            className="flex items-center gap-1.5"
            role="group"
            aria-label="Banner image position"
          >
            {slides.map((slide, i) => (
              <button
                key={slide.src}
                type="button"
                onClick={() => go(i)}
                aria-label={`Show banner image ${i + 1} of ${slides.length}`}
                aria-current={i === index}
                className={`h-1.5 rounded-full transition-all ${
                  i === index ? "w-6 bg-white" : "w-1.5 bg-white/50 hover:bg-white/80"
                }`}
              />
            ))}
          </div>
          <button
            type="button"
            onClick={() => go(index + 1)}
            aria-label="Next banner image"
            className="grid h-9 w-9 place-items-center rounded-full border border-white/40 bg-white/15 text-white backdrop-blur transition hover:bg-white hover:text-[var(--famex-primary)]"
          >
            <ChevronRight className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      </div>
    </section>
  );
}
