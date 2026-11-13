import Link from "next/link";
import { ArrowRight, BookOpen, HeartHandshake, UsersRound } from "lucide-react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { getSchoolBrandTokens } from "@/lib/brand";

const VALUES = [
  {
    icon: BookOpen,
    title: "Learning first",
    copy: "Help learners build knowledge, confidence and the habits to keep growing.",
  },
  {
    icon: HeartHandshake,
    title: "Care with purpose",
    copy: "Contribute to a respectful, supportive environment for children and families.",
  },
  {
    icon: UsersRound,
    title: "One school community",
    copy: "Work alongside educators and school teams who make each day possible.",
  },
];

export default function CareersPage() {
  const { schoolName } = getSchoolBrandTokens();

  return (
    <>
      <Header />
      <main className="min-h-screen bg-[var(--bg-primary)]">
        <section className="px-5 pb-12 pt-16 sm:px-8 sm:pb-16 sm:pt-20 lg:px-12">
          <div className="mx-auto max-w-[1320px]">
            <p className="mb-3 text-xs font-bold uppercase tracking-[.22em] text-[#1d4a45]">
              Work with purpose
            </p>
            <h1 className="max-w-5xl font-display text-[clamp(3rem,9vw,7rem)] uppercase leading-[.9] tracking-[-.02em] text-[#123a35]">
              Careers at <span className="text-[#1d4a45]">{schoolName}.</span>
            </h1>
            <p className="mt-6 max-w-2xl text-base leading-7 text-[#52645f]">
              A school is built by people who care about learning and the young people in their
              care. If that sounds like you, get in touch with our school office to ask about
              current opportunities.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/contact"
                className="inline-flex items-center gap-2 rounded-full bg-[#123a35] px-6 py-3.5 text-sm font-bold text-white transition hover:bg-[#1d4a45] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#123a35]"
              >
                Ask about opportunities <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
              <Link
                href="/staff-directory"
                className="inline-flex items-center gap-2 rounded-full bg-[#e9eee3] px-6 py-3.5 text-sm font-bold text-[#123a35] transition hover:bg-[#dce7d5] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#123a35]"
              >
                Meet the school team <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            </div>
          </div>
        </section>

        <section className="px-5 pb-20 sm:px-8 sm:pb-24 lg:px-12">
          <div className="mx-auto max-w-[1320px]">
            <div className="grid gap-4 md:grid-cols-3">
              {VALUES.map(({ icon: Icon, title, copy }) => (
                <article
                  key={title}
                  className="rounded-[24px] bg-white p-7 shadow-[var(--card-shadow)] sm:p-8"
                >
                  <div className="mb-5 grid h-12 w-12 place-items-center rounded-2xl bg-[#e9eee3] text-[#123a35]">
                    <Icon className="h-5 w-5" aria-hidden="true" />
                  </div>
                  <h2 className="font-display text-2xl uppercase leading-none text-[#123a35]">
                    {title}
                  </h2>
                  <p className="mt-3 text-sm leading-6 text-[#52645f]">{copy}</p>
                </article>
              ))}
            </div>
            <p className="mt-6 rounded-2xl bg-[#e9eee3] p-5 text-sm leading-6 text-[#123a35]">
              To keep this page accurate, vacancies are shared by the school office rather than
              shown as unverified listings. Please use the contact form for current information.
            </p>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
