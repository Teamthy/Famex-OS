import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { PRODUCT_NAME, getSchoolBrandTokens } from "@/lib/brand";
import { SERIF } from "./theme";

const LINK_GROUPS = [
  {
    title: "Explore",
    links: [
      { href: "#story", label: "Our school" },
      { href: "#academics", label: "Learning" },
      { href: "#stages", label: "School stages" },
      { href: "#campus", label: "Campus life" },
    ],
  },
  {
    title: "Community",
    links: [
      { href: "/news-events", label: "Journal" },
      { href: "/alumni", label: "Alumni" },
      { href: "/careers", label: "Careers" },
      { href: "/faq", label: "FAQs" },
    ],
  },
  {
    title: "Get in touch",
    links: [
      { href: "/admissions", label: "Admissions" },
      { href: "/contact", label: "Contact the school" },
      { href: "/login", label: "Student portal" },
    ],
  },
];

/** Warm, structured footer with distinct link groups and readable contrast. */
export default function HomeFooter() {
  const { schoolName } = getSchoolBrandTokens();
  const year = new Date().getFullYear();

  return (
    <footer className="home-below-fold bg-[#f6f4ea] text-[#123a35]">
      <div className="mx-auto grid max-w-[1320px] gap-12 px-5 py-14 sm:px-8 sm:py-16 lg:grid-cols-[1fr_1.2fr] lg:gap-16 lg:px-12 lg:py-20">
        <div>
          <div className="flex items-center gap-3">
            <Image
              src="/logo-280.webp"
              alt=""
              width={48}
              height={48}
              className="h-11 w-11 rounded-full bg-white object-contain p-1 shadow-sm"
            />
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[.2em] text-[#28645b]">
                Raising role models
              </p>
              <p className="mt-1 text-xs font-semibold text-[#52645f]">Welcome to</p>
            </div>
          </div>
          <h2 className={`${SERIF} mt-5 max-w-xl text-[clamp(2.3rem,4vw,3.8rem)] uppercase leading-[.92] text-[#123a35]`}>
            {schoolName}
          </h2>
          <p className="mt-4 max-w-md text-sm leading-6 text-[#52645f]">
            A joyful, rigorous school journey shaped by learning, character and care.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href="/admissions"
              className="inline-flex items-center gap-2 rounded-full bg-[#b6e618] px-5 py-3 text-xs font-bold text-[#123a35] transition hover:bg-[#c8ee53] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#123a35]"
            >
              Explore admissions <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
            </Link>
            <Link
              href="/contact"
              className="inline-flex items-center gap-2 rounded-full bg-white px-5 py-3 text-xs font-bold text-[#123a35] shadow-sm transition hover:bg-[#e9eee3] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#123a35]"
            >
              Talk to our team
            </Link>
          </div>
        </div>

        <nav aria-label="Footer" className="grid grid-cols-2 gap-x-6 gap-y-8 sm:grid-cols-3">
          {LINK_GROUPS.map((group) => (
            <div key={group.title}>
              <h3 className="mb-4 text-[10px] font-bold uppercase tracking-[.18em] text-[#28645b]">
                {group.title}
              </h3>
              <ul className="space-y-3">
                {group.links.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="inline-flex min-h-8 items-center text-sm font-semibold text-[#123a35] transition hover:text-[#28645b] hover:underline hover:underline-offset-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#123a35]"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>
      </div>

      <div className="bg-[#123a35] text-white">
        <div className="mx-auto flex max-w-[1320px] flex-col gap-2 px-5 py-5 text-xs sm:flex-row sm:items-center sm:justify-between sm:px-8 lg:px-12">
          <p className="font-semibold">© {year} {schoolName}. All rights reserved.</p>
          <p className="text-white/90">Powered by {PRODUCT_NAME}.</p>
        </div>
      </div>
    </footer>
  );
}
