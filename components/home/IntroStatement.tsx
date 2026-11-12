import { SERIF } from "./theme";

/** Section 2 — the editorial statement block: big serif claim, quiet aside. */
export default function IntroStatement() {
  return (
    <section id="story" className="mx-auto max-w-6xl px-4 pb-8 pt-16 sm:px-6 sm:pt-24">
      <div className="grid gap-8 lg:grid-cols-[1.4fr_1fr] lg:items-end">
        <h2 className={`${SERIF} text-4xl font-semibold leading-[1.08] tracking-tight sm:text-5xl`}>
          Rooted in character,
          <br />
          <em className="font-light italic text-[var(--famex-forest-mid)]">made for excellence</em>
        </h2>
        <div className="max-w-md justify-self-start lg:justify-self-end">
          <p className="text-sm leading-relaxed text-[var(--famex-text-secondary)]">
            We teach the whole child — scholarship, service and character — in small, known groups.
            Every stage hands over to the next, so your child never restarts: the reception class of
            today is the SS3 graduate of thirteen years from now.
          </p>
          <a
            href="/about"
            className="mt-5 inline-block rounded-full bg-[var(--famex-primary)] px-6 py-3 text-sm font-semibold text-[var(--famex-page-bg)] transition hover:bg-[var(--famex-forest-mid)]"
          >
            Our story
          </a>
        </div>
      </div>
    </section>
  );
}
