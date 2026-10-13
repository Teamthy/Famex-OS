"use client";

import PortalTopbar from "@/components/PortalTopbar";
import TeacherSidebar from "@/components/TeacherSidebar";
import { useApi } from "@/lib/useApi";
import {
  FileText,
  Calendar,
  Clock,
  Users,
  BookOpen,
  Award,
  TrendingUp,
  ClipboardCheck,
  Download,
} from "lucide-react";

const RECORDS = [
  {
    type: "Attendance",
    action: "Marked attendance for JSS1A",
    date: "Jul 21, 2025",
    time: "8:12 AM",
    status: "Submitted",
    detail: "38/40 present",
  },
  {
    type: "Grades",
    action: "Entered CA1 scores for Mathematics SS2A",
    date: "Jul 20, 2025",
    time: "3:45 PM",
    status: "Saved",
    detail: "32 students",
  },
  {
    type: "Exam",
    action: "Created Physics Mid-Term for SS2B",
    date: "Jul 18, 2025",
    time: "2:30 PM",
    status: "Scheduled",
    detail: "25 questions · 30 min",
  },
  {
    type: "Report Card",
    action: "Added remarks for SS2A students",
    date: "Jul 15, 2025",
    time: "4:00 PM",
    status: "Pending Review",
    detail: "28/32 done",
  },
  {
    type: "Attendance",
    action: "Marked attendance for SS2A",
    date: "Jul 15, 2025",
    time: "8:05 AM",
    status: "Submitted",
    detail: "30/32 present",
  },
  {
    type: "Questions",
    action: "Uploaded 20 Mathematics questions",
    date: "Jul 12, 2025",
    time: "11:00 AM",
    status: "Approved",
    detail: "DOCX upload",
  },
  {
    type: "Message",
    action: "Sent results to parents of SS2A",
    date: "Jul 10, 2025",
    time: "5:15 PM",
    status: "Delivered",
    detail: "30 parents",
  },
  {
    type: "Broadcast",
    action: "Posted class announcement",
    date: "Jul 8, 2025",
    time: "10:30 AM",
    status: "Delivered",
    detail: "PTM reminder",
  },
];

const TYPE_ICONS: Record<string, typeof FileText> = {
  Attendance: ClipboardCheck,
  Grades: BookOpen,
  Exam: Award,
  "Report Card": FileText,
  Questions: FileText,
  Message: Users,
  Broadcast: Users,
};

export default function MyRecordsPage() {
  const { loading: _apiLoading, error: _apiError } = useApi<any>("/api/teacher/profile");

  return (
    <>
      <PortalTopbar />
      <main className="bg-[var(--bg-primary)] min-h-screen theme-transition">
        <section className="pt-24 pb-10 bg-brand-navy px-6">
          <div className="mx-auto max-w-7xl">
            <h1 className="font-display text-4xl md:text-5xl tracking-widest text-white mb-2">
              MY <span className="text-brand-green">RECORDS</span>
            </h1>
            <p className="text-white/60 text-sm">
              Complete history of your actions and submissions.
            </p>
          </div>
        </section>

        <section className="py-10 px-6">
          <div className="mx-auto max-w-7xl flex flex-col lg:flex-row gap-8">
            <TeacherSidebar />

            <div className="flex-1 min-w-0 space-y-6">
              {/* Stats */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  { label: "Total Actions", value: RECORDS.length, icon: TrendingUp },
                  {
                    label: "Attendance Marks",
                    value: RECORDS.filter((r: any) => r.type === "Attendance").length,
                    icon: ClipboardCheck,
                  },
                  {
                    label: "Exams Created",
                    value: RECORDS.filter((r: any) => r.type === "Exam").length,
                    icon: Award,
                  },
                  {
                    label: "Messages Sent",
                    value: RECORDS.filter(
                      (r: any) => r.type === "Message" || r.type === "Broadcast",
                    ).length,
                    icon: Users,
                  },
                ].map((s) => (
                  <div
                    key={s.label}
                    className="p-4 rounded-2xl bg-[var(--surface-card)] border border-[var(--border-subtle)] shadow-[var(--card-shadow)]"
                  >
                    <s.icon className="text-brand-green mb-2" size={18} />
                    <div className="font-display text-2xl text-[var(--text-primary)]">
                      {s.value}
                    </div>
                    <div className="text-[10px] uppercase tracking-widest text-[var(--text-muted)]">
                      {s.label}
                    </div>
                  </div>
                ))}
              </div>

              {/* Export */}
              <div className="flex justify-end">
                <button className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-brand-green/10 text-brand-green text-sm font-bold hover:bg-brand-green hover:text-brand-navy transition-all">
                  <Download size={14} /> Export Records
                </button>
              </div>

              {/* Records List */}
              <div className="rounded-2xl bg-[var(--surface-card)] border border-[var(--border-subtle)] shadow-[var(--card-shadow)] overflow-hidden">
                <div className="divide-y divide-[var(--border-subtle)]">
                  {RECORDS.map((r: any, i: number) => {
                    const Icon = TYPE_ICONS[r.type] || FileText;
                    return (
                      <div
                        key={i}
                        className="p-5 flex items-start gap-4 hover:bg-[var(--surface-disabled)] transition-colors"
                      >
                        <div className="w-10 h-10 rounded-xl bg-brand-green/10 text-brand-green flex items-center justify-center shrink-0">
                          <Icon size={18} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-3 mb-1">
                            <div>
                              <div className="font-bold text-[var(--text-primary)] text-sm">
                                {r.action}
                              </div>
                              <div className="text-[11px] text-[var(--text-muted)] mt-0.5">
                                {r.detail}
                              </div>
                            </div>
                            <span
                              className={`text-[9px] px-2 py-0.5 rounded-full font-bold uppercase tracking-widest shrink-0 ${
                                r.status === "Submitted" ||
                                r.status === "Delivered" ||
                                r.status === "Approved"
                                  ? "bg-brand-green/10 text-brand-green"
                                  : r.status === "Saved" || r.status === "Scheduled"
                                    ? "bg-blue-500/10 text-blue-500"
                                    : "bg-brand-orange/10 text-brand-orange"
                              }`}
                            >
                              {r.status}
                            </span>
                          </div>
                          <div className="flex items-center gap-3 text-[10px] text-[var(--text-muted)]">
                            <span className="flex items-center gap-1">
                              <Calendar size={10} /> {r.date}
                            </span>
                            <span className="flex items-center gap-1">
                              <Clock size={10} /> {r.time}
                            </span>
                            <span className="px-1.5 py-0.5 rounded bg-[var(--surface-disabled)] text-[var(--text-muted)] font-bold">
                              {r.type}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>
    </>
  );
}
