import Link from "next/link";
import PortalTopbar from "@/components/PortalTopbar";
import {
  LayoutDashboard,
  Users,
  CreditCard,
  FileText,
  BookOpen,
  ClipboardCheck,
  GraduationCap,
  CalendarDays,
  Bell,
  Wallet,
  School,
  IdCard,
  Award,
} from "lucide-react";

const PORTALS = [
  {
    name: "Admin",
    accent: "text-brand-green",
    bg: "bg-brand-green/10",
    icon: School,
    routes: [
      { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
      { href: "/admin/students", label: "Student records", icon: Users },
      { href: "/admin/fees", label: "Fee management", icon: CreditCard },
      { href: "/admin/report-cards", label: "Report cards", icon: FileText },
      { href: "/admin/staff-assignments", label: "Staff assignments", icon: BookOpen },
      { href: "/admin/class-manager", label: "Class manager", icon: School },
      { href: "/admin/news", label: "Post & news", icon: Bell },
      { href: "/admin/questions", label: "Question bank", icon: ClipboardCheck },
    ],
  },
  {
    name: "Teacher",
    accent: "text-brand-orange",
    bg: "bg-brand-orange/10",
    icon: GraduationCap,
    routes: [
      { href: "/teacher/dashboard", label: "Dashboard", icon: LayoutDashboard },
      { href: "/teacher/gradebook", label: "Gradebook", icon: BookOpen },
      { href: "/teacher/question-bank", label: "Question bank", icon: ClipboardCheck },
      { href: "/teacher/upload-questions", label: "Upload questions", icon: FileText },
      { href: "/teacher/test-retake", label: "Grant retake", icon: Award },
      { href: "/teacher/class/attendance", label: "Take attendance", icon: CalendarDays },
      { href: "/teacher/students", label: "My students", icon: Users },
    ],
  },
  {
    name: "Student",
    accent: "text-brand-green",
    bg: "bg-brand-green/10",
    icon: GraduationCap,
    routes: [
      { href: "/student/dashboard", label: "Dashboard", icon: LayoutDashboard },
      { href: "/student/exams", label: "CBT / Exams", icon: ClipboardCheck },
      { href: "/student/report-cards", label: "Report cards", icon: FileText },
      { href: "/student/profile", label: "My profile", icon: Users },
      { href: "/student/id-card", label: "ID card", icon: IdCard },
      { href: "/student/attendance", label: "Attendance", icon: CalendarDays },
      { href: "/student/teachers", label: "My teachers", icon: GraduationCap },
    ],
  },
  {
    name: "Parent",
    accent: "text-brand-orange",
    bg: "bg-brand-orange/10",
    icon: Wallet,
    routes: [
      { href: "/parent/dashboard", label: "Dashboard", icon: LayoutDashboard },
      { href: "/parent/fees", label: "Fees & payment", icon: CreditCard },
      { href: "/parent/report-cards", label: "Report cards", icon: FileText },
      { href: "/parent/attendance", label: "Attendance", icon: CalendarDays },
      { href: "/parent/messages", label: "Messages", icon: Bell },
    ],
  },
];

export default function SuperAdminPortalsPage() {
  return (
    <>
      <PortalTopbar title="Portal navigation" />
      <main className="mx-auto max-w-[1600px] px-6 py-8">
        <div className="rounded-[2rem] bg-brand-navy p-7 text-white">
          <p className="text-xs font-bold uppercase tracking-widest text-brand-green">
            Cross-portal access
          </p>
          <h1 className="mt-2 font-display text-4xl tracking-widest">
            PORTAL <span className="text-brand-green">HUB</span>
          </h1>
          <p className="mt-3 max-w-2xl text-sm text-white/65">
            Jump straight into any portal&apos;s key pages. As super-admin you have read access
            across all schools and roles.
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <a
              href="/super-admin/schools"
              className="inline-flex items-center gap-2 rounded-full bg-brand-green px-5 py-2.5 text-xs font-bold uppercase tracking-widest text-brand-navy transition-all hover:scale-[1.03]"
            >
              Schools Overview →
            </a>
            <a
              href="/super-admin/health"
              className="inline-flex items-center gap-2 rounded-full bg-blue-500 px-5 py-2.5 text-xs font-bold uppercase tracking-widest text-white transition-all hover:scale-[1.03]"
            >
              System Health →
            </a>
            <a
              href="/super-admin/broadcast"
              className="inline-flex items-center gap-2 rounded-full bg-brand-orange px-5 py-2.5 text-xs font-bold uppercase tracking-widest text-brand-navy transition-all hover:scale-[1.03]"
            >
              Broadcast →
            </a>
          </div>
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-2">
          {PORTALS.map((p) => (
            <div
              key={p.name}
              className="rounded-3xl border border-[var(--border-subtle)] bg-[var(--surface-card)] p-6 shadow-[var(--card-shadow)]"
            >
              <div className="mb-4 flex items-center gap-3">
                <span
                  className={`grid h-11 w-11 place-items-center rounded-2xl ${p.bg} ${p.accent}`}
                >
                  <p.icon size={20} />
                </span>
                <h2 className="font-display text-2xl tracking-widest">{p.name.toUpperCase()}</h2>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                {p.routes.map((r) => (
                  <Link
                    key={r.href}
                    href={r.href}
                    className="flex items-center gap-3 rounded-xl border border-[var(--border-subtle)] px-4 py-3 text-sm font-medium transition-all hover:border-brand-green/40 hover:bg-brand-green/5"
                  >
                    <r.icon size={15} className="shrink-0 text-brand-green" />
                    {r.label}
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
      </main>
    </>
  );
}
