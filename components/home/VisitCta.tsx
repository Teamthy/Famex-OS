import { ArrowUpRight, Mail, MapPin, Phone } from "lucide-react";
import FindUs from "@/components/FindUs";
import { SERIF } from "./theme";

/** Visit/contact details stay connected to school configuration and the shared map component. */
export default function VisitCta() {
  const phone = process.env.SCHOOL_PHONE?.trim() || null;
  const email = process.env.SCHOOL_EMAIL?.trim() || null;
  return (
    <section
      id="visit"
      className="home-below-fold mx-auto max-w-[1320px] px-5 pb-20 sm:px-8 sm:pb-28 lg:px-12"
    >
      <div className="grid gap-3 lg:grid-cols-[.88fr_1.12fr]">
        <div className="flex flex-col items-start rounded-[25px] bg-[#e9f0dc] p-7 text-[#123a35] sm:p-9">
          <p className="text-[10px] font-bold uppercase tracking-[.2em] text-[#28645b]">
            Come see for yourself
          </p>
          <h2
            className={`${SERIF} mt-3 text-[clamp(2.8rem,5vw,4.7rem)] uppercase leading-[.88] text-[#123a35]`}
          >
            Come and <span className="text-[#28645b]">meet us.</span>
          </h2>
          <p className="mt-4 max-w-md text-sm leading-6 text-[#52645f]">
            A visit is the best way to picture your child here. Get in touch to plan a conversation
            with the school.
          </p>
          <ul className="mt-7 space-y-3">
            {phone ? (
              <li>
                <a
                  href={`tel:${phone.replace(/\s+/g, "")}`}
                  className="inline-flex items-center gap-3 text-sm text-[#123a35] hover:text-[#28645b]"
                >
                  <Phone className="h-4 w-4 text-[#28645b]" aria-hidden="true" />
                  {phone}
                </a>
              </li>
            ) : null}
            {email ? (
              <li>
                <a
                  href={`mailto:${email}`}
                  className="inline-flex items-center gap-3 text-sm text-[#123a35] hover:text-[#28645b]"
                >
                  <Mail className="h-4 w-4 text-[#28645b]" aria-hidden="true" />
                  {email}
                </a>
              </li>
            ) : null}
            <li className="inline-flex items-center gap-3 text-sm text-[#123a35]">
              <MapPin className="h-4 w-4 text-[#28645b]" aria-hidden="true" />
              Lagos, Nigeria
            </li>
          </ul>
          <a
            href="/contact"
            className="mt-auto inline-flex items-center gap-3 rounded-full bg-[#b6e618] px-5 py-3 text-xs font-bold text-[#123a35] transition hover:bg-[#c8ee53]"
          >
            Contact the school <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
          </a>
        </div>
        <div className="min-h-[320px] overflow-hidden rounded-[25px] border border-[var(--home-line)] bg-white shadow-[0_12px_35px_rgba(8,45,32,.06)]">
          <FindUs />
        </div>
      </div>
    </section>
  );
}
