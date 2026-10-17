import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { Reveal } from "@/components/Reveal";
import { AnimatedText } from "@/components/AnimatedText";
import Link from "next/link";
import { BookOpen, Child, Music, Palette, Puzzle, Shield } from "lucide-react";

export const metadata = {
  title: "Primary School — Foundational Learning & Character",
  description:
    "Our primary school programme builds literacy, numeracy, creativity and character for children aged 4–11 in a safe, nurturing environment aligned with the NERDC curriculum.",
};

const stages = [
  { key: "Creche / Playgroup", ages: "6 months – 2 years", icon: Child },
  { key: "Nursery 1–2", ages: "3 – 4 years", icon: Puzzle },
  { key: "Kindergarten / Pre-Primary", ages: "5 years", icon: Palette },
  { key: "Primary 1–6", ages: "6 – 11 years", icon: BookOpen },
];

const pillars = [
  {
    title: "Literacy & Numeracy",
    desc: "Phonics, reading fluency, handwriting, number sense and problem-solving, taught in small class sizes (max 20 pupils) so every child is heard.",
    icon: BookOpen,
  },
  {
    title: "Creative Expression",
    desc: "Art, music, dance and storytelling help children develop confidence and imagination alongside their academic work.",
    icon: Palette,
  },
  {
    title: "Safety & Wellbeing",
    desc: "Trained chaperones, CCTV in common areas, restricted pickup lists and a clinic on site. Every child is signed in and out by an authorised adult.",
    icon: Shield,
  },
  {
    title: "Music & Clubs",
    desc: "Recorder club, choir, chess, cultural dance and young coders club — included in fees so enrichment is not an add-on.",
    icon: Music,
  },
];

export default function PrimaryPage() {
  return (
    <>
      <Header />
      <main className="theme-transition min-h-screen bg-[var(--bg-primary)]">
        <Reveal>
          <section className="w-full overflow-hidden bg-[var(--bg-primary)] pt-32 pb-12 md:pt-40 md:pb-16">
            <div className="mx-auto max-w-7xl px-6">
              <nav aria-label="Breadcrumb" className="mb-6 text-xs uppercase tracking-widest text-[var(--text-muted)]">
                <ol className="flex gap-2">
                  <li><Link href="/academics" className="hover:text-[var(--accent-primary)]">Academics</Link></li>
                  <li aria-hidden>/</li>
                  <li className="text-[var(--accent-primary)]">Primary School</li>
                </ol>
              </nav>
              <p className="mb-4 font-body text-xs font-bold uppercase tracking-[0.25em] text-[var(--accent-primary)]">
                Ages 6 months – 11 years
              </p>
              <AnimatedText
                as="h1"
                heavy
                stagger={0.03}
                className="font-display text-[clamp(2.4rem,8vw,7rem)] leading-[0.86] tracking-[-0.01em] text-[var(--text-primary)] mb-6"
                text="PRIMARY SCHOOL"
              />
              <p className="max-w-2xl text-base leading-relaxed text-[var(--text-secondary)] md:text-xl">
                Our foundation classes grow children who love learning. A balanced curriculum,
                caring teachers and structured routines prepare pupils for a confident transition
                into secondary school.
              </p>
            </div>
          </section>
        </Reveal>

        {/* Stage ladder */}
        <Reveal>
          <section className="w-full bg-[var(--bg-primary)] py-12 md:py-20">
            <div className="mx-auto max-w-7xl px-6">
              <h2 className="mb-8 font-display text-[28px] tracking-[2px] text-[var(--text-primary)] md:text-[36px]">
                OUR CLASSES
              </h2>
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
                {stages.map((s, i) => (
                  <div
                    key={s.key}
                    className="rounded-[2rem] border border-[var(--border-subtle)] bg-[var(--surface-card)] p-8 shadow-[var(--card-shadow)] transition hover:-translate-y-1 hover:border-[var(--accent-primary)]"
                  >
                    <p className="text-xs uppercase tracking-widest text-[var(--text-muted)]">Stage {i + 1}</p>
                    <h3 className="mt-3 font-display text-xl tracking-widest text-[var(--text-primary)]">{s.key}</h3>
                    <p className="mt-2 text-sm text-[var(--text-secondary)]">{s.ages}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>
        </Reveal>

        {/* Pillars */}
        <Reveal>
          <section className="w-full bg-[var(--bg-secondary)] py-12 md:py-20">
            <div className="mx-auto max-w-7xl px-6">
              <h2 className="mb-10 font-display text-[28px] tracking-[2px] text-[var(--text-primary)] md:text-[36px]">
                WHAT MAKES OUR PRIMARY STAND OUT
              </h2>
              <div className="grid gap-6 md:grid-cols-2">
                {pillars.map((p) => (
                  <div
                    key={p.title}
                    className="rounded-[2rem] border border-[var(--border-subtle)] bg-[var(--surface-card)] p-8 md:p-10"
                  >
                    <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--accent-primary)]/15 text-[var(--accent-primary)]">
                      <p.icon size={22} />
                    </div>
                    <h3 className="mb-2 font-display text-xl tracking-widest text-[var(--text-primary)]">{p.title}</h3>
                    <p className="text-sm leading-relaxed text-[var(--text-secondary)]">{p.desc}</p>
                  </div>
                ))}
              </div>
              <div className="mt-12 flex flex-wrap gap-4">
                <Link
                  href="/admissions"
                  className="inline-flex items-center gap-2 rounded-full bg-[var(--accent-primary)] px-6 py-3 text-sm font-bold uppercase tracking-widest text-[var(--bg-primary)] transition hover:opacity-90"
                >
                  Begin admission
                </Link>
                <Link
                  href="/contact"
                  className="inline-flex items-center gap-2 rounded-full border border-[var(--border-subtle)] px-6 py-3 text-sm font-bold uppercase tracking-widest text-[var(--text-secondary)] transition hover:border-[var(--accent-primary)] hover:text-[var(--accent-primary)]"
                >
                  Book a tour
                </Link>
              </div>
            </div>
          </section>
        </Reveal>
      </main>
      <Footer />
    </>
  );
}
