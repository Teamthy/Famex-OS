import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { Reveal } from "@/components/Reveal";
import { Sparkles, Zap, Bug, Package } from "lucide-react";

import { AnimatedText } from "@/components/AnimatedText";
const CHANGES = [
  {
    date: "July 2025",
    version: "v2.0",
    title: "EduPortal Launch",
    items: [
      { type: "feature", text: "Full Admin, Teacher, Student, and Parent portals live" },
      { type: "feature", text: "CBT Exam engine with anti-cheat controls" },
      { type: "feature", text: "Paystack payment integration for fees" },
      { type: "feature", text: "Real-time SMS/WhatsApp attendance alerts" },
      { type: "feature", text: "Automated PDF report cards via WhatsApp" },
    ],
  },
  {
    date: "June 2025",
    version: "v1.5",
    title: "Website Redesign",
    items: [
      { type: "feature", text: "Complete website redesign with dark mode" },
      { type: "feature", text: "Director's message page added" },
      { type: "feature", text: "Alumni showcase and testimonials" },
      { type: "improvement", text: "Fee calculator on admissions page" },
    ],
  },
  {
    date: "May 2025",
    version: "v1.0",
    title: "Foundation",
    items: [
      { type: "feature", text: "Initial launch of ykaycollege.edu.ng" },
      { type: "feature", text: "Online admission application" },
      { type: "feature", text: "Contact and enquiry system" },
    ],
  },
];

const iconMap = { feature: Sparkles, improvement: Zap, fix: Bug };
const colorMap = {
  feature: "text-brand-green",
  improvement: "text-brand-orange",
  fix: "text-red-500",
};

export default function WhatsNewPage() {
  return (
    <>
      <Header />
      <main className="bg-[var(--bg-primary)] min-h-screen theme-transition">
        <Reveal>
          <section className="pt-32 pb-16 bg-brand-navy px-6">
            <div className="mx-auto max-w-4xl text-center">
              <div className="w-16 h-16 rounded-2xl bg-brand-green/20 text-brand-green flex items-center justify-center mx-auto mb-6">
                <Package size={30} />
              </div>
              <h1 className="font-display text-white leading-[0.82] text-[clamp(3rem,11vw,9.5rem)]">
                <AnimatedText heavy stagger={0.034} text="WHAT'S" delay={0.0} />
                <span className="text-brand-green">
                  <AnimatedText heavy stagger={0.034} text="NEW" delay={0.15} />
                </span>
              </h1>
              <p className="text-white/60 mt-6 max-w-2xl mx-auto">
                Recent updates and improvements to Ykay College EduPortal.
              </p>
            </div>
          </section>
        </Reveal>

        <Reveal>
          <section className="py-20 px-6">
            <div className="mx-auto max-w-4xl space-y-8">
              {CHANGES.map((release, i) => (
                <div
                  key={i}
                  className="p-8 rounded-[2rem] bg-[var(--surface-card)] border border-[var(--border-subtle)] shadow-[var(--card-shadow)]"
                >
                  <div className="flex items-baseline justify-between mb-6">
                    <div>
                      <div className="text-brand-green text-xs font-bold uppercase tracking-widest">
                        {release.date}
                      </div>
                      <h3 className="font-display text-2xl text-[var(--text-primary)]">
                        {release.title}
                      </h3>
                    </div>
                    <span className="text-xs px-3 py-1 rounded-full bg-[var(--surface-disabled)] text-[var(--text-muted)] font-bold">
                      {release.version}
                    </span>
                  </div>
                  <ul className="space-y-3">
                    {release.items.map((item, j) => {
                      const Icon = iconMap[item.type as keyof typeof iconMap];
                      return (
                        <li key={j} className="flex items-start gap-3">
                          <Icon
                            size={14}
                            className={`${colorMap[item.type as keyof typeof colorMap]} mt-1 shrink-0`}
                          />
                          <span className="text-sm text-[var(--text-secondary)]">{item.text}</span>
                        </li>
                      );
                    })}
                  </ul>
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
