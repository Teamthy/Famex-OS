"use client";

import { useState } from "react";
import { Award, Baby, BookOpen, FlaskConical, GraduationCap, Heart, Leaf } from "lucide-react";
import { SERIF } from "./theme";

type Stage = {
  id: string;
  label: string;
  ages: string;
  blurb: string;
  tone: string;
  icon: typeof Baby;
};

const STAGES: Stage[] = [
  {
    id: "pre-school",
    label: "Pre-school",
    ages: "Ages 2–3",
    blurb: "Play-based foundations: language, motor skills and first friendships.",
    tone: "var(--famex-lime-pale)",
    icon: Baby,
  },
  {
    id: "kindergarten",
    label: "Kindergarten",
    ages: "Ages 3–5",
    blurb: "Phonics, numeracy and curiosity — the habits of a learner.",
    tone: "var(--famex-lime-pale)",
    icon: Leaf,
  },
  {
    id: "nursery",
    label: "Nursery",
    ages: "Ages 4–6",
    blurb: "Early literacy and reasoning, with descriptor-based report cards.",
    tone: "var(--famex-page-bg)",
    icon: BookOpen,
  },
  {
    id: "primary",
    label: "Primary",
    ages: "Ages 5–11",
    blurb: "NERDC core plus STEM, digital literacy and a second language.",
    tone: "var(--famex-lime-pale)",
    icon: GraduationCap,
  },
  {
    id: "jss",
    label: "JSS",
    ages: "Ages 10–14",
    blurb: "Broad curriculum, laboratory science and BECE preparation.",
    tone: "var(--famex-lime-pale)",
    icon: FlaskConical,
  },
  {
    id: "sss",
    label: "SSS",
    ages: "Ages 14–17",
    blurb: "WAEC preparation, leadership roles and university placement.",
    tone: "var(--famex-lime-pale)",
    icon: Award,
  },
];

/**
 * Section 4 — "Explore by stage": the reference's filter-pill row and card
 * grid, translated to the school's six advertised stages. The heart is a
 * local shortlist toggle (client state only — nothing is tracked); the counts
 * are the real stage list, not invented numbers.
 */
export default function StageExplorer() {
  const [filter, setFilter] = useState<string>("all");
  const [shortlisted, setShortlisted] = useState<Record<string, boolean>>({});

  const visible = filter === "all" ? STAGES : STAGES.filter((stage) => stage.id === filter);

  return (
    <section id="stages" className="home-below-fold mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
      <div className="text-center">
        <h2 className={`${SERIF} text-4xl font-semibold tracking-tight sm:text-5xl`}>
          Explore by <em className="font-light italic text-[var(--famex-forest-mid)]">stage</em>
        </h2>
        <p className="mx-auto mt-3 max-w-md text-sm text-[var(--famex-text-secondary)]">
          Each stage is carefully handed over to the next, so you always know exactly where your
          child is and what comes after.
        </p>
      </div>

      <div
        className="mt-8 flex flex-wrap justify-center gap-2"
        role="group"
        aria-label="Filter stages"
      >
        <button
          type="button"
          onClick={() => setFilter("all")}
          aria-pressed={filter === "all"}
          className={`rounded-full px-4 py-2 text-sm transition ${
            filter === "all"
              ? "bg-[var(--famex-primary)] font-semibold text-[var(--famex-page-bg)]"
              : "border border-[var(--famex-primary)]/15 bg-white/70 text-[var(--famex-text-secondary)] hover:border-[var(--famex-primary)]/35"
          }`}
        >
          All {STAGES.length}
        </button>
        {STAGES.map((stage) => (
          <button
            key={stage.id}
            type="button"
            onClick={() => setFilter(stage.id)}
            aria-pressed={filter === stage.id}
            className={`rounded-full px-4 py-2 text-sm transition ${
              filter === stage.id
                ? "bg-[var(--famex-primary)] font-semibold text-[var(--famex-page-bg)]"
                : "border border-[var(--famex-primary)]/15 bg-white/70 text-[var(--famex-text-secondary)] hover:border-[var(--famex-primary)]/35"
            }`}
          >
            {stage.label}
          </button>
        ))}
      </div>

      <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {visible.map((stage) => {
          const Icon = stage.icon;
          const saved = Boolean(shortlisted[stage.id]);
          return (
            <article
              key={stage.id}
              className="group relative rounded-3xl p-7 transition duration-300 hover:-translate-y-1 hover:shadow-[0_20px_50px_rgba(33,29,25,0.12)]"
              style={{ background: stage.tone }}
            >
              <button
                type="button"
                onClick={() => setShortlisted((s) => ({ ...s, [stage.id]: !saved }))}
                aria-pressed={saved}
                aria-label={
                  saved ? `Remove ${stage.label} from shortlist` : `Shortlist ${stage.label}`
                }
                className={`absolute right-5 top-5 grid h-9 w-9 place-items-center rounded-full border transition ${
                  saved
                    ? "border-[var(--famex-lime-soft)] bg-[var(--famex-lime-soft)] text-white"
                    : "border-[var(--famex-primary)]/15 bg-white/80 text-[var(--famex-text-secondary)] hover:border-[var(--famex-lime-soft)] hover:text-[var(--famex-lime-soft)]"
                }`}
              >
                <Heart className={`h-4 w-4 ${saved ? "fill-current" : ""}`} aria-hidden="true" />
              </button>
              <span className="grid h-12 w-12 place-items-center rounded-2xl bg-white/80 text-[var(--famex-primary)]">
                <Icon className="h-5 w-5" aria-hidden="true" />
              </span>
              <h3 className={`${SERIF} mt-5 text-2xl font-semibold text-[var(--famex-primary)]`}>
                {stage.label}
              </h3>
              <p className="mt-1 text-xs font-semibold uppercase tracking-wider text-[var(--famex-text-muted)]">
                {stage.ages}
              </p>
              <p className="mt-3 text-sm leading-relaxed text-[var(--famex-text-secondary)]">
                {stage.blurb}
              </p>
            </article>
          );
        })}
      </div>
    </section>
  );
}
