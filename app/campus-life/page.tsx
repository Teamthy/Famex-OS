import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { Reveal } from "@/components/Reveal";
import { GraduationCap, Trophy, BookOpen, Music, Users } from "lucide-react";

import { AnimatedText } from "@/components/AnimatedText";
export default function CampusLifePage() {
  return (
    <>
      <Header />
      <main className="bg-[var(--bg-primary)] min-h-screen theme-transition">
        {/* Hero */}
        <Reveal>
          <section className="relative w-full bg-[var(--bg-primary)] pt-32 pb-12 md:pt-40 md:pb-16">
            <div className="mx-auto max-w-7xl px-6">
              <p className="font-body text-xs font-bold tracking-[0.25em] uppercase text-[var(--accent-primary)] mb-4">
                CAMPUS LIFE
              </p>
              <AnimatedText
                as="h1"
                heavy
                stagger={0.034}
                className="font-display text-[clamp(3rem,11vw,9.5rem)] leading-[0.82] tracking-[-0.01em] text-[var(--text-primary)] mb-6"
                text="BEYOND THE CLASSROOM"
              />
              <p className="font-body text-base md:text-lg text-[var(--text-secondary)] max-w-2xl leading-relaxed">
                At Ykay College, education extends far beyond textbooks. Our students discover their
                talents, build character, and develop leadership skills through clubs, sports, and
                creative expression.
              </p>
            </div>
          </section>
        </Reveal>

        {/* Clubs & Facilities */}
        <Reveal>
          <section className="w-full bg-[var(--bg-primary)] pb-16 md:pb-24">
            <div className="mx-auto max-w-7xl px-6">
              {/* Clubs grid */}
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8 mb-12">
                {[
                  {
                    icon: GraduationCap,
                    title: "Leadership Council",
                    desc: "Elected student government developing governance, event planning, and community leadership skills.",
                    stat: "Elected Annually",
                  },
                  {
                    icon: Trophy,
                    title: "Sports & Athletics",
                    desc: "Football, basketball, athletics, table tennis, volleyball. Inter-house competitions and external tournaments.",
                    stat: "5 Sports Fields",
                  },
                  {
                    icon: BookOpen,
                    title: "STEM Club",
                    desc: "Robotics, coding challenges, science fairs, and technology innovation projects for aspiring engineers.",
                    stat: "Weekly Workshops",
                  },
                  {
                    icon: Music,
                    title: "Music & Creative Arts",
                    desc: "Choir, drama, visual arts, and creative writing — preparing students for cultural festivals and competitions.",
                    stat: "4 Arts Tracks",
                  },
                  {
                    icon: Users,
                    title: "Debate Society",
                    desc: "Public speaking, structured debate, and critical reasoning. Students compete at regional and national levels.",
                    stat: "Regional Champions",
                  },
                ].map((item) => (
                  <div
                    key={item.title}
                    className="rounded-[2rem] bg-[var(--surface-card)] border border-[var(--border-subtle)] shadow-[var(--card-shadow)] hover:border-[var(--accent-primary)] hover:shadow-[var(--card-shadow-hover)] hover:-translate-y-1 transition-all duration-300 p-8 md:p-10"
                  >
                    <div className="w-12 h-12 rounded-xl bg-[var(--accent-primary)]/10 flex items-center justify-center mb-6">
                      <item.icon size={22} className="text-[var(--accent-primary)]" />
                    </div>
                    <h3 className="font-display text-xl md:text-2xl tracking-[2px] text-[var(--text-primary)] mb-3">
                      {item.title}
                    </h3>
                    <p className="font-body text-sm text-[var(--text-secondary)] leading-relaxed mb-4">
                      {item.desc}
                    </p>
                    <span className="font-body text-[10px] font-bold tracking-[0.15em] uppercase text-[var(--accent-primary)]">
                      {item.stat}
                    </span>
                  </div>
                ))}
              </div>

              {/* Facilities banner with image */}
              <div className="rounded-[2rem] overflow-hidden relative shadow-[var(--card-shadow-hover)]">
                <img
                  src="/home/leadership.jpg"
                  alt="Students collaborating"
                  className="w-full h-[400px] md:h-[500px] object-cover"
                />
                {/* Dark overlay always — this is a hero-style banner over an image */}
                <div className="absolute inset-0 bg-gradient-to-r from-brand-navy-dark/90 via-brand-navy-dark/60 to-transparent" />
                <div className="absolute inset-0 flex items-center">
                  <div className="px-6 md:px-16 lg:px-20 max-w-xl">
                    <p className="font-body text-xs font-bold tracking-[0.25em] uppercase text-brand-green mb-4">
                      FACILITIES
                    </p>
                    <AnimatedText
                      as="h2"
                      className="font-display text-[32px] md:text-[48px] leading-[0.9] tracking-[2px] md:tracking-[4px] text-white mb-4"
                      text="CAMPUS FACILITIES"
                    />
                    <p className="font-body text-sm md:text-base text-white/90 leading-relaxed mb-6">
                      A well-equipped computer laboratory, modern science laboratories, a fully
                      equipped library with digital resources, dedicated sports fields, a 360°
                      virtual campus tour, and technology-enhanced classrooms across our day school
                      campus.
                    </p>
                    <a
                      href="/contact"
                      className="inline-flex items-center gap-2 font-body text-xs font-bold tracking-[0.15em] uppercase text-brand-navy bg-brand-orange px-6 py-3 rounded-full hover:bg-brand-orange-dark transition-all duration-300 hover:scale-[1.03] shadow-lg shadow-black/30"
                    >
                      Plan a Visit
                    </a>
                  </div>
                </div>
              </div>
            </div>
          </section>
        </Reveal>
      </main>
      <Footer />
    </>
  );
}
