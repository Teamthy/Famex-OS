"use client";

import { AnimatedText } from "@/components/AnimatedText";
import { ArrowRight, FileCheck2, CreditCard, CalendarClock } from "lucide-react";

const HIGHLIGHTS = [
  { icon: FileCheck2, label: "Online application" },
  { icon: CalendarClock, label: "JSS1 — SS3 · 2026/2027" },
  { icon: CreditCard, label: "Secure Paystack fees" },
];

export default function AdmissionsBanner() {
  return (
    <section className="relative w-full overflow-hidden">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/home/ykay-students.png"
        alt=""
        aria-hidden="true"
        loading="lazy"
        decoding="async"
        className="absolute inset-0 h-full w-full object-cover"
      />
      <div className="absolute inset-0 bg-gradient-to-r from-brand-navy-dark via-brand-navy-dark/90 to-brand-navy-dark/45" />
      <div className="absolute inset-0 bg-gradient-to-t from-brand-navy-dark/80 via-transparent to-transparent" />

      <div className="relative z-10 mx-auto w-full px-6 py-16 md:px-10 md:py-24">
        <div className="max-w-2xl">
          <span className="inline-flex items-center gap-2 rounded-full bg-brand-green/20 px-4 py-1.5 font-body text-[10px] font-bold uppercase tracking-[0.2em] text-brand-green ring-1 ring-brand-green/40 backdrop-blur-sm">
            <span className="h-1.5 w-1.5 rounded-full bg-brand-green" /> Admissions Open · 2025 /
            2026
          </span>

          <h2 className="mt-5 font-display text-[clamp(2.25rem,6.5vw,5.5rem)] leading-[0.86] tracking-[-0.015em] text-white">
            <AnimatedText heavy stagger={0.03} text="BEGIN THE" className="block" />
            <span className="block text-brand-green">
              <AnimatedText heavy stagger={0.03} text="JOURNEY" delay={0.2} />
            </span>
          </h2>

          <p className="mt-5 max-w-lg font-body text-sm leading-relaxed text-white/85 md:text-base">
            A premium day secondary school raising role models through rigorous academics,
            leadership and character formation. Apply online and track your application in real
            time.
          </p>

          <div className="mt-7 flex flex-wrap gap-x-6 gap-y-3">
            {HIGHLIGHTS.map((h) => (
              <div
                key={h.label}
                className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-white/90"
              >
                <h.icon size={16} className="text-brand-green" />
                {h.label}
              </div>
            ))}
          </div>

          <div className="mt-9 flex flex-wrap items-center gap-4">
            <a
              href="/admissions"
              className="inline-flex items-center gap-3 rounded-full bg-brand-orange px-8 py-4 font-body text-sm font-bold uppercase tracking-[0.15em] text-brand-navy shadow-lg shadow-black/30 transition-all duration-300 hover:scale-[1.04] hover:bg-brand-orange-dark active:scale-[0.97]"
            >
              Apply Now <ArrowRight size={18} />
            </a>
            <a
              href="/admissions/status"
              className="font-body text-sm font-bold uppercase tracking-[0.15em] text-white transition-colors hover:text-brand-green"
            >
              Check application status →
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
