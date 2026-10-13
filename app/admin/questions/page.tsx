"use client";

import { useEffect, useState } from "react";
import AdminSidebar from "@/components/AdminSidebar";
import PortalTopbar from "@/components/PortalTopbar";
import { LoaderCircle, Search, FileQuestion, BookOpen, Layers } from "lucide-react";

type Question = {
  id: string;
  questionText: string;
  type: string;
  correctKey: string | null;
  subject: string;
  className: string | null;
  examTitle: string;
};

const TYPE_LABEL: Record<string, string> = {
  MCQ: "Multiple choice",
  TRUE_FALSE: "True / False",
  FILL_BLANK: "Fill in the blank",
  ESSAY: "Essay",
};

export default function AdminQuestionsPage() {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [subjects, setSubjects] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [subject, setSubject] = useState("All");
  const [type, setType] = useState("All");

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const r = await fetch("/api/admin/questions", { cache: "no-store" });
        const j = await r.json();
        if (!r.ok) throw new Error(j.error || "Unable to load questions.");
        setQuestions(j.questions || []);
        setSubjects(j.subjects || []);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Unable to load questions.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const types = ["All", ...new Set(questions.map((q) => q.type))];
  const filtered = questions.filter((q) => {
    const ms = subject === "All" || q.subject === subject;
    const mt = type === "All" || q.type === type;
    const mq = !search || q.questionText.toLowerCase().includes(search.toLowerCase());
    return ms && mt && mq;
  });

  return (
    <>
      <PortalTopbar title="Question bank" />
      <main className="mx-auto flex max-w-[1600px] gap-8 px-4 py-6 sm:px-6">
        <AdminSidebar />
        <section className="min-w-0 flex-1 space-y-6">
          <div className="rounded-[2rem] bg-brand-navy p-7 text-white">
            <p className="text-xs font-bold uppercase tracking-widest text-brand-green">
              Assessment items
            </p>
            <h1 className="mt-2 font-display text-4xl tracking-widest">
              ALL <span className="text-brand-green">QUESTIONS</span>
            </h1>
            <p className="mt-3 max-w-2xl text-sm text-white/65">
              Every exam question across the school, with subject and class context.
            </p>
          </div>

          {error && (
            <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-600">
              {error}
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-card)] p-4">
              <FileQuestion className="mb-2 text-[var(--text-accent)]" size={18} />
              <div className="font-display text-2xl">{questions.length}</div>
              <div className="text-[10px] uppercase tracking-widest text-[var(--text-muted)]">
                Questions
              </div>
            </div>
            <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-card)] p-4">
              <BookOpen className="mb-2 text-[var(--text-accent-warm)]" size={18} />
              <div className="font-display text-2xl">{subjects.length}</div>
              <div className="text-[10px] uppercase tracking-widest text-[var(--text-muted)]">
                Subjects
              </div>
            </div>
            <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-card)] p-4">
              <Layers className="mb-2 text-blue-500" size={18} />
              <div className="font-display text-2xl">{types.length - 1}</div>
              <div className="text-[10px] uppercase tracking-widest text-[var(--text-muted)]">
                Question types
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <label className="relative flex-1">
              <Search className="absolute left-3 top-3 text-[var(--text-muted)]" size={16} />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search question text"
                className="w-full rounded-full border border-[var(--input-border)] bg-[var(--input-bg)] py-2.5 pl-9 pr-4 text-sm"
              />
            </label>
            <select
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="rounded-full border border-[var(--input-border)] bg-[var(--input-bg)] px-4 py-2.5 text-sm"
            >
              <option value="All">All subjects</option>
              {subjects.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
            <select
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="rounded-full border border-[var(--input-border)] bg-[var(--input-bg)] px-4 py-2.5 text-sm"
            >
              <option value="All">All types</option>
              {types
                .filter((t) => t !== "All")
                .map((t) => (
                  <option key={t} value={t}>
                    {TYPE_LABEL[t] || t}
                  </option>
                ))}
            </select>
          </div>

          <div className="overflow-hidden rounded-3xl border border-[var(--border-subtle)] bg-[var(--surface-card)]">
            {loading ? (
              <div className="flex items-center gap-2 p-12 text-sm text-[var(--text-muted)]">
                <LoaderCircle className="animate-spin" size={18} /> Loading questions…
              </div>
            ) : (
              <table className="w-full text-left text-sm">
                <thead className="bg-[var(--surface-disabled)] text-[10px] uppercase tracking-widest text-[var(--text-muted)]">
                  <tr>
                    <th className="p-4">Question</th>
                    <th className="p-4">Type</th>
                    <th className="p-4">Subject · Class</th>
                    <th className="p-4">Exam</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((q) => (
                    <tr key={q.id} className="border-t border-[var(--border-subtle)] align-top">
                      <td className="p-4 max-w-md">{q.questionText}</td>
                      <td className="p-4">
                        <span className="rounded-full bg-brand-green/10 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-brand-green">
                          {TYPE_LABEL[q.type] || q.type}
                        </span>
                      </td>
                      <td className="p-4 text-xs text-[var(--text-muted)]">
                        {q.subject}
                        {q.className ? ` · ${q.className}` : ""}
                      </td>
                      <td className="p-4 text-xs text-[var(--text-muted)]">{q.examTitle}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {!loading && !filtered.length && (
              <p className="p-10 text-center text-sm text-[var(--text-muted)]">
                No questions match your filters.
              </p>
            )}
          </div>
        </section>
      </main>
    </>
  );
}
