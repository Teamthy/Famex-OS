"use client";

import { use, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import Header from "@/components/Header";
import { useToast } from "@/components/Toast";
import EnrolButton from "@/components/it/EnrolButton";
import {
  ArrowLeft,
  ArrowRight,
  Award,
  BookOpen,
  CheckCircle2,
  Circle,
  Clock,
  LoaderCircle,
  Menu,
  PlayCircle,
  X,
} from "lucide-react";

type Module = {
  id: string;
  title: string;
  summary: string;
  content: string;
  durationMinutes: number;
  completed: boolean;
  order: number;
};

type CourseData = {
  course: {
    id: string;
    slug: string;
    title: string;
    tagline: string;
    level: string;
    certification: string;
    durationWeeks: number;
    enrolled: boolean;
    status: string | null;
    certificateNumber: string | null;
    progressPercent: number;
    modules: Module[];
  };
};

export default function ItCoursePlayer({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const { toast } = useToast();
  const [data, setData] = useState<CourseData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeModuleId, setActiveModuleId] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [completing, setCompleting] = useState(false);

  const load = useCallback(async () => {
    try {
      const r = await fetch(`/api/it/courses/${slug}`, { cache: "no-store" });
      const j = await r.json();
      if (r.ok) {
        setData(j);
        // Auto-select first incomplete module, or first module
        const first =
          j.course?.modules?.find((m: Module) => !m.completed) || j.course?.modules?.[0];
        if (first) setActiveModuleId(first.id);
      }
    } catch {
      toast("Failed to load course.", "error");
    } finally {
      setLoading(false);
    }
  }, [slug, toast]);

  useEffect(() => {
    void load();
  }, [load]);

  const activeModule = data?.course?.modules?.find((m) => m.id === activeModuleId) || null;
  const modules = data?.course?.modules || [];
  const currentIdx = modules.findIndex((m) => m.id === activeModuleId);
  const prevModule = currentIdx > 0 ? modules[currentIdx - 1] : null;
  const nextModule = currentIdx < modules.length - 1 ? modules[currentIdx + 1] : null;
  const allComplete = modules.length > 0 && modules.every((m) => m.completed);
  // Progress can only be recorded by an enrolled learner; the server answers 409 otherwise.
  const enrolled = data?.course.enrolled ?? false;

  async function markComplete() {
    if (!activeModule || completing || !enrolled) return;
    setCompleting(true);
    try {
      const r = await fetch(`/api/it/progress`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ courseId: data!.course.id, moduleId: activeModule.id }),
      });
      if (r.ok) {
        toast("Module completed! 🎉", "success");
        await load();
        // Auto-advance to next module
        if (nextModule) setActiveModuleId(nextModule.id);
      } else {
        // The API explains the refusal (for example, not enrolled). Show that, not a generic line.
        const failure = (await r.json().catch(() => null)) as { error?: string } | null;
        toast(failure?.error || "Could not save progress. Please try again.", "error");
      }
    } catch {
      toast("Network error.", "error");
    } finally {
      setCompleting(false);
    }
  }

  if (loading) {
    return (
      <>
        <Header />
        <div className="grid min-h-screen place-items-center bg-brand-navy">
          <LoaderCircle className="animate-spin text-brand-green" size={40} />
        </div>
      </>
    );
  }

  if (!data?.course) {
    return (
      <>
        <Header />
        <div className="grid min-h-screen place-items-center bg-brand-navy text-white">
          <div className="text-center">
            <BookOpen size={48} className="mx-auto text-brand-green mb-4" />
            <h1 className="text-2xl font-bold">Course not found</h1>
            <Link href="/it-portal/dashboard" className="mt-4 text-brand-green underline">
              Back to dashboard
            </Link>
          </div>
        </div>
      </>
    );
  }

  const course = data.course;

  return (
    <div className="flex min-h-screen flex-col bg-[#0a1628]">
      {/* Top bar */}
      <header className="flex items-center justify-between border-b border-white/10 bg-brand-navy px-4 py-3">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="rounded-lg p-2 text-white/60 hover:bg-[var(--surface-card)]/10 hover:text-white lg:hidden"
          >
            {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
          <Link
            href="/it-portal/dashboard"
            className="flex items-center gap-2 text-sm text-white/60 hover:text-white"
          >
            <ArrowLeft size={16} /> Dashboard
          </Link>
          <span className="hidden text-white/20 sm:inline">|</span>
          <h1 className="hidden text-sm font-bold text-white sm:block">{course.title}</h1>
        </div>
        <div className="flex items-center gap-4">
          {/* Progress bar */}
          <div className="hidden items-center gap-2 md:flex">
            <div className="h-2 w-32 overflow-hidden rounded-full bg-[var(--surface-card)]/10">
              <div
                className="h-full rounded-full bg-brand-green transition-all duration-500"
                style={{ width: `${course.progressPercent}%` }}
              />
            </div>
            <span className="text-xs font-bold text-brand-green">{course.progressPercent}%</span>
          </div>
          {allComplete && course.status !== "COMPLETED" && (
            <span className="rounded-full bg-brand-green/20 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-brand-green">
              All modules complete!
            </span>
          )}
          {course.certificateNumber && (
            <Link
              href={`/it-portal/dashboard`}
              className="flex items-center gap-1.5 rounded-full bg-brand-orange/20 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-brand-orange"
            >
              <Award size={12} /> Certified
            </Link>
          )}
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar — Module list */}
        <aside
          className={`${
            sidebarOpen ? "w-80" : "w-0"
          } flex-shrink-0 overflow-y-auto border-r border-white/10 bg-[#0d1f33] transition-all duration-300 lg:w-80`}
        >
          <div className="p-4">
            <div className="mb-1 text-[10px] font-bold uppercase tracking-widest text-white/40">
              Course Content
            </div>
            <div className="mb-4 text-xs text-white/60">
              {modules.length} modules · {course.durationWeeks} weeks · {course.level}
            </div>

            {/* Overall progress */}
            <div className="mb-4 rounded-xl bg-[var(--surface-card)]/5 p-3">
              <div className="mb-2 flex items-center justify-between text-xs">
                <span className="text-white/60">Progress</span>
                <span className="font-bold text-brand-green">{course.progressPercent}%</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-[var(--surface-card)]/10">
                <div
                  className="h-full rounded-full bg-brand-green transition-all"
                  style={{ width: `${course.progressPercent}%` }}
                />
              </div>
              <div className="mt-2 text-[10px] text-white/40">
                {modules.filter((m) => m.completed).length} of {modules.length} completed
              </div>
            </div>

            {/* Module list */}
            <div className="space-y-1">
              {modules.map((mod, idx) => (
                <button
                  key={mod.id}
                  onClick={() => setActiveModuleId(mod.id)}
                  className={`flex w-full items-start gap-3 rounded-xl p-3 text-left transition ${
                    activeModuleId === mod.id
                      ? "bg-brand-green/10 border border-brand-green/30"
                      : "hover:bg-[var(--surface-card)]/5 border border-transparent"
                  }`}
                >
                  <div className="mt-0.5 flex-shrink-0">
                    {mod.completed ? (
                      <CheckCircle2 size={18} className="text-brand-green" />
                    ) : activeModuleId === mod.id ? (
                      <PlayCircle size={18} className="text-brand-green" />
                    ) : (
                      <Circle size={18} className="text-white/30" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold text-white/30">
                        {String(idx + 1).padStart(2, "0")}
                      </span>
                      <span
                        className={`text-sm font-medium ${
                          mod.completed ? "text-white/50 line-through" : "text-white"
                        }`}
                      >
                        {mod.title}
                      </span>
                    </div>
                    <div className="mt-1 flex items-center gap-2 text-[10px] text-white/30">
                      <Clock size={10} /> {mod.durationMinutes} min
                      {mod.completed && <span className="text-brand-green">· Done</span>}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </aside>

        {/* Main content area */}
        <main className="flex-1 overflow-y-auto">
          {activeModule ? (
            <div className="mx-auto max-w-4xl px-6 py-8 lg:px-12">
              {data && !enrolled && (
                <div
                  role="status"
                  className="mb-8 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-brand-orange/40 bg-brand-orange/10 p-5"
                >
                  <div>
                    <p className="text-sm font-bold text-white">
                      You are not enrolled in this course yet.
                    </p>
                    <p className="mt-1 text-xs text-white/70">
                      You can read the lessons, but progress is saved only after you enroll.
                    </p>
                  </div>
                  <EnrolButton
                    courseId={data.course.id}
                    slug={slug}
                    variant="solid"
                    onEnrolled={() => void load()}
                  />
                </div>
              )}
              {/* Module header */}
              <div className="mb-8">
                <div className="mb-2 flex items-center gap-2 text-xs text-white/40">
                  <span className="font-bold text-brand-green">
                    Module {currentIdx + 1} of {modules.length}
                  </span>
                  <span>·</span>
                  <Clock size={12} /> {activeModule.durationMinutes} min
                  {activeModule.completed && (
                    <>
                      <span>·</span>
                      <span className="flex items-center gap-1 text-brand-green">
                        <CheckCircle2 size={12} /> Completed
                      </span>
                    </>
                  )}
                </div>
                <h2 className="font-display text-3xl font-bold tracking-wide text-white">
                  {activeModule.title}
                </h2>
                <p className="mt-3 text-sm leading-relaxed text-white/60">{activeModule.summary}</p>
              </div>

              {/* Lesson content */}
              <div className="rounded-2xl border border-white/10 bg-[var(--surface-card)]/5 p-8">
                <div
                  className="prose prose-invert prose-sm max-w-none prose-headings:text-white prose-p:text-white/70 prose-strong:text-white prose-a:text-brand-green prose-li:text-white/70"
                  dangerouslySetInnerHTML={{
                    __html: activeModule.content.replace(/\n/g, "<br/>"),
                  }}
                />
              </div>

              {/* Actions */}
              <div className="mt-8 flex flex-wrap items-center justify-between gap-4">
                <div className="flex gap-3">
                  {prevModule && (
                    <button
                      onClick={() => setActiveModuleId(prevModule.id)}
                      className="flex items-center gap-2 rounded-full border border-white/20 px-5 py-2.5 text-sm text-white/70 hover:border-white/40 hover:text-white"
                    >
                      <ArrowLeft size={16} /> Previous
                    </button>
                  )}
                  {nextModule && (
                    <button
                      onClick={() => setActiveModuleId(nextModule.id)}
                      className="flex items-center gap-2 rounded-full border border-white/20 px-5 py-2.5 text-sm text-white/70 hover:border-white/40 hover:text-white"
                    >
                      Next <ArrowRight size={16} />
                    </button>
                  )}
                </div>

                {!activeModule.completed ? (
                  <button
                    onClick={() => void markComplete()}
                    disabled={completing || !enrolled}
                    className="flex items-center gap-2 rounded-full bg-brand-green px-6 py-3 text-sm font-bold text-brand-navy shadow-lg shadow-brand-green/20 transition hover:bg-brand-green/90 disabled:opacity-50"
                  >
                    {completing ? (
                      <LoaderCircle className="animate-spin" size={16} />
                    ) : (
                      <CheckCircle2 size={16} />
                    )}
                    {completing
                      ? "Saving..."
                      : enrolled
                        ? "Mark as Complete"
                        : "Enroll to save progress"}
                  </button>
                ) : (
                  <span className="flex items-center gap-2 rounded-full bg-brand-green/10 px-5 py-2.5 text-sm font-bold text-brand-green">
                    <CheckCircle2 size={16} /> Completed
                  </span>
                )}
              </div>
            </div>
          ) : (
            <div className="grid h-full place-items-center text-white/40">
              <div className="text-center">
                <BookOpen size={48} className="mx-auto mb-4" />
                <p>Select a module to begin learning</p>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
