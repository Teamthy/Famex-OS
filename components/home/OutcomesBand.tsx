import { SERIF } from "./theme";

/**
 * Section 7 — the dark stat band. Every figure is a structural fact about the
 * school (stages, terms, exam bodies, the alumni data-retention window), never
 * an invented satisfaction percentage.
 */
const STATS = [
  { value: "6", label: "stages", note: "pre-school through SS3, one continuum" },
  { value: "3", label: "terms", note: "per academic session, with moderated reports" },
  { value: "2", label: "public exams", note: "BECE and WAEC preparation, in-house" },
  { value: "5", label: "years", note: "alumni keep full records after graduation" },
];

export default function OutcomesBand() {
  return (
    <section className="mx-auto max-w-6xl px-4 pb-16 sm:px-6 sm:pb-24">
      <div className="rounded-[28px] bg-[#20261f] px-8 py-12 sm:px-12">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
          {STATS.map((stat) => (
            <div key={stat.label}>
              <p className={`${SERIF} text-5xl font-semibold text-[#f6f1e8]`}>
                {stat.value}
                <span className="ml-2 text-lg font-light italic text-[#7fb069]">{stat.label}</span>
              </p>
              <p className="mt-2 text-xs leading-relaxed text-[#f6f1e8]/60">{stat.note}</p>
            </div>
          ))}
        </div>
        <div className="mt-10 h-px w-full bg-[#f6f1e8]/15" />
        <p className={`${SERIF} mt-6 max-w-2xl text-lg italic leading-relaxed text-[#f6f1e8]/80`}>
          “A school is not a preparation for life — at this age, school is a large part of life. We
          treat it with that seriousness, and with joy.”
        </p>
      </div>
    </section>
  );
}
