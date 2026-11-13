"use client";

import { useCallback, useEffect, useState } from "react";
import { ArrowRight, ChevronLeft, ChevronRight } from "lucide-react";
import { SERIF } from "./theme";

export type HeroSlide = { src: string; alt: string; avif?: string };
const ROTATE_MS = 6500;

/** Split editorial campus hero with a quiet paper canvas and a vivid photo panel. */
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
  const [restMounted, setRestMounted] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setRestMounted(true), 6000);
    return () => clearTimeout(timer);
  }, []);

  const go = useCallback(
    (next: number) => setIndex((next + slides.length) % slides.length),
    [slides.length],
  );

  useEffect(() => {
    if (
      paused ||
      slides.length < 2 ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    )
      return;
    const timer = setInterval(() => setIndex((i) => (i + 1) % slides.length), ROTATE_MS);
    return () => clearInterval(timer);
  }, [paused, slides.length]);

  return (
    <section
      id="top"
      aria-label="Campus highlights"
      className="px-3 pb-4 sm:px-5 sm:pb-5"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={(event) => {
        if (!event.currentTarget.contains(document.activeElement)) setPaused(false);
      }}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={(event) => {
        const nextTarget = event.relatedTarget;
        if (!(nextTarget instanceof Node) || !event.currentTarget.contains(nextTarget))
          setPaused(false);
      }}
    >
      <div className="mx-auto max-w-[1480px] overflow-hidden rounded-[28px] bg-[var(--home-paper)] shadow-[0_26px_75px_rgba(8,45,32,.12)] sm:rounded-[34px]">
        <div className="grid lg:grid-cols-[.96fr_1.04fr]">
          <div className="flex flex-col justify-between px-6 pb-8 pt-8 sm:px-10 sm:pb-10 sm:pt-10 lg:px-12 lg:py-12 xl:px-16">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-[var(--home-dark)] px-3.5 py-2 text-[9px] font-bold uppercase tracking-[.15em] text-white sm:text-[10px]">
                {schoolName} · Lagos
              </span>
              <span className="rounded-full bg-[#e9eee3] px-3.5 py-2 text-[9px] font-bold uppercase tracking-[.12em] text-[var(--home-dark)] sm:text-[10px]">
                Pre-school to SS3
              </span>
            </div>

            <div className="mt-9 max-w-[650px] sm:mt-12 lg:my-auto lg:py-10">
              <p className="mb-4 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[.2em] text-[var(--home-dark-soft)] sm:text-xs">
                <span className="h-2 w-2 rounded-full bg-[var(--home-lime)]" aria-hidden="true" />A
                school for the whole journey
              </p>
              <h1
                className={`${SERIF} text-[clamp(2.35rem,7.5vw,6.4rem)] leading-[.94] tracking-[-.045em] text-[var(--home-dark)]`}
              >
                A bright start.
                <br />
                <span className="bg-[linear-gradient(transparent_63%,var(--home-lime)_63%)]">
                  A bold future.
                </span>
              </h1>
              <p className="mt-5 max-w-[510px] text-sm leading-6 text-[var(--home-muted)] sm:mt-6 sm:text-base sm:leading-7">
                {motto} — a joyful, rigorous school journey where strong learning, character and
                care help every child grow with confidence.
              </p>
              <div className="mt-6 flex flex-wrap items-center gap-3 sm:mt-8">
                <a
                  href="/admissions"
                  className="inline-flex items-center gap-3 rounded-full bg-[var(--home-lime)] px-5 py-3.5 text-xs font-bold text-[var(--home-dark)] transition hover:bg-[#d9ff7a] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--home-dark)] sm:px-6 sm:text-sm"
                >
                  Explore admissions <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </a>
                <a
                  href="#campus"
                  className="rounded-full px-4 py-3 text-xs font-bold text-[var(--home-dark)] transition hover:bg-[#e9eee3] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--home-dark)] sm:text-sm"
                >
                  Take the campus tour <span aria-hidden="true">↗</span>
                </a>
              </div>
            </div>

            <div className="mt-8 flex items-center gap-3 border-t border-[var(--home-line)] pt-5 text-[10px] font-semibold text-[var(--home-dark-soft)] sm:mt-10 sm:pt-6 sm:text-xs">
              <span>Pre-school</span>
              <span className="h-1 w-1 rounded-full bg-[var(--home-lime)]" aria-hidden="true" />
              <span>Primary</span>
              <span className="h-1 w-1 rounded-full bg-[var(--home-lime)]" aria-hidden="true" />
              <span>JSS</span>
              <span className="h-1 w-1 rounded-full bg-[var(--home-lime)]" aria-hidden="true" />
              <span>SSS</span>
            </div>
          </div>

          <div className="relative min-h-[300px] overflow-hidden bg-[var(--home-dark)] sm:min-h-[430px] lg:min-h-[630px]">
            {slides.map((slide, i) =>
              i === 0 || restMounted ? (
                <picture
                  key={slide.src}
                  className={`absolute inset-0 h-full w-full transition-opacity duration-700 ${i === index ? "opacity-100" : "opacity-0"}`}
                >
                  {slide.avif ? <source srcSet={slide.avif} type="image/avif" /> : null}
                  <img
                    src={slide.src}
                    alt={slide.alt}
                    loading={i === 0 ? "eager" : "lazy"}
                    fetchPriority={i === 0 ? "high" : "low"}
                    decoding="async"
                    aria-hidden={i !== index}
                    className="h-full w-full object-cover object-center"
                  />
                </picture>
              ) : null,
            )}
            <div
              className="absolute inset-0 bg-[linear-gradient(180deg,rgba(8,45,32,.18)_0%,transparent_36%,rgba(8,45,32,.52)_100%)]"
              aria-hidden="true"
            />

            <div className="absolute left-4 top-4 rounded-full border border-white/70 bg-[var(--home-paper)]/95 px-3.5 py-2 text-[9px] font-bold uppercase tracking-[.14em] text-[var(--home-dark)] shadow-sm backdrop-blur sm:bottom-5 sm:left-5 sm:top-auto sm:px-4 sm:py-2.5 sm:text-[10px]">
              Learning, growing, belonging
            </div>

            <aside
              aria-label="School at a glance"
              className="absolute bottom-[4.5rem] left-4 hidden w-[210px] rounded-[18px] bg-[var(--home-paper)] p-3.5 shadow-[0_14px_40px_rgba(0,0,0,.24)] sm:block lg:bottom-6 lg:left-6 lg:w-[230px] lg:p-4"
            >
              <p
                className={`${SERIF} text-[1.65rem] uppercase leading-none text-[var(--home-dark)] lg:text-3xl`}
              >
                6 stages
              </p>
              <p className="mt-2 text-[11px] leading-5 text-[var(--home-muted)] lg:text-xs">
                One connected journey from early years to senior secondary.
              </p>
            </aside>

            <div className="absolute bottom-4 right-4 z-20 flex items-center gap-1.5 sm:bottom-5 sm:right-5 lg:bottom-6 lg:right-6">
              <button
                type="button"
                onClick={() => go(index - 1)}
                aria-label="Previous campus image"
                className="grid h-9 w-9 place-items-center rounded-full border border-white/60 bg-[var(--home-dark)]/70 text-white backdrop-blur transition hover:bg-white hover:text-[var(--home-dark)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white sm:h-10 sm:w-10"
              >
                <ChevronLeft className="h-4 w-4" aria-hidden="true" />
              </button>
              <div
                className="flex items-center gap-1.5 px-1"
                role="group"
                aria-label="Campus image position"
              >
                {slides.map((slide, i) => (
                  <button
                    key={slide.src}
                    type="button"
                    onClick={() => go(i)}
                    aria-label={`Show campus image ${i + 1} of ${slides.length}`}
                    aria-current={i === index}
                    className={`h-2 rounded-full transition-all focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white ${i === index ? "w-6 bg-[var(--home-lime)]" : "w-2 bg-white/80 hover:bg-white"}`}
                  />
                ))}
              </div>
              <button
                type="button"
                onClick={() => go(index + 1)}
                aria-label="Next campus image"
                className="grid h-9 w-9 place-items-center rounded-full border border-white/60 bg-[var(--home-dark)]/70 text-white backdrop-blur transition hover:bg-white hover:text-[var(--home-dark)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white sm:h-10 sm:w-10"
              >
                <ChevronRight className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
