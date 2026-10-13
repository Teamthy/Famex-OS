import Link from "next/link";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { Reveal } from "@/components/Reveal";
import { ArrowRight, Award, BookOpen, FlaskConical, GraduationCap } from "lucide-react";

import { AnimatedText } from "@/components/AnimatedText";
const programmes = [
  {
    icon: BookOpen,
    title: "Junior Secondary",
    subtitle: "JSS1 — JSS3",
    desc: "Foundational Nigerian curriculum with digital literacy, continuous assessment, and BECE preparation.",
    extra: "BECE Ready",
    href: "/academics/junior-secondary",
  },
  {
    icon: Award,
    title: "SS Science",
    subtitle: "Science track",
    desc: "Physics, Chemistry, Biology, Mathematics and Further Maths for medicine, engineering and technology.",
    extra: "WAEC / JAMB",
    href: "/academics/ss-science",
  },
  {
    icon: GraduationCap,
    title: "SS Arts",
    subtitle: "Humanities track",
    desc: "Literature, Government, History, CRS, Fine Arts and French for creative and social-science pathways.",
    extra: "Humanities",
    href: "/academics/ss-arts",
  },
  {
    icon: FlaskConical,
    title: "SS Commercial",
    subtitle: "Business track",
    desc: "Economics, Commerce, Accounting and Business Studies for finance and entrepreneurship.",
    extra: "Business skills",
    href: "/academics/ss-commercial",
  },
];

export default function AcademicsPage() {
  return (
    <>
      <Header />
      <main className="min-h-screen bg-[var(--bg-primary)] theme-transition">
        <Reveal>
          <section className="relative overflow-hidden pt-32 pb-14 md:pt-40 md:pb-16">
            <div className="absolute inset-0">
              <img
                src="/home/students-class.jpg"
                alt="Classroom"
                className="h-full w-full object-cover opacity-30"
              />
              <div className="absolute inset-0 bg-gradient-to-b from-[var(--bg-primary)] via-[var(--bg-primary)]/90 to-[var(--bg-primary)]" />
            </div>
            <div className="relative mx-auto max-w-7xl px-6">
              <p className="text-xs font-bold uppercase tracking-[0.25em] text-brand-green">
                Programmes
              </p>
              <AnimatedText
                as="h1"
                heavy
                stagger={0.034}
                className="mt-4 font-display text-5xl tracking-widest text-[var(--text-primary)] md:text-7xl"
                text="ACADEMICS"
              />
              <p className="mt-4 max-w-2xl text-base text-[var(--text-secondary)] md:text-lg">
                A rigorous, NERDC-aligned curriculum spanning Junior Secondary (JSS1–JSS3) and
                Senior Secondary (SS1–SS3) — with Science, Arts, Commercial, and flagship IT
                pathways.
              </p>
            </div>
          </section>
        </Reveal>

        <Reveal>
          <section className="mx-auto max-w-7xl px-6 pb-20">
            <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
              {programmes.map((item) => (
                <div
                  key={item.title}
                  className="flex h-full flex-col rounded-[1.75rem] border border-[var(--border-subtle)] bg-[var(--surface-card)] p-6 shadow-sm transition hover:-translate-y-1 hover:border-brand-green/40 hover:shadow-xl"
                >
                  <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-xl bg-brand-green/10 text-brand-green">
                    <item.icon size={22} />
                  </div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-brand-orange">
                    {item.subtitle}
                  </p>
                  <h2 className="mt-2 font-display text-2xl tracking-wide text-[var(--text-primary)]">
                    <AnimatedText text={item.title} delay={0.0} />
                  </h2>
                  <p className="mt-3 flex-1 text-sm leading-relaxed text-[var(--text-secondary)]">
                    {item.desc}
                  </p>
                  <div className="mt-4 text-[10px] font-bold uppercase tracking-widest text-brand-green">
                    {item.extra}
                  </div>
                  <Link
                    href={item.href}
                    className="mt-5 inline-flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-[var(--text-primary)] hover:text-brand-green"
                  >
                    See more <ArrowRight size={14} />
                  </Link>
                </div>
              ))}
            </div>

            <div className="mt-10 flex flex-wrap gap-3">
              <Link
                href="/it-education"
                className="inline-flex items-center gap-2 rounded-full bg-brand-green px-6 py-3 text-xs font-bold uppercase tracking-widest text-brand-navy"
              >
                Explore IT programmes <ArrowRight size={14} />
              </Link>
              <Link
                href="/admissions"
                className="inline-flex items-center gap-2 rounded-full border border-[var(--border-default)] px-6 py-3 text-xs font-bold uppercase tracking-widest text-[var(--text-primary)]"
              >
                Apply for admission
              </Link>
            </div>

            <div className="mt-16 rounded-[2rem] border border-[var(--border-subtle)] bg-[var(--surface-card)] p-8 md:p-10">
              <AnimatedText
                as="h2"
                className="font-display text-3xl tracking-widest text-[var(--text-primary)]"
                text="CURRICULUM FOCUS"
              />
              <p className="mt-3 max-w-3xl text-sm leading-relaxed text-[var(--text-secondary)]">
                All academic content is aligned with the Nigerian Educational Research and
                Development Council (NERDC) curriculum. Students receive continuous assessment,
                leadership formation, and digital skills as part of a complete secondary education.
              </p>
              <div className="mt-8 grid gap-4 md:grid-cols-3">
                {[
                  {
                    label: "Assessment",
                    text: "CA components + terminal exams feeding live gradebooks.",
                  },
                  {
                    label: "Report cards",
                    text: "Branded PDF release with QR verification for authenticity.",
                  },
                  {
                    label: "IT pathway",
                    text: "Optional certification tracks via the Ykay IT Hub portal.",
                  },
                ].map((item) => (
                  <div key={item.label} className="rounded-2xl bg-[var(--surface-disabled)] p-5">
                    <div className="text-[10px] font-bold uppercase tracking-widest text-brand-green">
                      {item.label}
                    </div>
                    <p className="mt-2 text-sm text-[var(--text-secondary)]">{item.text}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>
        </Reveal>
      </main>
      <Footer />
    </>
  );
}
