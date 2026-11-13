import { ArrowUpRight, BookOpenCheck, Leaf } from "lucide-react";
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

/** Three editorial cards: school-in-action photography, a bright value card, campus moments. */
export default function TrioCards() {
  return (
    <section className="mx-auto max-w-[1320px] px-5 pb-16 sm:px-8 lg:px-12">
      <div className="grid gap-4 lg:grid-cols-3">
        <article className="group relative min-h-[350px] overflow-hidden rounded-[26px] bg-[var(--home-dark)] sm:min-h-[410px]">
          <img
            src="/home/lab.jpg"
            alt="Students working together in the science laboratory"
            loading="lazy"
            decoding="async"
            className="absolute inset-0 h-full w-full object-cover transition duration-700 group-hover:scale-[1.035]"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[var(--home-dark)]/90 via-[var(--home-dark)]/15 to-transparent" />
          <div className="absolute inset-x-5 bottom-5 rounded-[20px] bg-white p-4 sm:inset-x-6 sm:bottom-6 sm:p-5">
            <div className="flex items-start gap-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[var(--home-lime)] text-[var(--home-dark)]">
                <Leaf className="h-5 w-5" aria-hidden="true" />
              </span>
              <div>
                <h3 className={`${SERIF} text-xl uppercase leading-tight text-[var(--home-dark)]`}>
                  STEM beyond the textbook
                </h3>
                <p className="mt-1 text-xs leading-5 text-[var(--home-muted)]">
                  Practical discovery in the lab and beyond.
                </p>
              </div>
            </div>
          </div>
        </article>

        <article className="flex min-h-[350px] flex-col justify-between rounded-[26px] bg-[var(--home-lime)] p-6 sm:min-h-[410px] sm:p-8">
          <span className="grid h-12 w-12 place-items-center rounded-full bg-[var(--home-dark)] text-[var(--home-lime)]">
            <BookOpenCheck className="h-5 w-5" aria-hidden="true" />
          </span>
          <div>
            <p className="mb-3 text-[10px] font-bold uppercase tracking-[.18em] text-[var(--home-dark)]/70">
              Learning that goes further
            </p>
            <h3
              className={`${SERIF} text-[clamp(2rem,3vw,3rem)] uppercase leading-[.95] tracking-tight text-[var(--home-dark)]`}
            >
              Whole-child <br />
              learning.
            </h3>
            <p className="mt-4 text-sm leading-6 text-[var(--home-dark)]/80">
              Scholarship, sport, arts and service are part of the school day — building confidence,
              curiosity and character together.
            </p>
            <a
              href="/academics"
              className="mt-6 inline-flex items-center gap-2 rounded-full bg-[var(--home-dark)] px-4 py-2.5 text-xs font-bold text-[#ffffff] transition hover:bg-white hover:text-[var(--home-dark)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
            >
              Discover learning <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
            </a>
          </div>
        </article>

        <article className="flex min-h-[350px] flex-col rounded-[26px] bg-[var(--home-dark)] p-5 text-white sm:min-h-[410px] sm:p-6">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold uppercase tracking-[.15em] text-white">
              From our campus
            </p>
            <ArrowUpRight className="h-4 w-4 text-[var(--home-lime)]" aria-hidden="true" />
          </div>
          <div className="mt-4 flex-1">
            <CampusMiniCarousel photos={MINI_PHOTOS} />
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {TAGS.map((tag) => (
              <span
                key={tag}
                className="rounded-full border border-white/20 px-3 py-1 text-[10px] font-semibold text-white/80"
              >
                {tag}
              </span>
            ))}
          </div>
        </article>
      </div>
    </section>
  );
}
