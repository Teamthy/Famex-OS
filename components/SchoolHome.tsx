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
import VisitCta from "@/components/home/VisitCta";
import HomeFooter from "@/components/home/HomeFooter";
import { HOME_BG, HOME_INK } from "@/components/home/theme";

/** The four banner photographs of the hero carousel (real campus images). */
const HERO_SLIDES = [
  { src: "/home/hero-campus-750.webp", alt: "The school campus at golden hour" },
  { src: "/home/college-classroom.jpg", alt: "A lesson in progress in a bright classroom" },
  { src: "/home/college-sports.jpg", alt: "Students competing on the sports field" },
  { src: "/home/college-arts.jpg", alt: "Students at work in the arts studio" },
];

/**
 * The school's public home — twelve sections on the warm paper palette:
 *
 *  1 hero banner carousel (4 campus photographs)   7 outcomes band
 *  2 editorial statement                           8 people around your child
 *  3 three-card editorial grid                     9 campus-life mosaic
 *  4 explore-by-stage filter grid                 10 admissions steps
 *  5 marquee band                                 11 the school journal
 *  6 academic pillars                             12 visit & contact
 *
 * Data honesty: identity comes from brand tokens, the journal from the real
 * public calendar API, contacts from school env; no invented metrics anywhere.
 */
export default function SchoolHome() {
  const motto = process.env.SCHOOL_MOTTO?.trim() || "Raising Role Models";
  const { schoolName } = getSchoolBrandTokens();

  return (
    <div className="min-h-screen antialiased" style={{ background: HOME_BG, color: HOME_INK }}>
      <HomeHeader schoolName={schoolName} />
      <main>
        <HeroCarousel slides={HERO_SLIDES} motto={motto} />
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
        <VisitCta />
      </main>
      <HomeFooter />
    </div>
  );
}
