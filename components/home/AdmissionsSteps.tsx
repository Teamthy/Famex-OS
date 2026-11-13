import { ArrowRight } from "lucide-react";
import { SERIF } from "./theme";

const STEPS = [
  {
    n: "01",
    title: "Start an application",
    copy: "Tell us about your child and the stage you are interested in.",
  },
  {
    n: "02",
    title: "Meet the school",
    copy: "Our admissions team will guide you through the next steps and any age-appropriate assessment.",
  },
  {
    n: "03",
    title: "Join the journey",
    copy: "Once an offer is accepted, we will help your family prepare for a confident first day.",
  },
];

export default function AdmissionsSteps() {
  return (
    <section
      id="admissions"
      className="home-below-fold mx-auto max-w-[1320px] px-5 pb-16 sm:px-8 sm:pb-24 lg:px-12"
    >
      <div className="overflow-hidden rounded-[28px] bg-[var(--home-lime)] px-6 py-9 sm:px-10 sm:py-12 lg:px-14">
        <div className="grid gap-10 lg:grid-cols-[.95fr_1.05fr]">
          <div className="flex flex-col items-start">
            <p className="mb-3 text-[10px] font-extrabold uppercase tracking-[.2em] text-[var(--home-dark)]/70">
              A clear first step
            </p>
            <h2
              className={`${SERIF} text-[clamp(2.8rem,5vw,5rem)] uppercase leading-[.88] tracking-[-.025em] text-[var(--home-dark)]`}
            >
              Your next chapter starts here.
            </h2>
            <p className="mt-4 max-w-md text-sm leading-6 text-[var(--home-dark)]/75">
              We are here to make choosing a school feel straightforward. Talk to our admissions
              team or begin your application when you are ready.
            </p>
            <div className="mt-6 flex flex-wrap gap-2.5">
              <a
                href="/admissions"
                className="inline-flex items-center gap-3 rounded-full bg-[var(--home-dark)] px-5 py-3 text-xs font-bold text-white transition hover:bg-white hover:text-[var(--home-dark)]"
              >
                Apply now <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </a>
              <a
                href="/application-status"
                className="rounded-full border border-[var(--home-dark)]/25 bg-white/35 px-5 py-3 text-xs font-bold text-[var(--home-dark)] transition hover:bg-white"
              >
                Check application
              </a>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
            {STEPS.map((step) => (
              <article
                key={step.n}
                className="grid grid-cols-[48px_1fr] gap-3 rounded-[18px] bg-white/75 p-4 sm:p-5"
              >
                <span className={`${SERIF} pt-0.5 text-2xl text-[var(--home-dark-soft)]`}>
                  {step.n}
                </span>
                <div>
                  <h3 className={`${SERIF} text-xl uppercase leading-none text-[var(--home-dark)]`}>
                    {step.title}
                  </h3>
                  <p className="mt-2 text-xs leading-5 text-[var(--home-muted)]">{step.copy}</p>
                </div>
              </article>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
