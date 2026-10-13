"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Award,
  BarChart3,
  BookOpen,
  Code,
  Cpu,
  FileText,
  Globe,
  LoaderCircle,
  Presentation,
  Shield,
  Sparkles,
} from "lucide-react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { Reveal } from "@/components/Reveal";

import { AnimatedText } from "@/components/AnimatedText";
type CatalogCourse = {
  slug: string;
  title: string;
  tagline?: string;
  shortDesc?: string;
  certification: string;
  level?: string;
  durationWeeks?: number;
  moduleCount?: number;
  enrollmentCount?: number;
  href: string;
};

const HERO_IMAGES = [
  "/it-hub-classroom.jpg",
  "/it-hub-classroom.jpg",
  "/home/hero-campus.jpg",
  "/cybersecurity-hero.jpg",
];

const FALLBACK: CatalogCourse[] = [
  {
    slug: "python",
    title: "Python Programming",
    certification: "IT Specialist – Python",
    shortDesc: "From basics to automation and problem-solving.",
    href: "/it-education/python",
  },
  {
    slug: "ai",
    title: "Artificial Intelligence",
    certification: "IT Specialist – AI",
    shortDesc: "Practical AI literacy and responsible use.",
    href: "/it-education/ai",
  },
  {
    slug: "cybersecurity",
    title: "Cybersecurity",
    certification: "IT Specialist – Cybersecurity",
    shortDesc: "Protect systems, accounts, and data.",
    href: "/it-education/cybersecurity",
  },
  {
    slug: "digital-literacy",
    title: "Digital Literacy",
    certification: "Ykay Digital Literacy Certificate",
    shortDesc: "Essential computing for every student.",
    href: "/it-education/digital-literacy",
  },
  {
    slug: "microsoft-word",
    title: "Microsoft Word",
    certification: "Microsoft Office Specialist",
    shortDesc: "Professional documents and reports.",
    href: "/it-education/microsoft-word",
  },
  {
    slug: "microsoft-excel",
    title: "Microsoft Excel",
    certification: "Microsoft Office Specialist",
    shortDesc: "Spreadsheets, charts, and analysis.",
    href: "/it-education/microsoft-excel",
  },
  {
    slug: "microsoft-powerpoint",
    title: "Microsoft PowerPoint",
    certification: "Microsoft Office Specialist",
    shortDesc: "Confident presentations that persuade.",
    href: "/it-education/microsoft-powerpoint",
  },
  {
    slug: "excel-expert",
    title: "Excel Expert",
    certification: "Microsoft Office Expert",
    shortDesc: "Advanced formulas, pivots, and dashboards.",
    href: "/it-education/excel-expert",
  },
];

const IMAGES: Record<string, string> = {
  python: "/python-hero.jpg",
  ai: "/ai-hero.jpg",
  cybersecurity: "/cybersecurity-hero.jpg",
  "digital-literacy": "/it-hub-classroom.jpg",
  "microsoft-word": "/microsoft-excel-hero.jpg",
  "microsoft-excel": "/microsoft-excel-hero.jpg",
  "microsoft-powerpoint": "/it-hub-3.jpg",
  "excel-expert": "/excel-expert-hero.jpg",
};

const ICONS: Record<string, typeof Code> = {
  python: Code,
  ai: Cpu,
  cybersecurity: Shield,
  "digital-literacy": Globe,
  "microsoft-word": FileText,
  "microsoft-excel": BarChart3,
  "microsoft-powerpoint": Presentation,
  "excel-expert": BookOpen,
};

export default function ITEducationHubPage() {
  const [courses, setCourses] = useState<CatalogCourse[]>(FALLBACK);
  const [loading, setLoading] = useState(true);
  const [heroIndex, setHeroIndex] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setHeroIndex((i) => (i + 1) % HERO_IMAGES.length), 5500);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch("/api/it/catalog", { cache: "no-store" });
        const j = await r.json();
        if (!cancelled && r.ok && Array.isArray(j.courses) && j.courses.length) {
          setCourses(
            j.courses.map((c: CatalogCourse) => ({
              ...c,
              shortDesc: c.tagline || c.shortDesc,
              href: c.href || `/it-education/${c.slug}`,
            })),
          );
        }
      } catch {
        /* fallback */
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <>
      <Header />
      <main className="min-h-screen bg-[var(--bg-primary)] theme-transition">
        <Reveal>
          <section className="relative overflow-hidden px-6 pb-16 pt-28 text-white md:pt-32">
            <div className="absolute inset-0">
              {HERO_IMAGES.map((src, i) => (
                <img
                  key={src}
                  src={src}
                  alt=""
                  className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-1000 ${
                    i === heroIndex ? "opacity-100" : "opacity-0"
                  }`}
                />
              ))}
              <div className="absolute inset-0 bg-gradient-to-r from-brand-navy via-brand-navy/92 to-brand-navy/80" />
            </div>
            <div className="relative mx-auto max-w-7xl">
              <span className="inline-flex items-center gap-2 rounded-full border border-brand-green/50 bg-brand-green/20 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.2em] text-brand-green">
                <Sparkles size={12} /> Flagship digital academy
              </span>
              <h1 className="mt-5 max-w-4xl font-display tracking-widest text-[clamp(3rem,11vw,9.5rem)]">
                <AnimatedText heavy stagger={0.034} text="IT EDUCATION AT" delay={0.0} />
                <span className="text-brand-green">
                  <AnimatedText heavy stagger={0.034} text="YKAY COLLEGE" delay={0.375} />
                </span>
              </h1>
              <p className="mt-4 max-w-2xl text-base leading-relaxed text-white md:text-lg">
                Industry-aligned pathways in programming, AI, cybersecurity, digital literacy, and
                Microsoft Office — with a dedicated IT portal for enrollment, module progress, and
                certificates.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link
                  href="/it-portal/auth"
                  className="inline-flex items-center gap-2 rounded-full bg-white px-7 py-3.5 text-xs font-bold uppercase tracking-widest text-brand-navy shadow-xl hover:bg-slate-100"
                >
                  Start free IT portal <ArrowRight size={14} className="text-brand-green" />
                </Link>
                <a
                  href="#programmes"
                  className="inline-flex items-center gap-2 rounded-full border-2 border-white px-7 py-3.5 text-xs font-bold uppercase tracking-widest text-white hover:bg-white/10"
                >
                  Browse programmes
                </a>
                <Link
                  href="/admissions"
                  className="inline-flex items-center gap-2 rounded-full bg-brand-orange px-7 py-3.5 text-xs font-bold uppercase tracking-widest text-brand-navy shadow-lg hover:bg-orange-600"
                >
                  Apply to Ykay College
                </Link>
              </div>
              {loading && (
                <p className="mt-4 inline-flex items-center gap-2 text-xs text-white/70">
                  <LoaderCircle className="animate-spin" size={14} /> Syncing live catalog…
                </p>
              )}
            </div>
          </section>
        </Reveal>

        <Reveal>
          <section id="programmes" className="px-6 py-16">
            <div className="mx-auto max-w-7xl">
              <p className="text-xs font-bold uppercase tracking-widest text-brand-green">
                Programmes
              </p>
              <h2 className="mt-2 font-display text-4xl tracking-widest text-[var(--text-primary)]">
                <AnimatedText text="CHOOSE YOUR" delay={0.0} />
                <span className="text-brand-green">
                  <AnimatedText text="TRACK" delay={0.275} />
                </span>
              </h2>
              <div className="mt-8 grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
                {courses.map((course) => {
                  const Icon = ICONS[course.slug] || Award;
                  const image = IMAGES[course.slug] || IMAGES.python;
                  return (
                    <Link
                      key={course.slug}
                      href={course.href}
                      className="group relative flex min-h-[280px] flex-col overflow-hidden rounded-[1.75rem] border border-[var(--border-subtle)] shadow-sm transition hover:-translate-y-1 hover:border-brand-green/50 hover:shadow-2xl"
                    >
                      <img
                        src={image}
                        alt=""
                        className="absolute inset-0 h-full w-full object-cover transition duration-700 group-hover:scale-110"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-brand-navy via-brand-navy/85 to-brand-navy/25" />
                      <div className="relative z-10 flex h-full flex-col p-5">
                        <div className="mb-auto flex h-11 w-11 items-center justify-center rounded-2xl bg-white/15 text-brand-green backdrop-blur transition group-hover:bg-brand-green group-hover:text-brand-navy">
                          <Icon size={20} />
                        </div>
                        <div className="mt-6 text-[10px] font-bold uppercase tracking-widest text-brand-orange">
                          {course.level || "Programme"}
                        </div>
                        <h3 className="mt-2 font-display text-2xl tracking-wide text-white">
                          {course.title}
                        </h3>
                        <p className="mt-2 flex-1 text-sm leading-relaxed text-white/85">
                          {course.shortDesc || course.tagline}
                        </p>
                        <div className="mt-4 rounded-xl bg-black/35 px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-white/90 backdrop-blur">
                          {course.certification}
                        </div>
                        <span className="mt-3 inline-flex items-center gap-1 text-xs font-bold uppercase tracking-widest text-brand-green">
                          View track <ArrowRight size={12} />
                        </span>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>
          </section>
        </Reveal>

        <Reveal>
          <section className="bg-[var(--section-bg-alt)] px-6 py-16">
            <div className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-2">
              <div className="rounded-[2rem] border border-[var(--border-subtle)] bg-[var(--surface-card)] p-8">
                <Award className="text-[var(--text-accent)]" size={28} />
                <AnimatedText
                  as="h2"
                  className="mt-4 font-display text-3xl tracking-widest text-[var(--text-primary)]"
                  text="HOW IT WORKS"
                />
                <ol className="mt-6 space-y-4 text-sm text-[var(--text-secondary)]">
                  <li>
                    <b className="text-[var(--text-primary)]">1. Explore</b> — pick a track on this
                    hub.
                  </li>
                  <li>
                    <b className="text-[var(--text-primary)]">2. Create IT portal access</b> — new
                    IT learners sign up free.
                  </li>
                  <li>
                    <b className="text-[var(--text-primary)]">3. Enrol & learn</b> — complete
                    modules and track progress.
                  </li>
                  <li>
                    <b className="text-[var(--text-primary)]">4. Get recognized</b> — finish
                    pathways toward certificates.
                  </li>
                </ol>
              </div>
              <div className="rounded-[2rem] bg-brand-navy p-8 text-white">
                <h2 className="font-display text-3xl tracking-widest">
                  <AnimatedText text="READY TO" delay={0.0} />
                  <span className="text-brand-green">
                    <AnimatedText text="BEGIN?" delay={0.2} />
                  </span>
                </h2>
                <p className="mt-4 text-sm leading-relaxed text-white/85">
                  Parents can highlight IT interest during school admissions. Community learners can
                  start immediately in the IT portal.
                </p>
                <div className="mt-8 flex flex-wrap gap-3">
                  <Link
                    href="/it-portal/auth"
                    className="rounded-full bg-white px-6 py-3.5 text-xs font-bold uppercase tracking-widest text-brand-navy shadow-lg hover:bg-slate-100"
                  >
                    IT portal signup
                  </Link>
                  <Link
                    href="/contact"
                    className="rounded-full border-2 border-white px-6 py-3.5 text-xs font-bold uppercase tracking-widest text-white hover:bg-white/10"
                  >
                    Talk to admissions
                  </Link>
                </div>
              </div>
            </div>
          </section>
        </Reveal>
      </main>
      <Footer />
    </>
  );
}
