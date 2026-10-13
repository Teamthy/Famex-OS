"use client";

import { useState } from "react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { Reveal } from "@/components/Reveal";
import { ChevronDown, HelpCircle } from "lucide-react";

import { AnimatedText } from "@/components/AnimatedText";
const FAQS = [
  {
    category: "Admissions",
    items: [
      {
        q: "When does admissions open?",
        a: "Admissions for the 2026/2027 session are currently open. Applications close on 31st August 2026.",
      },
      {
        q: "What is the application fee?",
        a: "The application fee is ₦5,000, non-refundable. It covers processing and entrance assessment.",
      },
      {
        q: "Do you conduct entrance exams?",
        a: "Yes, all JSS1 applicants sit an entrance assessment in English, Mathematics, and General Knowledge.",
      },
      {
        q: "Can my child transfer mid-term?",
        a: "Yes, we accept transfers subject to seat availability and performance in a placement test.",
      },
    ],
  },
  {
    category: "Fees & Payments",
    items: [
      {
        q: "How do I pay school fees?",
        a: "Fees can be paid online via Paystack (card, bank transfer, USSD) or at the school office. Receipts are sent instantly.",
      },
      {
        q: "Are there sibling discounts?",
        a: "Yes, we offer a 10% discount for the second child and 15% for the third child.",
      },
      {
        q: "What is your refund policy?",
        a: "Fees paid are non-refundable except in cases of school-initiated cancellation.",
      },
      {
        q: "Can I pay in installments?",
        a: "Yes, split payments are allowed if arranged with the Bursary before the term begins.",
      },
    ],
  },
  {
    category: "Academics",
    items: [
      {
        q: "What curriculum do you follow?",
        a: "We follow the NERDC curriculum aligned with WAEC, NECO, and BECE standards, enhanced with digital literacy and STEM programmes.",
      },
      {
        q: "What subjects are offered in SS?",
        a: "We offer Science, Arts, and Commercial tracks. Full subject list is on our Academics page.",
      },
      {
        q: "Are there extracurricular activities?",
        a: "Yes — over 15 clubs including Debate, STEM, Sports, Music, and Leadership Council.",
      },
      {
        q: "How do you handle underperforming students?",
        a: "Weekly progress tracking, dedicated after-school remedial classes, and parent-teacher engagement sessions.",
      },
    ],
  },
  {
    category: "Portal & Technology",
    items: [
      {
        q: "When does the portal launch?",
        a: "The full EduPortal launches with the 2026/2027 academic session. Login credentials will be issued at resumption.",
      },
      {
        q: "Can parents track attendance in real-time?",
        a: "Yes. Parents receive SMS/WhatsApp alerts within 5 minutes of attendance being marked.",
      },
      {
        q: "How are report cards delivered?",
        a: "Branded PDF report cards are auto-generated and delivered via email and WhatsApp.",
      },
      {
        q: "Is my child's data safe?",
        a: "Yes. We comply with NDPR 2019. All data is encrypted and access is role-restricted.",
      },
    ],
  },
];

export default function FAQPage() {
  const [openItems, setOpenItems] = useState<string[]>([]);
  const toggle = (id: string) =>
    setOpenItems(openItems.includes(id) ? openItems.filter((i) => i !== id) : [...openItems, id]);

  return (
    <>
      <Header />
      <main className="bg-[var(--bg-primary)] min-h-screen theme-transition">
        <Reveal>
          <section className="pt-32 pb-16 bg-brand-navy px-6">
            <div className="mx-auto max-w-4xl text-center">
              <div className="w-16 h-16 rounded-2xl bg-brand-green/20 text-brand-green flex items-center justify-center mx-auto mb-6">
                <HelpCircle size={30} />
              </div>
              <h1 className="font-display text-white leading-[0.82] text-[clamp(3rem,11vw,9.5rem)]">
                <AnimatedText heavy stagger={0.034} text="FREQUENTLY" delay={0.0} />
                <span className="text-brand-green">
                  <AnimatedText heavy stagger={0.034} text="ASKED" delay={0.25} />
                </span>
              </h1>
              <p className="text-white/60 mt-6 max-w-2xl mx-auto">
                Quick answers to the most common questions about Ykay College — admissions, fees,
                academics, and our EduPortal.
              </p>
            </div>
          </section>
        </Reveal>

        <Reveal>
          <section className="py-20 px-6">
            <div className="mx-auto max-w-4xl space-y-10">
              {FAQS.map((cat) => (
                <div key={cat.category}>
                  <h2 className="font-display text-2xl text-brand-green tracking-widest mb-6">
                    <AnimatedText text={cat.category} delay={0.0} />
                  </h2>
                  <div className="space-y-3">
                    {cat.items.map((item, i) => {
                      const id = `${cat.category}-${i}`;
                      const isOpen = openItems.includes(id);
                      return (
                        <div
                          key={id}
                          className="rounded-2xl bg-[var(--surface-card)] border border-[var(--border-subtle)] overflow-hidden"
                        >
                          <button
                            onClick={() => toggle(id)}
                            className="w-full p-6 text-left flex items-center justify-between gap-4 hover:bg-[var(--surface-disabled)] transition-colors"
                          >
                            <span className="font-medium text-[var(--text-primary)]">{item.q}</span>
                            <ChevronDown
                              size={20}
                              className={`text-brand-green shrink-0 transition-transform ${isOpen ? "rotate-180" : ""}`}
                            />
                          </button>
                          {isOpen && (
                            <div className="px-6 pb-6 pt-0 text-sm text-[var(--text-secondary)] leading-relaxed">
                              {item.a}
                            </div>
                          )}
                        </div>
                      );
                    })}
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
