"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import TeacherSidebar from "@/components/TeacherSidebar";
import PortalTopbar from "@/components/PortalTopbar";
import {
  BookOpen,
  FileText,
  LoaderCircle,
  PlusCircle,
  ClipboardList,
  CheckCircle2,
} from "lucide-react";

type Exam = {
  id: string;
  title: string;
  subjectName: string;
  className: string;
  totalMarks: number;
  questionCount: number;
  status: string;
  statusLabel: string;
  submittedCount: number;
};

export default function QuestionBankPage() {
  const [exams, setExams] = useState<Exam[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const r = await fetch("/api/teacher/exams", { cache: "no-store" });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "Unable to load exams.");
      setExams(j.exams || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to load exams.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const totalQuestions = exams.reduce((sum, e) => sum + e.questionCount, 0);
  const drafts = exams.filter((e) => e.status === "DRAFT").length;

  return (
    <>
      <PortalTopbar title="Question bank" />
      <main className="mx-auto flex max-w-[1600px] gap-8 px-4 py-6 sm:px-6">
        <TeacherSidebar />
        <section className="min-w-0 flex-1 space-y-6">
          <div className="rounded-[2rem] bg-brand-navy p-7 text-white">
            <p className="text-xs font-bold uppercase tracking-widest text-brand-green">
              Assessments &amp; items
            </p>
            <h1 className="mt-2 font-display text-4xl tracking-widest">
              QUESTION <span className="text-brand-green">BANK</span>
            </h1>
            <p className="mt-3 max-w-2xl text-sm text-white/65">
              Every test and exam you own, with live question counts. Upload items from
              CSV/Excel/Word/JSON, preview, then publish.
            </p>
          </div>

          {error && (
            <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-600">
              {error}
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-card)] p-4">
              <FileText className="mb-2 text-[var(--text-accent)]" size={18} />
              <div className="font-display text-2xl">{exams.length}</div>
              <div className="text-[10px] uppercase tracking-widest text-[var(--text-muted)]">
                Exams / tests
              </div>
            </div>
            <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-card)] p-4">
              <BookOpen className="mb-2 text-[var(--text-accent-warm)]" size={18} />
              <div className="font-display text-2xl">{totalQuestions}</div>
              <div className="text-[10px] uppercase tracking-widest text-[var(--text-muted)]">
                Questions
              </div>
            </div>
            <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-card)] p-4">
              <ClipboardList className="mb-2 text-blue-500" size={18} />
              <div className="font-display text-2xl">{drafts}</div>
              <div className="text-[10px] uppercase tracking-widest text-[var(--text-muted)]">
                Drafts
              </div>
            </div>
          </div>

          <div className="flex justify-end">
            <Link
              href="/teacher/upload-questions"
              className="inline-flex items-center gap-2 rounded-full bg-brand-green px-5 py-2.5 text-xs font-bold uppercase tracking-widest text-brand-navy"
            >
              <PlusCircle size={15} /> Upload questions
            </Link>
          </div>

          <div className="overflow-hidden rounded-3xl border border-[var(--border-subtle)] bg-[var(--surface-card)]">
            {loading ? (
              <div className="flex items-center justify-center gap-2 p-12 text-sm text-[var(--text-muted)]">
                <LoaderCircle className="animate-spin" size={18} /> Loading exams…
              </div>
            ) : (
              <table className="w-full text-left text-sm">
                <thead className="bg-[var(--surface-disabled)] text-[10px] uppercase tracking-widest text-[var(--text-muted)]">
                  <tr>
                    <th className="p-4">Exam / Test</th>
                    <th className="p-4">Subject · Class</th>
                    <th className="p-4">Questions</th>
                    <th className="p-4">Marks</th>
                    <th className="p-4">Status</th>
                    <th className="p-4">Submitted</th>
                  </tr>
                </thead>
                <tbody>
                  {exams.map((e) => (
                    <tr key={e.id} className="border-t border-[var(--border-subtle)]">
                      <td className="p-4">
                        <b>{e.title}</b>
                      </td>
                      <td className="p-4 text-xs text-[var(--text-muted)]">
                        {e.subjectName} · {e.className}
                      </td>
                      <td className="p-4 font-display text-base text-brand-green">
                        {e.questionCount}
                      </td>
                      <td className="p-4">{e.totalMarks}</td>
                      <td className="p-4">
                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-bold uppercase tracking-wider ${
                            e.status === "PUBLISHED"
                              ? "bg-brand-green/15 text-brand-green"
                              : "bg-brand-orange/15 text-brand-orange"
                          }`}
                        >
                          {e.status === "PUBLISHED" && <CheckCircle2 size={11} />}
                          {e.statusLabel || e.status}
                        </span>
                      </td>
                      <td className="p-4 text-xs text-[var(--text-muted)]">{e.submittedCount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {!loading && !exams.length && (
              <div className="p-10 text-center">
                <p className="text-sm text-[var(--text-muted)]">No exams yet.</p>
                <Link
                  href="/teacher/upload-questions"
                  className="mt-3 inline-flex items-center gap-2 text-sm font-bold text-brand-green"
                >
                  <PlusCircle size={15} /> Upload your first set of questions
                </Link>
              </div>
            )}
          </div>
        </section>
      </main>
    </>
  );
}
