import { Mail, MapPin, Phone } from "lucide-react";
import FindUs from "@/components/FindUs";
import { SERIF } from "./theme";

/**
 * Section 12 — visit and contact. Contact details come from the school's own
 * environment tokens (never hardcoded); the map/address island is the shared
 * FindUs component so the configured address stays the single source.
 */
export default function VisitCta() {
  const phone = process.env.SCHOOL_PHONE?.trim() || null;
  const email = process.env.SCHOOL_EMAIL?.trim() || null;

  return (
    <section id="visit" className="mx-auto max-w-6xl px-4 pb-20 sm:px-6 sm:pb-28">
      <div className="grid gap-6 lg:grid-cols-[1fr_1.1fr]">
        <div className="flex flex-col justify-between rounded-[28px] bg-[#20261f] p-8 sm:p-10">
          <div>
            <h2 className={`${SERIF} text-4xl font-semibold tracking-tight text-[#f6f1e8]`}>
              Come and <em className="font-light italic text-[#7fb069]">see us</em>
            </h2>
            <p className="mt-4 max-w-sm text-sm leading-relaxed text-[#f6f1e8]/70">
              Tours run on school days, 8am to 2pm. Bring your child — the early-years classroom
              answers questions brochures cannot.
            </p>
          </div>
          <ul className="mt-8 space-y-3">
            {phone ? (
              <li>
                <a
                  href={`tel:${phone.replace(/\s+/g, "")}`}
                  className="inline-flex items-center gap-3 text-sm text-[#f6f1e8]/85 transition hover:text-[#7fb069]"
                >
                  <Phone className="h-4 w-4" aria-hidden="true" /> {phone}
                </a>
              </li>
            ) : null}
            {email ? (
              <li>
                <a
                  href={`mailto:${email}`}
                  className="inline-flex items-center gap-3 text-sm text-[#f6f1e8]/85 transition hover:text-[#7fb069]"
                >
                  <Mail className="h-4 w-4" aria-hidden="true" /> {email}
                </a>
              </li>
            ) : null}
            <li className="inline-flex items-center gap-3 text-sm text-[#f6f1e8]/85">
              <MapPin className="h-4 w-4" aria-hidden="true" /> Lagos, Nigeria
            </li>
          </ul>
          <a
            href="/contact"
            className="mt-8 inline-block w-fit rounded-full bg-[#7fb069] px-6 py-3 text-sm font-semibold text-[#1d241a] transition hover:bg-[#5d8f4e] hover:text-white"
          >
            Send a message
          </a>
        </div>
        <div className="overflow-hidden rounded-[28px] bg-[#fffdf8] shadow-[0_10px_40px_rgba(33,29,25,0.08)]">
          <FindUs />
        </div>
      </div>
    </section>
  );
}
