import { SERIF } from "./theme";

/**
 * Section 8 — the people around a child, described by ROLE (the school's real
 * staff structure) rather than invented names or photographs of strangers.
 */
const ROLES = [
  {
    initials: "HS",
    title: "Head of School",
    copy: "One accountable head across all stages — the person your letter is addressed to.",
  },
  {
    initials: "TC",
    title: "Teachers & heads of department",
    copy: "Subject specialists with moderated schemes of work and termly review panels.",
  },
  {
    initials: "BO",
    title: "Bursar's office",
    copy: "Fees, receipts and instalment plans handled transparently — every kobo ledgered.",
  },
  {
    initials: "SP",
    title: "Safeguarding & child protection",
    copy: "A named lead, vetted staff and a reporting path parents can use directly.",
  },
];

export default function PeopleSection() {
  return (
    <section className="mx-auto max-w-6xl px-4 pb-16 sm:px-6 sm:pb-24">
      <h2 className={`${SERIF} text-4xl font-semibold tracking-tight sm:text-5xl`}>
        The people <em className="font-light italic text-[#5d8f4e]">around your child</em>
      </h2>
      <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {ROLES.map((role) => (
          <article
            key={role.title}
            className="rounded-3xl border border-[#211d19]/8 bg-[#fffdf8] p-6 transition duration-300 hover:-translate-y-1 hover:shadow-[0_16px_44px_rgba(33,29,25,0.1)]"
          >
            <span className="grid h-12 w-12 place-items-center rounded-full bg-[#e8dcc8] font-[family-name:var(--font-fraunces)] text-sm font-semibold text-[#20261f]">
              {role.initials}
            </span>
            <h3 className="mt-4 text-base font-semibold text-[#211d19]">{role.title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-[#6b6459]">{role.copy}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
