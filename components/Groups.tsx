"use client";

import { ArrowRight } from "lucide-react";

import { AnimatedText } from "@/components/AnimatedText";
const clubs = [
  {
    title: "Science & Technology Club",
    subtitle: "STEM Leadership",
    desc: "A community of students passionate about science, engineering, and technology. Through hands-on experiments, robotics, coding challenges, and science fairs, members develop the skills to lead Nigeria's future innovation economy.",
    image: "/home/lab.jpg",
    href: "/campus-life",
  },
  {
    title: "Debate & Public Speaking",
    subtitle: "Leadership & Communication",
    desc: "Students train in structured debate, persuasive speaking, and critical reasoning. Our debaters compete at regional and national levels, developing the communication skills essential for leadership in any field.",
    image: "/home/debate.jpg",
    href: "/campus-life",
  },
  {
    title: "Sports & Athletics",
    subtitle: "Physical Excellence",
    desc: "Football, basketball, athletics, table tennis, volleyball — our sports program builds discipline, teamwork, and resilience. Students compete in inter-house tournaments and external competitions across Ogun State.",
    image: "/home/sports.jpg",
    href: "/campus-life",
  },
  {
    title: "Music & Creative Arts",
    subtitle: "Arts & Expression",
    desc: "A vibrant community for students passionate about music, drama, visual arts, and creative writing. Students prepare for arts competitions, school productions, and cultural festivals throughout the year.",
    image: "/home/arts.jpg",
    href: "/campus-life",
  },
  {
    title: "Leadership Council",
    subtitle: "Student Governance",
    desc: "An elected student government that represents student interests, organizes school-wide events, promotes positive school culture, and develops leadership capacity in a structured, mentored environment.",
    image: "/home/leadership.jpg",
    href: "/campus-life",
  },
];

export default function Clubs() {
  return (
    <section id="clubs" className="w-full bg-brand-navy-dark py-16 md:py-24">
      <div className="mx-auto max-w-7xl px-6 md:px-10">
        <div className="mb-12 flex flex-col gap-4 md:mb-16 md:flex-row md:items-end md:justify-between">
          <div>
            <span className="mb-3 block font-body text-[10px] font-bold uppercase tracking-[0.25em] text-brand-green">
              CLUBS &amp; SOCIETIES
            </span>
            <AnimatedText
              as="h2"
              heavy
              stagger={0.03}
              className="font-display text-[clamp(2.25rem,6.5vw,5.5rem)] leading-[0.86] tracking-[-0.015em] text-white"
              text="CAMPUS LIFE"
            />
          </div>
        </div>

        <div className="space-y-6 md:space-y-8">
          {clubs.map((club) => (
            <a
              key={club.title}
              href={club.href}
              className="group flex flex-col overflow-hidden rounded-[2rem] border border-white/10 bg-white/[0.04] transition-all duration-300 hover:-translate-y-0.5 hover:border-brand-green/40 md:flex-row md:gap-10"
            >
              <div className="relative aspect-[16/10] w-full shrink-0 overflow-hidden md:aspect-auto md:h-[260px] md:w-[320px] lg:w-[380px]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={club.image}
                  alt={club.title}
                  loading="lazy"
                  decoding="async"
                  className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-r from-transparent to-brand-navy-dark/50" />
              </div>
              <div className="flex flex-col justify-center p-6 md:p-8">
                <span className="mb-2 font-body text-[10px] font-bold uppercase tracking-[0.2em] text-brand-green">
                  {club.subtitle}
                </span>
                <h3 className="mb-3 font-display text-[clamp(1.5rem,2.4vw,2.25rem)] leading-[0.95] tracking-[-0.01em] text-white">
                  {club.title}
                </h3>
                <p className="mb-5 max-w-xl font-body text-sm leading-relaxed text-white/80">
                  {club.desc}
                </p>
                <span className="inline-flex w-fit items-center gap-2 font-body text-xs font-bold uppercase tracking-[0.15em] text-white transition-colors group-hover:text-brand-green">
                  Learn More{" "}
                  <ArrowRight
                    size={12}
                    className="transition-transform group-hover:translate-x-1"
                  />
                </span>
              </div>
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}
