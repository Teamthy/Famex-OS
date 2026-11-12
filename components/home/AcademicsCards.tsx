import { BookOpen, FlaskConical, Languages, Palette } from "lucide-react";
import { SERIF } from "./theme";

const PILLARS = [
  {
    icon: BookOpen,
    title: "NERDC core",
    copy: "The national curriculum, taught properly: continuous assessment, termly examinations and moderated report cards parents can actually read.",
  },
  {
    icon: FlaskConical,
    title: "STEM & digital literacy",
    copy: "Laboratory science, computing and robotics clubs — practical work timetabled from primary, not demonstrated once a term.",
  },
  {
    icon: Languages,
    title: "Languages & literacy",
    copy: "English, French and Yoruba, with a reading culture that starts in the early-years phonics programme and ends in SS3 essay craft.",
  },
  {
    icon: Palette,
    title: "Arts, sport & character",
    copy: "Music, fine arts, inter-house sports and leadership roles — the formation half of 'Raising Role Models', assessed like everything else.",
  },
];

/** Section 6 — the academic pillars as four quiet white cards. */
export default function AcademicsCards() {
  return (
    <section
      id="academics"
      className="home-below-fold mx-auto max-w-6xl rounded-[28px] bg-[var(--famex-primary)] px-6 py-12 text-white sm:px-10 sm:py-16"
    >
      <div className="flex flex-wrap items-end justify-between gap-6">
        <h2 className={`${SERIF} text-4xl font-semibold tracking-tight sm:text-5xl`}>
          A curriculum that <em className="font-light italic text-[var(--famex-lime)]">works</em>
        </h2>
        <a
          href="/academics"
          className="rounded-full border border-white/25 bg-white/10 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-white hover:text-[var(--famex-primary)]"
        >
          Academics &amp; calendar
        </a>
      </div>
      <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {PILLARS.map((pillar) => {
          const Icon = pillar.icon;
          return (
            <article
              key={pillar.title}
              className="rounded-3xl bg-[var(--famex-lime)] p-6 text-[var(--famex-primary)] shadow-[0_12px_32px_rgba(3,28,23,0.18)] transition duration-300 hover:-translate-y-1"
            >
              <span className="grid h-10 w-10 place-items-center rounded-full bg-[var(--famex-primary)] text-[var(--famex-lime)]">
                <Icon className="h-5 w-5" aria-hidden="true" />
              </span>
              <h3 className="mt-4 text-base font-semibold text-[var(--famex-primary)]">
                {pillar.title}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-[#285148]">{pillar.copy}</p>
            </article>
          );
        })}
      </div>
    </section>
  );
}
