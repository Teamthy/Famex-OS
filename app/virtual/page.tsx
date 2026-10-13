import Image from "next/image";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { Reveal } from "@/components/Reveal";
import { AnimatedText } from "@/components/AnimatedText";
import { ArrowRight, ArrowUpRight, Globe, MapPin } from "lucide-react";

const VIRTUAL_URL = process.env.NEXT_PUBLIC_VIRTUAL_URL || "https://virtual.ykaycollege.com";

export const metadata = {
  title: "Ykay Virtual — Learn Online Anywhere | Ykay College",
  description:
    "Ykay Virtual is the online arm of the Ykay family — live online classes, private 1-on-1 tuition, and UTME/WAEC/IELTS preparation you can join from anywhere.",
};

/**
 * The gateway between the two Ykay schools — editorial, image-led.
 *
 * Two full-bleed image cards side by side (index marks 01 / 02, photo that
 * scales on hover, dark overlay so the type always reads), under a big
 * editorial header. The reference language: madeinevolve.com case cards.
 */
export default function VirtualPage() {
  return (
    <>
      <Header />
      <main className="bg-[var(--bg-primary)] text-[var(--text-primary)]">
        {/* ── Editorial header ── */}
        <section className="w-full border-b border-[var(--border-subtle)] px-6 pb-10 pt-20 md:px-10 md:pb-14 md:pt-28">
          <div className="mx-auto w-full max-w-7xl">
            <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-[var(--border-subtle)] bg-[var(--surface-card)] px-4 py-1.5 font-body text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--text-secondary)]">
              <Globe size={12} className="text-brand-green" /> The Ykay family
            </p>
            <h1 className="font-display text-[clamp(2.75rem,9vw,8rem)] leading-[0.85] tracking-[-0.015em]">
              <AnimatedText
                heavy
                stagger={0.03}
                text="TWO SCHOOLS."
                delay={0.0}
                className="block"
              />
              <span className="block text-brand-green">
                <AnimatedText heavy stagger={0.03} text="ONE FAMILY." delay={0.2} />
              </span>
            </h1>
            <p className="mt-6 max-w-2xl font-body text-base leading-relaxed text-[var(--text-secondary)] md:text-lg">
              Learn on campus with Ykay College, or online with Ykay Virtual — the same teachers,
              the same standards, whichever fits your child.
            </p>
          </div>
        </section>

        {/* ── The two cards ── */}
        <section className="w-full px-6 py-10 md:px-10 md:py-14">
          <div className="mx-auto grid w-full max-w-7xl gap-6 md:grid-cols-2">
            {/* 01 — the campus school (you are here) */}
            <Reveal>
              <div className="group relative flex min-h-[26rem] flex-col justify-end overflow-hidden rounded-3xl border border-[var(--border-subtle)] shadow-lg">
                {/* First card — in the initial viewport on mobile, so it is the
                    LCP element: pre-built WebP, fetchpriority=high. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/it-hub-classroom-750.webp"
                  srcSet="/it-hub-classroom-750.webp 750w, /it-hub-classroom-1200.webp 1200w"
                  sizes="(max-width: 768px) 100vw, 50vw"
                  alt="Students working in the Ykay College IT hub"
                  fetchPriority="high"
                  decoding="async"
                  className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-brand-navy-dark via-brand-navy-dark/55 to-brand-navy-dark/10" />

                <div className="relative flex h-full flex-col justify-between p-7 md:p-9">
                  <div className="flex items-start justify-between">
                    <span className="inline-flex items-center gap-2 rounded-full border border-white/25 bg-black/30 px-3 py-1 font-body text-[10px] font-bold uppercase tracking-[0.2em] text-white backdrop-blur-sm">
                      <MapPin size={11} className="text-brand-orange" /> You are here
                    </span>
                    <span className="font-display text-xl tracking-widest text-white/50">(01)</span>
                  </div>

                  <div>
                    <h2 className="font-display text-[clamp(2.25rem,5vw,4.25rem)] leading-[0.88] tracking-[-0.01em] text-white">
                      YKAY
                      <span className="block text-brand-orange">COLLEGE</span>
                    </h2>
                    <p className="mt-3 max-w-md font-body text-sm leading-relaxed text-white/80">
                      The campus school — JSS1 to SS3, science laboratories, sports, clubs and a
                      full IT academy in the timetable.
                    </p>
                    <div className="mt-6 flex flex-wrap items-center gap-4">
                      <a
                        href="/admissions"
                        className="inline-flex items-center gap-2 rounded-full bg-[#ff6e00] px-6 py-3 font-body text-xs font-bold uppercase tracking-[0.15em] text-[#0c1824] transition-all duration-300 hover:scale-[1.03] hover:bg-[#e65f00] active:scale-[0.97]"
                      >
                        Apply to the college <ArrowRight size={13} />
                      </a>
                      <span className="font-body text-[10px] font-bold uppercase tracking-[0.2em] text-white/50">
                        ykaycollege.edu.ng
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </Reveal>

            {/* 02 — the online school (destination) */}
            <Reveal delay={80} className="cv-auto">
              <div className="group relative flex min-h-[26rem] flex-col justify-end overflow-hidden rounded-3xl border border-[var(--border-subtle)] shadow-lg">
                {/* Second card — below the fold on mobile, so it must not
                    compete with the LCP image for the connection. */}
                <Image
                  src="/home/hero-campus.jpg"
                  alt="A student learning online on a laptop"
                  fill
                  loading="lazy"
                  sizes="(max-width: 768px) 100vw, 50vw"
                  className="object-cover transition-transform duration-700 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-brand-navy-dark via-brand-navy-dark/55 to-brand-navy-dark/10" />

                <div className="relative flex h-full flex-col justify-between p-7 md:p-9">
                  <div className="flex items-start justify-between">
                    <span className="inline-flex items-center gap-2 rounded-full border border-brand-green/50 bg-black/30 px-3 py-1 font-body text-[10px] font-bold uppercase tracking-[0.2em] text-brand-green backdrop-blur-sm">
                      <Globe size={11} /> Online · anywhere
                    </span>
                    <span className="font-display text-xl tracking-widest text-white/50">(02)</span>
                  </div>

                  <div>
                    <h2 className="font-display text-[clamp(2.25rem,5vw,4.25rem)] leading-[0.88] tracking-[-0.01em] text-white">
                      YKAY
                      <span className="block text-brand-green">VIRTUAL</span>
                    </h2>
                    <p className="mt-3 max-w-md font-body text-sm leading-relaxed text-white/80">
                      The same teachers and standards — online. Live classes, private 1-on-1 tuition
                      and UTME / WAEC / IELTS preparation on any device.
                    </p>
                    <div className="mt-6 flex flex-wrap items-center gap-4">
                      <a
                        href={VIRTUAL_URL}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 rounded-full bg-[#4ec54d] px-6 py-3 font-body text-xs font-bold uppercase tracking-[0.15em] text-[#0c1824] transition-all duration-300 hover:scale-[1.03] hover:bg-[#3aa93a] active:scale-[0.97]"
                      >
                        Continue to Ykay Virtual <ArrowUpRight size={13} />
                      </a>
                      <span className="font-body text-[10px] font-bold uppercase tracking-[0.2em] text-white/50">
                        {VIRTUAL_URL.replace(/^https?:\/\//, "")}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </Reveal>
          </div>
        </section>

        {/* ── What you can do on Ykay Virtual ── */}
        <Reveal>
          <section className="w-full border-t border-[var(--border-subtle)] bg-[var(--bg-secondary)] py-16 md:py-24">
            <div className="mx-auto grid w-full max-w-7xl gap-10 px-6 md:grid-cols-2 md:px-10">
              <div>
                <AnimatedText
                  as="h2"
                  className="font-display text-3xl tracking-wide md:text-4xl"
                  text="What you can do on Ykay Virtual"
                />
                <p className="mt-4 max-w-md text-sm leading-relaxed text-[var(--text-muted)] md:text-base">
                  YK-Virtual is the home of Ykay Virtual — a full online school built by the same
                  team, for learners who study best from home or need extra support.
                </p>
                <a
                  href={VIRTUAL_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-7 inline-flex items-center gap-2 rounded-full bg-[var(--text-primary)] px-7 py-3.5 text-xs font-bold uppercase tracking-[0.15em] text-[var(--bg-primary)] transition-all duration-300 hover:scale-[1.03] active:scale-[0.97]"
                >
                  Visit {VIRTUAL_URL.replace(/^https?:\/\//, "")} <ArrowUpRight size={14} />
                </a>
              </div>
              <ul className="grid gap-4 sm:grid-cols-2">
                {[
                  [
                    "Live online classes",
                    "Real-time lessons with vetted teachers, anywhere in Nigeria.",
                  ],
                  ["Private 1-on-1 tuition", "A personal tutor with a plan and flexible times."],
                  ["UTME · WAEC · IELTS prep", "Structured revision, past questions, mock exams."],
                  ["Visible progress", "Parents and learners see attendance, scores and feedback."],
                ].map(([title, desc], i) => (
                  <li
                    key={title}
                    className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-card)] p-5"
                  >
                    <span className="font-display text-sm tracking-widest text-brand-green">
                      ({String(i + 1).padStart(2, "0")})
                    </span>
                    <h3 className="mt-2 font-body text-sm font-bold text-[var(--text-primary)]">
                      {title}
                    </h3>
                    <p className="mt-1.5 font-body text-xs leading-relaxed text-[var(--text-muted)]">
                      {desc}
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          </section>
        </Reveal>
      </main>
      <Footer />
    </>
  );
}
