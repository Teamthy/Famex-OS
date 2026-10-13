import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { Reveal } from "@/components/Reveal";
import { Quote, Star } from "lucide-react";

import { AnimatedText } from "@/components/AnimatedText";
const TESTIMONIALS = [
  {
    name: "Mrs. Chinwe Okafor",
    role: "Parent · JSS2 Parent",
    quote:
      "Ykay College transformed my daughter. She now looks forward to school every day. The teachers are dedicated and communication is excellent — I get WhatsApp updates on her progress weekly.",
    rating: 5,
  },
  {
    name: "Adekunle Ogundipe",
    role: "Alumni · 2020 · Now at University of Lagos",
    quote:
      "The academic foundation I got at Ykay prepared me for university. Their STEM program is exceptional. I graduated with distinction and got admission to study Medicine on my first attempt.",
    rating: 5,
  },
  {
    name: "Mr. Femi Adeleke",
    role: "Parent · Two Children Enrolled",
    quote:
      "I have two children here and the sibling discount helps. The Director is hands-on and knows every student by name. That personal touch matters.",
    rating: 5,
  },
  {
    name: "Blessing Ifeanyi",
    role: "SS3 Student",
    quote:
      "The leadership council here taught me things I couldn't learn anywhere else. I'm applying to Harvard next year — my teachers helped me prepare for SAT and essays.",
    rating: 5,
  },
  {
    name: "Dr. Amina Bello",
    role: "Parent · Medical Doctor",
    quote:
      "As a doctor, I appreciate the school's commitment to health education and their partnership with local hospitals. My son's health records are always up to date.",
    rating: 5,
  },
  {
    name: "Chukwuma Nwosu",
    role: "Alumni · 2019 · Software Engineer at Andela",
    quote:
      "Started coding at Ykay's STEM club in JSS2. Today I write code for global startups. Grateful to Mr. Adeyemi who saw the spark in me.",
    rating: 5,
  },
];

export default function TestimonialsPage() {
  return (
    <>
      <Header />
      <main className="bg-[var(--bg-primary)] min-h-screen theme-transition">
        <Reveal>
          <section className="pt-32 pb-16 bg-brand-navy px-6">
            <div className="mx-auto max-w-4xl text-center">
              <span className="text-brand-green text-xs font-bold tracking-widest uppercase mb-4 block">
                Real Stories
              </span>
              <h1 className="font-display text-white leading-[0.82] text-[clamp(3rem,11vw,9.5rem)]">
                <AnimatedText heavy stagger={0.034} text="WHAT" delay={0.0} />
                <span className="text-brand-green">
                  <AnimatedText heavy stagger={0.034} text="FAMILIES" delay={0.1} />
                </span>{" "}
                <AnimatedText heavy stagger={0.034} text="SAY" delay={0.3} />
              </h1>
              <p className="text-white/60 mt-6 max-w-2xl mx-auto">
                Hear from parents, students, and alumni about their Ykay College experience.
              </p>
            </div>
          </section>
        </Reveal>

        <Reveal>
          <section className="py-20 px-6">
            <div className="mx-auto max-w-6xl grid md:grid-cols-2 gap-6">
              {TESTIMONIALS.map((t, i) => (
                <div
                  key={i}
                  className="p-8 rounded-[2rem] bg-[var(--surface-card)] border border-[var(--border-subtle)] shadow-[var(--card-shadow)] hover:border-brand-green/30 hover:-translate-y-1 transition-all"
                >
                  <Quote className="text-brand-green mb-4" size={32} />
                  <div className="flex gap-0.5 mb-4">
                    {Array.from({ length: t.rating }).map((_, i) => (
                      <Star key={i} size={14} className="fill-brand-orange text-brand-orange" />
                    ))}
                  </div>
                  <p className="text-[var(--text-secondary)] italic mb-6 leading-relaxed">
                    "{t.quote}"
                  </p>
                  <div className="flex items-center gap-4 pt-6 border-t border-[var(--border-subtle)]">
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-brand-green to-brand-green-dark text-white flex items-center justify-center font-display text-lg">
                      {t.name
                        .split(" ")
                        .map((n) => n[0])
                        .join("")
                        .slice(0, 2)}
                    </div>
                    <div>
                      <div className="font-bold text-[var(--text-primary)]">{t.name}</div>
                      <div className="text-xs text-[var(--text-muted)]">{t.role}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </Reveal>
      </main>
      <Footer />
    </>
  );
}
