import { HeartHandshake, ShieldCheck, WalletCards, UsersRound } from "lucide-react";
import { SERIF } from "./theme";

const ROLES = [
  {
    icon: UsersRound,
    title: "Head of school",
    copy: "One accountable school leadership team across every stage.",
  },
  {
    icon: HeartHandshake,
    title: "Teachers & heads of department",
    copy: "Subject specialists guiding learning, care and termly progress.",
  },
  {
    icon: WalletCards,
    title: "Bursar's office",
    copy: "Fees, receipts and instalment plans handled with clear records.",
  },
  {
    icon: ShieldCheck,
    title: "Safeguarding & child protection",
    copy: "A clear reporting path and a school community that puts children first.",
  },
];

export default function PeopleSection() {
  return (
    <section className="home-below-fold mx-auto max-w-[1320px] px-5 pb-16 sm:px-8 sm:pb-24 lg:px-12">
      <div className="flex flex-wrap items-end justify-between gap-5">
        <div>
          <p className="mb-2 text-[10px] font-bold uppercase tracking-[.2em] text-[var(--home-dark-soft)]">
            Care is part of the curriculum
          </p>
          <h2
            className={`${SERIF} max-w-3xl text-[clamp(2.7rem,5vw,4.6rem)] uppercase leading-[.9] text-[var(--home-dark)]`}
          >
            Good people, <span className="text-[var(--home-dark-soft)]">growing together.</span>
          </h2>
        </div>
        <a
          href="/about"
          className="rounded-full border border-[var(--home-line)] bg-white px-5 py-3 text-xs font-bold text-[var(--home-dark)] transition hover:bg-[var(--home-dark)] hover:text-white"
        >
          Meet our school
        </a>
      </div>
      <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {ROLES.map(({ icon: Icon, title, copy }, i) => (
          <article
            key={title}
            className={`rounded-[21px] p-5 sm:p-6 ${i === 1 ? "bg-[var(--home-lime)]" : "bg-white"}`}
          >
            <span
              className={`grid h-11 w-11 place-items-center rounded-full ${i === 1 ? "bg-[var(--home-dark)] text-[var(--home-lime)]" : "bg-[#eff2eb] text-[var(--home-dark)]"}`}
            >
              <Icon className="h-5 w-5" aria-hidden="true" />
            </span>
            <h3
              className={`${SERIF} mt-5 text-[1.35rem] uppercase leading-[.95] text-[var(--home-dark)]`}
            >
              {title}
            </h3>
            <p className="mt-3 text-xs leading-5 text-[var(--home-muted)]">{copy}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
