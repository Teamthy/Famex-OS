import type { CSSProperties } from "react";
import HomeHeader from "@/components/home/HomeHeader";
import { getSchoolBrandTokens } from "@/lib/brand";
import HeroCarousel from "@/components/home/HeroCarousel";
import IntroStatement from "@/components/home/IntroStatement";
import TrioCards from "@/components/home/TrioCards";
import StageExplorer from "@/components/home/StageExplorer";
import MarqueeStrip from "@/components/home/MarqueeStrip";
import AcademicsCards from "@/components/home/AcademicsCards";
import OutcomesBand from "@/components/home/OutcomesBand";
import PeopleSection from "@/components/home/PeopleSection";
import LifeGallery from "@/components/home/LifeGallery";
import AdmissionsSteps from "@/components/home/AdmissionsSteps";
import NewsEvents from "@/components/home/NewsEvents";
import HomeFaq from "@/components/home/HomeFaq";
import VisitCta from "@/components/home/VisitCta";
import HomeFooter from "@/components/home/HomeFooter";
import { HOME_BG, HOME_INK } from "@/components/home/theme";

const HERO_SLIDES = [
  {
    src: "/home/hero-campus-750.webp",
    alt: "Students and families moving through the school campus",
    avif: "/home/hero-campus-750.avif",
  },
  { src: "/home/college-classroom.jpg", alt: "Students learning together in a classroom" },
  { src: "/home/college-sports.jpg", alt: "Students playing football on the school field" },
  { src: "/home/college-arts.jpg", alt: "Students taking part in a creative arts lesson" },
];

/** Famex public school-home, using the warm editorial / forest / lime visual language. */
export default function SchoolHome() {
  const motto = process.env.SCHOOL_MOTTO?.trim() || "Raising Role Models";
  const { schoolName } = getSchoolBrandTokens();

  return (
    <div
      className="famex-home relative min-h-screen antialiased"
      style={
        {
          background: HOME_BG,
          color: HOME_INK,
          "--home-paper": "#f6f4ea",
          "--home-ink": "#10291f",
          "--home-dark": "#082d20",
          "--home-dark-soft": "#123e2f",
          "--home-lime": "#c9ff45",
          "--home-lime-soft": "#e0ff91",
          "--home-card": "#ffffff",
          "--home-muted": "#566258",
          "--home-line": "rgba(8,45,32,.12)",
        } as CSSProperties
      }
    >
      <HomeHeader schoolName={schoolName} />
      <main>
        <HeroCarousel slides={HERO_SLIDES} motto={motto} schoolName={schoolName} />
        <IntroStatement />
        <TrioCards />
        <StageExplorer />
        <MarqueeStrip />
        <AcademicsCards />
        <OutcomesBand />
        <PeopleSection />
        <LifeGallery />
        <AdmissionsSteps />
        <NewsEvents />
        <HomeFaq />
        <VisitCta />
      </main>
      <HomeFooter />
    </div>
  );
}
