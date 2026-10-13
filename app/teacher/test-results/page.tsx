"use client";

import { useCallback, useEffect, useState } from "react";
import TeacherSidebar from "@/components/TeacherSidebar";
import PortalTopbar from "@/components/PortalTopbar";
import { LoaderCircle, FileCheck2, Award } from "lucide-react";

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

export default function TestResultsPage() {
  const [exams, setExams] = useState<Exam[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const r = await fetch("/api/teacher/exams", { cache: "no-store" });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "Unable to load results.");
      setExams(j.exams || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to load results.");
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  const released = exams.filter((e) => e.status === "PUBLISHED");

  return (
    <>
      <PortalTopbar title="Test results" />
      <main className="mx-auto flex max-w-[1600px] gap-8 px-4 py-6 sm:px-6">
        <TeacherSidebar />
        <section className="min-w-0 flex-1 space-y-6">
          <div className="rounded-[2rem] bg-brand-navy p-7 text-white">
            <p className="text-xs font-bold uppercase tracking-widest text-brand-green">Outcomes</p>
            <h1 className="mt-2 font-display text-4xl tracking-widest">
              TEST <span className="text-brand-green">RESULTS</span>
            </h1>
            <p className="mt-3 max-w-2xl text-sm text-white/65">
              Released exam results and submission counts across your classes.
            </p>
          </div>

          {error && (
            <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-600">
              {error}
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-card)] p-4">
              <Award className="mb-2 text-[var(--text-accent)]" size={18} />
              <div className="font-display text-2xl">{released.length}</div>
              <div className="text-[10px] uppercase tracking-widest text-[var(--text-muted)]">
                Released
              </div>
            </div>
            <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-card)] p-4">
              <FileCheck2 className="mb-2 text-[var(--text-accent-warm)]" size={18} />
              <div className="font-display text-2xl">
                {exams.reduce((s, e) => s + e.submittedCount, 0)}
              </div>
              <div className="text-[10px] uppercase tracking-widest text-[var(--text-muted)]">
                Total submissions
              </div>
            </div>
            <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-card)] p-4">
              <LoaderCircle className="mb-2 text-blue-500" size={18} />
              <div className="font-display text-2xl">{exams.length}</div>
              <div className="text-[10px] uppercase tracking-widest text-[var(--text-muted)]">
                Exams
              </div>
            </div>
          </div>

          <div className="overflow-hidden rounded-3xl border border-[var(--border-subtle)] bg-[var(--surface-card)]">
            {loading ? (
              <div className="flex items-center justify-center gap-2 p-12 text-sm text-[var(--text-muted)]">
                <LoaderCircle className="animate-spin" size={18} /> Loading results…
              </div>
            ) : (
              <table className="w-full text-left text-sm">
                <thead className="bg-[var(--surface-disabled)] text-[10px] uppercase tracking-widest text-[var(--text-muted)]">
                  <tr>
                    <th className="p-4">Exam</th>
                    <th className="p-4">Subject · Class</th>
                    <th className="p-4">Marks</th>
                    <th className="p-4">Submissions</th>
                    <th className="p-4">Status</th>
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
                      <td className="p-4">{e.totalMarks}</td>
                      <td className="p-4 font-display text-base text-brand-green">
                        {e.submittedCount}
                      </td>
                      <td className="p-4 text-xs">{e.statusLabel || e.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {!loading && !exams.length && (
              <p className="p-10 text-center text-sm text-[var(--text-muted)]">No exams yet.</p>
            )}
          </div>
        </section>
      </main>
    </>
  );
}
