"use client";

import { use, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import Header from "@/components/Header";
import EnrolButton from "@/components/it/EnrolButton";
import Footer from "@/components/Footer";
import { useToast } from "@/components/Toast";
import {
  ArrowLeft,
  Award,
  BookOpen,
  CheckCircle2,
  ChevronDown,
  Circle,
  Clock,
  LoaderCircle,
  PlayCircle,
} from "lucide-react";

type CourseModule = {
  id: string;
  title: string;
  summary: string;
  content: string;
  durationMinutes: number;
  completed: boolean;
};

type CourseResponse = {
  course: {
    id: string;
    slug: string;
    title: string;
    tagline: string;
    description: string;
    level: string;
    certification: string;
    durationWeeks: number;
    enrolled: boolean;
    status: string | null;
    certificateNumber: string | null;
    progressPercent: number;
    modules: CourseModule[];
  };
};

export default function ItCoursePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const { toast } = useToast();
  const [data, setData] = useState<CourseResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyModuleId, setBusyModuleId] = useState("");
  const [openModuleId, setOpenModuleId] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`/api/it/courses/${encodeURIComponent(slug)}`, {
        cache: "no-store",
      });
      const body = (await response.json()) as CourseResponse & { error?: string };
      if (!response.ok) throw new Error(body.error || "Unable to load this course.");
      setData(body);
      const firstIncomplete = body.course.modules.find((module) => !module.completed);
      if (firstIncomplete) setOpenModuleId(firstIncomplete.id);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load this course.");
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    void load();
  }, [load]);

  async function completeModule(module: CourseModule) {
    if (!data) return;
    setBusyModuleId(module.id);
    try {
      const response = await fetch("/api/it/progress", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ courseId: data.course.id, moduleId: module.id }),
      });
      const body = (await response.json()) as {
        message?: string;
        error?: string;
        certified?: boolean;
      };
      if (!response.ok) throw new Error(body.error || "Unable to update progress.");
      toast(body.message || "Progress saved.", body.certified ? "success" : "info");
      await load();
    } catch (completeError) {
      toast(
        completeError instanceof Error ? completeError.message : "Unable to update progress.",
        "error",
      );
    } finally {
      setBusyModuleId("");
    }
  }

  const course = data?.course || null;

  return (
    <>
      <Header />
      <main className="min-h-screen bg-[var(--bg-primary)] theme-transition">
        <section className="relative overflow-hidden bg-brand-navy px-6 pt-28 pb-14">
          <div className="absolute top-0 right-0 h-full w-1/3 bg-gradient-to-l from-brand-green to-transparent opacity-10" />
          <div className="relative z-10 mx-auto max-w-5xl">
            <Link
              href="/it-portal/dashboard"
              className="mb-6 inline-flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-brand-green hover:text-brand-green-light"
            >
              <ArrowLeft size={14} /> Back to IT Dashboard
            </Link>
            {course ? (
              <>
                <div className="mb-3 flex flex-wrap items-center gap-3">
                  <span className="rounded-full border border-brand-green/40 bg-brand-green/20 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-brand-green">
                    {course.level}
                  </span>
                  <span className="flex items-center gap-1 text-xs text-white/50">
                    <Clock size={12} /> {course.durationWeeks} weeks · {course.modules.length}{" "}
                    modules
                  </span>
                </div>
                <h1 className="font-display text-4xl tracking-widest text-white md:text-5xl">
                  {course.title.toUpperCase()}
                </h1>
                <p className="mt-3 max-w-2xl text-sm leading-7 text-white/60">
                  {course.description}
                </p>
                <div className="mt-6 max-w-md">
                  <div className="mb-2 flex items-center justify-between text-xs">
                    <span className="text-white/50">Course progress</span>
                    <span className="font-bold text-brand-green">{course.progressPercent}%</span>
                  </div>
                  <div className="h-2.5 overflow-hidden rounded-full bg-white/10">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-brand-green to-brand-green-light transition-all"
                      style={{ width: `${course.progressPercent}%` }}
                    />
                  </div>
                </div>
              </>
            ) : null}
          </div>
        </section>

        <section className="px-6 py-10">
          <div className="mx-auto max-w-5xl space-y-6">
            {error ? (
              <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-500">
                {error}{" "}
                <Link href="/it-portal/auth" className="font-bold underline">
                  Sign in
                </Link>
              </div>
            ) : null}

            {loading ? (
              <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-card)] p-10 shadow-[var(--card-shadow)]">
                <div className="flex items-center gap-3 text-[var(--text-secondary)]">
                  <LoaderCircle className="animate-spin text-brand-green" size={20} /> Loading
                  course...
                </div>
              </div>
            ) : null}

            {!loading && course && !course.enrolled ? (
              <div className="rounded-[2rem] border border-brand-orange/25 bg-brand-orange/10 p-8 text-center">
                <BookOpen className="mx-auto mb-3 text-brand-orange" size={32} />
                <h2 className="font-display text-2xl text-[var(--text-primary)]">
                  You are not enrolled yet
                </h2>
                <p className="mx-auto mt-2 max-w-md text-sm text-[var(--text-secondary)]">
                  Enroll in this course to unlock the modules, save your progress and earn your
                  certificate.
                </p>
                <div className="mt-5 flex justify-center">
                  <EnrolButton courseId={course.id} slug={course.slug} variant="solid" />
                </div>
              </div>
            ) : null}

            {!loading && course?.certificateNumber ? (
              <div className="flex flex-wrap items-center justify-between gap-4 rounded-[2rem] border border-brand-green/30 bg-brand-green/10 p-6">
                <div className="flex items-center gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-green text-brand-navy">
                    <Award size={22} />
                  </div>
                  <div>
                    <div className="font-display text-xl text-[var(--text-primary)]">
                      Course Completed — Certified!
                    </div>
                    <div className="text-xs text-[var(--text-secondary)]">
                      {course.certification}
                    </div>
                  </div>
                </div>
                <span className="rounded-full bg-brand-green px-4 py-2 text-[10px] font-bold uppercase tracking-widest text-brand-navy">
                  {course.certificateNumber}
                </span>
              </div>
            ) : null}

            {!loading && course?.enrolled
              ? course.modules.map((module, index) => {
                  const isOpen = openModuleId === module.id;
                  return (
                    <div
                      key={module.id}
                      className={`overflow-hidden rounded-[2rem] border bg-[var(--surface-card)] shadow-[var(--card-shadow)] transition-colors ${
                        module.completed ? "border-brand-green/30" : "border-[var(--border-subtle)]"
                      }`}
                    >
                      <button
                        onClick={() => setOpenModuleId(isOpen ? "" : module.id)}
                        className="flex w-full items-center gap-4 px-6 py-5 text-left"
                      >
                        {module.completed ? (
                          <CheckCircle2 size={22} className="shrink-0 text-brand-green" />
                        ) : (
                          <Circle size={22} className="shrink-0 text-[var(--text-muted)]" />
                        )}
                        <div className="min-w-0 flex-1">
                          <div className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)]">
                            Module {index + 1} · {module.durationMinutes} min
                          </div>
                          <div className="truncate font-display text-lg text-[var(--text-primary)]">
                            {module.title}
                          </div>
                        </div>
                        <ChevronDown
                          size={18}
                          className={`shrink-0 text-[var(--text-muted)] transition-transform ${isOpen ? "rotate-180" : ""}`}
                        />
                      </button>
                      {isOpen ? (
                        <div className="border-t border-[var(--border-subtle)] px-6 py-6">
                          <p className="mb-4 text-sm font-medium text-[var(--text-primary)]">
                            {module.summary}
                          </p>
                          <div className="mb-6 whitespace-pre-line text-sm leading-7 text-[var(--text-secondary)]">
                            {module.content}
                          </div>
                          {!module.completed ? (
                            <button
                              onClick={() => void completeModule(module)}
                              disabled={Boolean(busyModuleId)}
                              className="inline-flex items-center gap-2 rounded-full bg-brand-green px-6 py-3 text-xs font-bold uppercase tracking-widest text-brand-navy shadow-lg transition-all hover:bg-brand-green-dark disabled:opacity-50"
                            >
                              {busyModuleId === module.id ? (
                                <LoaderCircle size={14} className="animate-spin" />
                              ) : (
                                <PlayCircle size={14} />
                              )}
                              Mark Module Complete
                            </button>
                          ) : (
                            <span className="inline-flex items-center gap-2 rounded-full bg-brand-green/10 px-4 py-2 text-[10px] font-bold uppercase tracking-widest text-brand-green">
                              <CheckCircle2 size={12} /> Completed
                            </span>
                          )}
                        </div>
                      ) : null}
                    </div>
                  );
                })
              : null}
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
