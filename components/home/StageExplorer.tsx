"use client";

import { useRef } from "react";
import { ArrowLeft, ArrowRight, ArrowUpRight } from "lucide-react";
import { SERIF } from "./theme";

const STAGES = [
  {
    number: "01",
    label: "Early years",
    tags: "PRE-SCHOOL · NURSERY",
    copy: "A warm start built on curiosity, language and play.",
    img: "/home/identity-girl.jpg",
    href: "/academics",
  },
  {
    number: "02",
    label: "Primary",
    tags: "PRIMARY 1–6",
    copy: "Strong foundations in literacy, numeracy and discovery.",
    img: "/home/college-classroom.jpg",
    href: "/academics/primary",
  },
  {
    number: "03",
    label: "Junior secondary",
    tags: "JSS 1–3 · BECE",
    copy: "A broad curriculum that grows confidence and independence.",
    img: "/home/college-science.jpg",
    href: "/academics/junior-secondary",
  },
  {
    number: "04",
    label: "Senior science",
    tags: "SSS 1–3 · WAEC",
    copy: "Focused science learning, practical work and exam readiness.",
    img: "/home/lab.jpg",
    href: "/academics/ss-science",
  },
  {
    number: "05",
    label: "Senior arts",
    tags: "SSS 1–3 · WAEC",
    copy: "Humanities, communication and critical thinking for what comes next.",
    img: "/home/college-arts.jpg",
    href: "/academics/ss-arts",
  },
  {
    number: "06",
    label: "Senior commercial",
    tags: "SSS 1–3 · WAEC",
    copy: "Business, economics and numeracy grounded in real life.",
    img: "/home/debate.jpg",
    href: "/academics/ss-commercial",
  },
];

/** Swipeable stage cards follow the reference's horizontal programme-track carousel. */
export default function StageExplorer() {
  const rail = useRef<HTMLDivElement>(null);
  const scroll = (direction: -1 | 1) =>
    rail.current?.scrollBy({
      left: direction * Math.max(300, rail.current.clientWidth * 0.78),
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
    });

  return (
    <section id="stages" className="home-below-fold overflow-hidden py-16 sm:py-24">
      <div className="mx-auto max-w-[1480px] px-5 sm:px-8 lg:px-12">
        <div className="flex flex-wrap items-end justify-between gap-5">
          <div>
            <p className="mb-2 text-[10px] font-bold uppercase tracking-[.2em] text-[var(--home-dark-soft)]">
              One journey · every next step
            </p>
            <h2
              className={`${SERIF} text-[clamp(2.7rem,5vw,4.7rem)] uppercase leading-[.9] tracking-[-.02em] text-[var(--home-dark)]`}
            >
              Find their stage
            </h2>
            <p className="mt-3 max-w-lg text-sm leading-6 text-[var(--home-muted)]">
              From first classroom friendships to senior-school pathways — find the right place to
              grow.
            </p>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => scroll(-1)}
              aria-label="Scroll to earlier school stages"
              className="grid h-11 w-11 place-items-center rounded-full border border-[var(--home-line)] bg-white text-[var(--home-dark)] transition hover:bg-[var(--home-dark)] hover:text-white"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={() => scroll(1)}
              aria-label="Scroll to later school stages"
              className="grid h-11 w-11 place-items-center rounded-full bg-[var(--home-dark)] text-white transition hover:bg-[var(--home-lime)] hover:text-[var(--home-dark)]"
            >
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        </div>
      </div>
      <div
        ref={rail}
        className="mt-8 flex snap-x snap-mandatory gap-4 overflow-x-auto px-5 pb-5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:mt-10 sm:px-8 lg:px-12"
        aria-label="School stages"
      >
        {STAGES.map((stage, i) => (
          <article
            key={stage.number}
            className={`group relative flex w-[min(82vw,320px)] shrink-0 snap-start flex-col overflow-hidden rounded-[24px] border border-black/[.06] p-3.5 shadow-[0_10px_32px_rgba(8,45,32,.07)] transition duration-300 hover:-translate-y-1 hover:shadow-[0_18px_42px_rgba(8,45,32,.13)] sm:w-[300px] ${i === 2 ? "bg-[var(--home-lime)]" : "bg-white"}`}
          >
            <div className="mb-3 flex items-center justify-between px-1">
              <span
                className={`rounded-full px-2.5 py-1 text-[9px] font-bold uppercase tracking-wider ${i === 2 ? "bg-[var(--home-dark)] text-white" : "bg-[#f0f2ed] text-[var(--home-dark)]"}`}
              >
                {stage.tags}
              </span>
              <span
                className={`grid h-7 w-7 place-items-center rounded-full text-[9px] font-bold ${i === 2 ? "bg-[var(--home-dark)] text-white" : "bg-[#f0f2ed] text-[var(--home-dark)]"}`}
              >
                {stage.number}
              </span>
            </div>
            <h3
              className={`${SERIF} min-h-[52px] px-1 text-[1.45rem] uppercase leading-[.92] text-[var(--home-dark)]`}
            >
              {stage.label}
            </h3>
            <p className="mb-3 mt-2 min-h-[46px] px-1 text-xs leading-5 text-[var(--home-muted)]">
              {stage.copy}
            </p>
            <div className="relative mt-auto overflow-hidden rounded-[17px]">
              <img
                src={stage.img}
                alt=""
                loading="lazy"
                decoding="async"
                className="h-[190px] w-full object-cover transition duration-500 group-hover:scale-[1.035]"
              />
              <a
                href={stage.href}
                className="absolute bottom-3 left-3 inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-[11px] font-bold text-[var(--home-dark)] shadow-sm transition hover:bg-[var(--home-dark)] hover:text-white"
              >
                Explore stage <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
              </a>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
