import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { Reveal } from "@/components/Reveal";

import { AnimatedText } from "@/components/AnimatedText";
export default function GalleryPage() {
  const images = [
    {
      src: "/home/students-class.jpg",
      caption: "Classroom Learning",
      category: "Academics",
    },
    {
      src: "/home/leadership.jpg",
      caption: "Student Collaboration",
      category: "Campus Life",
    },
    {
      src: "/home/students-class.jpg",
      caption: "Modern Facilities",
      category: "Campus",
    },
    {
      src: "/home/sports.jpg",
      caption: "Sports Day",
      category: "Sports",
    },
    {
      src: "/home/arts.jpg",
      caption: "Arts & Music",
      category: "Arts",
    },
    {
      src: "/it-hub-classroom.jpg",
      caption: "STEM Club",
      category: "Academics",
    },
  ];

  return (
    <>
      <Header />
      <main className="bg-[var(--bg-primary)] min-h-screen theme-transition">
        {/* Hero */}
        <Reveal>
          <section className="relative w-full bg-[var(--bg-primary)] pt-32 pb-12 md:pt-40 md:pb-16">
            <div className="mx-auto max-w-7xl px-6">
              <p className="font-body text-xs font-bold tracking-[0.25em] uppercase text-[var(--accent-primary)] mb-4">
                GALLERY
              </p>
              <AnimatedText
                as="h1"
                heavy
                stagger={0.034}
                className="font-display text-[clamp(3rem,11vw,9.5rem)] leading-[0.82] tracking-[-0.01em] text-[var(--text-primary)] mb-4"
                text="CAMPUS GALLERY"
              />
              <p className="font-body text-base md:text-lg text-[var(--text-secondary)] max-w-xl">
                A visual journey through our facilities, events, and student life at Ykay College.
              </p>
            </div>
          </section>
        </Reveal>

        {/* Gallery grid */}
        <Reveal>
          <section className="w-full bg-[var(--bg-primary)] pb-20 md:pb-32">
            <div className="mx-auto max-w-7xl px-6">
              <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-4 md:gap-6">
                {images.map((img, i) => (
                  <a
                    key={i}
                    href="#"
                    className="group relative block rounded-[2rem] overflow-hidden aspect-[4/3] shadow-[var(--card-shadow)] hover:shadow-[var(--card-shadow-hover)] transition-shadow duration-300"
                  >
                    <img
                      src={img.src}
                      alt={img.caption}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                    />
                    {/* Always dark overlay for readability of caption */}
                    <div className="absolute inset-0 bg-gradient-to-t from-brand-navy-dark/80 via-brand-navy-dark/20 to-transparent" />
                    <div className="absolute bottom-0 left-0 right-0 p-6 md:p-8">
                      <span className="font-body text-[10px] font-bold tracking-[0.2em] uppercase text-brand-green mb-2 block">
                        {img.category}
                      </span>
                      <h3 className="font-display text-xl md:text-2xl tracking-[2px] text-white">
                        {img.caption}
                      </h3>
                    </div>
                  </a>
                ))}
              </div>
            </div>
          </section>
        </Reveal>
      </main>
      <Footer />
    </>
  );
}
