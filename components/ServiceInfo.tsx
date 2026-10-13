"use client";

import { Clock, MapPin } from "lucide-react";

import { AnimatedText } from "@/components/AnimatedText";
import { useSchoolProfile } from "@/components/SchoolProfileContext";

/**
 * Full-bleed school information band.
 *
 * Edge-to-edge like every other home section (the content sits in a normal
 * max-width container inside). Stacks strictly in document flow — no card
 * floating over neighbours, no negative margins, so it can never overlap the
 * section before or after it.
 */
export default function ServiceInfo() {
  const { address } = useSchoolProfile();
  return (
    <section className="relative w-full border-y border-[var(--border-subtle)] bg-[var(--bg-secondary)] backdrop-edu-light py-14 md:py-20 theme-transition">
      <div className="mx-auto w-full max-w-7xl px-6 md:px-10">
        <div className="grid gap-10 lg:grid-cols-[1.05fr_2fr] lg:items-center">
          {/* Best-fit campus photo — the info band gets a visual anchor. */}
          <div className="relative overflow-hidden rounded-3xl border border-[var(--border-subtle)] shadow-lg">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/it-hub-classroom.jpg"
              alt="Students working in the Ykay College IT hub"
              className="h-56 w-full object-cover md:h-72 lg:h-full"
              loading="lazy"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-brand-navy-dark/70 via-transparent to-transparent" />
            <p className="absolute bottom-4 left-5 font-body text-[10px] font-bold uppercase tracking-[0.25em] text-white">
              The campus
            </p>
          </div>
          <div className="grid gap-10 md:grid-cols-3 md:items-center md:gap-8">
            <div>
              <span className="mb-3 block font-body text-[10px] font-bold uppercase tracking-[0.25em] text-[var(--accent-primary)]">
                School Hours &amp; Location
              </span>
              <h2 className="font-display text-[clamp(1.75rem,3vw,2.75rem)] leading-[0.95] tracking-[-0.01em] text-[var(--text-primary)]">
                <AnimatedText
                  heavy
                  stagger={0.03}
                  text="School Hours"
                  delay={0.0}
                  className="block"
                />
                <span className="block text-[var(--accent-primary)]">
                  <AnimatedText heavy stagger={0.03} text="& Location" delay={0.15} />
                </span>
              </h2>
              <p className="mt-3 font-body text-sm text-[var(--text-muted)]">
                Ykay College &amp; Leadership Academy
              </p>
            </div>

            <div className="flex items-start gap-3">
              <div className="rounded-lg bg-[var(--accent-primary)]/10 p-2.5">
                <Clock size={18} className="text-[var(--accent-primary)]" />
              </div>
              <div>
                <p className="mb-1 font-body text-[10px] font-bold uppercase tracking-[0.15em] text-[var(--accent-primary)]">
                  School Days
                </p>
                <p className="font-body text-sm font-medium text-[var(--text-primary)]">
                  Monday — Friday
                </p>
                <p className="font-body text-sm text-[var(--text-secondary)]">7:30 AM — 3:30 PM</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="rounded-lg bg-[var(--accent-primary)]/10 p-2.5">
                <MapPin size={18} className="text-[var(--accent-primary)]" />
              </div>
              <div>
                <p className="mb-1 font-body text-[10px] font-bold uppercase tracking-[0.15em] text-[var(--accent-primary)]">
                  Location
                </p>
                {address ? (
                  <a
                    href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-body text-sm text-[var(--text-primary)] underline decoration-[var(--border-default)] underline-offset-4 transition-colors hover:text-[var(--accent-primary)] hover:decoration-[var(--accent-primary)]"
                  >
                    {address}
                  </a>
                ) : (
                  <p className="font-body text-sm text-[var(--text-primary)]">
                    Call or email the school office for directions.
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
