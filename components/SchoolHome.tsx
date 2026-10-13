import LoadingScreen from "@/components/LoadingScreen";
import Header from "@/components/Header";
import Hero from "@/components/Hero";
import { Marquee } from "@/components/AnimatedText";
import { HomeSectionsTop, HomeSectionsBottom } from "@/components/HomeSections";
import MobileAppCTA from "@/components/MobileAppCTA";
import Footer from "@/components/Footer";

/**
 * A school's public home page (tenant portal landing).
 * Shown when a specific school is resolved from the hostname.
 *
 * Only the hero (the first viewport on mobile) is in the initial load; the
 * sections below it arrive as async chunks via HomeSections so they never
 * delay the first paint.
 */
export default function SchoolHome() {
  return (
    <>
      <LoadingScreen />
      <Header />
      {/* overflow-x-clip: the Reveal scroll animations hold sections at
          translateX(±48px) until they enter the viewport; without this the
          translated boxes inflate the body's scroll extent past the viewport
          (audit finding AUD-F6 — clipped globally by html/body overflow-x,
          but better never to escape the page container). */}
      <main className="flex flex-col overflow-x-clip">
        <Hero />
        <HomeSectionsTop />
        <Marquee
          items={[
            "JSS1 — SS3",
            "NERDC CURRICULUM",
            "STEM & DIGITAL LITERACY",
            "LEADERSHIP TRAINING",
            "CHARACTER FORMATION",
          ]}
          className="border-y border-[var(--border-subtle)] bg-[var(--bg-secondary)] py-3 md:py-4"
          itemClassName="font-display text-[clamp(1rem,2.2vw,1.9rem)] tracking-[-0.01em] text-[var(--text-accent)]"
          duration={32}
        />

        <HomeSectionsBottom>
          <MobileAppCTA />
        </HomeSectionsBottom>
      </main>
      <Footer />
    </>
  );
}
