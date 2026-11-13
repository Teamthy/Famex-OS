"use client";

import { useState } from "react";
import { ArrowRight, BookOpen, FlaskConical, GraduationCap } from "lucide-react";
import { SERIF } from "./theme";

const PATHS = {
  "Early years": [
    {
      eyebrow: "01 · DISCOVER",
      title: "Curiosity comes first",
      copy: "Play, language and early number skills give young learners a confident start.",
      points: [
        "Play-based foundations",
        "Language and early literacy",
        "Care, routine and belonging",
      ],
      href: "/academics",
      icon: BookOpen,
    },
    {
      eyebrow: "02 · BUILD",
      title: "Small steps, big ideas",
      copy: "Purposeful activities help children notice, ask questions and try things out.",
      points: ["Guided exploration", "Early numeracy", "Creative expression"],
      href: "/academics",
      icon: FlaskConical,
    },
    {
      eyebrow: "03 · GROW",
      title: "Ready for what's next",
      copy: "A steady transition prepares learners for the wider world of primary school.",
      points: [
        "Confidence and independence",
        "Positive learning habits",
        "A connected school journey",
      ],
      href: "/admissions",
      icon: GraduationCap,
    },
  ],
  Primary: [
    {
      eyebrow: "01 · FOUNDATIONS",
      title: "Learn with confidence",
      copy: "A strong base in literacy and numeracy supports every subject that follows.",
      points: ["NERDC core subjects", "Reading and communication", "Clear termly progress"],
      href: "/academics/primary",
      icon: BookOpen,
    },
    {
      eyebrow: "02 · EXPLORE",
      title: "Make ideas tangible",
      copy: "Practical experiences connect classroom learning with the world around us.",
      points: ["Science and discovery", "Digital literacy", "Arts, sport and teamwork"],
      href: "/academics/primary",
      icon: FlaskConical,
    },
    {
      eyebrow: "03 · PREPARE",
      title: "Grow into independence",
      copy: "Learners build the habits and curiosity that help them thrive in secondary school.",
      points: ["Study habits", "Responsibility and service", "A clear next step"],
      href: "/academics/junior-secondary",
      icon: GraduationCap,
    },
  ],
  Secondary: [
    {
      eyebrow: "01 · EXPLORE",
      title: "A broad JSS experience",
      copy: "Build a strong academic base while discovering interests and strengths.",
      points: ["NERDC-aligned curriculum", "Practical science", "BECE preparation"],
      href: "/academics/junior-secondary",
      icon: BookOpen,
    },
    {
      eyebrow: "02 · SPECIALISE",
      title: "Choose a direction",
      copy: "Senior students follow a science, arts or commercial pathway toward WAEC.",
      points: ["Science pathway", "Arts pathway", "Commercial pathway"],
      href: "/academics",
      icon: FlaskConical,
    },
    {
      eyebrow: "03 · LOOK AHEAD",
      title: "Prepare for next steps",
      copy: "Subject learning, guidance and responsibility prepare students for life after school.",
      points: ["WAEC readiness", "Leadership and service", "Alumni connection"],
      href: "/alumni",
      icon: GraduationCap,
    },
  ],
};

type PathKey = keyof typeof PATHS;
const TABS = Object.keys(PATHS) as PathKey[];

/** Dark patterned programme band with lime feature card; no invented prices or promises. */
export default function AcademicsCards() {
  const [active, setActive] = useState<PathKey>("Primary");
  return (
    <section
      id="academics"
      className="home-below-fold relative overflow-hidden bg-[var(--home-dark)] px-5 py-16 text-white sm:px-8 sm:py-24 lg:px-12"
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-[.12] [background-image:radial-gradient(rgba(255,255,255,.45)_1px,transparent_1px)] [background-size:22px_22px]"
        aria-hidden="true"
      />
      <div className="relative mx-auto max-w-[1100px]">
        <div className="text-center">
          <p className="mb-3 text-[10px] font-bold uppercase tracking-[.22em] text-[var(--home-lime)]">
            A thoughtful path, from first steps to what comes next
          </p>
          <h2
            className={`${SERIF} mx-auto max-w-[920px] text-[clamp(2.4rem,5.2vw,4.8rem)] uppercase leading-[.95] tracking-[-.02em] text-[#ffffff]`}
          >
            Learning for every chapter
          </h2>
          <div
            className="mt-7 flex flex-wrap justify-center gap-2"
            role="tablist"
            aria-label="Choose a school stage"
          >
            {TABS.map((tab) => (
              <button
                key={tab}
                type="button"
                role="tab"
                aria-selected={active === tab}
                onClick={() => setActive(tab)}
                className={`rounded-full px-4 py-2.5 text-xs font-bold transition ${active === tab ? "bg-[var(--home-lime)] text-[var(--home-dark)]" : "text-[#f2f6f3] hover:bg-white/10 hover:text-[#ffffff]"}`}
              >
                {tab}
              </button>
            ))}
          </div>
          <p className="mx-auto mt-4 max-w-xl text-xs leading-6 text-[#e5efea] sm:text-sm">
            An education that joins strong learning with character, care and room to find your own
            strengths.
          </p>
        </div>

        <div
          className="mt-9 grid gap-4 md:grid-cols-3"
          role="tabpanel"
          aria-label={`${active} learning path`}
        >
          {PATHS[active].map((card, i) => {
            const Icon = card.icon;
            return (
              <article
                key={card.eyebrow}
                className={`flex min-h-[350px] flex-col rounded-[23px] p-5 sm:p-6 ${i === 1 ? "bg-[var(--home-lime)] text-[var(--home-dark)]" : "bg-white text-[var(--home-dark)]"}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <p className="text-[9px] font-extrabold tracking-[.13em] opacity-75">
                    {card.eyebrow}
                  </p>
                  <span
                    className={`grid h-9 w-9 place-items-center rounded-full ${i === 1 ? "bg-[var(--home-dark)] text-[var(--home-lime)]" : "bg-[#f0f3ed] text-[var(--home-dark)]"}`}
                  >
                    <Icon className="h-4 w-4" aria-hidden="true" />
                  </span>
                </div>
                <h3 className={`${SERIF} mt-6 text-[1.75rem] uppercase leading-[.94]`}>
                  {card.title}
                </h3>
                <p className="mt-3 text-xs leading-5 opacity-75">{card.copy}</p>
                <ul className="mt-4 space-y-2">
                  {card.points.map((point) => (
                    <li key={point} className="flex items-start gap-2 text-[11px] font-medium">
                      <span className="mt-[6px] h-1.5 w-1.5 shrink-0 rounded-full bg-current" />
                      {point}
                    </li>
                  ))}
                </ul>
                <a
                  href={card.href}
                  className={`mt-auto inline-flex w-full items-center justify-between rounded-full px-4 py-3 text-xs font-bold transition ${i === 1 ? "bg-[var(--home-dark)] text-white hover:bg-white hover:text-[var(--home-dark)]" : "bg-[var(--home-dark)] text-white hover:bg-[var(--home-lime)] hover:text-[var(--home-dark)]"}`}
                >
                  Explore learning <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </a>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
