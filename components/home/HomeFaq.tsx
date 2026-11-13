import { ArrowUpRight, ChevronDown } from "lucide-react";
import { SERIF } from "./theme";

const QUESTIONS = [
  {
    question: "How do I apply to Famex?",
    answer: "Visit the admissions page to begin an application or review the application steps.",
    href: "/admissions",
    label: "Go to admissions",
  },
  {
    question: "Where can I explore school stages and learning?",
    answer:
      "Explore the stage cards above or visit Academics for curriculum and pathway information.",
    href: "/academics",
    label: "Explore academics",
  },
  {
    question: "How can I contact or visit the school?",
    answer: "Use the contact page to reach the school and arrange your next conversation.",
    href: "/contact",
    label: "Contact the school",
  },
  {
    question: "Where can I find school updates?",
    answer: "The school journal shares published news and calendar updates when available.",
    href: "/news-events",
    label: "Read the journal",
  },
];

/** Short, route-grounded FAQ block; deliberately avoids stale fee/session claims. */
export default function HomeFaq() {
  return (
    <section className="home-below-fold mx-auto grid max-w-[1320px] gap-9 px-5 pb-16 sm:px-8 sm:pb-24 lg:grid-cols-[.78fr_1.22fr] lg:px-12">
      <div>
        <p className="mb-2 text-[10px] font-bold uppercase tracking-[.2em] text-[var(--home-dark-soft)]">
          Need a little more information?
        </p>
        <h2
          className={`${SERIF} text-[clamp(2.8rem,5vw,4.8rem)] uppercase leading-[.88] text-[var(--home-dark)]`}
        >
          Good questions, <span className="text-[var(--home-dark-soft)]">clear next steps.</span>
        </h2>
        <p className="mt-4 max-w-md text-sm leading-6 text-[var(--home-muted)]">
          Find your way to admissions, curriculum details and the right person to speak with.
        </p>
        <a
          href="/contact"
          className="mt-5 inline-flex items-center gap-2 rounded-full bg-[var(--home-dark)] px-5 py-3 text-xs font-bold text-white transition hover:bg-[var(--home-lime)] hover:text-[var(--home-dark)]"
        >
          Ask the school <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
        </a>
      </div>
      <div className="space-y-2">
        {QUESTIONS.map((item, i) => (
          <details
            key={item.question}
            className="group rounded-[17px] border border-[var(--home-line)] bg-white open:bg-[var(--home-lime)]"
          >
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 text-sm font-bold text-[var(--home-dark)] [&::-webkit-details-marker]:hidden">
              <span>
                <span className="mr-3 text-[10px] font-bold text-[var(--home-dark-soft)]">
                  0{i + 1}
                </span>
                {item.question}
              </span>
              <ChevronDown
                className="h-4 w-4 shrink-0 transition-transform group-open:rotate-180"
                aria-hidden="true"
              />
            </summary>
            <div className="px-5 pb-4 pl-12">
              <p className="text-xs leading-5 text-[var(--home-muted)]">{item.answer}</p>
              <a
                href={item.href}
                className="mt-2 inline-flex items-center gap-1 text-[10px] font-bold text-[var(--home-dark)] underline decoration-[var(--home-dark)]/30 underline-offset-4"
              >
                {item.label} <ArrowUpRight className="h-3 w-3" aria-hidden="true" />
              </a>
            </div>
          </details>
        ))}
      </div>
    </section>
  );
}
