import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { Reveal } from "@/components/Reveal";
import { Shield, Lock, FileText, Mail } from "lucide-react";

import { AnimatedText } from "@/components/AnimatedText";
export default function PrivacyPolicyPage() {
  return (
    <>
      <Header />
      <main className="bg-[var(--section-bg-alt)] min-h-screen theme-transition">
        {/* Hero */}
        <Reveal>
          <section className="pt-32 pb-10 md:pt-40 md:pb-16">
            <div className="mx-auto max-w-4xl px-6">
              <div className="rounded-[2rem] bg-gradient-to-br from-brand-navy via-brand-navy-light to-green-900 p-8 md:p-12 shadow-xl relative overflow-hidden">
                <div className="absolute -top-24 -right-24 w-80 h-80 rounded-full bg-brand-green/20 blur-3xl" />
                <div className="absolute -bottom-16 -left-16 w-60 h-60 rounded-full bg-brand-orange/20 blur-3xl" />

                <div className="relative z-10">
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 backdrop-blur-sm border border-white/20 mb-6">
                    <Shield size={14} className="text-brand-green-light" />
                    <span className="font-body text-[10px] font-bold tracking-[0.2em] uppercase text-white">
                      NDPR Compliant
                    </span>
                  </div>
                  <h1 className="font-display tracking-[-0.01em] text-white mb-3 text-[clamp(3rem,11vw,9.5rem)]">
                    <AnimatedText heavy stagger={0.034} text="PRIVACY" delay={0.0} />
                    <span className="text-brand-green-light">
                      <AnimatedText heavy stagger={0.034} text="POLICY" delay={0.175} />
                    </span>
                  </h1>
                  <p className="font-body text-base md:text-lg text-white/80">
                    Ykay College &amp; Leadership Academy — NDPR Compliance Statement
                  </p>
                </div>
              </div>
            </div>
          </section>
        </Reveal>

        {/* Content sections */}
        <Reveal>
          <section className="pb-20 md:pb-28">
            <div className="mx-auto max-w-4xl px-6 space-y-6 md:space-y-8">
              {/* Data Protection */}
              <div className="rounded-[2rem] bg-[var(--surface-card)] border border-[var(--border-subtle)] shadow-[var(--card-shadow)] p-8 md:p-10">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-xl bg-[var(--accent-primary)]/10 flex items-center justify-center">
                    <Lock size={18} className="text-[var(--accent-primary)]" />
                  </div>
                  <h2 className="font-display text-xl tracking-[2px] text-[var(--text-primary)]">
                    <AnimatedText text="Data Protection & Privacy" delay={0.0} />
                  </h2>
                </div>
                <p className="font-body text-sm text-[var(--text-secondary)] leading-relaxed mb-4">
                  Ykay College &amp; Leadership Academy is committed to protecting the privacy and
                  personal data of all students, parents, staff, and stakeholders in accordance with
                  the Nigeria Data Protection Regulation (NDPR) 2019.
                </p>
                <p className="font-body text-sm text-[var(--text-secondary)] leading-relaxed">
                  We collect, process, and store personal data only for legitimate educational,
                  administrative, and operational purposes. All data is handled with strict
                  confidentiality and secured using industry-standard practices.
                </p>
              </div>

              {/* What data */}
              <div className="rounded-[2rem] bg-[var(--surface-card)] border border-[var(--border-subtle)] shadow-[var(--card-shadow)] p-8 md:p-10">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 rounded-xl bg-[var(--accent-primary)]/10 flex items-center justify-center">
                    <FileText size={18} className="text-[var(--accent-primary)]" />
                  </div>
                  <AnimatedText
                    as="h2"
                    className="font-display text-xl tracking-[2px] text-[var(--text-primary)]"
                    text="What Data We Collect"
                  />
                </div>
                <ul className="space-y-3">
                  {[
                    "Student registration details (name, date of birth, gender, class, health records)",
                    "Parent or guardian contact information (name, phone, email)",
                    "Academic records (grades, attendance, report cards, exam scores)",
                    "Financial information (fee invoices, payment records, bank references)",
                    "Health and wellbeing records (blood group, allergies, medical notes)",
                    "Communication records (notifications, SMS, WhatsApp, email)",
                  ].map((item, i) => (
                    <li
                      key={i}
                      className="flex items-start gap-3 font-body text-sm text-[var(--text-secondary)]"
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-brand-green mt-1.5 shrink-0" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Rights */}
              <div className="rounded-[2rem] bg-[var(--surface-card)] border border-[var(--border-subtle)] shadow-[var(--card-shadow)] p-8 md:p-10">
                <AnimatedText
                  as="h2"
                  className="font-display text-xl tracking-[2px] text-[var(--text-primary)] mb-6"
                  text="Your Rights"
                />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {[
                    { title: "Access", desc: "Request a copy of your personal data." },
                    { title: "Correction", desc: "Request correction of inaccurate data." },
                    { title: "Deletion", desc: "Request deletion of your data where applicable." },
                    { title: "Portability", desc: "Request your data in a portable format." },
                    { title: "Restriction", desc: "Restrict processing of your data." },
                    {
                      title: "Objection",
                      desc: "Object to processing based on legitimate interests.",
                    },
                  ].map((right) => (
                    <div
                      key={right.title}
                      className="rounded-xl bg-[var(--surface-disabled)] border border-[var(--border-subtle)] px-5 py-5 hover:border-[var(--accent-primary)] transition-colors"
                    >
                      <h3 className="font-display text-sm tracking-[2px] text-[var(--accent-primary)] mb-1">
                        {right.title}
                      </h3>
                      <p className="font-body text-xs text-[var(--text-secondary)] leading-relaxed">
                        {right.desc}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Cookie Consent — dark accent card */}
              <div className="rounded-[2rem] bg-gradient-to-br from-brand-navy via-brand-navy-light to-green-900 p-8 md:p-10 shadow-xl relative overflow-hidden">
                <div className="absolute -top-16 -right-16 w-60 h-60 rounded-full bg-brand-green/20 blur-3xl" />
                <div className="relative z-10">
                  <AnimatedText
                    as="h2"
                    className="font-display text-xl tracking-[2px] text-white mb-4"
                    text="Cookie Consent"
                  />
                  <p className="font-body text-sm text-white/80 mb-6 leading-relaxed">
                    This website uses cookies and similar technologies to enhance user experience,
                    remember preferences, and analyze traffic. By continuing to use this site, you
                    consent to our use of cookies in accordance with this policy.
                  </p>
                  <div className="flex flex-wrap gap-3">
                    <span className="px-3 py-1.5 rounded-full bg-brand-green/20 border border-brand-green/40 text-brand-green-light text-[10px] font-bold tracking-[0.15em] uppercase">
                      Essential
                    </span>
                    <span className="px-3 py-1.5 rounded-full bg-brand-orange/20 border border-brand-orange/40 text-brand-orange-light text-[10px] font-bold tracking-[0.15em] uppercase">
                      Analytics
                    </span>
                    <span className="px-3 py-1.5 rounded-full bg-white/10 border border-white/20 text-white text-[10px] font-bold tracking-[0.15em] uppercase">
                      Preferences
                    </span>
                  </div>
                </div>
              </div>

              {/* Data Requests */}
              <div className="rounded-[2rem] bg-[var(--surface-card)] border border-[var(--border-subtle)] shadow-[var(--card-shadow)] p-8 md:p-10">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-xl bg-[var(--accent-primary)]/10 flex items-center justify-center">
                    <Mail size={18} className="text-[var(--accent-primary)]" />
                  </div>
                  <AnimatedText
                    as="h2"
                    className="font-display text-xl tracking-[2px] text-[var(--text-primary)]"
                    text="Data Requests"
                  />
                </div>
                <p className="font-body text-sm text-[var(--text-secondary)] leading-relaxed">
                  To request access to, correction of, or deletion of your personal data, please
                  contact our Data Protection Officer at{" "}
                  <a
                    href="mailto:dpo@ykaycollege.com"
                    className="text-[var(--accent-primary)] font-bold hover:underline"
                  >
                    dpo@ykaycollege.com
                  </a>{" "}
                  or visit the school office. All requests will be processed within the timeframe
                  required by NDPR.
                </p>
              </div>
            </div>
          </section>
        </Reveal>
      </main>
      <Footer />
    </>
  );
}
