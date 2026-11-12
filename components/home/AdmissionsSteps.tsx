import { ArrowRight } from "lucide-react";
import { SERIF } from "./theme";

const STEPS = [
  {
    n: "1",
    title: "Apply online",
    copy: "One form per child, from pre-school to SS3. Save, return and submit — then track it any time.",
  },
  {
    n: "2",
    title: "Entrance assessment",
    copy: "Age-appropriate: readiness observation in the early years, literacy and numeracy from primary, subjects from JSS.",
  },
  {
    n: "3",
    title: "Enrol & orient",
    copy: "Offer, fees schedule with instalment options, uniform list, portal accounts and a parents' briefing evening.",
  },
];

/** Section 10 — admissions as three honest steps, no mystery and no urgency theatre. */
export default function AdmissionsSteps() {
  return (
    <section
      id="admissions"
      className="home-below-fold mx-auto max-w-6xl px-4 pb-16 sm:px-6 sm:pb-24"
    >
      <div className="rounded-[28px] bg-[var(--famex-lime-pale)] px-8 py-12 sm:px-12">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <h2 className={`${SERIF} text-4xl font-semibold tracking-tight sm:text-5xl`}>
            Admissions,{" "}
            <em className="font-light italic text-[var(--famex-forest-mid)]">without mystery</em>
          </h2>
          <p className="text-sm text-[var(--famex-text-secondary)]">
            2026/2027 session · places offered by stage
          </p>
        </div>
        <div className="mt-10 grid gap-8 lg:grid-cols-3">
          {STEPS.map((step) => (
            <div key={step.n} className="relative">
              <span className="font-[family-name:var(--font-fraunces)] text-5xl font-light italic text-[var(--famex-lime-soft)]">
                {step.n}
              </span>
              <h3 className="mt-3 text-base font-semibold text-[var(--famex-primary)]">
                {step.title}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-[var(--famex-text-secondary)]">
                {step.copy}
              </p>
            </div>
          ))}
        </div>
        <div className="mt-10 flex flex-wrap items-center gap-3">
          <a
            href="/admissions"
            className="inline-flex items-center gap-2 rounded-full bg-[var(--famex-primary)] px-6 py-3 text-sm font-semibold text-[var(--famex-page-bg)] transition hover:bg-[var(--famex-forest-mid)]"
          >
            Apply Now <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </a>
          <a
            href="/application-status"
            className="rounded-full border border-[var(--famex-primary)]/20 bg-white/70 px-6 py-3 text-sm font-medium text-[var(--famex-primary)] transition hover:border-[var(--famex-primary)]/40"
          >
            Check application status
          </a>
        </div>
      </div>
    </section>
  );
}
