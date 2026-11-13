import Header from "@/components/Header";
import Footer from "@/components/Footer";
import GalleryGrid, { type GalleryImage } from "@/components/GalleryGrid";

const IMAGES: GalleryImage[] = [
  {
    src: "/home/college-classroom.jpg",
    alt: "Students learning together in a classroom",
    caption: "Learning together",
    category: "Academics",
  },
  {
    src: "/home/leadership.jpg",
    alt: "Students working together on a school activity",
    caption: "Student leadership",
    category: "Community",
  },
  {
    src: "/home/college-assembly.jpg",
    alt: "Students gathered for a school assembly",
    caption: "School assembly",
    category: "School life",
  },
  {
    src: "/home/college-sports.jpg",
    alt: "Students taking part in sport on the school field",
    caption: "On the field",
    category: "Sport",
  },
  {
    src: "/home/arts.jpg",
    alt: "Students taking part in a creative arts activity",
    caption: "Creative learning",
    category: "Arts",
  },
  {
    src: "/home/college-itlab.jpg",
    alt: "Students learning with computers in the ICT lab",
    caption: "Digital discovery",
    category: "Technology",
  },
];

export default function GalleryPage() {
  return (
    <>
      <Header />
      <main className="min-h-screen bg-[var(--bg-primary)]">
        <section className="px-5 pb-10 pt-16 sm:px-8 sm:pb-14 sm:pt-20 lg:px-12">
          <div className="mx-auto max-w-[1320px]">
            <p className="mb-3 text-xs font-bold uppercase tracking-[.22em] text-[#1d4a45]">
              Moments at Famex
            </p>
            <h1 className="max-w-4xl font-display text-[clamp(3rem,9vw,7rem)] uppercase leading-[.9] tracking-[-.02em] text-[#123a35]">
              A day in <span className="text-[#1d4a45]">school.</span>
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-7 text-[#52645f]">
              Take a closer look at learning, creativity, sport and the everyday moments that make
              up school life. Select a photograph to view it larger.
            </p>
          </div>
        </section>
        <section className="px-5 pb-20 sm:px-8 sm:pb-24 lg:px-12">
          <div className="mx-auto max-w-[1320px]">
            <GalleryGrid images={IMAGES} />
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
