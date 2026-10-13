"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useToast } from "@/components/Toast";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import {
  Award,
  BarChart3,
  BookOpen,
  GraduationCap,
  LoaderCircle,
  TrendingUp,
  Users,
  FileText,
  CheckCircle2,
  ArrowUpRight,
} from "lucide-react";

type CourseStats = {
  id: string;
  slug: string;
  title: string;
  tagline: string;
  level: string;
  moduleCount: number;
  totalDurationMinutes: number;
  totalEnrollments: number;
  completions: number;
  activeLearners: number;
  completionRate: number;
  avgProgress: number;
  certificatesIssued: number;
};

type RecentEnrollment = {
  studentName: string;
  studentEmail: string;
  courseTitle: string;
  courseSlug: string;
  enrolledAt: string;
  modulesCompleted: number;
};

type ExamStats = {
  id: string;
  title: string;
  subjectName: string;
  className: string;
  questionCount: number;
  attemptCount: number;
  avgScore: number | null;
  status: string;
};

type InstructorData = {
  instructor: { name: string; email: string; role: string; isTeacher: boolean };
  overview: {
    totalCourses: number;
    totalEnrollments: number;
    totalCompletions: number;
    totalCertificates: number;
    overallCompletionRate: number;
  };
  courses: CourseStats[];
  recentEnrollments: RecentEnrollment[];
  exams: ExamStats[];
};

type Tab = "overview" | "courses" | "students" | "exams";

function timeAgo(iso: string) {
  const seconds = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (seconds < 3600) return `${Math.max(1, Math.floor(seconds / 60))}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

export default function InstructorDashboard() {
  const { toast } = useToast();
  const [data, setData] = useState<InstructorData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>("overview");

  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/it/instructor", { cache: "no-store" });
      if (r.ok) setData(await r.json());
      else toast("Failed to load instructor data.", "error");
    } catch {
      toast("Network error.", "error");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return (
      <div className="grid min-h-screen place-items-center bg-[var(--bg-primary)]">
        <div className="flex flex-col items-center gap-3">
          <LoaderCircle className="animate-spin text-[var(--text-primary)]" size={32} />
          <p className="text-sm text-[var(--text-muted)]">Loading instructor dashboard...</p>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="grid min-h-screen place-items-center bg-[var(--bg-primary)]">
        <div className="text-center">
          <GraduationCap size={48} className="mx-auto mb-4 text-[var(--text-muted)]" />
          <h1 className="text-xl font-bold text-[var(--text-primary)]">
            Instructor access required
          </h1>
          <p className="mt-2 text-sm text-[var(--text-muted)]">
            You need a Teacher, HOD, or Admin role to access this page.
          </p>
          <Link
            href="/it-portal/dashboard"
            className="mt-4 inline-block text-sm font-bold text-[#4EC54D] hover:underline"
          >
            Go to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  const tabs: { key: Tab; label: string; icon: typeof BookOpen }[] = [
    { key: "overview", label: "Overview", icon: BarChart3 },
    { key: "courses", label: "Courses", icon: BookOpen },
    { key: "students", label: "Students", icon: Users },
    { key: "exams", label: "Exams", icon: FileText },
  ];

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] theme-transition">
      <Header />
      {/* Nav */}
      <header className="sticky top-0 z-50 border-b border-[var(--border-subtle)] bg-[var(--surface-card)] shadow-[var(--card-shadow)]">
        <div className="mx-auto flex h-[72px] max-w-[1340px] items-center gap-4 px-6">
          <Link href="/it-portal/dashboard" className="flex items-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#0F1F2E]">
              <GraduationCap size={22} className="text-[#4EC54D]" />
            </div>
            <div className="hidden sm:block">
              <div className="text-[13px] font-extrabold tracking-wider text-[var(--text-primary)]">
                YKAY
              </div>
              <div className="text-[9px] font-bold uppercase tracking-[0.2em] text-[#EA902E]">
                Instructor
              </div>
            </div>
          </Link>
          <div className="ml-auto flex items-center gap-3">
            <Link
              href="/it-portal/dashboard"
              className="rounded-full border border-[var(--border-default)] px-4 py-2 text-xs font-bold text-[var(--text-primary)] transition hover:bg-[var(--surface-disabled)]"
            >
              Learner View
            </Link>
            <Link
              href="/teacher/upload-questions"
              className="rounded-full bg-[#0F1F2E] px-4 py-2 text-xs font-bold text-white hover:bg-[#1a3148]"
            >
              Upload Questions
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1340px] px-6 py-8">
        {/* Welcome */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-[var(--text-primary)]">Instructor Dashboard</h1>
          <p className="mt-1 text-sm text-[var(--text-muted)]">
            Welcome back, {data.instructor.name}. Monitor your courses, students, and exam
            performance.
          </p>
        </div>

        {/* Overview stats */}
        <div className="mb-8 grid grid-cols-2 gap-4 lg:grid-cols-5">
          {[
            {
              label: "IT Courses",
              value: data.overview.totalCourses,
              icon: BookOpen,
              color: "#0F1F2E",
            },
            {
              label: "Total Enrollments",
              value: data.overview.totalEnrollments,
              icon: Users,
              color: "#4EC54D",
            },
            {
              label: "Completions",
              value: data.overview.totalCompletions,
              icon: CheckCircle2,
              color: "#6366f1",
            },
            {
              label: "Certificates",
              value: data.overview.totalCertificates,
              icon: Award,
              color: "#EA902E",
            },
            {
              label: "Completion Rate",
              value: `${data.overview.overallCompletionRate}%`,
              icon: TrendingUp,
              color: "#ef4444",
            },
          ].map((stat) => (
            <div
              key={stat.label}
              className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-card)] p-5 shadow-[var(--card-shadow)]"
            >
              <div className="flex items-center gap-3">
                <div
                  className="flex h-10 w-10 items-center justify-center rounded-lg"
                  style={{ backgroundColor: `${stat.color}10` }}
                >
                  <stat.icon size={20} style={{ color: stat.color }} />
                </div>
                <div>
                  <div className="text-2xl font-bold text-[var(--text-primary)]">{stat.value}</div>
                  <div className="text-[11px] font-medium text-[var(--text-muted)]">
                    {stat.label}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div className="mb-6 flex gap-0 border-b border-[var(--border-subtle)]">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`relative flex items-center gap-2 px-5 py-3 text-sm font-bold transition ${
                activeTab === tab.key
                  ? "text-[var(--text-primary)]"
                  : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
              }`}
            >
              <tab.icon size={16} /> {tab.label}
              {activeTab === tab.key && (
                <div className="absolute bottom-0 left-0 right-0 h-[3px] rounded-t-full bg-[#0F1F2E]" />
              )}
            </button>
          ))}
        </div>

        {/* Overview Tab */}
        {activeTab === "overview" && (
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Course performance */}
            <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-card)] p-6 shadow-[var(--card-shadow)]">
              <h3 className="mb-4 text-sm font-bold uppercase tracking-widest text-[var(--text-muted)]">
                Course Performance
              </h3>
              <div className="space-y-4">
                {data.courses.map((course) => (
                  <div key={course.id} className="flex items-center gap-4">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-bold text-[var(--text-primary)]">
                        {course.title}
                      </p>
                      <div className="mt-1 flex items-center gap-3 text-xs text-[var(--text-muted)]">
                        <span className="flex items-center gap-1">
                          <Users size={11} /> {course.totalEnrollments} enrolled
                        </span>
                        <span className="flex items-center gap-1">
                          <CheckCircle2 size={11} /> {course.completions} completed
                        </span>
                      </div>
                    </div>
                    <div className="text-right">
                      <div
                        className="text-lg font-bold"
                        style={{ color: course.completionRate >= 50 ? "#4EC54D" : "#EA902E" }}
                      >
                        {course.completionRate}%
                      </div>
                      <div className="text-[10px] text-[var(--text-muted)]">completion</div>
                    </div>
                  </div>
                ))}
                {data.courses.length === 0 && (
                  <p className="text-sm text-[var(--text-muted)]">No courses yet.</p>
                )}
              </div>
            </div>

            {/* Recent enrollments */}
            <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-card)] p-6 shadow-[var(--card-shadow)]">
              <h3 className="mb-4 text-sm font-bold uppercase tracking-widest text-[var(--text-muted)]">
                Recent Enrollments
              </h3>
              <div className="space-y-3 max-h-[400px] overflow-y-auto">
                {data.recentEnrollments.map((enrollment, idx) => (
                  <div
                    key={idx}
                    className="flex items-center gap-3 rounded-xl border border-[var(--border-subtle)] p-3"
                  >
                    <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-[#4EC54D]/10 text-xs font-bold text-[#4EC54D]">
                      {enrollment.studentName.charAt(0)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-bold text-[var(--text-primary)]">
                        {enrollment.studentName}
                      </p>
                      <p className="truncate text-[11px] text-[var(--text-muted)]">
                        {enrollment.courseTitle} · {timeAgo(enrollment.enrolledAt)}
                      </p>
                    </div>
                    <div className="text-right">
                      <span className="text-xs font-bold text-[var(--text-secondary)]">
                        {enrollment.modulesCompleted} modules
                      </span>
                    </div>
                  </div>
                ))}
                {data.recentEnrollments.length === 0 && (
                  <p className="text-sm text-[var(--text-muted)]">No enrollments yet.</p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Courses Tab */}
        {activeTab === "courses" && (
          <div className="space-y-4">
            {data.courses.map((course) => (
              <div
                key={course.id}
                className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-card)] p-6 shadow-[var(--card-shadow)]"
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-lg font-bold text-[var(--text-primary)]">
                        {course.title}
                      </h3>
                      <span className="rounded-full bg-[var(--surface-disabled)] px-2 py-0.5 text-[9px] font-bold uppercase text-[var(--text-secondary)]">
                        {course.level}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-[var(--text-muted)]">{course.tagline}</p>
                  </div>
                  <Link
                    href={`/it-portal/courses/${course.slug}`}
                    className="flex items-center gap-1 text-sm font-bold text-[#4EC54D] hover:underline"
                  >
                    View Course <ArrowUpRight size={14} />
                  </Link>
                </div>

                <div className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
                  {[
                    { label: "Modules", value: course.moduleCount },
                    {
                      label: "Duration",
                      value: `${Math.round(course.totalDurationMinutes / 60)}h`,
                    },
                    { label: "Enrolled", value: course.totalEnrollments },
                    { label: "Active", value: course.activeLearners },
                    { label: "Completed", value: course.completions },
                    { label: "Certificates", value: course.certificatesIssued },
                  ].map((stat) => (
                    <div key={stat.label} className="text-center">
                      <div className="text-xl font-bold text-[var(--text-primary)]">
                        {stat.value}
                      </div>
                      <div className="text-[10px] font-medium uppercase tracking-wider text-[var(--text-muted)]">
                        {stat.label}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Progress bar */}
                <div className="mt-4">
                  <div className="mb-1 flex justify-between text-xs">
                    <span className="text-[var(--text-muted)]">Average progress</span>
                    <span className="font-bold text-[var(--text-primary)]">
                      {course.avgProgress}%
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-[var(--surface-disabled)]">
                    <div
                      className="h-full rounded-full bg-[#4EC54D]"
                      style={{ width: `${course.avgProgress}%` }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Students Tab */}
        {activeTab === "students" && (
          <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-card)] shadow-[var(--card-shadow)]">
            <div className="border-b border-[var(--border-subtle)] px-6 py-4">
              <h3 className="text-sm font-bold uppercase tracking-widest text-[var(--text-muted)]">
                All Students ({data.recentEnrollments.length})
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-[var(--surface-disabled)] text-[10px] uppercase tracking-widest text-[var(--text-muted)]">
                  <tr>
                    <th className="px-6 py-3">Student</th>
                    <th className="px-6 py-3">Course</th>
                    <th className="px-6 py-3">Enrolled</th>
                    <th className="px-6 py-3">Progress</th>
                  </tr>
                </thead>
                <tbody>
                  {data.recentEnrollments.map((e, idx) => (
                    <tr key={idx} className="border-t border-[var(--border-subtle)]">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#0F1F2E] text-xs font-bold text-white">
                            {e.studentName.charAt(0)}
                          </div>
                          <div>
                            <p className="font-bold text-[var(--text-primary)]">{e.studentName}</p>
                            <p className="text-[11px] text-[var(--text-muted)]">{e.studentEmail}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <Link
                          href={`/it-portal/courses/${e.courseSlug}`}
                          className="font-medium text-[#4EC54D] hover:underline"
                        >
                          {e.courseTitle}
                        </Link>
                      </td>
                      <td className="px-6 py-4 text-[var(--text-muted)]">
                        {timeAgo(e.enrolledAt)}
                      </td>
                      <td className="px-6 py-4">
                        <span className="rounded-full bg-[#4EC54D]/10 px-2.5 py-1 text-xs font-bold text-[#4EC54D]">
                          {e.modulesCompleted} modules
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {data.recentEnrollments.length === 0 && (
                <div className="py-12 text-center text-sm text-[var(--text-muted)]">
                  No students enrolled yet.
                </div>
              )}
            </div>
          </div>
        )}

        {/* Exams Tab */}
        {activeTab === "exams" && (
          <div className="space-y-4">
            {data.exams.map((exam) => (
              <div
                key={exam.id}
                className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-card)] p-6 shadow-[var(--card-shadow)]"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-bold text-[var(--text-primary)]">{exam.title}</h3>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[9px] font-bold uppercase ${
                        exam.status === "PUBLISHED"
                          ? "bg-[#4EC54D]/10 text-[#4EC54D]"
                          : "bg-[var(--surface-disabled)] text-[var(--text-muted)]"
                      }`}
                    >
                      {exam.status}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-[var(--text-muted)]">
                    {exam.subjectName} · {exam.className}
                  </p>
                </div>
                <div className="flex items-center gap-6">
                  <div className="text-center">
                    <div className="text-lg font-bold text-[var(--text-primary)]">
                      {exam.questionCount}
                    </div>
                    <div className="text-[10px] text-[var(--text-muted)]">Questions</div>
                  </div>
                  <div className="text-center">
                    <div className="text-lg font-bold text-[var(--text-primary)]">
                      {exam.attemptCount}
                    </div>
                    <div className="text-[10px] text-[var(--text-muted)]">Attempts</div>
                  </div>
                  <div className="text-center">
                    <div
                      className="text-lg font-bold"
                      style={{ color: (exam.avgScore ?? 0) >= 50 ? "#4EC54D" : "#EA902E" }}
                    >
                      {exam.avgScore !== null ? `${exam.avgScore}%` : "—"}
                    </div>
                    <div className="text-[10px] text-[var(--text-muted)]">Avg Score</div>
                  </div>
                </div>
              </div>
            ))}
            {data.exams.length === 0 && (
              <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-card)] py-12 text-center">
                <FileText size={40} className="mx-auto mb-3 text-[var(--text-muted)]" />
                <p className="text-sm text-[var(--text-muted)]">No exams created yet.</p>
                <Link
                  href="/teacher/exam-center"
                  className="mt-4 inline-block rounded-full bg-[#0F1F2E] px-6 py-2.5 text-sm font-bold text-white hover:bg-[#1a3148]"
                >
                  Create Exam
                </Link>
              </div>
            )}
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
}
