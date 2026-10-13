import Link from "next/link";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { Reveal } from "@/components/Reveal";
import { AnimatedText } from "@/components/AnimatedText";
import {
  GraduationCap,
  User,
  Users,
  MonitorSmartphone,
  ArrowRight,
  LockKeyhole,
  Sparkles,
} from "lucide-react";

export const metadata = {
  title: "EduPortal — Sign In",
  description:
    "Access the Ykay College EduPortal: staff, student, parent, and IT education portals.",
};

const portals = [
  {
    label: "Staff Portal",
    title: "Teaching & Administration",
    desc: "For teachers and school officers — mark attendance, enter scores, manage classes, and run day-to-day school operations.",
    icon: GraduationCap,
    href: "/login?portal=staff",
    cta: "Sign In",
    features: ["Attendance", "Gradebook", "Report Cards", "Administration"],
    accent: false,
  },
  {
    label: "Student Portal",
    title: "Learning & Results",
    desc: "See your attendance, results, exams, and announcements in one place.",
    icon: User,
    href: "/login?portal=student",
    cta: "Sign In",
    features: ["Dashboard", "Attendance", "Report Cards", "Announcements"],
    accent: false,
  },
  {
    label: "IT Education",
    title: "Digital Skills Academy",
    desc: "Learn Python, AI, cybersecurity, and Microsoft Office. Free accounts for Ykay students and external learners.",
    icon: MonitorSmartphone,
    href: "/it-portal/auth",
    cta: "Sign In / Sign Up",
    features: ["Python", "AI", "Cybersecurity", "Certifications"],
    accent: true,
  },
  {
    label: "Parent Portal",
    title: "Child Monitoring & Fees",
    desc: "Follow your child's attendance and results, get alerts, and pay school fees securely.",
    icon: Users,
    href: "/login?portal=parent",
    cta: "Sign In",
    features: ["Child Dashboard", "Fees", "Attendance", "Report Cards"],
    accent: false,
  },
];

export default function PortalPage() {
  return (
    <>
      <Header />
      <main className="bg-[var(--bg-primary)] min-h-screen theme-transition">
        {/* Hero */}
        <Reveal>
          <section className="pt-32 pb-16 bg-brand-navy px-6">
            <div className="mx-auto max-w-7xl text-center">
              <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-brand-green/10 border border-brand-green/30 text-brand-green text-[10px] font-bold tracking-[0.2em] uppercase mb-6">
                <LockKeyhole size={12} /> Secure Access
              </span>
              <h1 className="font-display text-white leading-[0.82] text-[clamp(3rem,11vw,9.5rem)]">
                <AnimatedText heavy stagger={0.034} text="YKAY" delay={0.0} />
                <span className="text-brand-green">
                  <AnimatedText heavy stagger={0.034} text="EDUPORTAL" delay={0.1} />
                </span>
              </h1>
              <p className="text-white/60 font-body max-w-2xl mx-auto mt-6 text-base md:text-lg">
                One digital ecosystem for the whole school community. Choose your portal below and
                sign in with the credentials issued by Ykay College — or join our IT Education
                academy.
              </p>
            </div>
          </section>
        </Reveal>

        {/* Portal Cards */}
        <Reveal>
          <section className="py-20 px-6">
            <div className="mx-auto max-w-7xl">
              <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-6">
                {portals.map((portal) => (
                  <div
                    key={portal.label}
                    className={`group relative flex flex-col p-8 rounded-[2rem] bg-[var(--surface-card)] border shadow-[var(--card-shadow)] hover:shadow-[var(--card-shadow-hover)] hover:-translate-y-1 transition-all duration-300 overflow-hidden ${
                      portal.accent
                        ? "border-brand-green/50 ring-1 ring-brand-green/20"
                        : "border-[var(--border-subtle)] hover:border-brand-green"
                    }`}
                  >
                    {portal.accent ? (
                      <span className="absolute top-4 right-4 inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-widest text-brand-navy bg-brand-orange px-2.5 py-1 rounded-full">
                        <Sparkles size={10} /> Open Enrollment
                      </span>
                    ) : null}

                    <div className="w-14 h-14 rounded-2xl bg-brand-green/10 flex items-center justify-center text-brand-green group-hover:bg-brand-green group-hover:text-brand-navy transition-colors mb-6">
                      <portal.icon size={26} strokeWidth={1.75} />
                    </div>

                    <span className="font-body text-[10px] font-bold uppercase tracking-widest text-brand-green mb-2 block">
                      {portal.label}
                    </span>
                    <h3 className="font-display text-2xl text-[var(--text-primary)] mb-3 tracking-[1px]">
                      {portal.title}
                    </h3>
                    <p className="text-sm text-[var(--text-secondary)] leading-relaxed mb-5 flex-1">
                      {portal.desc}
                    </p>

                    <div className="flex flex-wrap gap-1.5 mb-6">
                      {portal.features.map((feature) => (
                        <span
                          key={feature}
                          className="text-[10px] px-2.5 py-1 rounded-full bg-[var(--surface-disabled)] text-[var(--text-muted)] font-medium"
                        >
                          {feature}
                        </span>
                      ))}
                    </div>

                    <Link
                      href={portal.href}
                      className={`inline-flex items-center justify-center gap-2 rounded-full px-6 py-3 text-xs font-bold uppercase tracking-widest transition-all ${
                        portal.accent
                          ? "bg-brand-orange text-brand-navy hover:bg-brand-orange-dark shadow-[var(--btn-secondary-shadow)]"
                          : "bg-brand-green text-brand-navy hover:bg-brand-green-dark shadow-[var(--btn-primary-shadow)]"
                      }`}
                    >
                      {portal.cta} <ArrowRight size={14} />
                    </Link>
                  </div>
                ))}
              </div>

              {/* Help strip */}
              <div className="mt-16 p-10 rounded-[2rem] bg-gradient-to-br from-brand-navy to-brand-navy-light border border-white/5 text-center">
                <h3 className="font-display text-2xl text-white mb-4">Need help signing in?</h3>
                <p className="font-body text-white/60 max-w-2xl mx-auto mb-6">
                  Staff, student, and parent credentials are issued by the school administration —
                  there is no public sign-up. If you have lost access to your account, use the
                  password reset option or contact the school office.
                </p>
                <p className="font-body text-white/60 max-w-2xl mx-auto mb-6">
                  Not yet part of Ykay College?{" "}
                  <Link href="/admissions" className="font-bold text-brand-orange hover:underline">
                    Apply for admission online
                  </Link>{" "}
                  — no account required. You will receive an Application ID to{" "}
                  <Link
                    href="/admissions/status"
                    className="font-bold text-brand-orange hover:underline"
                  >
                    track your application
                  </Link>{" "}
                  at any time.
                </p>
                <div className="flex flex-wrap items-center justify-center gap-4">
                  <Link
                    href="/admissions"
                    className="inline-flex items-center gap-2 px-8 py-3 rounded-full border-2 border-brand-orange text-brand-orange font-body text-sm font-bold tracking-widest hover:bg-brand-orange hover:text-brand-navy transition-all"
                  >
                    Apply for Admission
                  </Link>
                  <Link
                    href="/reset-password"
                    className="inline-flex items-center gap-2 px-8 py-3 rounded-full border-2 border-white/20 text-white font-body text-sm font-bold tracking-widest hover:bg-white hover:text-brand-navy transition-all"
                  >
                    Reset Password
                  </Link>
                  <Link
                    href="/contact"
                    className="inline-flex items-center gap-2 px-8 py-3 rounded-full bg-brand-orange text-brand-navy font-body text-sm font-bold tracking-widest hover:bg-brand-orange-dark transition-all shadow-lg"
                  >
                    Contact Admin
                  </Link>
                </div>
              </div>
            </div>
          </section>
        </Reveal>
      </main>
      <Footer />
    </>
  );
}
