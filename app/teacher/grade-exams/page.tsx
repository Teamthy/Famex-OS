"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import TeacherSidebar from "@/components/TeacherSidebar";
import PortalTopbar from "@/components/PortalTopbar";
import { LoaderCircle, FileCheck2, ClipboardCheck } from "lucide-react";

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

export default function GradeExamsPage() {
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

  // Exams with submissions awaiting review/grading.
  const toGrade = exams.filter((e) => e.submittedCount > 0);

  return (
    <>
      <PortalTopbar title="Grade exams" />
      <main className="mx-auto flex max-w-[1600px] gap-8 px-4 py-6 sm:px-6">
        <TeacherSidebar />
        <section className="min-w-0 flex-1 space-y-6">
          <div className="rounded-[2rem] bg-brand-navy p-7 text-white">
            <p className="text-xs font-bold uppercase tracking-widest text-brand-green">
              Marking &amp; review
            </p>
            <h1 className="mt-2 font-display text-4xl tracking-widest">
              GRADE <span className="text-brand-green">EXAMS</span>
            </h1>
            <p className="mt-3 max-w-2xl text-sm text-white/65">
              Exams with submitted attempts awaiting your review. Open an exam to grade essays /
              fill-ins and release objective scores.
            </p>
          </div>

          {error && (
            <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-600">
              {error}
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-card)] p-4">
              <ClipboardCheck className="mb-2 text-[var(--text-accent)]" size={18} />
              <div className="font-display text-2xl">{toGrade.length}</div>
              <div className="text-[10px] uppercase tracking-widest text-[var(--text-muted)]">
                Awaiting grading
              </div>
            </div>
            <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-card)] p-4">
              <FileCheck2 className="mb-2 text-[var(--text-accent-warm)]" size={18} />
              <div className="font-display text-2xl">
                {toGrade.reduce((s, e) => s + e.submittedCount, 0)}
              </div>
              <div className="text-[10px] uppercase tracking-widest text-[var(--text-muted)]">
                Submissions
              </div>
            </div>
            <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-card)] p-4">
              <LoaderCircle className="mb-2 text-blue-500" size={18} />
              <div className="font-display text-2xl">{exams.length}</div>
              <div className="text-[10px] uppercase tracking-widest text-[var(--text-muted)]">
                Total exams
              </div>
            </div>
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
                    <th className="p-4">Exam</th>
                    <th className="p-4">Subject · Class</th>
                    <th className="p-4">Questions</th>
                    <th className="p-4">Submissions</th>
                    <th className="p-4">Status</th>
                    <th className="p-4"></th>
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
                      <td className="p-4">{e.questionCount}</td>
                      <td className="p-4 font-display text-base text-brand-green">
                        {e.submittedCount}
                      </td>
                      <td className="p-4 text-xs">{e.statusLabel || e.status}</td>
                      <td className="p-4 text-right">
                        {e.submittedCount > 0 ? (
                          <Link
                            href={`/teacher/test-results?exam=${e.id}`}
                            className="rounded-full bg-brand-green px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-brand-navy"
                          >
                            Review {e.submittedCount}
                          </Link>
                        ) : (
                          <span className="text-xs text-[var(--text-muted)]">No submissions</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {!loading && !exams.length && (
              <p className="p-10 text-center text-sm text-[var(--text-muted)]">
                No exams yet. Create one from the CBT center.
              </p>
            )}
          </div>
        </section>
      </main>
    </>
  );
}
