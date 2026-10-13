import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { Reveal } from "@/components/Reveal";
import { Briefcase, MapPin, Clock, Mail } from "lucide-react";

import { AnimatedText } from "@/components/AnimatedText";
const OPENINGS = [
  {
    title: "Mathematics Teacher",
    type: "Full-time",
    location: "On campus",
    posted: "5 days ago",
    desc: "Teaching JSS/SS Mathematics. B.Ed or equivalent required. 3+ years experience preferred.",
  },
  {
    title: "Chemistry Teacher",
    type: "Full-time",
    location: "On campus",
    posted: "1 week ago",
    desc: "Teaching SS Chemistry. Must be able to conduct lab practicals. WAEC/NECO examiner experience is a plus.",
  },
  {
    title: "IT Support Officer",
    type: "Full-time",
    location: "On campus",
    posted: "3 days ago",
    desc: "Manage school IT infrastructure, EduPortal support, and computer lab operations. Diploma/Degree in IT.",
  },
  {
    title: "School Nurse",
    type: "Part-time",
    location: "On campus",
    posted: "2 weeks ago",
    desc: "Certified nurse to manage sick bay, health records, and first-aid. Registered with the Nursing Council of Nigeria.",
  },
];

export default function CareersPage() {
  return (
    <>
      <Header />
      <main className="bg-[var(--bg-primary)] min-h-screen theme-transition">
        <Reveal>
          <section className="pt-32 pb-16 bg-brand-navy px-6">
            <div className="mx-auto max-w-4xl text-center">
              <span className="text-brand-green text-xs font-bold tracking-widest uppercase mb-4 block">
                Join Our Team
              </span>
              <h1 className="font-display text-white leading-[0.82] text-[clamp(3rem,11vw,9.5rem)]">
                <AnimatedText heavy stagger={0.034} text="CAREERS" delay={0.0} />
                <span className="text-brand-green">
                  <AnimatedText heavy stagger={0.034} text="AT YKAY" delay={0.175} />
                </span>
              </h1>
              <p className="text-white/60 mt-6 max-w-2xl mx-auto">
                Build your career at one of Nigeria's most innovative schools. We hire passionate
                educators and support staff who share our vision.
              </p>
            </div>
          </section>
        </Reveal>

        <Reveal>
          <section className="py-20 px-6">
            <div className="mx-auto max-w-4xl space-y-4">
              <h2 className="font-display text-2xl text-brand-green tracking-widest mb-6">
                <AnimatedText text={`Current Openings (${OPENINGS.length})`} />
              </h2>
              {OPENINGS.map((job, i) => (
                <div
                  key={i}
                  className="p-8 rounded-[2rem] bg-[var(--surface-card)] border border-[var(--border-subtle)] shadow-[var(--card-shadow)] hover:border-brand-green/30 transition-all"
                >
                  <div className="flex items-start justify-between gap-4 mb-4">
                    <div>
                      <h3 className="font-display text-2xl text-[var(--text-primary)] mb-2">
                        {job.title}
                      </h3>
                      <div className="flex flex-wrap gap-4 text-xs text-[var(--text-muted)]">
                        <span className="flex items-center gap-1">
                          <Briefcase size={12} /> {job.type}
                        </span>
                        <span className="flex items-center gap-1">
                          <MapPin size={12} /> {job.location}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock size={12} /> {job.posted}
                        </span>
                      </div>
                    </div>
                    <a
                      href={`mailto:careers@ykaycollege.com?subject=Application: ${job.title}`}
                      className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-brand-green text-brand-navy text-sm font-bold uppercase tracking-widest hover:bg-brand-green-dark transition-all shadow-lg shrink-0"
                    >
                      Apply
                    </a>
                  </div>
                  <p className="text-sm text-[var(--text-secondary)]">{job.desc}</p>
                </div>
              ))}

              <div className="mt-12 p-8 rounded-[2rem] bg-gradient-to-br from-brand-navy to-brand-navy-light text-white text-center">
                <Mail className="mx-auto text-brand-green mb-4" size={32} />
                <h3 className="font-display text-2xl mb-2">Don't see your role?</h3>
                <p className="text-white/60 text-sm mb-6">
                  We're always interested in exceptional talent. Send us your CV.
                </p>
                <a
                  href="mailto:careers@ykaycollege.com"
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-brand-orange text-brand-navy font-bold text-sm hover:bg-brand-orange-dark transition-all"
                >
                  careers@ykaycollege.com
                </a>
              </div>
            </div>
          </section>
        </Reveal>
      </main>
      <Footer />
    </>
  );
}
