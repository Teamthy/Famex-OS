import { ArrowUpRight } from "lucide-react";
import { SERIF } from "./theme";

/** Editorial school introduction: condensed display title on the paper canvas. */
export default function IntroStatement() {
  return (
    <section
      id="story"
      className="mx-auto max-w-[1320px] px-5 pb-10 pt-20 sm:px-8 sm:pb-14 sm:pt-28 lg:px-12"
    >
      <div className="grid gap-8 lg:grid-cols-[1.15fr_.85fr] lg:items-end">
        <div>
          <p className="mb-3 text-[11px] font-bold uppercase tracking-[.2em] text-[var(--home-dark-soft)]">
            Raising role models · since day one
          </p>
          <h2
            className={`${SERIF} max-w-[760px] text-[clamp(3rem,7vw,6.6rem)] uppercase leading-[.88] tracking-[-.03em] text-[var(--home-dark)]`}
          >
            Rooted in character,
            <br />
            <span className="text-[var(--home-dark-soft)]">made for excellence.</span>
          </h2>
        </div>
        <div className="max-w-[500px] lg:justify-self-end">
          <p className="text-sm leading-7 text-[var(--home-muted)] sm:text-base sm:leading-8">
            We teach the whole child — scholarship, service and character — in small, known groups.
            Every stage hands over to the next, so your child never has to start their story again.
          </p>
          <a
            href="/about"
            className="mt-5 inline-flex items-center gap-2 rounded-full bg-[var(--home-lime)] px-5 py-3 text-sm font-bold text-[var(--home-dark)] transition hover:bg-[#d9ff7a] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--home-dark)]"
          >
            Our story <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
          </a>
        </div>
      </div>
    </section>
  );
}
