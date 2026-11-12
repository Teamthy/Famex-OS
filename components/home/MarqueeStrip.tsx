import { Marquee } from "@/components/AnimatedText";

/** A quiet, moving wordmark strip separating editorial sections. */
export default function MarqueeStrip() {
  return (
    <section
      aria-label="School rhythm"
      className="home-below-fold overflow-hidden border-y border-white/10 bg-[var(--home-dark-soft)] py-4"
    >
      <Marquee
        items={[
          "PRE-SCHOOL — SS3",
          "NERDC CURRICULUM",
          "STEM & DIGITAL LITERACY",
          "LEADERSHIP & SERVICE",
          "CHARACTER FORMATION",
          "BECE · WAEC PREPARATION",
        ]}
        className="text-[var(--home-lime)]"
        itemClassName="font-display text-[clamp(1rem,2vw,1.55rem)] uppercase tracking-[.06em] text-[var(--home-lime)]"
        duration={36}
      />
    </section>
  );
}
