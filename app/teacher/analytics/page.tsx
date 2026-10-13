"use client";

import { useState } from "react";
import PortalTopbar from "@/components/PortalTopbar";
import TeacherSidebar from "@/components/TeacherSidebar";
import { useApi } from "@/lib/useApi";
import {
  BarChart3,
  TrendingUp,
  TrendingDown,
  Users,
  Award,
  Target,
  Activity,
  Zap,
  Download,
} from "lucide-react";

export default function TeacherAnalyticsPage() {
  const { data, loading: _apiLoading, error: _apiError } = useApi<any>("/api/teacher/profile");
  const teacher = data?.teacher || ({} as any);
  const [selectedSubject, setSelectedSubject] = useState(
    (teacher.subjectAssignments || [])[0]?.subject || "",
  );

  // Mock analytics data
  const performanceTrend = [
    { period: "CA1", avg: 68 },
    { period: "CA2", avg: 72 },
    { period: "Mid-Term", avg: 75 },
    { period: "Test", avg: 78 },
    { period: "Assignment", avg: 82 },
    { period: "Exam", avg: 76 },
  ];

  const gradeDistribution = [
    { grade: "A1", count: 12, percent: 25 },
    { grade: "B2", count: 15, percent: 31 },
    { grade: "B3", count: 10, percent: 21 },
    { grade: "C4", count: 6, percent: 12 },
    { grade: "C5", count: 3, percent: 6 },
    { grade: "D7", count: 2, percent: 4 },
    { grade: "F9", count: 0, percent: 0 },
  ];

  const classPerformance = [
    { class: "SS2A", students: 32, avgScore: 78, top: "Emmanuel Adebayo", trend: "up" },
    { class: "SS2B", students: 28, avgScore: 72, top: "Fatima Yusuf", trend: "up" },
    { class: "SS1A", students: 30, avgScore: 68, top: "Blessing Eze", trend: "down" },
    { class: "JSS1A", students: 28, avgScore: 82, top: "Adeola Ogunlade", trend: "up" },
    { class: "JSS2A", students: 26, avgScore: 74, top: "David Okoye", trend: "up" },
  ];

  const maxBarHeight = Math.max(...performanceTrend.map((p) => p.avg));

  return (
    <>
      <PortalTopbar />
      <main className="bg-[var(--bg-primary)] min-h-screen theme-transition">
        <section className="pt-24 pb-10 bg-brand-navy px-6">
          <div className="mx-auto max-w-7xl">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-brand-green/20 border border-brand-green/40 text-brand-green text-[10px] font-bold uppercase tracking-widest mb-3">
              <BarChart3 size={11} /> Teaching Analytics
            </span>
            <h1 className="font-display text-4xl md:text-5xl tracking-widest text-white mb-2">
              MY <span className="text-brand-green">ANALYTICS</span>
            </h1>
            <p className="text-white/60 text-sm">
              Track student performance, identify trends, and optimize teaching strategies.
            </p>
          </div>
        </section>

        <section className="py-10 px-6">
          <div className="mx-auto max-w-7xl flex flex-col lg:flex-row gap-8">
            <TeacherSidebar />

            <div className="flex-1 min-w-0 space-y-6">
              {/* Filter Bar */}
              <div className="flex flex-wrap items-center gap-3">
                <select
                  value={selectedSubject}
                  onChange={(e) => setSelectedSubject(e.target.value)}
                  className="px-5 py-2.5 rounded-full bg-[var(--input-bg)] border border-[var(--input-border)] text-[var(--input-text)] text-sm focus:outline-none focus:border-brand-green"
                >
                  {(teacher.subjectAssignments || []).map((sa: any) => (
                    <option key={sa.subject}>{sa.subject}</option>
                  ))}
                </select>
                <select className="px-5 py-2.5 rounded-full bg-[var(--input-bg)] border border-[var(--input-border)] text-[var(--input-text)] text-sm focus:outline-none focus:border-brand-green">
                  <option>First Term 2026/2027</option>
                  <option>Full Session</option>
                </select>
                <button className="ml-auto inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-brand-green text-brand-navy text-sm font-bold hover:bg-brand-green-dark transition-all">
                  <Download size={14} /> Export Report
                </button>
              </div>

              {/* Key Metrics */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  {
                    label: "Overall Avg",
                    value: "76%",
                    change: "+4%",
                    trend: "up",
                    icon: Target,
                    color: "text-brand-green",
                  },
                  {
                    label: "Total Students",
                    value: teacher.totalStudentsTaught,
                    change: "+8",
                    trend: "up",
                    icon: Users,
                    color: "text-brand-orange",
                  },
                  {
                    label: "Pass Rate",
                    value: "89%",
                    change: "+3%",
                    trend: "up",
                    icon: Award,
                    color: "text-brand-green",
                  },
                  {
                    label: "Tests Conducted",
                    value: 24,
                    change: "+6",
                    trend: "up",
                    icon: Activity,
                    color: "text-blue-500",
                  },
                ].map((s) => (
                  <div
                    key={s.label}
                    className="p-5 rounded-2xl bg-[var(--surface-card)] border border-[var(--border-subtle)] shadow-[var(--card-shadow)]"
                  >
                    <div
                      className={`w-10 h-10 rounded-xl bg-brand-green/10 flex items-center justify-center mb-3 ${s.color}`}
                    >
                      <s.icon size={18} />
                    </div>
                    <div className="font-display text-3xl text-[var(--text-primary)]">
                      {s.value}
                    </div>
                    <div className="text-[10px] uppercase tracking-widest text-[var(--text-muted)] mb-2">
                      {s.label}
                    </div>
                    <div
                      className={`flex items-center gap-1 text-xs ${s.trend === "up" ? "text-brand-green" : "text-red-500"}`}
                    >
                      {s.trend === "up" ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
                      <strong>{s.change}</strong> vs last term
                    </div>
                  </div>
                ))}
              </div>

              {/* Performance Trend Chart */}
              <div className="rounded-2xl bg-[var(--surface-card)] border border-[var(--border-subtle)] p-6 shadow-[var(--card-shadow)]">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h3 className="font-display text-lg text-[var(--text-primary)]">
                      Performance Trend
                    </h3>
                    <p className="text-xs text-[var(--text-muted)]">
                      Average scores across assessments — {selectedSubject}
                    </p>
                  </div>
                  <TrendingUp className="text-brand-green" size={20} />
                </div>

                <div className="flex items-end justify-between gap-2 h-64 pt-8">
                  {performanceTrend.map((p) => (
                    <div key={p.period} className="flex-1 flex flex-col items-center gap-2">
                      <div className="text-xs font-bold text-brand-green">{p.avg}%</div>
                      <div
                        className="w-full rounded-t-lg bg-gradient-to-t from-brand-green to-brand-green/60 transition-all hover:from-brand-green-dark hover:to-brand-green"
                        style={{ height: `${(p.avg / maxBarHeight) * 100}%` }}
                      />
                      <div className="text-[10px] uppercase tracking-widest text-[var(--text-muted)]">
                        {p.period}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Grade Distribution */}
              <div className="rounded-2xl bg-[var(--surface-card)] border border-[var(--border-subtle)] p-6 shadow-[var(--card-shadow)]">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h3 className="font-display text-lg text-[var(--text-primary)]">
                      Grade Distribution
                    </h3>
                    <p className="text-xs text-[var(--text-muted)]">
                      How students are performing across grade bands
                    </p>
                  </div>
                  <Award className="text-brand-orange" size={20} />
                </div>

                <div className="space-y-3">
                  {gradeDistribution.map((g) => {
                    const color = g.grade.startsWith("A")
                      ? "brand-green"
                      : g.grade.startsWith("B")
                        ? "blue-500"
                        : g.grade.startsWith("C")
                          ? "brand-orange"
                          : "red-500";
                    return (
                      <div key={g.grade}>
                        <div className="flex items-center justify-between mb-1.5">
                          <div className="flex items-center gap-3">
                            <span className={`text-xs font-bold text-${color} w-8`}>{g.grade}</span>
                            <span className="text-xs text-[var(--text-muted)]">
                              {g.count} students
                            </span>
                          </div>
                          <span className="text-xs font-bold text-[var(--text-primary)]">
                            {g.percent}%
                          </span>
                        </div>
                        <div className="w-full h-6 rounded-lg bg-[var(--surface-disabled)] overflow-hidden">
                          <div
                            className={`h-full bg-${color} transition-all flex items-center justify-end pr-2`}
                            style={{ width: `${g.percent}%` }}
                          >
                            {g.percent > 8 && (
                              <span className="text-[9px] font-bold text-white">{g.count}</span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Class Performance Comparison */}
              <div className="rounded-2xl bg-[var(--surface-card)] border border-[var(--border-subtle)] p-6 shadow-[var(--card-shadow)]">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h3 className="font-display text-lg text-[var(--text-primary)]">
                      Class Performance
                    </h3>
                    <p className="text-xs text-[var(--text-muted)]">
                      Compare average scores across your classes
                    </p>
                  </div>
                  <BarChart3 className="text-blue-500" size={20} />
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-[var(--border-subtle)]">
                        <th className="text-left px-3 py-2 text-[10px] uppercase tracking-widest text-[var(--text-muted)] font-bold">
                          Class
                        </th>
                        <th className="text-center px-3 py-2 text-[10px] uppercase tracking-widest text-[var(--text-muted)] font-bold">
                          Students
                        </th>
                        <th className="text-center px-3 py-2 text-[10px] uppercase tracking-widest text-[var(--text-muted)] font-bold">
                          Avg Score
                        </th>
                        <th className="text-center px-3 py-2 text-[10px] uppercase tracking-widest text-[var(--text-muted)] font-bold">
                          Trend
                        </th>
                        <th className="text-left px-3 py-2 text-[10px] uppercase tracking-widest text-[var(--text-muted)] font-bold">
                          Top Student
                        </th>
                        <th className="text-left px-3 py-2 text-[10px] uppercase tracking-widest text-[var(--text-muted)] font-bold">
                          Performance
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {classPerformance.map((c: any) => (
                        <tr
                          key={c.class}
                          className="border-b border-[var(--border-subtle)] hover:bg-[var(--surface-disabled)]"
                        >
                          <td className="px-3 py-3 font-bold text-[var(--text-primary)]">
                            {c.class}
                          </td>
                          <td className="px-3 py-3 text-center text-[var(--text-secondary)]">
                            {c.students}
                          </td>
                          <td className="px-3 py-3 text-center">
                            <span
                              className={`inline-block px-2 py-0.5 rounded-full text-xs font-bold ${c.avgScore >= 75 ? "bg-brand-green/10 text-brand-green" : c.avgScore >= 60 ? "bg-brand-orange/10 text-brand-orange" : "bg-red-500/10 text-red-500"}`}
                            >
                              {c.avgScore}%
                            </span>
                          </td>
                          <td className="px-3 py-3 text-center">
                            {c.trend === "up" ? (
                              <TrendingUp className="mx-auto text-brand-green" size={14} />
                            ) : (
                              <TrendingDown className="mx-auto text-red-500" size={14} />
                            )}
                          </td>
                          <td className="px-3 py-3 text-xs text-[var(--text-secondary)]">
                            {c.top}
                          </td>
                          <td className="px-3 py-3">
                            <div className="w-32 h-2 rounded-full bg-[var(--surface-disabled)] overflow-hidden">
                              <div
                                className={
                                  c.avgScore >= 75
                                    ? "bg-brand-green h-full"
                                    : c.avgScore >= 60
                                      ? "bg-brand-orange h-full"
                                      : "bg-red-500 h-full"
                                }
                                style={{ width: `${c.avgScore}%` }}
                              />
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Insights */}
              <div className="rounded-2xl bg-gradient-to-br from-brand-navy to-brand-navy-light p-6 text-white">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-xl bg-brand-green/20 flex items-center justify-center">
                    <Zap className="text-brand-green" size={18} />
                  </div>
                  <div>
                    <h3 className="font-display text-lg">AI-Powered Insights</h3>
                    <p className="text-xs text-white/60">
                      Based on your teaching patterns and student data
                    </p>
                  </div>
                </div>

                <div className="space-y-3">
                  {[
                    {
                      text: "SS2A is your top performing class with an average of 78%. Consider using their teaching methodology for other classes.",
                      type: "success",
                    },
                    {
                      text: "Grade C4 has 12% of students. 3 students in SS1A may need extra tutoring in quadratic equations.",
                      type: "warning",
                    },
                    {
                      text: "Assignment scores are consistently higher than exam scores. Consider more exam practice sessions.",
                      type: "info",
                    },
                    {
                      text: "Physics classes are trending upward. JSS1A shows the strongest improvement (+8% from last term).",
                      type: "success",
                    },
                  ].map((i, idx) => (
                    <div
                      key={idx}
                      className={`flex items-start gap-3 p-3 rounded-xl ${i.type === "success" ? "bg-brand-green/10 border border-brand-green/20" : i.type === "warning" ? "bg-brand-orange/10 border border-brand-orange/20" : "bg-blue-500/10 border border-blue-500/20"}`}
                    >
                      <div
                        className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${i.type === "success" ? "bg-brand-green" : i.type === "warning" ? "bg-brand-orange" : "bg-blue-500"}`}
                      />
                      <p className="text-sm text-white/90">{i.text}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>
    </>
  );
}
