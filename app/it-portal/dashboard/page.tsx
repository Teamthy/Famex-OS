"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { useToast } from "@/components/Toast";
import EnrolButton from "@/components/it/EnrolButton";
import {
  Award,
  BookOpen,
  Clock,
  PlayCircle,
  Search,
  TrendingUp,
  Trophy,
  Grid3X3,
  List,
} from "lucide-react";

type Course = {
  id: string;
  slug: string;
  title: string;
  tagline: string;
  level: string;
  certification: string;
  durationWeeks: number;
  moduleCount: number;
  enrolled: boolean;
  progressPercent: number;
  status: string | null;
  certificateNumber: string | null;
};

type DashboardData = {
  user: { name: string; email: string; role: string };
  summary: {
    enrolledCourses: number;
    completedCourses: number;
    certificatesEarned: number;
    averageProgress: number;
  };
  catalog: Course[];
  certificates: {
    certificateNumber: string;
    issuedAt: string;
    courseTitle: string;
    credential: string;
  }[];
};

type Tab = "all" | "in-progress" | "completed" | "not-started";

const COURSE_IMAGES: Record<string, string> = {
  python: "/python-hero.jpg",
  ai: "/ai-hero.jpg",
  cybersecurity: "/cybersecurity-hero.jpg",
  "digital-literacy": "/it-hub-classroom.jpg",
  "microsoft-word": "/microsoft-word-hero.jpg",
  "microsoft-excel": "/home/debate.jpg",
  "microsoft-powerpoint": "/it-hub-3.jpg",
  "excel-expert": "/excel-expert-hero.jpg",
};

export default function ItPortalDashboard() {
  const { toast } = useToast();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [view, setView] = useState<"grid" | "list">("grid");

  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/it/dashboard", { cache: "no-store" });
      if (r.ok) setData(await r.json());
      else toast("Failed to load dashboard.", "error");
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
      <>
        <Header />
        <main className="min-h-screen bg-[var(--bg-primary)] pt-28">
          <div className="mx-auto max-w-7xl px-6">
            <div className="h-10 w-72 rounded-lg bg-[var(--surface-disabled)] animate-pulse" />
            <div className="mt-4 h-5 w-96 rounded-lg bg-[var(--surface-disabled)] animate-pulse" />
            <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {[1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  className="h-24 rounded-2xl bg-[var(--surface-disabled)] animate-pulse"
                />
              ))}
            </div>
          </div>
        </main>
        <Footer />
      </>
    );
  }

  if (!data) {
    return (
      <>
        <Header />
        <main className="grid min-h-screen place-items-center bg-[var(--bg-primary)]">
          <div className="text-center">
            <BookOpen size={48} className="mx-auto mb-4 text-[var(--text-muted)]" />
            <h1 className="text-xl font-bold text-[var(--text-primary)]">
              Unable to load dashboard
            </h1>
            <Link
              href="/it-portal/auth"
              className="mt-4 inline-block text-sm font-bold text-brand-green hover:underline"
            >
              Sign in to continue
            </Link>
          </div>
        </main>
        <Footer />
      </>
    );
  }

  const enrolled = data.catalog.filter((c) => c.enrolled);
  const notEnrolled = data.catalog.filter((c) => !c.enrolled);

  const filteredCourses = (() => {
    let courses = enrolled;
    if (activeTab === "in-progress")
      courses = enrolled.filter(
        (c) => c.status === "ACTIVE" && c.progressPercent > 0 && c.progressPercent < 100,
      );
    if (activeTab === "completed") courses = enrolled.filter((c) => c.status === "COMPLETED");
    if (activeTab === "not-started") courses = enrolled.filter((c) => c.progressPercent === 0);
    if (searchQuery)
      courses = courses.filter((c) => c.title.toLowerCase().includes(searchQuery.toLowerCase()));
    return courses;
  })();

  const tabs: { key: Tab; label: string; count: number }[] = [
    { key: "all", label: "All Courses", count: enrolled.length },
    {
      key: "in-progress",
      label: "In Progress",
      count: enrolled.filter((c) => c.status === "ACTIVE" && c.progressPercent > 0).length,
    },
    {
      key: "completed",
      label: "Completed",
      count: enrolled.filter((c) => c.status === "COMPLETED").length,
    },
    {
      key: "not-started",
      label: "Not Started",
      count: enrolled.filter((c) => c.progressPercent === 0).length,
    },
  ];

  return (
    <>
      <Header />
      <main className="min-h-screen bg-[var(--bg-primary)] theme-transition">
        {/* Hero */}
        <section className="bg-brand-navy px-6 pt-28 pb-14">
          <div className="mx-auto max-w-7xl">
            <div className="flex items-center gap-3 mb-3">
              <img src="/ykay-logo.png" alt="Ykay" className="h-10 w-10 rounded-lg" />
              <span className="rounded-full bg-brand-green/20 border border-brand-green/40 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-brand-green">
                IT Learning Hub
              </span>
            </div>
            <h1 className="font-display text-4xl tracking-widest text-white md:text-5xl">
              MY <span className="text-brand-green">COURSES</span>
            </h1>
            <p className="mt-3 max-w-2xl text-sm text-white/60">
              Welcome back, {data.user.name}.{" "}
              {enrolled.length > 0
                ? `You have ${enrolled.filter((c) => c.status === "ACTIVE").length} course(s) in progress.`
                : "Start your IT learning journey — enroll in a course below."}
            </p>
          </div>
        </section>

        <section className="px-6 py-10">
          <div className="mx-auto max-w-7xl space-y-6">
            {/* Stats */}
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              {[
                {
                  label: "Enrolled Courses",
                  value: data.summary.enrolledCourses,
                  icon: BookOpen,
                  color: "text-brand-green",
                },
                {
                  label: "Completed",
                  value: data.summary.completedCourses,
                  icon: Trophy,
                  color: "text-brand-orange",
                },
                {
                  label: "Certificates",
                  value: data.summary.certificatesEarned,
                  icon: Award,
                  color: "text-brand-orange",
                },
                {
                  label: "Avg. Progress",
                  value: `${data.summary.averageProgress}%`,
                  icon: TrendingUp,
                  color: "text-brand-green",
                },
              ].map((stat) => (
                <div
                  key={stat.label}
                  className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-card)] p-5 shadow-[var(--card-shadow)]"
                >
                  <div className="flex items-center gap-3">
                    <stat.icon size={20} className={stat.color} />
                    <div>
                      <div className="text-2xl font-bold text-[var(--text-primary)]">
                        {stat.value}
                      </div>
                      <div className="text-[11px] font-medium text-[var(--text-muted)]">
                        {stat.label}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Quick links */}
            <div className="flex flex-wrap gap-3">
              <Link
                href="/it-portal/certificates"
                className="inline-flex items-center gap-2 rounded-full border border-[var(--border-subtle)] bg-[var(--surface-card)] px-4 py-2 text-xs font-bold text-[var(--text-secondary)] hover:border-brand-green hover:text-[var(--text-accent)]"
              >
                <Award size={14} /> My Certificates
              </Link>
              <Link
                href="/it-portal/profile"
                className="inline-flex items-center gap-2 rounded-full border border-[var(--border-subtle)] bg-[var(--surface-card)] px-4 py-2 text-xs font-bold text-[var(--text-secondary)] hover:border-brand-green hover:text-[var(--text-accent)]"
              >
                Profile & Settings
              </Link>
              <Link
                href="/it-portal/instructor"
                className="inline-flex items-center gap-2 rounded-full border border-[var(--border-subtle)] bg-[var(--surface-card)] px-4 py-2 text-xs font-bold text-[var(--text-secondary)] hover:border-brand-green hover:text-[var(--text-accent)]"
              >
                Instructor Dashboard
              </Link>
              <Link
                href="/it-education"
                className="inline-flex items-center gap-2 rounded-full border border-[var(--border-subtle)] bg-[var(--surface-card)] px-4 py-2 text-xs font-bold text-[var(--text-secondary)] hover:border-brand-green hover:text-[var(--text-accent)]"
              >
                Browse Catalog
              </Link>
            </div>

            {/* Search + tabs */}
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="relative">
                <Search
                  size={16}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]"
                />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search my courses..."
                  className="w-64 rounded-full border border-[var(--border-subtle)] bg-[var(--surface-input)] py-2.5 pl-10 pr-4 text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] outline-none focus:border-brand-green"
                />
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setView("grid")}
                  className={`rounded-lg p-2 ${view === "grid" ? "bg-brand-green/10 text-brand-green" : "text-[var(--text-muted)]"}`}
                >
                  <Grid3X3 size={18} />
                </button>
                <button
                  onClick={() => setView("list")}
                  className={`rounded-lg p-2 ${view === "list" ? "bg-brand-green/10 text-brand-green" : "text-[var(--text-muted)]"}`}
                >
                  <List size={18} />
                </button>
              </div>
            </div>

            {/* Tab bar */}
            <div className="flex gap-0 border-b border-[var(--border-subtle)]">
              {tabs.map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`relative px-5 py-3 text-sm font-bold transition ${
                    activeTab === tab.key
                      ? "text-[var(--text-primary)]"
                      : "text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
                  }`}
                >
                  {tab.label}
                  <span
                    className={`ml-1.5 text-xs ${activeTab === tab.key ? "text-brand-green" : "text-[var(--text-muted)]"}`}
                  >
                    ({tab.count})
                  </span>
                  {activeTab === tab.key && (
                    <div className="absolute bottom-0 left-0 right-0 h-[3px] rounded-t-full bg-brand-green" />
                  )}
                </button>
              ))}
            </div>

            {/* Course cards */}
            {filteredCourses.length > 0 ? (
              <div
                className={
                  view === "grid"
                    ? "grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
                    : "space-y-4"
                }
              >
                {filteredCourses.map((course) => (
                  <CourseCard key={course.id} course={course} view={view} />
                ))}
              </div>
            ) : (
              <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-card)] py-16 text-center">
                <BookOpen size={40} className="mx-auto mb-3 text-[var(--text-muted)]" />
                <h3 className="text-lg font-bold text-[var(--text-primary)]">
                  {searchQuery
                    ? "No courses match your search"
                    : `No ${activeTab.replace("-", " ")} courses`}
                </h3>
                <p className="mt-1 text-sm text-[var(--text-muted)]">
                  Browse the catalog to find courses.
                </p>
                <Link
                  href="/it-education"
                  className="mt-4 inline-block rounded-full bg-brand-green px-6 py-2.5 text-sm font-bold text-brand-navy hover:bg-brand-green-dark"
                >
                  Browse Courses
                </Link>
              </div>
            )}

            {/* Recommended */}
            {notEnrolled.length > 0 && activeTab === "all" && !searchQuery && (
              <div className="mt-12">
                <h2 className="mb-1 font-display text-2xl tracking-widest text-[var(--text-primary)]">
                  RECOMMENDED <span className="text-brand-green">FOR YOU</span>
                </h2>
                <p className="mb-5 text-sm text-[var(--text-muted)]">
                  Expand your skills with these courses
                </p>
                <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {notEnrolled.slice(0, 4).map((course) => (
                    <CourseCard key={course.id} course={course} view="grid" />
                  ))}
                </div>
              </div>
            )}
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}

function CourseCard({ course, view }: { course: Course; view: "grid" | "list" }) {
  const img = COURSE_IMAGES[course.slug] || COURSE_IMAGES["digital-literacy"];
  const isComplete = course.status === "COMPLETED";
  const detailHref = `/it-portal/courses/${course.slug}`;
  const learnHref = `${detailHref}/learn`;

  // An enrolled card is one link into the player. A card the student has not
  // joined cannot be a link too: its Enroll control is a real button, and a
  // button inside an <a> is invalid HTML. So the card body links to the course
  // page and the button sits beside it.
  if (view === "list") {
    const listBody = (
      <>
        <div className="h-20 w-32 flex-shrink-0 overflow-hidden rounded-xl">
          <img src={img} alt={course.title} className="h-full w-full object-cover" />
        </div>
        <div className="flex min-w-0 flex-1 flex-col justify-center">
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-brand-green/10 px-2 py-0.5 text-[9px] font-bold uppercase text-brand-green">
              {course.level}
            </span>
            {isComplete && (
              <span className="rounded-full bg-brand-orange/10 px-2 py-0.5 text-[9px] font-bold uppercase text-brand-orange">
                ✓ Completed
              </span>
            )}
          </div>
          <h3 className="mt-1 text-sm font-bold text-[var(--text-primary)] group-hover:text-brand-green">
            {course.title}
          </h3>
          {course.enrolled && (
            <div className="mt-2 flex items-center gap-3">
              <div className="h-2 flex-1 max-w-[200px] overflow-hidden rounded-full bg-[var(--surface-disabled)]">
                <div
                  className="h-full rounded-full bg-brand-green transition-all"
                  style={{ width: `${course.progressPercent}%` }}
                />
              </div>
              <span className="text-xs font-bold text-[var(--text-muted)]">
                {course.progressPercent}%
              </span>
            </div>
          )}
        </div>
      </>
    );
    const listSurface =
      "group flex gap-4 rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-card)] p-4 shadow-[var(--card-shadow)] transition hover:border-brand-green/30";
    if (course.enrolled) {
      return (
        <Link href={learnHref} className={listSurface}>
          {listBody}
        </Link>
      );
    }
    return (
      <div className={listSurface}>
        <Link href={detailHref} className="flex min-w-0 flex-1 gap-4">
          {listBody}
        </Link>
        <div className="flex flex-shrink-0 items-center">
          <EnrolButton courseId={course.id} slug={course.slug} />
        </div>
      </div>
    );
  }

  const media = (
    <div className="relative aspect-video overflow-hidden">
      <img
        src={img}
        alt={course.title}
        className="h-full w-full object-cover transition group-hover:scale-105"
      />
      {isComplete && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/50">
          <div className="flex items-center gap-1.5 rounded-full bg-brand-green px-3 py-1.5 text-xs font-bold text-brand-navy">
            <Trophy size={14} /> Completed
          </div>
        </div>
      )}
      <div className="absolute bottom-2 left-2">
        <span className="rounded-full bg-black/70 px-2 py-0.5 text-[10px] font-bold uppercase text-white">
          {course.level}
        </span>
      </div>
      {course.enrolled && course.progressPercent > 0 && !isComplete && (
        <div className="absolute bottom-0 left-0 right-0">
          <div className="h-1.5 bg-black/20">
            <div
              className="h-full bg-brand-green"
              style={{ width: `${course.progressPercent}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );

  const meta = (
    <>
      <h3 className="mb-1 text-sm font-bold text-[var(--text-primary)] line-clamp-2 group-hover:text-brand-green">
        {course.title}
      </h3>
      <p className="mb-3 text-xs text-[var(--text-muted)] line-clamp-1">{course.tagline}</p>
      {course.enrolled && (
        <div className="mb-3 flex items-center gap-2">
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-[var(--surface-disabled)]">
            <div
              className="h-full rounded-full bg-brand-green transition-all"
              style={{ width: `${course.progressPercent}%` }}
            />
          </div>
          <span className="text-xs font-bold text-[var(--text-muted)]">
            {course.progressPercent}%
          </span>
        </div>
      )}
      <div className="flex items-center justify-between text-[11px] text-[var(--text-muted)]">
        <span className="flex items-center gap-1">
          <BookOpen size={11} /> {course.moduleCount} modules
        </span>
        <span className="flex items-center gap-1">
          <Clock size={11} /> {course.durationWeeks} weeks
        </span>
      </div>
    </>
  );

  const gridSurface =
    "overflow-hidden rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-card)] shadow-[var(--card-shadow)] transition hover:border-brand-green/30 hover:shadow-lg";

  if (!course.enrolled) {
    return (
      <div className={`group ${gridSurface}`}>
        <Link href={detailHref} className="block">
          {media}
          <div className="p-4 pb-0">{meta}</div>
        </Link>
        <div className="p-4">
          <EnrolButton courseId={course.id} slug={course.slug} fullWidth />
        </div>
      </div>
    );
  }

  return (
    <Link href={learnHref} className="group">
      <div className={gridSurface}>
        {media}
        <div className="p-4">
          {meta}
          <div className="mt-3">
            {isComplete ? (
              <span className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl bg-brand-green/10 py-2.5 text-xs font-bold text-brand-green">
                <Award size={14} /> View Certificate
              </span>
            ) : course.progressPercent > 0 ? (
              <span className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl bg-brand-green py-2.5 text-xs font-bold text-brand-navy group-hover:bg-brand-green-dark">
                <PlayCircle size={14} /> Continue Learning
              </span>
            ) : (
              <span className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl bg-brand-green py-2.5 text-xs font-bold text-brand-navy group-hover:bg-brand-green-dark">
                <PlayCircle size={14} /> Start Course
              </span>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}
