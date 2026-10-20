"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import TeacherSidebar from "@/components/TeacherSidebar";
import PortalTopbar from "@/components/PortalTopbar";
import { useToast } from "@/components/Toast";
import {
  ArrowLeft,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  LoaderCircle,
  Save,
  Star,
  User,
} from "lucide-react";

type Question = {
  id: string;
  type: string;
  questionText: string;
  marks: number;
  sortOrder: number;
  pendingCount: number;
};
type MarkItem = {
  answerId: string;
  attemptId: string;
  questionId: string;
  student: { id: string; name: string; studentId: string };
  response: string | null;
  marks: number;
  awardedMarks: number | null;
};
type MarkingData = {
  exam: {
    id: string;
    title: string;
    subjectName: string;
    className: string;
    totalMarks: number;
    theoryMinutes: number;
  };
  summary: {
    totalStudents: number;
    pendingCount: number;
    totalTheory: number;
    totalMarked: number;
  };
  questions: Question[];
  items: MarkItem[];
};

export default function TeacherMarkingPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { toast } = useToast();
  const examId = params.id;
  const [data, setData] = useState<MarkingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeQ, setActiveQ] = useState(0);
  const [marks, setMarks] = useState<Record<string, number>>({});
  const [filter, setFilter] = useState<"pending" | "all">("pending");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(`/api/teacher/exams/${examId}/marking`, { cache: "no-store" });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "Couldn't load marking queue.");
      setData(j);
      const initial: Record<string, number> = {};
      for (const it of j.items) if (it.awardedMarks != null) initial[it.answerId] = it.awardedMarks;
      setMarks(initial);
    } catch (e) {
      toast(e instanceof Error ? e.message : "Load failed.", "error");
    } finally {
      setLoading(false);
    }
  }, [examId, toast]);

  useEffect(() => {
    void load();
  }, [load]);

  const questions = useMemo(() => data?.questions ?? [], [data]);
  const q = questions[activeQ];
  const visibleItems = useMemo(() => {
    if (!data || !q) return [] as MarkItem[];
    return data.items
      .filter((i) => i.questionId === q.id)
      .filter((i) => (filter === "pending" ? i.awardedMarks == null : true))
      .sort((a, b) => a.student.name.localeCompare(b.student.name));
  }, [data, q, filter]);

  async function save(updates: Record<string, number>, finalize = false) {
    setSaving(true);
    try {
      const body = {
        marks: Object.entries(updates).map(([answerId, awardedMarks]) => ({
          answerId,
          awardedMarks,
        })),
        finalize,
      };
      const r = await fetch(`/api/teacher/exams/${examId}/marking`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "Save failed.");
      toast(
        `Saved ${j.marked} mark${j.marked === 1 ? "" : "s"}${finalize ? " · exams graded" : ""}.`,
        "success",
      );
      await load();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Save failed.", "error");
    } finally {
      setSaving(false);
    }
  }

  function setMark(answerId: string, value: number, max: number) {
    setMarks((prev) => ({ ...prev, [answerId]: Math.max(0, Math.min(max, Math.round(value))) }));
  }

  async function quickAward(item: MarkItem, value: number) {
    setMarks((m) => ({ ...m, [item.answerId]: value }));
    await save({ [item.answerId]: value });
  }

  async function saveVisible(e?: FormEvent) {
    e?.preventDefault();
    const updates: Record<string, number> = {};
    for (const it of visibleItems) {
      const v = marks[it.answerId];
      if (v != null) updates[it.answerId] = v;
    }
    if (!Object.keys(updates).length) return;
    await save(updates);
  }

  async function finalizeAll() {
    if (!data) return;
    const updates: Record<string, number> = {};
    for (const it of data.items) {
      if (it.awardedMarks != null) updates[it.answerId] = it.awardedMarks;
      else if (marks[it.answerId] != null) updates[it.answerId] = marks[it.answerId];
    }
    const pending = data.items.filter(
      (i) => i.awardedMarks == null && marks[i.answerId] == null,
    ).length;
    if (pending > 0) {
      toast(
        `${pending} answer${pending === 1 ? "" : "s"} still unmarked — cannot finalise.`,
        "error",
      );
      return;
    }
    await save(updates, true);
  }

  if (loading || !data) {
    return (
      <>
        <PortalTopbar title="Mark theory" />
        <main className="mx-auto flex max-w-[1600px] items-center justify-center gap-2 px-4 py-20 text-[var(--text-muted)]">
          <LoaderCircle className="animate-spin" size={18} /> Loading marking queue…
        </main>
      </>
    );
  }

  const progressPct =
    data.summary.totalTheory === 0
      ? 100
      : Math.round((data.summary.totalMarked / data.summary.totalTheory) * 100);

  return (
    <>
      <PortalTopbar title="Mark theory" />
      <main className="mx-auto flex max-w-[1600px] gap-8 px-4 py-6 sm:px-6">
        <TeacherSidebar />
        <section className="min-w-0 flex-1 space-y-6">
          <div className="rounded-[2rem] bg-brand-navy p-7 text-white">
            <button
              onClick={() => router.back()}
              className="mb-3 inline-flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-brand-green hover:opacity-80"
            >
              <ArrowLeft size={14} /> Back to exams
            </button>
            <p className="text-xs font-bold uppercase tracking-widest text-brand-green">
              {data.exam.subjectName} · {data.exam.className}
            </p>
            <h1 className="mt-2 font-display text-4xl tracking-widest">{data.exam.title}</h1>
            <div className="mt-4 h-2 w-full max-w-md overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full bg-brand-green transition-all"
                style={{ width: `${progressPct}%` }}
              />
            </div>
            <p className="mt-2 text-sm text-white/65">
              {data.summary.totalMarked}/{data.summary.totalTheory} answers marked across{" "}
              {data.summary.totalStudents} scripts
              {" · "}
              {data.summary.pendingCount} pending
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="flex gap-1 overflow-x-auto rounded-full border border-[var(--border-subtle)] bg-[var(--surface-card)] p-1">
              {questions.map((qq, i) => {
                const pending = qq.pendingCount;
                const done = pending === 0;
                const active = i === activeQ;
                return (
                  <button
                    key={qq.id}
                    onClick={() => setActiveQ(i)}
                    className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold uppercase tracking-widest transition ${
                      active
                        ? "bg-brand-green text-brand-navy"
                        : done
                          ? "text-emerald-500 hover:bg-emerald-50"
                          : "text-[var(--text-muted)] hover:bg-[var(--bg-primary)]"
                    }`}
                    title={qq.questionText}
                  >
                    Q{i + 1}
                    {done ? (
                      <CheckCircle2 size={12} />
                    ) : pending > 0 ? (
                      <span className="rounded-full bg-yellow-400/20 px-1.5 text-yellow-600">
                        {pending}
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>
            <div className="ml-auto flex items-center gap-2">
              <select
                className="rounded-full border border-[var(--border-subtle)] bg-[var(--surface-card)] px-4 py-2 text-xs font-bold uppercase tracking-widest"
                value={filter}
                onChange={(e) => setFilter(e.target.value as "pending" | "all")}
              >
                <option value="pending">Pending only</option>
                <option value="all">All scripts</option>
              </select>
              <button
                onClick={() => void saveVisible()}
                disabled={saving}
                className="inline-flex items-center gap-2 rounded-full border border-[var(--border-subtle)] px-4 py-2 text-xs font-bold uppercase tracking-widest hover:border-[var(--accent-primary)] hover:text-[var(--accent-primary)] disabled:opacity-60"
              >
                <Save size={14} /> {saving ? "Saving…" : "Save question"}
              </button>
              <button
                onClick={() => void finalizeAll()}
                disabled={saving}
                className="inline-flex items-center gap-2 rounded-full bg-emerald-500 px-4 py-2 text-xs font-bold uppercase tracking-widest text-white hover:bg-emerald-600 disabled:opacity-60"
              >
                <Star size={14} /> Finalise & publish
              </button>
            </div>
          </div>

          {q && (
            <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-card)] p-6">
              <p className="text-xs uppercase tracking-widest text-[var(--accent-primary)]">
                Question {activeQ + 1} · {q.type.replace("_", " ")} · {q.marks} mk
                {q.marks !== 1 ? "s" : ""}
              </p>
              <h2 className="mt-2 text-lg font-semibold leading-relaxed">{q.questionText}</h2>
              <div className="mt-4 flex items-center justify-between text-sm text-[var(--text-muted)]">
                <span>
                  {visibleItems.length} script{visibleItems.length === 1 ? "" : "s"} ·{" "}
                  <span className="font-bold text-[var(--accent-primary)]">
                    {
                      visibleItems.filter(
                        (i) => marks[i.answerId] != null || i.awardedMarks != null,
                      ).length
                    }
                  </span>{" "}
                  marked
                </span>
                <div className="flex gap-2">
                  <button
                    onClick={() => setActiveQ((i) => Math.max(0, i - 1))}
                    disabled={activeQ === 0}
                    className="rounded-full border border-[var(--border-subtle)] p-2 disabled:opacity-40"
                  >
                    <ChevronLeft size={14} />
                  </button>
                  <button
                    onClick={() => setActiveQ((i) => Math.min(questions.length - 1, i + 1))}
                    disabled={activeQ === questions.length - 1}
                    className="rounded-full border border-[var(--border-subtle)] p-2 disabled:opacity-40"
                  >
                    <ChevronRight size={14} />
                  </button>
                </div>
              </div>
            </div>
          )}

          <ul className="space-y-3">
            {visibleItems.map((it) => {
              const val = marks[it.answerId] ?? it.awardedMarks ?? 0;
              const marked = it.awardedMarks != null || marks[it.answerId] != null;
              return (
                <li
                  key={it.answerId}
                  className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-card)] p-5"
                >
                  <div className="flex items-start gap-3">
                    <User size={18} className="mt-1 shrink-0 text-[var(--accent-primary)]" />
                    <div className="min-w-0 flex-1">
                      <p className="font-bold">
                        {it.student.name}{" "}
                        <span className="text-xs text-[var(--text-muted)]">
                          ({it.student.studentId})
                        </span>
                      </p>
                      <div className="mt-2 whitespace-pre-wrap rounded-lg bg-[var(--bg-primary)] p-3 text-sm leading-relaxed">
                        {it.response || (
                          <span className="italic text-[var(--text-muted)]">(no response)</span>
                        )}
                      </div>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-2">
                      <div className="flex items-center gap-1">
                        {[0, 0.25, 0.5, 0.75, 1].map((pct) => {
                          const v = Math.round(pct * it.marks);
                          const active = val >= v && v > 0;
                          return (
                            <button
                              key={pct}
                              onClick={() => setMark(it.answerId, v, it.marks)}
                              className={`flex h-8 w-8 items-center justify-center rounded-md border text-xs font-bold transition ${
                                active
                                  ? "border-[var(--accent-primary)] bg-[var(--accent-primary)] text-white"
                                  : "border-[var(--border-subtle)] text-[var(--text-muted)] hover:border-[var(--accent-primary)]"
                              }`}
                              title={`${v}/${it.marks}`}
                            >
                              {v}
                            </button>
                          );
                        })}
                      </div>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          min={0}
                          max={it.marks}
                          value={val}
                          onChange={(e) => setMark(it.answerId, Number(e.target.value), it.marks)}
                          className="w-16 rounded-md border border-[var(--border-subtle)] bg-[var(--bg-primary)] px-2 py-1 text-center text-sm"
                        />
                        <span className="text-xs text-[var(--text-muted)]">/ {it.marks}</span>
                      </div>
                      <div className="flex gap-1">
                        <button
                          onClick={() => quickAward(it, 0)}
                          className="rounded-md bg-red-50 px-2 py-1 text-[10px] font-bold uppercase tracking-widest text-red-500 hover:bg-red-100"
                        >
                          0
                        </button>
                        <button
                          onClick={() => quickAward(it, it.marks)}
                          className="rounded-md bg-emerald-50 px-2 py-1 text-[10px] font-bold uppercase tracking-widest text-emerald-600 hover:bg-emerald-100"
                        >
                          Full
                        </button>
                      </div>
                      {marked ? (
                        <CheckCircle2 size={14} className="text-emerald-500" />
                      ) : (
                        <Clock size={14} className="text-yellow-500" />
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
            {visibleItems.length === 0 && (
              <li className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-card)] p-8 text-center text-sm text-[var(--text-muted)]">
                All scripts marked for this question. Use the pills above to move to the next
                pending question.
              </li>
            )}
          </ul>
        </section>
      </main>
    </>
  );
}
