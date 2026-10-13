"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowLeft, ArrowRight, Award, BookOpen, Check, Clock, GraduationCap } from "lucide-react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";

export type ITCourseContent = {
  slug: string;
  title: string;
  shortTitle: string;
  certification: string;
  category: string;
  duration: string;
  difficulty: string;
  heroTagline: string;
  heroDescription: string;
  heroImages: string[];
  overview: string;
  learningObjectives: string[];
  curriculum: Array<{ week: string; topics: string[] }>;
  certificationDetails: {
    name: string;
    provider: string;
    examCode: string;
    validity: string;
    recognition: string;
    examFormat: string;
    passingScore: string;
    logoText?: string;
  };
  targetAudience: string[];
  prerequisites: string[];
  careerOutcomes: string[];
  relatedCourses: Array<{ title: string; href: string }>;
};

export default function ITCourseTrackPage({ course }: { course: ITCourseContent }) {
  const [heroIndex, setHeroIndex] = useState(0);
  useEffect(() => {
    if (course.heroImages.length < 2) return;
    const t = setInterval(() => setHeroIndex((i) => (i + 1) % course.heroImages.length), 5000);
    return () => clearInterval(t);
  }, [course.heroImages.length]);

  return (
    <>
      <Header />
      <main className="min-h-screen bg-[var(--bg-primary)] theme-transition">
        <section className="relative overflow-hidden pt-28 pb-16 md:pt-32">
          <div className="absolute inset-0">
            {course.heroImages.map((src, i) => (
              <img
                key={src}
                src={src}
                alt=""
                className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-1000 ${
                  i === heroIndex ? "opacity-100" : "opacity-0"
                }`}
              />
            ))}
            <div className="absolute inset-0 bg-gradient-to-r from-brand-navy via-brand-navy/90 to-brand-navy/75" />
          </div>
          <div className="relative mx-auto max-w-7xl px-6">
            <Link
              href="/it-education"
              className="inline-flex items-center gap-2 text-sm font-semibold text-white/80 hover:text-brand-green"
            >
              <ArrowLeft size={18} /> Back to IT Education
            </Link>
            <p className="mt-8 text-[10px] font-bold uppercase tracking-[0.25em] text-brand-green">
              {course.category}
            </p>
            <h1 className="mt-3 max-w-4xl font-display text-4xl tracking-widest text-white md:text-6xl">
              {course.title}
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-relaxed text-white md:text-lg">
              {course.heroTagline}
            </p>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-white/80">
              {course.heroDescription}
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <span className="rounded-full border border-white/20 bg-white/10 px-4 py-2 text-xs font-bold uppercase tracking-widest text-white">
                <Clock className="mr-1 inline" size={14} /> {course.duration}
              </span>
              <span className="rounded-full border border-white/20 bg-white/10 px-4 py-2 text-xs font-bold uppercase tracking-widest text-white">
                {course.difficulty}
              </span>
              <span className="rounded-full border border-brand-green/40 bg-brand-green/15 px-4 py-2 text-xs font-bold uppercase tracking-widest text-brand-green">
                {course.certification}
              </span>
            </div>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/it-portal/auth"
                className="inline-flex items-center gap-2 rounded-full bg-white px-6 py-3.5 text-xs font-bold uppercase tracking-widest text-brand-navy shadow-lg hover:bg-slate-100"
              >
                Start free IT portal <ArrowRight size={14} className="text-brand-green" />
              </Link>
              <Link
                href="/it-education"
                className="inline-flex items-center gap-2 rounded-full border border-white/40 bg-white/10 px-6 py-3.5 text-xs font-bold uppercase tracking-widest text-white hover:bg-white/20"
              >
                All programmes
              </Link>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-6 py-16">
          <div className="grid gap-10 lg:grid-cols-3">
            <div className="lg:col-span-2 space-y-10">
              <div>
                <h2 className="font-display text-3xl tracking-widest text-[var(--text-primary)]">
                  OVERVIEW
                </h2>
                <p className="mt-4 text-sm leading-relaxed text-[var(--text-secondary)] md:text-base">
                  {course.overview}
                </p>
              </div>
              <div>
                <h2 className="font-display text-3xl tracking-widest text-[var(--text-primary)]">
                  WHAT YOU&apos;LL LEARN
                </h2>
                <ul className="mt-5 grid gap-3 sm:grid-cols-2">
                  {course.learningObjectives.map((item) => (
                    <li
                      key={item}
                      className="flex gap-3 rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-card)] p-4 text-sm text-[var(--text-secondary)]"
                    >
                      <Check className="mt-0.5 shrink-0 text-brand-green" size={16} />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <h2 className="font-display text-3xl tracking-widest text-[var(--text-primary)]">
                  CURRICULUM
                </h2>
                <div className="mt-5 space-y-4">
                  {course.curriculum.map((block) => (
                    <div
                      key={block.week}
                      className="rounded-3xl border border-[var(--border-subtle)] bg-[var(--surface-card)] p-5"
                    >
                      <h3 className="font-bold text-brand-green">{block.week}</h3>
                      <ul className="mt-3 space-y-2 text-sm text-[var(--text-secondary)]">
                        {block.topics.map((topic) => (
                          <li key={topic} className="flex gap-2">
                            <span className="text-brand-green">•</span> {topic}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <aside className="space-y-5">
              <div className="rounded-3xl border border-[var(--border-subtle)] bg-[var(--surface-card)] p-6">
                <BookOpen className="text-[var(--text-accent)]" size={22} />
                <h3 className="mt-3 font-display text-xl tracking-wide">Who it&apos;s for</h3>
                <ul className="mt-4 space-y-2 text-sm text-[var(--text-secondary)]">
                  {course.targetAudience.map((item) => (
                    <li key={item}>• {item}</li>
                  ))}
                </ul>
              </div>
              <div className="rounded-3xl border border-[var(--border-subtle)] bg-[var(--surface-card)] p-6">
                <GraduationCap className="text-[var(--text-accent-warm)]" size={22} />
                <h3 className="mt-3 font-display text-xl tracking-wide">Prerequisites</h3>
                <ul className="mt-4 space-y-2 text-sm text-[var(--text-secondary)]">
                  {course.prerequisites.map((item) => (
                    <li key={item}>• {item}</li>
                  ))}
                </ul>
              </div>
              <div className="rounded-3xl bg-brand-navy p-6 text-white">
                <h3 className="font-display text-xl tracking-wide">Career outcomes</h3>
                <div className="mt-4 flex flex-wrap gap-2">
                  {course.careerOutcomes.map((item) => (
                    <span
                      key={item}
                      className="rounded-full bg-white/10 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-white"
                    >
                      {item}
                    </span>
                  ))}
                </div>
              </div>
            </aside>
          </div>
        </section>

        {/* Compact certification strip — logo-focused */}
        <section className="bg-[var(--section-bg-alt)] px-6 py-14">
          <div className="mx-auto flex max-w-7xl flex-col items-center gap-8 rounded-[2rem] border border-[var(--border-subtle)] bg-[var(--surface-card)] p-8 md:flex-row md:p-10">
            <div className="flex h-36 w-36 shrink-0 flex-col items-center justify-center rounded-3xl border-2 border-brand-green/30 bg-brand-navy p-4 text-center shadow-lg">
              <Award className="text-brand-green" size={36} />
              <div className="mt-2 text-[10px] font-bold uppercase tracking-widest text-brand-green">
                Certified
              </div>
              <div className="mt-1 font-display text-sm leading-tight tracking-wide text-white">
                {course.certificationDetails.logoText || course.shortTitle}
              </div>
            </div>
            <div className="min-w-0 flex-1 text-center md:text-left">
              <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-brand-orange">
                Get certified
              </p>
              <h2 className="mt-2 font-display text-3xl tracking-widest text-[var(--text-primary)]">
                {course.certificationDetails.name}
              </h2>
              <p className="mt-2 text-sm text-[var(--text-secondary)]">
                {course.certificationDetails.provider} · Exam {course.certificationDetails.examCode}{" "}
                · Pass mark {course.certificationDetails.passingScore}
              </p>
              <p className="mt-2 text-sm text-[var(--text-muted)]">
                {course.certificationDetails.recognition}
              </p>
              <Link
                href="/it-portal/auth"
                className="mt-5 inline-flex items-center gap-2 rounded-full bg-brand-green px-6 py-3 text-xs font-bold uppercase tracking-widest text-brand-navy hover:bg-brand-green-dark"
              >
                Enrol via IT portal <ArrowRight size={14} />
              </Link>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-6 py-14">
          <h2 className="font-display text-3xl tracking-widest text-[var(--text-primary)]">
            RELATED TRACKS
          </h2>
          <div className="mt-6 grid gap-4 sm:grid-cols-3">
            {course.relatedCourses.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-card)] p-5 transition hover:border-brand-green/40"
              >
                <div className="font-display text-xl tracking-wide text-[var(--text-primary)]">
                  {item.title}
                </div>
                <span className="mt-2 inline-flex items-center gap-1 text-xs font-bold uppercase tracking-widest text-brand-green">
                  View track <ArrowRight size={12} />
                </span>
              </Link>
            ))}
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
