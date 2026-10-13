"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { ArrowRight, GraduationCap, ChevronLeft, ChevronRight } from "lucide-react";

export default function ITAwarenessCTA() {
  // Carousel images
  const carouselImages = [
    { src: "/it-hub-1.jpg", alt: "IT Training Classroom" },
    { src: "/it-hub-2.jpg", alt: "Students Learning" },
    { src: "/it-hub-3.jpg", alt: "Certification Ceremony" },
    { src: "/it-hub-4.jpg", alt: "Hands-on Training" },
  ];

  const [currentIndex, setCurrentIndex] = useState(0);

  // Auto-rotate carousel every 5 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % carouselImages.length);
    }, 5000);
    return () => clearInterval(interval);
  }, [carouselImages.length]);

  const goToNext = () => {
    setCurrentIndex((prev) => (prev + 1) % carouselImages.length);
  };

  const goToPrev = () => {
    setCurrentIndex((prev) => (prev - 1 + carouselImages.length) % carouselImages.length);
  };

  return (
    <section className="py-20 px-6 bg-brand-navy">
      <div className="mx-auto max-w-7xl">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          {/* Left Side - Content */}
          <div>
            {/* HEADLINE - YKAY HUB (BIG) */}
            <h2 className="font-display text-5xl md:text-7xl text-white mb-4">
              YKAY <span className="text-brand-green">HUB</span>
            </h2>

            {/* SUBHEADLINE */}
            <p className="font-display text-3xl md:text-4xl text-white/80 mb-8">
              Build Your Digital Future with Us
            </p>

            <p className="text-white/70 text-lg font-body mb-8">
              Join our internationally recognized IT training programs and earn certifications that
              open doors to global opportunities. Our students have achieved remarkable success in
              Python, AI, Cybersecurity, and Microsoft Office applications.
            </p>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-6 mb-8">
              <div className="text-center">
                <p className="font-display text-3xl text-brand-green">500+</p>
                <p className="text-white/60 text-sm">Certified Students</p>
              </div>
              <div className="text-center">
                <p className="font-display text-3xl text-brand-green">8</p>
                <p className="text-white/60 text-sm">Certification Courses</p>
              </div>
              <div className="text-center">
                <p className="font-display text-3xl text-brand-green">95%</p>
                <p className="text-white/60 text-sm">Exam Pass Rate</p>
              </div>
            </div>

            {/* CTA Buttons - More White on Explore */}
            <div className="flex flex-wrap gap-4">
              <Link
                href="/it-education"
                className="inline-flex items-center justify-center gap-2 px-10 py-5 rounded-full bg-white text-brand-navy font-bold uppercase tracking-widest hover:bg-gray-100 transition-all shadow-lg hover:shadow-xl hover:scale-[1.05]"
              >
                Explore IT Courses <ArrowRight size={18} className="text-brand-green" />
              </Link>
              <Link
                href="/it-education#register"
                className="inline-flex items-center justify-center gap-2 px-8 py-5 rounded-full bg-brand-green text-brand-navy font-bold uppercase tracking-widest hover:bg-brand-green-dark transition-all"
              >
                Register Now <GraduationCap size={18} />
              </Link>
            </div>
          </div>

          {/* Right Side - 4-Image Carousel */}
          <div className="relative">
            {/* Carousel Container */}
            <div className="relative rounded-3xl overflow-hidden shadow-2xl border-4 border-brand-green">
              {/* Images */}
              <div
                className="flex transition-transform duration-500 ease-in-out"
                style={{ transform: `translateX(-${currentIndex * 100}%)` }}
              >
                {carouselImages.map((image, index) => (
                  <div key={index} className="w-full flex-shrink-0">
                    <img src={image.src} alt={image.alt} className="w-full h-96 object-cover" />
                  </div>
                ))}
              </div>

              {/* Carousel Navigation */}
              <button
                onClick={goToPrev}
                className="absolute left-4 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-brand-green/20 backdrop-blur-sm flex items-center justify-center text-white hover:bg-brand-green/30 transition-all"
              >
                <ChevronLeft size={24} />
              </button>
              <button
                onClick={goToNext}
                className="absolute right-4 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-brand-green/20 backdrop-blur-sm flex items-center justify-center text-white hover:bg-brand-green/30 transition-all"
              >
                <ChevronRight size={24} />
              </button>

              {/* Bottom Text */}
              <div className="absolute bottom-6 left-6 right-6 text-center text-white">
                <p className="font-display text-2xl mb-2">Certified IT Professionals</p>
                <p className="text-brand-green font-bold text-sm uppercase tracking-wider">
                  Globally Recognized Certifications
                </p>
              </div>

              {/* Dots Indicator */}
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
                {carouselImages.map((_, index) => (
                  <button
                    key={index}
                    onClick={() => setCurrentIndex(index)}
                    className={`w-3 h-3 rounded-full transition-all ${
                      index === currentIndex ? "bg-brand-green" : "bg-white/30"
                    }`}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
