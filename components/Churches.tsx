"use client";

import { m } from "framer-motion";
import { ArrowUpRight } from "lucide-react";

const departments = [
  {
    name: "Junior Secondary (JSS1 — JSS3)",
    desc: "Foundational education with BECE preparation and digital literacy.",
    href: "/academics",
  },
  {
    name: "Senior Secondary — Science",
    desc: "Physics, Chemistry, Biology, Mathematics, Technical Drawing.",
    href: "/academics",
  },
  {
    name: "Senior Secondary — Arts",
    desc: "Literature, Government, History, Religious Studies, Fine Arts.",
    href: "/academics",
  },
  {
    name: "Senior Secondary — Commercial",
    desc: "Economics, Commerce, Accounting, Business Studies.",
    href: "/academics",
  },
  {
    name: "STEM & Digital Learning",
    desc: "Computer science, robotics programs, and technology-enhanced instruction.",
    href: "/academics",
  },
  {
    name: "Sports & Physical Education",
    desc: "Football, basketball, athletics, table tennis, and inter-house competitions.",
    href: "/campus-life",
  },
  {
    name: "Library & E-Resources",
    desc: "Curated digital textbooks, past exam archives, and study materials.",
    href: "/campus-life",
  },
  {
    name: "Computer Laboratory",
    desc: "Well-equipped computer laboratory with modern workstations and internet access for ICT, Data Processing and CBT practice.",
    href: "/campus-life",
  },
  {
    name: "Leadership & Character",
    desc: "Ethics, public speaking, debate, and student government programs.",
    href: "/campus-life",
  },
];

export default function Departments() {
  return (
    <section
      id="departments"
      className="w-full bg-[var(--section-bg-alt)] pt-16 md:pt-24 pb-16 md:pb-24 theme-transition"
    >
      <div className="mx-auto max-w-7xl px-6">
        <div className="max-w-3xl mb-12 md:mb-16">
          <span className="font-body text-[10px] font-bold tracking-[0.25em] uppercase text-[var(--accent-primary)] mb-3 block">
            DEPARTMENTS &amp; PROGRAMMES
          </span>
          <h2 className="font-display text-[32px] md:text-[48px] lg:text-[56px] leading-[0.9] tracking-[2px] md:tracking-[4px] text-[var(--text-primary)] mb-4">
            A COMPLETE EDUCATIONAL ECOSYSTEM
          </h2>
          <p className="font-body text-sm md:text-base text-[var(--text-secondary)] leading-relaxed">
            From Junior Secondary through Senior Secondary, Ykay College offers rigorous academic
            tracks, world-class facilities, and leadership training designed to prepare students for
            university and life.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
          {departments.map((dept, i) => (
            <m.a
              key={dept.name}
              href={dept.href}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: i * 0.04 }}
              className="group flex items-center justify-between rounded-2xl bg-[var(--surface-card)] border border-[var(--border-subtle)] p-6 hover:border-[var(--accent-primary)] hover:shadow-[var(--card-shadow-hover)] hover:-translate-y-0.5 transition-all duration-300"
            >
              <div className="flex-1 min-w-0 pr-3">
                <h3 className="font-display text-lg md:text-xl tracking-[2px] text-[var(--text-primary)] mb-1 group-hover:text-[var(--accent-primary)] transition-colors">
                  {dept.name}
                </h3>
                <p className="font-body text-xs text-[var(--text-muted)] tracking-wide leading-relaxed">
                  {dept.desc}
                </p>
              </div>
              <ArrowUpRight
                size={18}
                className="text-[var(--text-muted)] group-hover:text-[var(--accent-primary)] group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all shrink-0"
              />
            </m.a>
          ))}
        </div>
      </div>
    </section>
  );
}
