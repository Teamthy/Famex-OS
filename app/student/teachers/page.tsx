"use client";

import PortalTopbar from "@/components/PortalTopbar";
import PortalSidebar from "@/components/PortalSidebar";
import { useApi } from "@/lib/useApi";
import { EmptyState, LoadingState } from "@/components/DataStates";
import {
  MessageCircle,
  LayoutDashboard,
  CalendarDays,
  FileText,
  User,
  Bell,
  ClipboardCheck,
  GraduationCap,
  BookOpen,
  School,
} from "lucide-react";

const SIDEBAR_ITEMS = [
  { label: "Dashboard", href: "/student/dashboard", icon: LayoutDashboard },
  { label: "Attendance", href: "/student/attendance", icon: CalendarDays },
  { label: "CBT Tests", href: "/student/exams", icon: ClipboardCheck },
  { label: "Report Cards", href: "/student/report-cards", icon: FileText },
  { label: "Messages", href: "/student/messages", icon: MessageCircle },
  { label: "Announcements", href: "/student/announcements", icon: Bell },
  { label: "My Profile", href: "/student/profile", icon: User },
  { label: "Teachers", href: "/student/teachers", icon: GraduationCap },
];

type Teacher = { id: string; name: string; role: string; subject: string; photoUrl: string | null };

function initials(name: string) {
  return (
    name
      .split(" ")
      .map((n) => n[0])
      .filter(Boolean)
      .slice(0, 2)
      .join("")
      .toUpperCase() || "?"
  );
}

function TeacherCard({ t, form }: { t: Teacher; form?: boolean }) {
  return (
    <div
      className={`p-6 rounded-2xl bg-[var(--surface-card)] border ${form ? "border-brand-orange/30" : "border-[var(--border-subtle)]"} shadow-[var(--card-shadow)] hover:border-brand-green/40 hover:-translate-y-0.5 transition-all`}
    >
      <div className="flex items-start gap-4">
        <div className="w-16 h-16 rounded-2xl overflow-hidden bg-gradient-to-br from-brand-green to-brand-green-dark flex items-center justify-center text-white font-display text-lg shrink-0">
          {t.photoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={t.photoUrl} alt={t.name} className="h-full w-full object-cover" />
          ) : (
            <span>{initials(t.name)}</span>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-bold text-[var(--text-primary)] mb-1">{t.name}</h3>
          <div
            className={`text-xs font-bold mb-2 ${form ? "text-brand-orange" : "text-brand-green"}`}
          >
            {t.role || (form ? "Form Teacher" : "Subject Teacher")}
          </div>
          {t.subject && (
            <span
              className={`inline-flex items-center gap-1 text-[10px] px-2 py-1 rounded font-bold ${form ? "bg-brand-orange/10 text-brand-orange" : "bg-brand-green/10 text-brand-green"}`}
            >
              <BookOpen size={11} /> {t.subject}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

export default function TeachersDirectoryPage() {
  const { data, loading } = useApi<{ className: string | null; teachers: Teacher[] }>(
    "/api/student/teachers",
  );
  const all = data?.teachers ?? [];
  const formTeachers = all.filter(
    (t) => !t.subject || t.subject === "Class Teacher" || /form/i.test(t.role),
  );
  const subjectTeachers = all.filter(
    (t) => t.subject && t.subject !== "Class Teacher" && !/form/i.test(t.role),
  );

  return (
    <>
      <PortalTopbar title="My teachers" />
      <main className="bg-[var(--bg-primary)] min-h-screen theme-transition">
        <section className="pt-24 pb-10 bg-brand-navy px-6">
          <div className="mx-auto max-w-7xl">
            <h1 className="font-display text-4xl md:text-5xl tracking-widest text-white mb-2">
              MY <span className="text-brand-green">TEACHERS</span>
            </h1>
            <p className="text-white/60 text-sm">
              Faculty teaching your class{data?.className ? ` (${data.className})` : ""}.
            </p>
          </div>
        </section>

        <section className="py-10 px-6">
          <div className="mx-auto max-w-7xl flex flex-col lg:flex-row gap-8">
            <PortalSidebar portalName="Student" portalType="student" items={SIDEBAR_ITEMS} />

            <div className="flex-1 min-w-0 space-y-8">
              {loading ? (
                <LoadingState label="Loading your teachers…" />
              ) : all.length === 0 ? (
                <EmptyState
                  icon={<School size={28} />}
                  title="No teachers assigned yet"
                  message="Once the school office assigns subject teachers to your class, they will be listed here with their subjects."
                />
              ) : (
                <>
                  {!!formTeachers.length && (
                    <div>
                      <h2 className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-brand-orange mb-3">
                        <School size={14} /> Form Teacher
                      </h2>
                      <div className="grid md:grid-cols-2 gap-4">
                        {formTeachers.map((t) => (
                          <TeacherCard key={t.id} t={t} form />
                        ))}
                      </div>
                    </div>
                  )}
                  {!!subjectTeachers.length && (
                    <div>
                      <h2 className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-brand-green mb-3">
                        <BookOpen size={14} /> Subject Teachers
                      </h2>
                      <div className="grid md:grid-cols-2 gap-4">
                        {subjectTeachers.map((t) => (
                          <TeacherCard key={t.id} t={t} />
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </section>
      </main>
    </>
  );
}
