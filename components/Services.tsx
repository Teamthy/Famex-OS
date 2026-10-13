"use client";

import Link from "next/link";
import { AnimatedText } from "@/components/AnimatedText";
import {
  GraduationCap,
  ClipboardCheck,
  Trophy,
  ShieldCheck,
  Heart,
  ArrowRight,
} from "lucide-react";

const SERVICES = [
  {
    icon: GraduationCap,
    title: "Academics",
    subtitle: "JSS1 — SS3",
    desc: "NERDC-aligned curriculum enhanced with digital literacy, STEM, and continuous assessment.",
    href: "/academics",
  },
  {
    icon: ClipboardCheck,
    title: "Admissions",
    subtitle: "2025 / 2026 Now Open",
    desc: "Streamlined online application with document upload and Paystack fee payment.",
    href: "/admissions",
  },
  {
    icon: Trophy,
    title: "Campus Life",
    subtitle: "Beyond the Classroom",
    desc: "Sports, clubs, leadership training, cultural events, and community service.",
    href: "/campus-life",
  },
  {
    icon: ShieldCheck,
    title: "EduPortal",
    subtitle: "Digital School Management",
    desc: "Real-time attendance, grades, fees, and communication for parents and students.",
    href: "/portal",
  },
  {
    icon: Heart,
    title: "Student Wellbeing",
    subtitle: "Character & Support",
    desc: "Anonymous mood check-ins, counselor messaging, and pastoral care programs.",
    href: "/contact",
  },
];

export default function Services() {
  return (
    <section className="backdrop-brand-navy w-full bg-[var(--bg-primary)] py-16 md:py-24 theme-transition">
      <div className="mx-auto max-w-7xl px-6">
        <div className="text-center mb-12">
          <span className="text-brand-green text-[10px] font-bold tracking-widest uppercase mb-3 block">
            Programmes & Services
          </span>
          <h2 className="font-display text-[clamp(2.25rem,6.5vw,5.5rem)] leading-[0.86] tracking-[-0.015em] text-[var(--text-primary)]">
            <AnimatedText heavy stagger={0.03} text="WHAT WE" delay={0.0} className="block" />
            <span className="block text-brand-green">
              <AnimatedText heavy stagger={0.03} text="OFFER" delay={0.175} />
            </span>
          </h2>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-5">
          {SERVICES.map((s) => (
            <div key={s.title}>
              <Link
                href={s.href}
                className="group block h-full rounded-[1.75rem] bg-[var(--surface-card)] border border-[var(--border-subtle)] p-6 shadow-[var(--card-shadow)] hover:border-brand-green hover:shadow-[var(--card-shadow-hover)] hover:-translate-y-1 transition-all duration-300"
              >
                <div className="w-12 h-12 rounded-2xl bg-brand-green/10 text-brand-green flex items-center justify-center mb-6 group-hover:bg-brand-green group-hover:text-brand-navy transition-colors">
                  <s.icon size={22} />
                </div>
                <div className="text-[10px] font-bold uppercase tracking-widest text-brand-green mb-2">
                  {s.subtitle}
                </div>
                <h3 className="font-display text-[clamp(1.5rem,2.4vw,2.25rem)] leading-[0.95] tracking-[-0.01em] text-[var(--text-primary)] mb-3">
                  {s.title}
                </h3>
                <p className="text-sm text-[var(--text-secondary)] leading-relaxed mb-6">
                  {s.desc}
                </p>
                <span className="inline-flex items-center gap-2 text-xs font-bold text-brand-green group-hover:gap-3 transition-all uppercase tracking-widest">
                  Learn More <ArrowRight size={12} />
                </span>
              </Link>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
