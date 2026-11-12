import { SERIF } from "./theme";

const FACTS = [
  { value: "6", label: "school stages", note: "From early years through senior secondary" },
  { value: "3", label: "school terms", note: "A steady rhythm for learning and growth" },
  { value: "BECE", label: "junior exams", note: "Preparation within the JSS journey" },
  { value: "WAEC", label: "senior exams", note: "A supported pathway through SSS" },
];

/** Clear school facts on light cards; the copy remains legible on every viewport. */
export default function OutcomesBand() {
  return (
    <section className="home-below-fold bg-[#f6f4ea] px-5 py-16 sm:px-8 sm:py-20 lg:px-12">
      <div className="mx-auto max-w-[1320px]">
        <div className="mb-7 flex flex-col gap-2 sm:mb-9 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[.2em] text-[#28645b]">
              The school journey
            </p>
            <h2 className={`${SERIF} mt-2 text-[clamp(2.2rem,4.3vw,3.7rem)] uppercase leading-[.92] text-[#123a35]`}>
              A clear path, <span className="text-[#28645b]">every step.</span>
            </h2>
          </div>
          <p className="max-w-md text-sm leading-6 text-[#52645f]">
            The milestones and rhythms that guide learning from the first school years to senior
            secondary.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {FACTS.map((fact, index) => (
            <article
              key={fact.label}
              className={`flex min-h-[190px] flex-col rounded-[22px] p-5 shadow-[0_8px_28px_rgba(8,45,32,.06)] sm:min-h-[215px] sm:p-7 ${index === 1 ? "bg-[#e9f0dc]" : "bg-white"}`}
            >
              <p className={`${SERIF} text-[clamp(2rem,4vw,3.1rem)] uppercase leading-none text-[#123a35]`}>
                {fact.value}
              </p>
              <p className="mt-4 text-[10px] font-bold uppercase tracking-[.14em] text-[#123a35] sm:text-xs">
                {fact.label}
              </p>
              <p className="mt-2 text-xs leading-5 text-[#52645f] sm:text-sm">{fact.note}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
