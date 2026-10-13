import Link from "next/link";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { Reveal } from "@/components/Reveal";
import { AnimatedText } from "@/components/AnimatedText";
import { ArrowRight, ClipboardCheck, GraduationCap, Monitor, Palette, PenLine } from "lucide-react";

const SUBJECTS = [
  "English Language",
  "Literature-in-English",
  "Government",
  "History",
  "Christian Religious Studies",
  "Cultural & Creative Arts",
  "French",
];

const AT_A_GLANCE = [
  { icon: PenLine, label: "SS1 — SS3 · Humanities track" },
  { icon: GraduationCap, label: "WASSCE · NECO · UTME" },
  { icon: Palette, label: "Creative pathways" },
];

export default function SSArtsPage() {
  return (
    <>
      <Header />
      <main className="min-h-screen bg-[var(--bg-primary)] theme-transition">
        <Reveal>
          <section className="relative overflow-hidden pt-32 pb-14 md:pt-40 md:pb-16">
            <div className="absolute inset-0">
              {/* TODO(school-photos): swap for an arts / creative-class photo
                  from the school Drive folder (named slot: public/home/college-arts.jpg) */}
              <img
                src="/home/college-arts.jpg"
                alt="Senior secondary arts class"
                className="h-full w-full object-cover opacity-30"
              />
              <div className="absolute inset-0 bg-gradient-to-b from-[var(--bg-primary)] via-[var(--bg-primary)]/90 to-[var(--bg-primary)]" />
            </div>
            <div className="relative mx-auto max-w-7xl px-6">
              <p className="text-xs font-bold uppercase tracking-[0.25em] text-brand-green">
                <Link href="/academics" className="hover:text-brand-orange">
                  Academics
                </Link>{" "}
                / SS Arts
              </p>
              <AnimatedText
                as="h1"
                heavy
                stagger={0.034}
                className="mt-4 font-display text-4xl tracking-widest text-[var(--text-primary)] md:text-6xl"
                text="SS ARTS"
              />
              <p className="mt-4 max-w-2xl text-base text-[var(--text-secondary)] md:text-lg">
                Literature, Government, History, CRS, Fine Arts and French — the humanities track
                for law, media, administration and the creative and social-science pathways.
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                {AT_A_GLANCE.map((item) => (
                  <span
                    key={item.label}
                    className="inline-flex items-center gap-2 rounded-full border border-[var(--border-subtle)] bg-[var(--surface-card)] px-4 py-2 text-xs font-bold uppercase tracking-widest text-[var(--text-primary)]"
                  >
                    <item.icon size={14} className="text-brand-green" />
                    {item.label}
                  </span>
                ))}
              </div>
            </div>
          </section>
        </Reveal>

        <Reveal>
          <section className="mx-auto max-w-7xl px-6 pb-20">
            <AnimatedText
              as="h2"
              className="font-display text-3xl tracking-widest text-[var(--text-primary)]"
              text="SUBJECTS OFFERED"
            />
            <p className="mt-3 max-w-3xl text-sm leading-relaxed text-[var(--text-secondary)]">
              English Language is compulsory; students combine the humanities subjects that fit
              their intended university course.
            </p>
            <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {SUBJECTS.map((subject) => (
                <div
                  key={subject}
                  className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-card)] p-5 text-sm font-semibold text-[var(--text-primary)] transition hover:border-brand-green/40 hover:shadow-md"
                >
                  {subject}
                </div>
              ))}
            </div>
          </section>
        </Reveal>

        <Reveal>
          <section className="mx-auto max-w-7xl px-6 pb-20">
            <div className="rounded-[2rem] border border-[var(--border-subtle)] bg-[var(--surface-card)] p-8 md:p-10">
              <AnimatedText
                as="h2"
                className="font-display text-3xl tracking-widest text-[var(--text-primary)]"
                text="STRUCTURE & ASSESSMENT"
              />
              <p className="mt-3 max-w-3xl text-sm leading-relaxed text-[var(--text-secondary)]">
                Three senior years of continuous assessment and terminal examinations, essay-writing
                practice, and exam-hall simulation for WASSCE, NECO and UTME.
              </p>
              <div className="mt-8 grid gap-4 md:grid-cols-3">
                {[
                  {
                    icon: ClipboardCheck,
                    label: "CA + coursework",
                    text: "Essays, projects and terminal exams feed live gradebooks each term.",
                  },
                  {
                    icon: GraduationCap,
                    label: "WAEC / NECO / JAMB",
                    text: "Past-paper drills and syllabus-complete revision for external examinations.",
                  },
                  {
                    icon: Monitor,
                    label: "CBT practice",
                    text: "Timed, UTME-style computer-based tests in the well-equipped computer laboratory.",
                  },
                ].map((item) => (
                  <div key={item.label} className="rounded-2xl bg-[var(--surface-disabled)] p-5">
                    <div className="flex items-center gap-2">
                      <item.icon size={16} className="text-brand-green" />
                      <div className="text-[10px] font-bold uppercase tracking-widest text-brand-green">
                        {item.label}
                      </div>
                    </div>
                    <p className="mt-2 text-sm text-[var(--text-secondary)]">{item.text}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>
        </Reveal>

        <Reveal>
          <section className="mx-auto max-w-7xl px-6 pb-24">
            <div className="flex flex-wrap gap-3">
              <Link
                href="/admissions"
                className="inline-flex items-center gap-2 rounded-full bg-brand-green px-6 py-3 text-xs font-bold uppercase tracking-widest text-brand-navy"
              >
                Apply for admission <ArrowRight size={14} />
              </Link>
              <Link
                href="/academics"
                className="inline-flex items-center gap-2 rounded-full border border-[var(--border-default)] px-6 py-3 text-xs font-bold uppercase tracking-widest text-[var(--text-primary)]"
              >
                All programmes
              </Link>
            </div>
          </section>
        </Reveal>
      </main>
      <Footer />
    </>
  );
}
