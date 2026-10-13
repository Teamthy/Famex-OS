"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

const SLIDES = [
  {
    img: "/home/hero-campus.jpg",
    title: "The Operating System",
    highlight: "for African Schools",
    sub: "Admissions, fees, exams, attendance — all in one branded portal.",
  },
  {
    img: "/home/students-class.jpg",
    title: "Run Your Classroom",
    highlight: "Digitally",
    sub: "Daily registers, gradebook, report cards — no more paper or Excel.",
  },
  {
    img: "/it-hub-classroom.jpg",
    title: "Collect Fees",
    highlight: "Online",
    sub: "Paystack integration. Parents pay with cards, USSD, or transfer.",
  },
  {
    img: "/home/lab.jpg",
    title: "Exam Results",
    highlight: "In Real Time",
    sub: "Computer-based tests with auto-grading and instant parent SMS.",
  },
  {
    img: "/home/leadership.jpg",
    title: "Built for",
    highlight: "Every School",
    sub: "From 50 students to 5,000. Free to start. No credit card required.",
  },
];

export default function HeroCarousel() {
  const [active, setActive] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setActive((prev) => (prev + 1) % SLIDES.length);
    }, 5000);
    return () => clearInterval(timer);
  }, []);

  return (
    <section className="relative h-screen min-h-[640px] overflow-hidden">
      {/* Slides */}
      {SLIDES.map((slide, i) => (
        <div
          key={i}
          className="absolute inset-0 transition-opacity duration-1000"
          style={{ opacity: i === active ? 1 : 0 }}
        >
          <img src={slide.img} alt="" className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-[#00072D] via-[#00072D]/50 to-[#00072D]/30" />
        </div>
      ))}

      {/* Content */}
      <div className="relative z-10 flex flex-col items-center justify-center h-full px-6 text-center">
        <div className="max-w-4xl">
          <h1 className="font-bold text-4xl md:text-7xl leading-[1.1] mb-6">
            {SLIDES[active].title}
            <br />
            <span className="text-[#2840E8]">{SLIDES[active].highlight}</span>
          </h1>
          <p className="text-white/50 text-lg md:text-xl max-w-2xl mx-auto mb-10">
            {SLIDES[active].sub}
          </p>
          <Link
            href="/signup"
            className="inline-flex items-center gap-2 bg-[#123499] text-white px-8 py-4 rounded-2xl font-bold hover:bg-[#2840E8] transition-colors"
          >
            Start Your School Free <ArrowRight size={18} />
          </Link>
        </div>
      </div>

      {/* Dots */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex gap-2 z-20">
        {SLIDES.map((_, i) => (
          <button
            key={i}
            onClick={() => setActive(i)}
            className={`h-1.5 rounded-full transition-all ${
              i === active ? "w-8 bg-[#2840E8]" : "w-1.5 bg-white/30"
            }`}
            aria-label={`Slide ${i + 1}`}
          />
        ))}
      </div>
    </section>
  );
}
