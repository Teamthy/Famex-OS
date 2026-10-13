"use client";

import PortalTopbar from "@/components/PortalTopbar";
import PortalSidebar from "@/components/PortalSidebar";
import {
  MessageCircle,
  LayoutDashboard,
  CalendarDays,
  FileText,
  User,
  Bell,
  Info,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";
import { useApi } from "@/lib/useApi";
import { EmptyState, LoadingState } from "@/components/DataStates";

const SIDEBAR_ITEMS = [
  { label: "Dashboard", href: "/student/dashboard", icon: LayoutDashboard },
  { label: "Attendance", href: "/student/attendance", icon: CalendarDays },
  { label: "Timetable", href: "/student/timetable", icon: CalendarDays },
  { label: "Report Cards", href: "/student/report-cards", icon: FileText },
  { label: "Messages", href: "/student/messages", icon: MessageCircle },
  { label: "Announcements", href: "/student/announcements", icon: Bell },
  { label: "My Profile", href: "/student/dashboard", icon: User },
];

const typeConfig = {
  success: { icon: CheckCircle2, color: "text-brand-green", bg: "bg-brand-green/10" },
  info: { icon: Info, color: "text-brand-orange", bg: "bg-brand-orange/10" },
  warning: { icon: AlertCircle, color: "text-red-500", bg: "bg-red-500/10" },
};

export default function StudentAnnouncementsPage() {
  const { data, loading } = useApi<{
    announcements: {
      id: string;
      title: string;
      body: string;
      kind: string;
      read: boolean;
      at: string;
    }[];
  }>("/api/student/announcements");
  const announcements = (data?.announcements ?? []).map((a) => ({
    id: a.id,
    type: "info" as const,
    title: a.title,
    time: new Date(a.at).toLocaleString("en", { month: "short", day: "numeric" }),
    desc: a.body,
    audience: "Students",
  }));

  return (
    <>
      <PortalTopbar />
      <main className="bg-[var(--bg-primary)] min-h-screen theme-transition">
        <section className="pt-32 pb-10 bg-brand-navy px-6">
          <div className="mx-auto max-w-7xl">
            <h1 className="font-display text-[42px] md:text-[56px] tracking-[3px] text-white mb-4">
              SCHOOL <span className="text-brand-green">ANNOUNCEMENTS</span>
            </h1>
            <p className="text-white/60">Stay updated with the latest news from Ykay College.</p>
          </div>
        </section>

        <section className="py-10 px-6">
          <div className="mx-auto max-w-7xl flex flex-col lg:flex-row gap-8">
            <PortalSidebar portalName="Student" portalType="student" items={SIDEBAR_ITEMS} />

            <div className="flex-1 min-w-0 space-y-4">
              {loading ? (
                <LoadingState label="Loading announcements…" />
              ) : announcements.length === 0 ? (
                <EmptyState
                  icon={<Bell size={28} />}
                  title="No announcements yet"
                  message="When your teachers or the school office post an announcement, it will appear here."
                />
              ) : (
                announcements.map((a) => {
                  const config = typeConfig[a.type as keyof typeof typeConfig];
                  return (
                    <div
                      key={a.id}
                      className="p-6 rounded-2xl bg-[var(--surface-card)] border border-[var(--border-subtle)] shadow-[var(--card-shadow)] hover:border-brand-green/30 transition-all"
                    >
                      <div className="flex items-start gap-4">
                        <div
                          className={`w-11 h-11 rounded-xl ${config.bg} ${config.color} flex items-center justify-center shrink-0`}
                        >
                          <config.icon size={20} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-4 mb-2">
                            <h3 className="font-display text-lg text-[var(--text-primary)]">
                              {a.title}
                            </h3>
                            <span className="text-[10px] text-[var(--text-muted)] shrink-0 uppercase tracking-widest">
                              {a.time}
                            </span>
                          </div>
                          <p className="text-sm text-[var(--text-secondary)] mb-3">{a.desc}</p>
                          <span className="inline-block text-[10px] px-2 py-0.5 rounded-full bg-[var(--surface-disabled)] text-[var(--text-muted)] font-bold uppercase tracking-widest">
                            {a.audience}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </section>
      </main>
    </>
  );
}
