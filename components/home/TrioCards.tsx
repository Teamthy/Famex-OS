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
          <div className="absolute bottom-4 left-4 right-4 rounded-2xl bg-[#fffdf8] p-4 shadow-[0_16px_40px_rgba(33,29,25,0.25)]">
            <div className="flex items-center gap-3">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-[#7fb069]/20 text-[#5d8f4e]">
                <Leaf className="h-4 w-4" aria-hidden="true" />
              </span>
              <div>
                <p className="text-sm font-semibold text-[#211d19]">STEM &amp; digital literacy</p>
                <p className="text-xs text-[#6b6459]">lab-based, not rote — from primary upward</p>
              </div>
            </div>
            <div className="mt-3 flex gap-1" aria-hidden="true">
              {Array.from({ length: 10 }).map((_, i) => (
                <span
                  key={i}
                  className={`h-3 w-2 rounded-[2px] ${i < 7 ? "bg-[#20261f]" : "bg-[#2026190d]"}`}
                />
              ))}
            </div>
          </div>
        </div>

        {/* White idea card */}
        <div className="flex flex-col rounded-3xl bg-[#fffdf8] p-7 shadow-[0_10px_40px_rgba(33,29,25,0.08)]">
          <span className="grid h-10 w-10 place-items-center rounded-full bg-[#7fb069]/20 text-[#5d8f4e]">
            <Leaf className="h-5 w-5" aria-hidden="true" />
          </span>
          <h3 className={`${SERIF} mt-5 text-2xl font-semibold text-[#211d19]`}>
            Whole-child <em className="font-light italic">learning</em>
          </h3>
          <p className="mt-3 text-sm leading-relaxed text-[#6b6459]">
            Scholarship, sport, arts and service are timetabled, not extracurricular afterthoughts.
            Report cards carry narrative comments in the early years and subject grades from primary
            — the same continuum, honestly recorded.
          </p>
          <div className="mt-auto pt-6">
            <div className="h-px w-full bg-[#211d19]/10" />
            <div className="mt-4 flex items-center gap-3">
              <div className="flex -space-x-2" aria-hidden="true">
                {["#7fb069", "#c96f4a", "#e8dcc8"].map((tone) => (
                  <span
                    key={tone}
                    className="h-7 w-7 rounded-full border-2 border-[#fffdf8]"
                    style={{ background: tone }}
                  />
                ))}
              </div>
              <p className="text-xs text-[#6b6459]">Parent partnership, every term</p>
            </div>
          </div>
        </div>

        {/* Dark campus card */}
        <div className="rounded-3xl bg-[#20261f] p-6">
          <p className="text-sm font-semibold text-[#f6f1e8]">From our campus</p>
          <div className="mt-4">
            <CampusMiniCarousel photos={MINI_PHOTOS} />
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {TAGS.map((tag) => (
              <span
                key={tag}
                className="rounded-full border border-[#f6f1e8]/25 px-3 py-1 text-[11px] text-[#f6f1e8]/80"
              >
                {tag}
              </span>
            ))}
          </div>
          <p className="mt-3 text-[11px] text-[#f6f1e8]/60">
            One continuum across the four school stages.
          </p>
        </div>
      </div>
    </section>
  );
}
