import Link from "next/link";
import HeroCarousel from "@/components/HeroCarousel";
import {
  GraduationCap,
  CreditCard,
  ClipboardCheck,
  CalendarCheck,
  BookOpen,
  Bell,
  ArrowRight,
  MapPin,
  Mail,
  Phone,
  Eye,
  Target,
  AlertCircle,
  Lightbulb,
} from "lucide-react";

/* ── DATA ── */
const SERVICES = [
  {
    icon: GraduationCap,
    title: "Admissions",
    desc: "Online applications, document uploads, entrance exams, and one-click enrolment.",
  },
  {
    icon: CreditCard,
    title: "Fees & Payments",
    desc: "Invoices, Paystack payments, automatic receipts, and real-time tracking.",
  },
  {
    icon: ClipboardCheck,
    title: "Exams & CBT",
    desc: "Computer-based tests, auto-grading, question banks, bulk Word/Excel upload.",
  },
  {
    icon: CalendarCheck,
    title: "Attendance",
    desc: "Daily registers, QR staff check-in, parent alerts, term analytics.",
  },
  {
    icon: BookOpen,
    title: "Gradebook & Reports",
    desc: "CA scores, printable report cards, broadsheet ranking, performance data.",
  },
  {
    icon: Bell,
    title: "Communications",
    desc: "SMS, email, in-app notifications, automated fee and event reminders.",
  },
];

const SCHOOLS = [
  {
    name: "Ykay College",
    loc: "Nigeria",
    img: "/home/hero-campus.jpg",
  },
  {
    name: "Greenfield Academy",
    loc: "Lekki, Lagos",
    img: "/home/hero-campus.jpg",
  },
  {
    name: "Faith Heights School",
    loc: "Ikeja, Lagos",
    img: "/home/hero-campus.jpg",
  },
  {
    name: "Crestwood College",
    loc: "Abuja, FCT",
    img: "/it-hub-1.jpg",
  },
  {
    name: "Royal Crown School",
    loc: "Port Harcourt",
    img: "/home/students-class.jpg",
  },
  {
    name: "Bright Future Academy",
    loc: "Ibadan, Oyo",
    img: "/home/leadership.jpg",
  },
];

const PILLARS = [
  {
    icon: Eye,
    title: "Vision",
    desc: "Every African school — regardless of size or budget — running on a world-class digital platform that empowers administrators, teachers, parents, and students.",
    img: "/it-hub-classroom.jpg",
  },
  {
    icon: Target,
    title: "Mission",
    desc: "Eliminate paperwork, spreadsheets, and WhatsApp chaos from school management. One platform, every feature, every device.",
    img: "/home/leadership.jpg",
  },
  {
    icon: AlertCircle,
    title: "The Problem",
    desc: "Schools drown in manual processes — paper registers, hand-written receipts, exam scripts, WhatsApp groups, and Excel sheets that crash. Parents left in the dark.",
    img: "/it-hub-4.jpg",
  },
  {
    icon: Lightbulb,
    title: "The Solution",
    desc: "The Ykay Platform brings everything into one cloud system — branded for each school, accessible from any device, with zero installation required.",
    img: "/home/lab.jpg",
  },
];

const STATS = [
  { value: "200+", label: "Schools" },
  { value: "50K+", label: "Students" },
  { value: "₦2B+", label: "Fees Processed" },
  { value: "99.9%", label: "Uptime" },
];

export default function PlatformLanding() {
  return (
    <>
      {/* Kill all green — override CSS vars for the entire landing page */}
      <style
        dangerouslySetInnerHTML={{
          __html: `:root{--color-brand-green:#123499;--color-brand-green-dark:#2840E8;--color-brand-green-light:#0A2472;--color-brand-orange:#123499;--color-brand-orange-dark:#2840E8;--color-brand-orange-light:#0A2472;}`,
        }}
      />

      <div className="bg-[#00072D] text-white">
        {/* ── MARQUEE ── */}
        <div className="overflow-hidden py-3 border-b border-white/5">
          <div className="flex gap-8 whitespace-nowrap animate-[marquee_25s_linear_infinite]">
            {Array(10)
              .fill("YKAY PLATFORM · EDUCATION OPERATING SYSTEM ·")
              .map((t, i) => (
                <span key={i} className="text-xs font-bold tracking-[0.3em] text-[#123499]">
                  {t}
                </span>
              ))}
          </div>
        </div>
        <style>{`@keyframes marquee{0%{transform:translateX(0)}100%{transform:translateX(-50%)}}`}</style>

        {/* ── NAV ── */}
        <nav className="sticky top-0 z-50 bg-[#00072D]/95 border-b border-white/5">
          <div className="max-w-7xl mx-auto flex items-center justify-between px-6 py-4">
            <Link href="/" className="flex items-center gap-2">
              <img src="/ykay-logo.png" alt="Ykay Platform" className="w-8 h-8 rounded-lg" />
              <span className="font-bold text-lg tracking-wider">
                EDU<span className="text-[#123499]">os</span>
              </span>
            </Link>
            <div className="hidden md:flex items-center gap-6">
              <a href="#services" className="text-white/70 text-sm hover:text-white">
                Services
              </a>
              <a href="#schools" className="text-white/70 text-sm hover:text-white">
                Schools
              </a>
              <a href="#pillars" className="text-white/70 text-sm hover:text-white">
                About
              </a>
              <a href="#contact" className="text-white/70 text-sm hover:text-white">
                Contact
              </a>
              <Link href="/login" className="text-white/75 text-sm hover:text-white">
                Sign In
              </Link>
              <Link
                href="/signup"
                className="bg-[#123499] text-white px-5 py-2 rounded-full text-sm font-bold hover:bg-[#2840E8] transition-colors"
              >
                Start Free
              </Link>
            </div>
          </div>
        </nav>

        {/* ── HERO CAROUSEL ── */}
        <HeroCarousel />

        {/* ── STATS ── */}
        <section className="border-y border-white/5">
          <div className="max-w-7xl mx-auto grid grid-cols-2 md:grid-cols-4 px-6 py-10">
            {STATS.map((s, i) => (
              <div
                key={s.label}
                className={`text-center ${i < 3 ? "md:border-r border-white/5" : ""}`}
              >
                <div className="font-bold text-3xl md:text-4xl mb-1">{s.value}</div>
                <div className="text-xs text-white/50 uppercase tracking-widest">{s.label}</div>
              </div>
            ))}
          </div>
        </section>

        {/* ── ABOUT ── */}
        <section className="py-24 px-6">
          <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-16 items-center">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.3em] text-[#123499] mb-4">
                About the Ykay Platform
              </p>
              <h2 className="font-bold text-3xl md:text-4xl mb-6 leading-tight">
                One platform that runs your entire school
              </h2>
              <p className="text-white/60 text-base leading-relaxed mb-4">
                The Ykay Platform is a cloud-based school management system built for African
                schools. It replaces paper registers, manual receipts, and WhatsApp groups with a
                single portal that works on any device.
              </p>
              <p className="text-white/60 text-base leading-relaxed mb-8">
                From admissions to graduation, from fee collection to exam results — every process
                is digitised, automated, and secure.
              </p>
              <Link
                href="/signup"
                className="inline-flex items-center gap-2 text-[#8FA0FF] font-bold text-sm"
              >
                Get Started <ArrowRight size={14} />
              </Link>
            </div>
            <div className="relative">
              <img
                src="/home/lab.jpg"
                alt="Students learning"
                className="rounded-2xl w-full h-[420px] object-cover"
              />
            </div>
          </div>
        </section>

        {/* ── OUR SERVICES ── */}
        <section id="services" className="py-24 px-6 border-t border-white/5">
          <div className="max-w-7xl mx-auto">
            <div className="mb-16">
              <p className="text-xs font-bold uppercase tracking-[0.3em] text-[#123499] mb-4">
                What We Offer
              </p>
              <h2 className="font-bold text-3xl md:text-4xl">Our Services</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-px bg-white/5 border border-white/5 rounded-2xl overflow-hidden">
              {SERVICES.map((s) => (
                <div
                  key={s.title}
                  className="bg-[#00072D] p-8 hover:bg-[#051650] transition-colors"
                >
                  <s.icon className="text-[#123499] mb-5" size={28} />
                  <h3 className="font-bold text-lg mb-2">{s.title}</h3>
                  <p className="text-white/35 text-sm leading-relaxed">{s.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── SCHOOLS ── */}
        <section id="schools" className="py-24 px-6 border-t border-white/5">
          <div className="max-w-7xl mx-auto">
            <div className="mb-16">
              <p className="text-xs font-bold uppercase tracking-[0.3em] text-[#123499] mb-4">
                Our Community
              </p>
              <h2 className="font-bold text-3xl md:text-4xl mb-4">Schools on the Ykay Platform</h2>
              <p className="text-white/30 text-sm max-w-lg">
                Join hundreds of schools and colleges running on the Ykay Platform. Each one
                branded, customised, and thriving.
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {SCHOOLS.map((sch) => (
                <div key={sch.name} className="group relative overflow-hidden rounded-xl">
                  <img
                    src={sch.img}
                    alt={sch.name}
                    className="w-full h-56 object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#00072D] to-transparent" />
                  <div className="absolute bottom-0 p-5">
                    <div className="text-[10px] text-[#123499] font-bold uppercase tracking-widest mb-1">
                      Ykay Platform School
                    </div>
                    <h3 className="font-bold text-lg">{sch.name}</h3>
                    <p className="text-white/55 text-xs flex items-center gap-1 mt-1">
                      <MapPin size={10} /> {sch.loc}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── PILLARS (Vision / Mission / Problem / Solution) ── */}
        <section id="pillars" className="py-24 px-6 border-t border-white/5">
          <div className="max-w-7xl mx-auto">
            <div className="mb-16">
              <p className="text-xs font-bold uppercase tracking-[0.3em] text-[#123499] mb-4">
                Why the Ykay Platform
              </p>
              <h2 className="font-bold text-3xl md:text-4xl">Our Foundation</h2>
            </div>
            <div className="space-y-8">
              {PILLARS.map((p, i) => (
                <div key={p.title} className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
                  <div className={i % 2 === 1 ? "md:order-2" : ""}>
                    <img
                      src={p.img}
                      alt={p.title}
                      className="rounded-2xl w-full h-72 object-cover"
                    />
                  </div>
                  <div className={i % 2 === 1 ? "md:order-1" : ""}>
                    <p.icon className="text-[#123499] mb-4" size={28} />
                    <h3 className="font-bold text-2xl mb-3">{p.title}</h3>
                    <p className="text-white/35 text-base leading-relaxed">{p.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── CONTACT ── */}
        <section id="contact" className="py-24 px-6 border-t border-white/5">
          <div className="max-w-3xl mx-auto text-center">
            <p className="text-xs font-bold uppercase tracking-[0.3em] text-[#123499] mb-4">
              Get In Touch
            </p>
            <h2 className="font-bold text-3xl md:text-4xl mb-4">Ready to digitise your school?</h2>
            <p className="text-white/30 text-base mb-10 max-w-lg mx-auto">
              Start free — no credit card required. Set up in minutes.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-10">
              <div className="bg-[#051650] rounded-xl p-5 text-center">
                <Mail className="mx-auto mb-2 text-[#123499]" size={20} />
                <div className="text-xs text-white/30 mb-0.5">Email</div>
                <div className="text-sm font-medium">hello@ykaycollege.com</div>
              </div>
              <div className="bg-[#051650] rounded-xl p-5 text-center">
                <Phone className="mx-auto mb-2 text-[#123499]" size={20} />
                <div className="text-xs text-white/30 mb-0.5">Phone</div>
                <div className="text-sm font-medium">+234 800 YKAY</div>
              </div>
              <div className="bg-[#051650] rounded-xl p-5 text-center">
                <MapPin className="mx-auto mb-2 text-[#123499]" size={20} />
                <div className="text-xs text-white/30 mb-0.5">Location</div>
                <div className="text-sm font-medium">Lagos, Nigeria</div>
              </div>
            </div>
            <Link
              href="/signup"
              className="inline-flex items-center gap-2 bg-[#123499] text-white px-8 py-4 rounded-xl font-bold hover:bg-[#2840E8] transition-colors"
            >
              Create Your School <ArrowRight size={16} />
            </Link>
          </div>
        </section>

        {/* ── FOOTER ── */}
        <footer className="border-t border-white/5 pt-16 pb-8 px-6">
          <div className="max-w-7xl mx-auto">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-12">
              <div className="col-span-2 md:col-span-1">
                <Link href="/" className="flex items-center gap-2 mb-4">
                  <img src="/ykay-logo.png" alt="Ykay Platform" className="w-7 h-7 rounded" />
                  <span className="font-bold text-sm">
                    EDU<span className="text-[#123499]">os</span>
                  </span>
                </Link>
                <p className="text-white/20 text-xs leading-relaxed max-w-[200px]">
                  The Education Operating System for African schools. Admissions, fees, exams,
                  attendance, and communications — all in one branded portal.
                </p>
              </div>
              <div>
                <h4 className="font-bold text-xs uppercase tracking-widest text-white/60 mb-4">
                  Platform
                </h4>
                <ul className="space-y-2.5">
                  <li>
                    <Link href="/signup" className="text-white/60 text-xs hover:text-white">
                      Get Started
                    </Link>
                  </li>
                  <li>
                    <Link href="/login" className="text-white/60 text-xs hover:text-white">
                      Sign In
                    </Link>
                  </li>
                  <li>
                    <a href="#services" className="text-white/60 text-xs hover:text-white">
                      Features
                    </a>
                  </li>
                  <li>
                    <a href="#schools" className="text-white/60 text-xs hover:text-white">
                      Schools
                    </a>
                  </li>
                </ul>
              </div>
              <div>
                <h4 className="font-bold text-xs uppercase tracking-widest text-white/60 mb-4">
                  Solutions
                </h4>
                <ul className="space-y-2.5">
                  <li>
                    <a href="#services" className="text-white/60 text-xs hover:text-white">
                      Admissions
                    </a>
                  </li>
                  <li>
                    <a href="#services" className="text-white/60 text-xs hover:text-white">
                      Fees & Payments
                    </a>
                  </li>
                  <li>
                    <a href="#services" className="text-white/60 text-xs hover:text-white">
                      Exams & CBT
                    </a>
                  </li>
                  <li>
                    <a href="#services" className="text-white/60 text-xs hover:text-white">
                      Attendance
                    </a>
                  </li>
                </ul>
              </div>
              <div>
                <h4 className="font-bold text-xs uppercase tracking-widest text-white/60 mb-4">
                  Contact
                </h4>
                <ul className="space-y-2.5">
                  <li className="text-white/55 text-xs">hello@ykaycollege.com</li>
                  <li className="text-white/55 text-xs">+234 800 YKAY</li>
                  <li className="text-white/55 text-xs">Lagos, Nigeria</li>
                </ul>
              </div>
            </div>
            <div className="pt-6 border-t border-white/5 flex flex-col md:flex-row items-center justify-between gap-3">
              <p className="text-white/15 text-[11px]">
                © 2026 Ykay Platform — Education Operating System. All rights reserved.
              </p>
              <div className="flex gap-5 text-[11px] text-white/15">
                <a href="#" className="hover:text-white/30">
                  Privacy
                </a>
                <a href="#" className="hover:text-white/30">
                  Terms
                </a>
                <a href="#" className="hover:text-white/30">
                  Cookies
                </a>
              </div>
            </div>
          </div>
        </footer>
      </div>
    </>
  );
}
