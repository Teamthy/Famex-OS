"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { AnimatedText } from "@/components/AnimatedText";
import { Reveal } from "@/components/Reveal";

const VIRTUAL_URL = process.env.NEXT_PUBLIC_VIRTUAL_URL || "https://virtual.ykaycollege.com";

/**
 * Home bridge to YK-Virtual — the online arm of the Ykay family.
 *
 * Full-bleed dark band, edge to edge, in normal document flow. Gives homepage
 * visitors a direct, premium path to the virtual school (live classes,
 * 1-on-1 tuition, exam prep) and makes the two sites read as one brand.
 */
export default function VirtualBridge() {
  return (
    <section className="backdrop-brand-dark relative w-full overflow-hidden bg-brand-navy-dark py-16 md:py-24">
      {/* Soft brand glows */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -left-24 top-0 h-72 w-72 rounded-full bg-brand-green/15 blur-3xl"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-24 bottom-0 h-72 w-72 rounded-full bg-brand-orange/10 blur-3xl"
      />

      <div className="relative mx-auto flex w-full max-w-7xl flex-col gap-8 px-6 md:flex-row md:items-end md:justify-between md:px-10">
        <div className="max-w-2xl">
          <span className="mb-3 inline-flex items-center gap-2 rounded-full border border-brand-green/40 bg-brand-green/15 px-3 py-1 font-body text-[10px] font-bold uppercase tracking-[0.2em] text-brand-green">
            The Ykay family · Online
          </span>
          <h2 className="font-display text-[clamp(2.25rem,6vw,5rem)] leading-[0.86] tracking-[-0.015em] text-white">
            <AnimatedText heavy stagger={0.03} text="YKAY" delay={0.0} className="block" />
            <span className="block text-brand-green">
              <AnimatedText heavy stagger={0.03} text="VIRTUAL" delay={0.15} />
            </span>
          </h2>
          <p className="mt-4 font-body text-base leading-relaxed text-white/80">
            The same teachers, the same standards — online. Live classes, private 1-on-1 tuition,
            and UTME / WAEC / IELTS preparation you can join from anywhere in Nigeria.
          </p>
        </div>

        <Reveal delay={80} className="shrink-0">
          <div className="flex flex-col gap-3 sm:flex-row md:flex-col lg:flex-row">
            <a
              href={VIRTUAL_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 rounded-full bg-[#4ec54d] px-7 py-3.5 font-body text-xs font-bold uppercase tracking-[0.15em] text-[#0c1824] shadow-lg transition-all duration-300 hover:scale-[1.03] hover:bg-[#3aa93a] active:scale-[0.97]"
            >
              Visit Ykay Virtual <ArrowRight size={14} />
            </a>
            <Link
              href="/virtual"
              className="inline-flex items-center justify-center gap-2 rounded-full border border-white/30 bg-white/10 px-7 py-3.5 font-body text-xs font-bold uppercase tracking-[0.15em] text-white backdrop-blur-sm transition-all duration-300 hover:border-white/40 hover:bg-white/20"
            >
              What is it?
            </Link>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
