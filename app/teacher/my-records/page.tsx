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

/**
 * This page used to render a hard-coded RECORDS array — "Marked attendance for
 * JSS1A", "Jul 21, 2025" — while /api/teacher/my-records sat unreferenced and
 * returned the teacher's real history. Every teacher saw the same invented
 * July. The API is the record; this only formats it.
 */
type MyRecords = {
  teacher: { displayName: string; email: string };
  attendanceHistory: {
    date: string;
    className: string;
    present: number;
    absent: number;
    late: number;
    total: number;
    locked: boolean;
  }[];
  recentActions: { action: string; entityType: string; at: string }[];
};

/** Turn ACTION_CONSTANT into "Action constant" for a human to read. */
function humanise(action: string) {
  const words = action.toLowerCase().replaceAll("_", " ");
  return words.charAt(0).toUpperCase() + words.slice(1);
}

const TYPE_ICONS: Record<string, typeof FileText> = {
  attendance: ClipboardCheck,
  grade: BookOpen,
  exam: Award,
  question: FileText,
  message: Users,
  broadcast: Users,
  report: FileText,
};

export default function MyRecordsPage() {
  const { data, loading, error } = useApi<MyRecords>("/api/teacher/my-records");
  const records: MyRecords = data ?? {
    teacher: { displayName: "", email: "" },
    attendanceHistory: [],
    recentActions: [],
  };

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
              {error ? (
                <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-500">
                  {error}
                </div>
              ) : null}

              {loading ? (
                <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-card)] p-10 text-sm text-[var(--text-secondary)]">
                  Loading your records…
                </div>
              ) : null}

              {/* Stats, from the teacher's own history. */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  {
                    label: "Attendance taken",
                    value: records.attendanceHistory.length,
                    icon: ClipboardCheck,
                  },
                  {
                    label: "Students marked",
                    value: records.attendanceHistory.reduce((sum, r) => sum + r.total, 0),
                    icon: Users,
                  },
                  { label: "Recent actions", value: records.recentActions.length, icon: TrendingUp },
                  {
                    label: "Registers locked",
                    value: records.attendanceHistory.filter((r) => r.locked).length,
                    icon: Award,
                  },
                ].map((stat) => (
                  <div
                    key={stat.label}
                    className="p-4 rounded-2xl bg-[var(--surface-card)] border border-[var(--border-subtle)] shadow-[var(--card-shadow)]"
                  >
                    <stat.icon className="text-brand-green mb-2" size={18} />
                    <div className="font-display text-2xl text-[var(--text-primary)]">
                      {stat.value}
                    </div>
                    <div className="text-[10px] uppercase tracking-widest text-[var(--text-muted)]">
                      {stat.label}
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
                  {/* Registers taken, newest first — the thing a teacher is
                      most often asked to prove. */}
                  {records.attendanceHistory.map((r) => (
                    <div
                      key={`attendance-${r.date}-${r.className}`}
                      className="p-5 flex items-start gap-4 hover:bg-[var(--surface-disabled)] transition-colors"
                    >
                      <div className="w-10 h-10 rounded-xl bg-brand-green/10 text-brand-green flex items-center justify-center shrink-0">
                        <ClipboardCheck size={18} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-3 mb-1">
                          <div>
                            <div className="font-bold text-[var(--text-primary)] text-sm">
                              Marked attendance for {r.className}
                            </div>
                            <div className="text-[11px] text-[var(--text-muted)] mt-0.5">
                              {r.present} present · {r.absent} absent · {r.late} late of {r.total}
                            </div>
                          </div>
                          <span
                            className={`text-[9px] px-2 py-0.5 rounded-full font-bold uppercase tracking-widest shrink-0 ${
                              r.locked
                                ? "bg-brand-green/10 text-brand-green"
                                : "bg-brand-orange/10 text-brand-orange"
                            }`}
                          >
                            {r.locked ? "Locked" : "Open"}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 text-[10px] text-[var(--text-muted)]">
                          <span className="flex items-center gap-1">
                            <Calendar size={10} />
                            {new Date(r.date).toLocaleDateString(undefined, {
                              year: "numeric",
                              month: "short",
                              day: "numeric",
                            })}
                          </span>
                          <span className="px-1.5 py-0.5 rounded bg-[var(--surface-disabled)] text-[var(--text-muted)] font-bold">
                            Attendance
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}

                  {/* Then everything else the audit log recorded. */}
                  {records.recentActions.map((action, index) => {
                    const key = action.entityType?.toLowerCase() ?? "";
                    const Icon = TYPE_ICONS[key] ?? FileText;
                    return (
                      <div
                        key={`action-${action.at}-${index}`}
                        className="p-5 flex items-start gap-4 hover:bg-[var(--surface-disabled)] transition-colors"
                      >
                        <div className="w-10 h-10 rounded-xl bg-brand-green/10 text-brand-green flex items-center justify-center shrink-0">
                          <Icon size={18} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-bold text-[var(--text-primary)] text-sm">
                            {humanise(action.action)}
                          </div>
                          <div className="flex items-center gap-3 text-[10px] text-[var(--text-muted)] mt-1">
                            <span className="flex items-center gap-1">
                              <Calendar size={10} />
                              {new Date(action.at).toLocaleDateString(undefined, {
                                year: "numeric",
                                month: "short",
                                day: "numeric",
                              })}
                            </span>
                            <span className="flex items-center gap-1">
                              <Clock size={10} />
                              {new Date(action.at).toLocaleTimeString(undefined, {
                                hour: "numeric",
                                minute: "2-digit",
                              })}
                            </span>
                            {action.entityType ? (
                              <span className="px-1.5 py-0.5 rounded bg-[var(--surface-disabled)] text-[var(--text-muted)] font-bold">
                                {action.entityType}
                              </span>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    );
                  })}

                  {/* An empty history is a real answer. Saying so stops the
                      page looking broken on a teacher's first week. */}
                  {!loading &&
                  records.attendanceHistory.length === 0 &&
                  records.recentActions.length === 0 ? (
                    <div className="p-10 text-center text-sm text-[var(--text-muted)]">
                      No records yet. Registers you take and actions you make will appear here.
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>
    </>
  );
}
