"use client";

import { useCallback, useEffect, useState } from "react";
import { ArrowRight, ChevronLeft, ChevronRight } from "lucide-react";
import { SERIF } from "./theme";

export type HeroSlide = { src: string; alt: string; avif?: string };
const ROTATE_MS = 6500;

/** Full-bleed editorial campus hero with a deliberate dark grade and accessible controls. */
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
      className="px-3 sm:px-5"
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
      <div className="relative mx-auto max-w-[1480px] overflow-hidden rounded-[28px] bg-[var(--home-dark)] shadow-[0_32px_90px_rgba(8,45,32,.2)] sm:rounded-[34px]">
        <div className="relative min-h-[690px] sm:min-h-[650px] lg:min-h-[min(760px,88vh)]">
          {slides.map((slide, i) =>
            i === 0 || restMounted ? (
              <picture
                key={slide.src}
                className={`absolute inset-0 h-full w-full transition-opacity duration-1000 ${i === index ? "opacity-100" : "opacity-0"}`}
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
            className="absolute inset-0 bg-[linear-gradient(90deg,rgba(5,34,23,.94)_0%,rgba(5,34,23,.82)_36%,rgba(5,34,23,.35)_72%,rgba(5,34,23,.12)_100%)]"
            aria-hidden="true"
          />
          <div
            className="absolute inset-0 bg-[linear-gradient(0deg,rgba(5,34,23,.48),transparent_40%)]"
            aria-hidden="true"
          />

          <div className="relative z-10 flex min-h-[690px] flex-col justify-between px-6 pb-20 pt-16 sm:min-h-[650px] sm:px-10 sm:pb-16 sm:pt-20 lg:min-h-[min(760px,88vh)] lg:px-[7%] lg:py-20">
            <div className="flex items-center gap-2.5">
              <span className="rounded-full border border-white/25 bg-white/10 px-3.5 py-1.5 text-[10px] font-bold uppercase tracking-[.17em] text-[#ffffff] backdrop-blur-sm">
                {schoolName} · Lagos
              </span>
              <span className="hidden rounded-full bg-[var(--home-lime)] px-3.5 py-1.5 text-[10px] font-bold uppercase tracking-[.12em] text-[var(--home-dark)] sm:inline-flex">
                Pre-school to SS3
              </span>
            </div>

            <div className="max-w-[720px] pb-4 sm:pb-0">
              <p className="mb-4 text-xs font-bold uppercase tracking-[.22em] text-[var(--home-lime)] sm:text-sm">
                A school for the whole journey
              </p>
              <h1
                className={`${SERIF} text-[clamp(2.8rem,8vw,7.6rem)] uppercase leading-[.89] tracking-[-.035em] text-[#ffffff]`}
              >
                A bright start.
                <br />
                <em className="font-normal not-italic text-[var(--home-lime)]">A bold future.</em>
              </h1>
              <p className="mt-6 max-w-[580px] text-sm leading-7 text-[#f2f6f3] sm:text-base sm:leading-8">
                {motto} — a joyful, rigorous school journey where strong learning, character and
                care help every child grow with confidence.
              </p>
              <div className="mt-7 flex flex-wrap items-center gap-3">
                <a
                  href="/admissions"
                  className="inline-flex items-center gap-3 rounded-full bg-[var(--home-lime)] px-6 py-3.5 text-sm font-bold text-[var(--home-dark)] transition hover:bg-white"
                >
                  Explore admissions <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </a>
                <a
                  href="#campus"
                  className="rounded-full border border-white/40 bg-white/10 px-6 py-3.5 text-sm font-semibold text-[#ffffff] backdrop-blur transition hover:bg-white hover:text-[var(--home-dark)]"
                >
                  Take the campus tour
                </a>
              </div>
            </div>

            <div className="hidden items-center gap-5 text-[11px] font-semibold text-[#ffffff] sm:flex">
              <span>Pre-school · Primary · JSS · SSS</span>
              <span className="h-px w-12 bg-[var(--home-lime)]" />
              <span>One continuous school journey</span>
            </div>
          </div>

          <aside
            aria-label="School at a glance"
            className="absolute right-[5%] top-1/2 z-10 hidden w-[230px] -translate-y-1/2 rounded-[22px] bg-white p-3.5 shadow-[0_20px_60px_rgba(0,0,0,.32)] xl:block"
          >
            <img
              src="/home/identity-pair.jpg"
              alt="Two Famex students in school uniform"
              loading="lazy"
              decoding="async"
              className="h-36 w-full rounded-[15px] object-cover"
            />
            <div className="px-1 pb-1 pt-3">
              <p className={`${SERIF} text-3xl uppercase leading-none text-[var(--home-dark)]`}>
                6 stages
              </p>
              <p className="mt-2 text-xs leading-5 text-[var(--home-muted)]">
                From early years to senior secondary, growing together under one roof.
              </p>
              <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[#e8eee2]">
                <div className="h-full w-full rounded-full bg-[var(--home-lime)]" />
              </div>
            </div>
          </aside>

          <div className="absolute bottom-5 right-5 z-20 flex items-center gap-2 sm:bottom-7 sm:right-7">
            <button
              type="button"
              onClick={() => go(index - 1)}
              aria-label="Previous campus image"
              className="grid h-10 w-10 place-items-center rounded-full border border-white/30 bg-white/10 text-[#ffffff] backdrop-blur transition hover:bg-white hover:text-[var(--home-dark)]"
            >
              <ChevronLeft className="h-4 w-4" aria-hidden="true" />
            </button>
            <div
              className="flex items-center gap-1.5"
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
                  className={`h-1.5 rounded-full transition-all ${i === index ? "w-7 bg-[var(--home-lime)]" : "w-1.5 bg-white/55 hover:bg-white"}`}
                />
              ))}
            </div>
            <button
              type="button"
              onClick={() => go(index + 1)}
              aria-label="Next campus image"
              className="grid h-10 w-10 place-items-center rounded-full border border-white/30 bg-white/10 text-[#ffffff] backdrop-blur transition hover:bg-white hover:text-[var(--home-dark)]"
            >
              <ChevronRight className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
