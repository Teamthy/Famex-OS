import { Leaf } from "lucide-react";
import CampusMiniCarousel from "./CampusMiniCarousel";
import { SERIF } from "./theme";

const MINI_PHOTOS = [
  {
    src: "/home/college-assembly.jpg",
    alt: "Whole-school assembly",
    caption: "Assembly · Mondays",
  },
  { src: "/home/debate.jpg", alt: "Students debating", caption: "Debating society" },
  {
    src: "/home/college-sports.jpg",
    alt: "Sports day on the field",
    caption: "Inter-house sports",
  },
  { src: "/home/arts.jpg", alt: "Art class work", caption: "Arts studio" },
];

const TAGS = ["Pre-school", "Primary", "JSS", "SSS"];

/**
 * Section 3 — the three-card editorial grid: a photograph card with a floating
 * fact chip, a white idea card, and a dark campus card with its own mini
 * carousel. Every claim here is structural (what the school runs), never an
 * invented satisfaction metric.
 */
export default function TrioCards() {
  return (
    <section className="mx-auto max-w-6xl px-4 pb-8 sm:px-6">
      <div className="grid gap-5 lg:grid-cols-3">
        {/* Photograph card with floating chip */}
        <div className="relative overflow-hidden rounded-3xl">
          <img
            src="/home/lab.jpg"
            alt="Students working in the science laboratory"
            loading="lazy"
            decoding="async"
            className="h-80 w-full object-cover"
          />
          <div className="absolute bottom-4 left-4 right-4 rounded-2xl bg-[var(--famex-white)] p-4 shadow-[0_16px_40px_rgba(33,29,25,0.25)]">
            <div className="flex items-center gap-3">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-[var(--famex-lime)]/20 text-[var(--famex-forest-mid)]">
                <Leaf className="h-4 w-4" aria-hidden="true" />
              </span>
              <div>
                <p className="text-sm font-semibold text-[var(--famex-primary)]">
                  STEM &amp; digital literacy
                </p>
                <p className="text-xs text-[var(--famex-text-secondary)]">
                  lab-based, not rote — from primary upward
                </p>
              </div>
            </div>
            <div className="mt-3 flex gap-1" aria-hidden="true">
              {Array.from({ length: 10 }).map((_, i) => (
                <span
                  key={i}
                  className={`h-3 w-2 rounded-[2px] ${i < 7 ? "bg-[var(--famex-primary)]" : "bg-[#10463D0D]"}`}
                />
              ))}
            </div>
          </div>
        </div>

        {/* White idea card */}
        <div className="flex flex-col rounded-3xl bg-[var(--famex-white)] p-7 shadow-[0_10px_40px_rgba(33,29,25,0.08)]">
          <span className="grid h-10 w-10 place-items-center rounded-full bg-[var(--famex-lime)]/20 text-[var(--famex-forest-mid)]">
            <Leaf className="h-5 w-5" aria-hidden="true" />
          </span>
          <h3 className={`${SERIF} mt-5 text-2xl font-semibold text-[var(--famex-primary)]`}>
            Whole-child <em className="font-light italic">learning</em>
          </h3>
          <p className="mt-3 text-sm leading-relaxed text-[var(--famex-text-secondary)]">
            Scholarship, sport, arts and service are timetabled, not extracurricular afterthoughts.
            Report cards carry narrative comments in the early years and subject grades from primary
            — the same continuum, honestly recorded.
          </p>
          <div className="mt-auto pt-6">
            <div className="h-px w-full bg-[var(--famex-primary)]/10" />
            <div className="mt-4 flex items-center gap-3">
              <div className="flex -space-x-2" aria-hidden="true">
                {["var(--famex-lime)", "var(--famex-lime-soft)", "var(--famex-lime-pale)"].map(
                  (tone) => (
                    <span
                      key={tone}
                      className="h-7 w-7 rounded-full border-2 border-[var(--famex-white)]"
                      style={{ background: tone }}
                    />
                  ),
                )}
              </div>
              <p className="text-xs text-[var(--famex-text-secondary)]">
                Parent partnership, every term
              </p>
            </div>
          </div>
        </div>

        {/* Dark campus card */}
        <div className="rounded-3xl bg-[var(--famex-primary)] p-6">
          <p className="text-sm font-semibold text-[var(--famex-page-bg)]">From our campus</p>
          <div className="mt-4">
            <CampusMiniCarousel photos={MINI_PHOTOS} />
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {TAGS.map((tag) => (
              <span
                key={tag}
                className="rounded-full border border-[var(--famex-page-bg)]/25 px-3 py-1 text-[11px] text-[var(--famex-page-bg)]/80"
              >
                {tag}
              </span>
            ))}
          </div>
          <p className="mt-3 text-[11px] text-[var(--famex-page-bg)]/60">
            One continuum across the four school stages.
          </p>
        </div>
      </div>
    </section>
  );
}
