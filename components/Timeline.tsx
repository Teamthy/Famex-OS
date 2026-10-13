"use client";

import { m } from "framer-motion";

const MILESTONES = [
  {
    year: "2012",
    title: "School Founded",
    desc: "Ykay College opened with 48 students and 7 teaching staff.",
  },
  {
    year: "2015",
    title: "First WAEC Batch",
    desc: "85% pass rate — our first graduating class exceeded all expectations.",
  },
  {
    year: "2018",
    title: "STEM Lab Opened",
    desc: "Fully-equipped science and computer labs, funded by community partnership.",
  },
  {
    year: "2020",
    title: "Digital Transformation",
    desc: "Introduced online learning during COVID-19, reaching 100% student engagement.",
  },
  {
    year: "2023",
    title: "Leadership Academy Launched",
    desc: "Added dedicated leadership development curriculum to distinguish our graduates.",
  },
  {
    year: "2025",
    title: "EduPortal Launched",
    desc: "Full digital school management platform for students, parents, teachers, and admin.",
  },
];

export default function Timeline() {
  return (
    <div className="relative">
      <div className="absolute left-8 md:left-1/2 top-0 bottom-0 w-0.5 bg-brand-green/20 md:-translate-x-1/2" />
      <div className="space-y-12">
        {MILESTONES.map((milestone, i) => (
          <m.div
            key={milestone.year}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: i * 0.1 }}
            className={`relative flex items-start gap-6 md:gap-12 ${i % 2 === 1 ? "md:flex-row-reverse" : ""}`}
          >
            <div className="absolute left-8 md:left-1/2 w-4 h-4 rounded-full bg-brand-green border-4 border-[var(--bg-primary)] md:-translate-x-1/2 mt-2" />
            <div
              className="pl-20 md:pl-0 md:w-1/2 md:pr-12 md:text-right"
              style={{ display: i % 2 === 0 ? "block" : "none" }}
            >
              {i % 2 === 0 && (
                <>
                  <div className="font-display text-4xl text-brand-green mb-2">
                    {milestone.year}
                  </div>
                  <h3 className="font-bold text-lg text-[var(--text-primary)] mb-2">
                    {milestone.title}
                  </h3>
                  <p className="text-sm text-[var(--text-secondary)]">{milestone.desc}</p>
                </>
              )}
            </div>
            <div
              className="pl-20 md:pl-12 md:w-1/2"
              style={{ display: i % 2 === 1 ? "block" : "none" }}
            >
              {i % 2 === 1 && (
                <>
                  <div className="font-display text-4xl text-brand-green mb-2">
                    {milestone.year}
                  </div>
                  <h3 className="font-bold text-lg text-[var(--text-primary)] mb-2">
                    {milestone.title}
                  </h3>
                  <p className="text-sm text-[var(--text-secondary)]">{milestone.desc}</p>
                </>
              )}
            </div>
          </m.div>
        ))}
      </div>
    </div>
  );
}
