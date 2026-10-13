"use client";

import { useState } from "react";
import Link from "next/link";
import PortalTopbar from "@/components/PortalTopbar";
import TeacherSidebar from "@/components/TeacherSidebar";
import { useApi } from "@/lib/useApi";
import {
  TrendingUp,
  BookOpen,
  ChevronDown,
  ChevronUp,
  Users,
  Plus,
  Download,
  Edit3,
} from "lucide-react";

interface StudentScore {
  id: string;
  name: string;
  ca1: number | null;
  ca2: number | null;
  test: number | null;
  exam: number | null;
  total: number | null;
  comment: string;
}

const SAMPLE_SCORES: Record<string, StudentScore[]> = {
  "SS2A-Mathematics": [
    {
      id: "1",
      name: "Emmanuel Adebayo",
      ca1: 8,
      ca2: 9,
      test: 18,
      exam: 52,
      total: 87,
      comment: "Excellent",
    },
    {
      id: "2",
      name: "Blessing Eze",
      ca1: 6,
      ca2: 7,
      test: 14,
      exam: 38,
      total: 65,
      comment: "Good",
    },
    {
      id: "3",
      name: "Chinedu Okoro",
      ca1: 4,
      ca2: 5,
      test: 10,
      exam: 22,
      total: 41,
      comment: "Needs improvement",
    },
    {
      id: "4",
      name: "Fatima Yusuf",
      ca1: 9,
      ca2: 9,
      test: 19,
      exam: 55,
      total: 92,
      comment: "Outstanding",
    },
    {
      id: "5",
      name: "David Okoye",
      ca1: 7,
      ca2: 8,
      test: 15,
      exam: 44,
      total: 74,
      comment: "Very good",
    },
  ],
  "SS2A-Physics": [
    {
      id: "1",
      name: "Emmanuel Adebayo",
      ca1: 7,
      ca2: 8,
      test: 17,
      exam: 48,
      total: 80,
      comment: "Excellent",
    },
    {
      id: "2",
      name: "Blessing Eze",
      ca1: 5,
      ca2: 6,
      test: 12,
      exam: 31,
      total: 54,
      comment: "Credit",
    },
    {
      id: "3",
      name: "Chinedu Okoro",
      ca1: null,
      ca2: null,
      test: null,
      exam: null,
      total: null,
      comment: "",
    },
    {
      id: "4",
      name: "Fatima Yusuf",
      ca1: 8,
      ca2: 9,
      test: 18,
      exam: 50,
      total: 85,
      comment: "Very good",
    },
  ],
};

export default function PerformancePage() {
  const { data, loading: _apiLoading, error: _apiError } = useApi<any>("/api/teacher/profile");
  const teacher = data?.teacher || ({} as any);
  const [expandedClass, setExpandedClass] = useState<string | null>("SS2A");
  const [term] = useState("First Term 2026/2027");

  return (
    <>
      <PortalTopbar />
      <main className="bg-[var(--bg-primary)] min-h-screen theme-transition">
        <section className="pt-24 pb-10 bg-brand-navy px-6">
          <div className="mx-auto max-w-7xl">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-brand-green/20 border border-brand-green/40 text-brand-green text-[10px] font-bold uppercase tracking-widest mb-3">
              <BookOpen size={11} /> Subject Teacher
            </span>
            <h1 className="font-display text-4xl md:text-5xl tracking-widest text-white mb-2">
              PERFORMANCE <span className="text-brand-green">RECORDS</span>
            </h1>
            <p className="text-white/60 text-sm">
              {term} · All your subjects across assigned classes.
            </p>
          </div>
        </section>

        <section className="py-10 px-6">
          <div className="mx-auto max-w-7xl flex flex-col lg:flex-row gap-8">
            <TeacherSidebar />

            <div className="flex-1 min-w-0 space-y-6">
              {/* Header banner */}
              <div className="p-8 rounded-[2rem] bg-gradient-to-br from-brand-green to-brand-green-dark text-white text-center">
                <div className="inline-block px-3 py-1 rounded-full bg-white/20 text-[10px] font-bold uppercase tracking-widest mb-4">
                  <TrendingUp size={11} className="inline mr-1" /> {term}
                </div>
                <div className="w-16 h-16 rounded-full bg-white/20 flex items-center justify-center mx-auto mb-4">
                  <TrendingUp size={28} className="text-white" />
                </div>
                <h2 className="font-display text-3xl mb-2">Performance Records</h2>
                <p className="text-white/80 text-sm">
                  Track and manage student performance across all your subjects
                </p>
              </div>

              {/* Actions Bar */}
              <div className="flex flex-wrap items-center gap-3">
                <Link
                  href="/teacher/performance/add"
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-brand-green text-brand-navy text-sm font-bold hover:bg-brand-green-dark transition-all shadow-lg"
                >
                  <Plus size={14} /> Add Performance
                </Link>
                <button className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-[var(--surface-disabled)] text-[var(--text-primary)] text-sm font-bold hover:bg-brand-green hover:text-brand-navy transition-all">
                  <Download size={14} /> Export Excel
                </button>
                <select className="ml-auto px-4 py-2.5 rounded-full bg-[var(--input-bg)] border border-[var(--input-border)] text-[var(--input-text)] text-sm focus:outline-none focus:border-brand-green">
                  <option>First Term 2026/2027</option>
                  <option>Second Term 2026/2027</option>
                  <option>Third Term 2026/2027</option>
                </select>
              </div>

              {/* Class Groups */}
              {(teacher.subjectAssignments || []).map((sa: any) =>
                sa.classes.map((className: any) => {
                  const key = `${className}-${sa.subject}`;
                  const scores = SAMPLE_SCORES[key] || [];
                  const isExpanded = expandedClass === className;
                  const subjectsForClass = (teacher.subjectAssignments || []).filter((s: any) =>
                    s.classes.includes(className),
                  );

                  return (
                    <div
                      key={key}
                      className="rounded-2xl bg-[var(--surface-card)] border border-[var(--border-subtle)] shadow-[var(--card-shadow)] overflow-hidden"
                    >
                      <button
                        onClick={() => setExpandedClass(isExpanded ? null : className)}
                        className="w-full p-6 flex items-center justify-between hover:bg-[var(--surface-disabled)] transition-colors"
                      >
                        <div className="flex items-center gap-4">
                          <div className="w-11 h-11 rounded-xl bg-brand-green/10 text-brand-green flex items-center justify-center">
                            <Users size={20} />
                          </div>
                          <div className="text-left">
                            <div className="font-display text-lg text-[var(--text-primary)]">
                              Class: {className}
                            </div>
                            <div className="text-xs text-[var(--text-muted)]">
                              {subjectsForClass.length} subject
                              {subjectsForClass.length !== 1 ? "s" : ""} you teach here
                            </div>
                          </div>
                        </div>
                        <div className="text-[var(--text-muted)]">
                          {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                        </div>
                      </button>

                      {isExpanded && (
                        <div className="border-t border-[var(--border-subtle)]">
                          <div className="p-6">
                            {/* Subject Header */}
                            <div className="flex items-center justify-between mb-4 p-4 rounded-xl bg-brand-green/5">
                              <div className="flex items-center gap-3">
                                <BookOpen className="text-brand-green" size={18} />
                                <span className="font-bold text-[var(--text-primary)]">
                                  {sa.subject}
                                </span>
                              </div>
                              <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-brand-green text-brand-navy font-bold uppercase tracking-widest">
                                <Users size={9} className="inline mr-1" /> {scores.length} students
                              </span>
                            </div>

                            {/* Scores Table */}
                            <div className="overflow-x-auto">
                              <table className="w-full text-sm">
                                <thead>
                                  <tr className="border-b border-[var(--border-subtle)]">
                                    <th className="text-left px-3 py-2 text-[10px] uppercase tracking-widest text-[var(--text-muted)] font-bold">
                                      Student
                                    </th>
                                    <th className="text-center px-3 py-2 text-[10px] uppercase tracking-widest text-[var(--text-muted)] font-bold">
                                      CA1
                                    </th>
                                    <th className="text-center px-3 py-2 text-[10px] uppercase tracking-widest text-[var(--text-muted)] font-bold">
                                      CA2
                                    </th>
                                    <th className="text-center px-3 py-2 text-[10px] uppercase tracking-widest text-[var(--text-muted)] font-bold">
                                      Test
                                    </th>
                                    <th className="text-center px-3 py-2 text-[10px] uppercase tracking-widest text-[var(--text-muted)] font-bold">
                                      Exam
                                    </th>
                                    <th className="text-center px-3 py-2 text-[10px] uppercase tracking-widest text-[var(--text-muted)] font-bold">
                                      Total
                                    </th>
                                    <th className="text-left px-3 py-2 text-[10px] uppercase tracking-widest text-[var(--text-muted)] font-bold">
                                      Comment
                                    </th>
                                    <th></th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {scores.map((s) => (
                                    <tr
                                      key={s.id}
                                      className="border-b border-[var(--border-subtle)] hover:bg-[var(--surface-disabled)]"
                                    >
                                      <td className="px-3 py-3 font-medium text-[var(--text-primary)]">
                                        {s.name}
                                      </td>
                                      <td className="px-3 py-3 text-center">
                                        <span
                                          className={`inline-block px-2 py-0.5 rounded text-xs font-bold ${s.ca1 !== null ? "bg-blue-500/10 text-blue-500" : "bg-purple-500/10 text-purple-400"}`}
                                        >
                                          {s.ca1 !== null ? s.ca1.toFixed(2) : "None"}
                                        </span>
                                      </td>
                                      <td className="px-3 py-3 text-center">
                                        <span
                                          className={`inline-block px-2 py-0.5 rounded text-xs font-bold ${s.ca2 !== null ? "bg-blue-500/10 text-blue-500" : "bg-purple-500/10 text-purple-400"}`}
                                        >
                                          {s.ca2 !== null ? s.ca2.toFixed(2) : "None"}
                                        </span>
                                      </td>
                                      <td className="px-3 py-3 text-center">
                                        <span
                                          className={`inline-block px-2 py-0.5 rounded text-xs font-bold ${s.test !== null ? "bg-blue-500/10 text-blue-500" : "bg-purple-500/10 text-purple-400"}`}
                                        >
                                          {s.test !== null ? s.test.toFixed(2) : "None"}
                                        </span>
                                      </td>
                                      <td className="px-3 py-3 text-center">
                                        <span
                                          className={`inline-block px-2 py-0.5 rounded text-xs font-bold ${s.exam !== null ? "bg-purple-500/10 text-purple-400" : "bg-gray-500/10 text-gray-400"}`}
                                        >
                                          {s.exam !== null ? s.exam.toFixed(2) : "None"}
                                        </span>
                                      </td>
                                      <td className="px-3 py-3 text-center">
                                        <span
                                          className={`inline-block px-2.5 py-1 rounded-full text-xs font-bold ${
                                            s.total === null
                                              ? "bg-gray-500/10 text-gray-400"
                                              : s.total >= 70
                                                ? "bg-brand-green/20 text-brand-green"
                                                : s.total >= 50
                                                  ? "bg-brand-orange/20 text-brand-orange"
                                                  : "bg-red-500/20 text-red-500"
                                          }`}
                                        >
                                          {s.total !== null ? s.total.toFixed(2) : "-"}
                                        </span>
                                      </td>
                                      <td className="px-3 py-3 text-xs text-[var(--text-muted)]">
                                        {s.comment || "-"}
                                      </td>
                                      <td className="px-3 py-3">
                                        <button className="p-1.5 rounded-lg bg-brand-green/10 text-brand-green hover:bg-brand-green hover:text-brand-navy transition-all">
                                          <Edit3 size={12} />
                                        </button>
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                }),
              )}
            </div>
          </div>
        </section>
      </main>
    </>
  );
}
