"use client";

import Link from "next/link";
import { useState } from "react";
import PortalTopbar from "@/components/PortalTopbar";
import TeacherSidebar from "@/components/TeacherSidebar";
import { useApi } from "@/lib/useApi";
import { EmptyState, LoadingState } from "@/components/DataStates";
import {
  Search,
  Users,
  School,
  Award,
  TrendingUp,
  Phone,
  MessageSquare,
  BookOpen,
  AlertCircle,
} from "lucide-react";

export default function ClassRosterPage() {
  const { data, loading } = useApi<{
    teacher: { displayName: string };
    classes: { id: string; className: string }[];
    students: {
      id: string;
      studentId: string;
      displayName: string;
      className: string;
      gender?: string | null;
      guardianName?: string | null;
      guardianPhone?: string | null;
    }[];
  }>("/api/teacher/students");
  const teacher: any = {
    ...(data?.teacher ?? {}),
    formClass: data?.classes?.[0]?.className ?? "",
    formClassStudentCount: data?.students?.length ?? 0,
  };
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "excellent" | "good" | "attention">("all");

  const students = (data?.students ?? []).map((s) => ({
    id: s.id,
    studentId: s.studentId,
    name: s.displayName,
    // The API already returns gender and guardian details — the page was
    // discarding them and hardcoding em-dashes, so "Call Parent" dialled
    // literally nothing.
    gender: s.gender || "—",
    status: "Good",
    overallGrade: "—",
    attendanceRate: 0,
    behaviorScore: "—",
    guardianName: s.guardianName || "",
    parentContact: s.guardianPhone || "",
    photoUrl: "",
  }));

  const filtered = students.filter((s) => {
    const matchSearch = s.name.toLowerCase().includes(search.toLowerCase());
    const matchFilter =
      filter === "all" ||
      (filter === "excellent" && s.status === "Excellent") ||
      (filter === "good" && s.status === "Good") ||
      (filter === "attention" && s.status === "Needs Attention");
    return matchSearch && matchFilter;
  });

  const excellent = students.filter((s) => s.status === "Excellent").length;
  const good = students.filter((s) => s.status === "Good").length;
  const attention = students.filter((s) => s.status === "Needs Attention").length;

  return (
    <>
      <PortalTopbar />
      <main className="bg-[var(--bg-primary)] min-h-screen theme-transition">
        <section className="pt-24 pb-10 bg-brand-navy px-6">
          <div className="mx-auto max-w-7xl">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-brand-orange/20 border border-brand-orange/40 text-brand-orange text-[10px] font-bold uppercase tracking-widest mb-3">
              <School size={11} /> Form Teacher · {teacher.formClass}
            </span>
            <h1 className="font-display text-4xl md:text-5xl tracking-widest text-white mb-2">
              CLASS <span className="text-brand-orange">ROSTER</span>
            </h1>
            <p className="text-white/60 text-sm">
              All {teacher.formClassStudentCount} students in {teacher.formClass} under your care.
            </p>
          </div>
        </section>

        <section className="py-10 px-6">
          <div className="mx-auto max-w-7xl flex flex-col lg:flex-row gap-8">
            <TeacherSidebar />

            <div className="flex-1 min-w-0 space-y-6">
              {/* Stats */}
              <div className="grid grid-cols-4 gap-4">
                <div className="rounded-2xl bg-[var(--surface-card)] border border-[var(--border-subtle)] p-4">
                  <Users className="text-[var(--text-accent-warm)] mb-2" size={18} />
                  <div className="font-display text-2xl text-[var(--text-primary)]">
                    {teacher.formClassStudentCount}
                  </div>
                  <div className="text-[10px] uppercase tracking-widest text-[var(--text-muted)]">
                    Total
                  </div>
                </div>
                <div className="rounded-2xl bg-brand-green/10 border border-brand-green/30 p-4">
                  <Award className="text-brand-green mb-2" size={18} />
                  <div className="font-display text-2xl text-brand-green">{excellent}</div>
                  <div className="text-[10px] uppercase tracking-widest text-brand-green">
                    Excellent
                  </div>
                </div>
                <div className="rounded-2xl bg-blue-500/10 border border-blue-500/30 p-4">
                  <TrendingUp className="text-blue-500 mb-2" size={18} />
                  <div className="font-display text-2xl text-blue-500">{good}</div>
                  <div className="text-[10px] uppercase tracking-widest text-blue-500">Good</div>
                </div>
                <div className="rounded-2xl bg-red-500/10 border border-red-500/30 p-4">
                  <AlertCircle className="text-red-500 mb-2" size={18} />
                  <div className="font-display text-2xl text-red-500">{attention}</div>
                  <div className="text-[10px] uppercase tracking-widest text-red-500">
                    Attention
                  </div>
                </div>
              </div>

              {/* Filters */}
              <div className="flex flex-col md:flex-row gap-3">
                <div className="relative flex-1">
                  <Search
                    size={16}
                    className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--text-muted)]"
                  />
                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search students..."
                    className="w-full pl-11 pr-5 py-3 rounded-xl bg-[var(--input-bg)] border border-[var(--input-border)] text-[var(--input-text)] focus:outline-none focus:border-brand-orange"
                  />
                </div>
                <div className="flex gap-2">
                  {[
                    { key: "all", label: "All" },
                    { key: "excellent", label: "Excellent" },
                    { key: "good", label: "Good" },
                    { key: "attention", label: "Attention" },
                  ].map((f) => (
                    <button
                      key={f.key}
                      onClick={() => setFilter(f.key as any)}
                      className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                        filter === f.key
                          ? "bg-brand-orange text-white"
                          : "bg-[var(--surface-disabled)] text-[var(--text-muted)] hover:bg-brand-orange/10"
                      }`}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Student Cards */}
              <div className="grid md:grid-cols-2 gap-4">
                {filtered.map((s) => (
                  <div
                    key={s.id}
                    className="p-5 rounded-2xl bg-[var(--surface-card)] border border-[var(--border-subtle)] shadow-[var(--card-shadow)] hover:border-brand-orange/30 hover:-translate-y-0.5 transition-all"
                  >
                    <div className="flex items-start gap-4">
                      <img
                        src={s.photoUrl}
                        alt={s.name}
                        className="w-16 h-16 rounded-2xl object-cover border-2 border-[var(--border-subtle)]"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <h3 className="font-bold text-[var(--text-primary)] truncate">
                            {s.name}
                          </h3>
                          <span
                            className={`text-[9px] px-2 py-0.5 rounded-full font-bold uppercase tracking-widest shrink-0 ${
                              s.status === "Excellent"
                                ? "bg-brand-green/20 text-brand-green"
                                : s.status === "Good"
                                  ? "bg-blue-500/20 text-blue-500"
                                  : "bg-red-500/20 text-red-500"
                            }`}
                          >
                            {s.status}
                          </span>
                        </div>
                        <div className="text-[11px] text-[var(--text-muted)] mb-3">
                          {s.studentId} · {s.gender}
                        </div>

                        <div className="grid grid-cols-3 gap-2 mb-3">
                          <div className="text-center p-2 rounded-lg bg-[var(--surface-disabled)]">
                            <div className="text-[9px] uppercase text-[var(--text-muted)]">
                              Grade
                            </div>
                            <div
                              className={`font-display text-sm ${
                                s.overallGrade.startsWith("A")
                                  ? "text-brand-green"
                                  : s.overallGrade.startsWith("B")
                                    ? "text-blue-500"
                                    : "text-brand-orange"
                              }`}
                            >
                              {s.overallGrade}
                            </div>
                          </div>
                          <div className="text-center p-2 rounded-lg bg-[var(--surface-disabled)]">
                            <div className="text-[9px] uppercase text-[var(--text-muted)]">
                              Attend.
                            </div>
                            <div
                              className={`font-display text-sm ${s.attendanceRate >= 90 ? "text-brand-green" : s.attendanceRate >= 75 ? "text-brand-orange" : "text-red-500"}`}
                            >
                              {s.attendanceRate}%
                            </div>
                          </div>
                          <div className="text-center p-2 rounded-lg bg-[var(--surface-disabled)]">
                            <div className="text-[9px] uppercase text-[var(--text-muted)]">
                              Behavior
                            </div>
                            <div className="font-display text-sm text-[var(--text-primary)]">
                              {s.behaviorScore}
                            </div>
                          </div>
                        </div>

                        <div className="flex gap-2">
                          {/* tel: opens the dialler on mobile and the default
                              calling app on desktop. Disabled rather than
                              dead when no number is on record — a link that
                              silently does nothing is worse than a greyed one. */}
                          {s.parentContact ? (
                            <a
                              href={`tel:${s.parentContact.replace(/\s+/g, "")}`}
                              title={`Call ${s.guardianName || "parent"} on ${s.parentContact}`}
                              className="flex-1 inline-flex items-center justify-center gap-1 px-3 py-1.5 rounded-lg bg-brand-green/10 text-brand-green text-[10px] font-bold hover:bg-brand-green hover:text-brand-navy transition-all"
                            >
                              <Phone size={10} /> Call Parent
                            </a>
                          ) : (
                            <span
                              title="No guardian phone number on record"
                              className="flex-1 inline-flex cursor-not-allowed items-center justify-center gap-1 rounded-lg bg-[var(--surface-disabled)] px-3 py-1.5 text-[10px] font-bold text-[var(--text-disabled)]"
                            >
                              <Phone size={10} /> No number
                            </span>
                          )}
                          {/* Opens the real parent-teacher messaging thread for
                              this student, rather than being a button with no
                              onClick. */}
                          <Link
                            href={`/teacher/messages/compose?studentProfileId=${encodeURIComponent(s.id)}`}
                            className="flex-1 inline-flex items-center justify-center gap-1 px-3 py-1.5 rounded-lg bg-brand-orange/10 text-brand-orange text-[10px] font-bold hover:bg-brand-orange hover:text-brand-navy transition-all"
                          >
                            <MessageSquare size={10} /> Message
                          </Link>
                          {/* Not every student takes every subject — this is
                              where a form teacher records their electives. */}
                          <Link
                            href={`/teacher/students/subjects?studentProfileId=${encodeURIComponent(s.id)}`}
                            className="flex-1 inline-flex items-center justify-center gap-1 px-3 py-1.5 rounded-lg bg-brand-navy/10 text-[var(--text-secondary)] text-[10px] font-bold hover:bg-brand-navy hover:text-white transition-all"
                          >
                            <BookOpen size={10} /> Subjects
                          </Link>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {loading ? (
                <LoadingState label="Loading your class roster…" />
              ) : filtered.length === 0 ? (
                <EmptyState
                  icon={<Users size={28} />}
                  title="No students to show"
                  message="Either no students are enrolled in this class yet, or your search matched nothing. Clear the search to see the full roster."
                />
              ) : null}
            </div>
          </div>
        </section>
      </main>
    </>
  );
}
