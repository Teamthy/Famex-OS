"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  LayoutDashboard,
  BookOpen,
  ClipboardCheck,
  FileText,
  Users,
  LogOut,
  UserCheck,
  History,
  School,
  Award,
  BarChart3,
  LoaderCircle,
  Upload,
  Library,
  Send,
  Megaphone,
  MessageCircle,
} from "lucide-react";
import { useAuth } from "./AuthProvider";

type Me = {
  displayName: string;
  roleLabel: string | null;
  photoUrl: string | null;
  isFormTeacher: boolean;
  isSubjectTeacher: boolean;
  formClassName: string | null;
};

type NavItem = { label: string; href: string; icon: typeof LayoutDashboard; badge?: string };

function NavBlock({
  title,
  color,
  items,
  pathname,
}: {
  title: string;
  color: string;
  items: NavItem[];
  pathname: string;
}) {
  return (
    <div>
      <div className={`px-4 mb-2 text-[10px] font-bold uppercase tracking-widest ${color}`}>
        {title}
      </div>
      <nav className="space-y-1">
        {items.map((item) => {
          const active = pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex w-full items-center gap-3 rounded-xl border px-4 py-2.5 text-sm font-medium transition-all ${
                active
                  ? "border-brand-green/20 bg-brand-green/10 text-brand-green"
                  : "border-transparent text-[var(--text-muted)] hover:bg-[var(--surface-disabled)] hover:text-[var(--text-primary)]"
              }`}
            >
              <item.icon size={16} />
              <span className="flex-1 tracking-wide">{item.label}</span>
              {item.badge ? (
                <span className="rounded-full bg-brand-orange px-2 py-0.5 text-[9px] font-bold text-brand-navy">
                  {item.badge}
                </span>
              ) : null}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

/**
 * Production teacher nav — roles from live /api/teacher/dashboard.
 * No portal switcher, no demo badge, no mock teacherData.
 */
export default function TeacherSidebar() {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const [me, setMe] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch("/api/teacher/dashboard", { cache: "no-store" });
        const j = await r.json();
        if (!cancelled && r.ok) setMe(j.teacher);
      } catch {
        /* sidebar still usable */
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const isForm = Boolean(me?.isFormTeacher);
  const isSubject = Boolean(me?.isSubjectTeacher) || (!isForm && !loading);

  const general: NavItem[] = [
    { label: "Dashboard", href: "/teacher/dashboard", icon: LayoutDashboard },
    { label: "My Students", href: "/teacher/students", icon: Users },
    { label: "My Profile", href: "/teacher/profile", icon: Award },
    { label: "My attendance", href: "/staff/attendance", icon: UserCheck },
    { label: "My Records", href: "/teacher/my-records", icon: FileText },
    { label: "Announcements", href: "/teacher/announcements", icon: Megaphone },
    { label: "Messages", href: "/teacher/messages", icon: MessageCircle },
  ];

  const subject: NavItem[] = [
    { label: "Gradebook", href: "/teacher/gradebook", icon: BookOpen },
    { label: "Performance Records", href: "/teacher/performance-records", icon: BookOpen },
    { label: "Analytics", href: "/teacher/analytics", icon: BarChart3 },
  ];

  /**
   * Tests & exams, in the order a teacher actually works.
   *
   * Two problems this fixes.
   *
   * 1. "Exam Centre" and "CBT Center" sat next to each other as peers with no
   *    hint of the difference. They query the SAME endpoint
   *    (/api/teacher/exams) — CBT Center is the older single-page builder,
   *    Exam Centre is the board that added scheduling, retakes and readiness
   *    warnings. Presented as equals, the only way to learn which to use was
   *    to open both. Exam Centre now leads and is labelled as the starting
   *    point; the old builder stays, marked "Classic", because it is a
   *    perfectly good quick-create form and removing a page teachers may have
   *    bookmarked mid-term is not worth the tidiness.
   *
   * 2. Upload Questions and Question Bank were ORPHANED — fully built and
   *    reachable only by clicking through from an existing exam. A teacher
   *    looking for "where do I drop my Word file" could not find it, because
   *    it was not in the navigation at all. Fifteen teacher pages are in that
   *    state; these are the two that block the exam workflow.
   */
  const assessments: NavItem[] = [
    {
      label: "Exam Centre",
      href: "/teacher/exam-center",
      icon: ClipboardCheck,
      badge: "Start here",
    },
    { label: "Upload Questions", href: "/teacher/upload-questions", icon: Upload },
    { label: "Question Bank", href: "/teacher/question-bank", icon: Library },
    { label: "Edit Test Courses", href: "/teacher/test-courses", icon: BookOpen },
    { label: "Grade Exams", href: "/teacher/grade-exams", icon: FileText },
    { label: "Send Results", href: "/teacher/send-results", icon: Send },
    { label: "Quick Create", href: "/teacher/cbt-center", icon: BookOpen, badge: "Classic" },
  ];

  const form: NavItem[] = [
    {
      label: me?.formClassName ? `Class: ${me.formClassName}` : "Class roster",
      href: "/teacher/class/roster",
      icon: School,
    },
    { label: "Attendance register", href: "/teacher/class/attendance", icon: UserCheck },
    { label: "Attendance history", href: "/teacher/class/attendance-history", icon: History },
    { label: "Class report cards", href: "/teacher/class/report-cards", icon: FileText },
    { label: "Class parents", href: "/teacher/class/parents", icon: Users },
    { label: "Class timetable", href: "/teacher/class/timetable", icon: History },
  ];

  return (
    <aside className="hidden w-[280px] shrink-0 lg:block">
      <div className="sticky top-24 max-h-[calc(100vh-6rem)] space-y-4 overflow-y-auto pb-4">
        <div className="rounded-2xl border border-white/10 bg-brand-navy p-4">
          <div className="text-[9px] font-bold uppercase tracking-widest text-brand-green">
            Teaching workspace
          </div>
          <div className="mt-1 font-display text-sm tracking-[1px] text-white">
            {loading ? "Loading…" : me?.displayName || user?.name || "Teacher"}
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {isSubject && (
              <span className="rounded-full bg-brand-green/15 px-2 py-0.5 text-[9px] font-bold uppercase tracking-widest text-brand-green">
                Subject
              </span>
            )}
            {isForm && (
              <span className="rounded-full bg-brand-orange/15 px-2 py-0.5 text-[9px] font-bold uppercase tracking-widest text-brand-orange">
                Form {me?.formClassName || ""}
              </span>
            )}
          </div>
        </div>

        {loading ? (
          <div className="flex items-center gap-2 px-4 text-xs text-[var(--text-muted)]">
            <LoaderCircle className="animate-spin" size={14} /> Syncing assignments…
          </div>
        ) : null}

        <NavBlock
          title="General"
          color="text-[var(--text-muted)]"
          items={general}
          pathname={pathname}
        />
        {isSubject ? (
          <NavBlock
            title="Subject teaching"
            color="text-brand-green"
            items={subject}
            pathname={pathname}
          />
        ) : null}
        {isSubject ? (
          <NavBlock
            title="Tests & exams"
            color="text-brand-orange"
            items={assessments}
            pathname={pathname}
          />
        ) : null}
        {isForm ? (
          <NavBlock title="Form class" color="text-brand-orange" items={form} pathname={pathname} />
        ) : null}

        <button
          onClick={logout}
          className="flex w-full items-center gap-2 rounded-lg px-4 py-2 text-xs text-[var(--text-muted)] hover:text-red-500"
        >
          <LogOut size={14} /> Sign out
        </button>
      </div>
    </aside>
  );
}
