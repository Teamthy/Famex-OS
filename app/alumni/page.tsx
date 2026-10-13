import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { Reveal } from "@/components/Reveal";
import { GraduationCap, Briefcase, Award, Users } from "lucide-react";

import { AnimatedText } from "@/components/AnimatedText";
const ALUMNI = [
  {
    name: "Dr. Kemi Adeleke",
    year: "2015",
    now: "Medical Doctor · Lagos University Teaching Hospital",
    achievement: "First class MBBS graduate",
  },
  {
    name: "Emmanuel Okonkwo",
    year: "2016",
    now: "Software Engineer · Google (Kenya)",
    achievement: "Full-scholarship to MIT",
  },
  {
    name: "Fatima Bashir",
    year: "2018",
    now: "Investment Banker · Standard Chartered",
    achievement: "CFA Charterholder at age 26",
  },
  {
    name: "Adekunle Adebayo",
    year: "2019",
    now: "Founder · TechStart Africa",
    achievement: "Raised $2M seed funding",
  },
  {
    name: "Blessing Ibe",
    year: "2020",
    now: "Law Student · Oxford University",
    achievement: "Rhodes Scholar 2024",
  },
  {
    name: "Chiamaka Nwosu",
    year: "2021",
    now: "Engineer · Shell Nigeria",
    achievement: "Chemical Engineering top graduate",
  },
];

export default function AlumniPage() {
  return (
    <>
      <Header />
      <main className="bg-[var(--bg-primary)] min-h-screen theme-transition">
        <Reveal>
          <section className="pt-32 pb-16 bg-brand-navy px-6">
            <div className="mx-auto max-w-4xl text-center">
              <div className="w-16 h-16 rounded-2xl bg-brand-green/20 text-brand-green flex items-center justify-center mx-auto mb-6">
                <GraduationCap size={30} />
              </div>
              <h1 className="font-display text-white leading-[0.82] text-[clamp(3rem,11vw,9.5rem)]">
                <AnimatedText heavy stagger={0.034} text="OUR" delay={0.0} />
                <span className="text-brand-green">
                  <AnimatedText heavy stagger={0.034} text="ALUMNI" delay={0.075} />
                </span>
              </h1>
              <p className="text-white/60 mt-6 max-w-2xl mx-auto">
                Ykay graduates are making waves across Nigeria and the world. Meet a few of them.
              </p>
            </div>
          </section>
        </Reveal>

        <Reveal>
          <section className="py-20 px-6">
            <div className="mx-auto max-w-7xl">
              <div className="grid md:grid-cols-4 gap-6 mb-16">
                {[
                  { icon: GraduationCap, label: "Alumni", value: "1,200+" },
                  { icon: Briefcase, label: "In Top Careers", value: "78%" },
                  { icon: Award, label: "Scholarships Won", value: "245" },
                  { icon: Users, label: "Countries", value: "22" },
                ].map((stat) => (
                  <div
                    key={stat.label}
                    className="p-6 rounded-2xl bg-[var(--surface-card)] border border-[var(--border-subtle)] text-center shadow-[var(--card-shadow)]"
                  >
                    <stat.icon className="mx-auto text-brand-green mb-3" size={24} />
                    <div className="font-display text-3xl text-[var(--text-primary)]">
                      {stat.value}
                    </div>
                    <div className="text-xs uppercase tracking-widest text-[var(--text-muted)] mt-1">
                      {stat.label}
                    </div>
                  </div>
                ))}
              </div>

              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                {ALUMNI.map((a, i) => (
                  <div
                    key={i}
                    className="p-8 rounded-[2rem] bg-[var(--surface-card)] border border-[var(--border-subtle)] shadow-[var(--card-shadow)] hover:border-brand-green/30 hover:-translate-y-1 transition-all"
                  >
                    <div className="w-16 h-16 rounded-full bg-gradient-to-br from-brand-green to-brand-green-dark text-white flex items-center justify-center font-display text-xl mb-4">
                      {a.name
                        .split(" ")
                        .map((n) => n[0])
                        .join("")
                        .slice(0, 2)}
                    </div>
                    <h3 className="font-display text-lg text-[var(--text-primary)]">{a.name}</h3>
                    <div className="text-brand-green text-xs uppercase tracking-widest mt-1">
                      Class of {a.year}
                    </div>
                    <p className="text-sm text-[var(--text-secondary)] mt-3">{a.now}</p>
                    <div className="mt-4 pt-4 border-t border-[var(--border-subtle)] text-xs text-brand-orange font-bold">
                      ⭐ {a.achievement}
                    </div>
                  </div>
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
