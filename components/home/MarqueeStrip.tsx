import { Marquee } from "@/components/AnimatedText";

/** Section 5 — the slow marquee band, restyled onto the paper palette. */
export default function MarqueeStrip() {
  return (
    <section
      aria-label="School rhythm"
      className="home-below-fold border-y border-[var(--famex-primary)]/10 bg-[var(--famex-lime-pale)] py-4"
    >
      <Marquee
        items={[
          "PRE-SCHOOL — SS3",
          "NERDC CURRICULUM",
          "STEM & DIGITAL LITERACY",
          "LEADERSHIP TRAINING",
          "CHARACTER FORMATION",
          "WAEC · BECE PREPARATION",
        ]}
        className="text-[var(--famex-text-secondary)]"
        itemClassName="font-[family-name:var(--font-fraunces)] text-[clamp(0.95rem,2vw,1.6rem)] italic tracking-[-0.01em] text-[var(--famex-text-secondary)]"
        duration={36}
      />
    </section>
  );
}
