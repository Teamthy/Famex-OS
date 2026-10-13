"use client";

import { useCallback, useEffect, useState } from "react";
import TeacherSidebar from "@/components/TeacherSidebar";
import PortalTopbar from "@/components/PortalTopbar";
import { useToast } from "@/components/Toast";
import { LoaderCircle, RotateCcw, CheckCircle2 } from "lucide-react";

type Exam = { id: string; title: string; subjectName: string; className: string };
type Row = {
  id: string;
  studentId: string;
  displayName: string;
  hasRetake: boolean;
  retakeUsed: boolean;
};

export default function TestRetakePage() {
  const { toast } = useToast();
  const [exams, setExams] = useState<Exam[]>([]);
  const [examId, setExamId] = useState("");
  const [rows, setRows] = useState<Row[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [, setLoadingExams] = useState(true);
  const [loadingRows, setLoadingRows] = useState(false);
  const [granting, setGranting] = useState(false);

  // load the teacher's exams
  const loadExams = useCallback(async () => {
    setLoadingExams(true);
    try {
      const r = await fetch("/api/teacher/exams", { cache: "no-store" });
      const j = await r.json();
      if (r.ok) setExams(j.exams || []);
    } catch {
      /* ignore */
    } finally {
      setLoadingExams(false);
    }
  }, []);
  useEffect(() => {
    void loadExams();
  }, [loadExams]);

  // load students + retake status for the selected exam
  const loadRows = useCallback(
    async (id: string) => {
      if (!id) {
        setRows([]);
        return;
      }
      setLoadingRows(true);
      setSelected(new Set());
      try {
        const r = await fetch(`/api/teacher/exams/${id}/retake`, { cache: "no-store" });
        const j = await r.json();
        if (r.ok) setRows(j.students || []);
        else toast(j.error || "Unable to load students.", "error");
      } catch {
        toast("Unable to load students.", "error");
      } finally {
        setLoadingRows(false);
      }
    },
    [toast],
  );

  useEffect(() => {
    if (examId) void loadRows(examId);
  }, [examId, loadRows]);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }
  function toggleAll() {
    setSelected((prev) => (prev.size === rows.length ? new Set() : new Set(rows.map((r) => r.id))));
  }

  async function grant() {
    if (!examId || !selected.size) {
      toast("Select an exam and at least one student.", "warning");
      return;
    }
    setGranting(true);
    try {
      const r = await fetch(`/api/teacher/exams/${examId}/retake`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentProfileIds: [...selected] }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "Grant failed.");
      toast(j.message || "Retake enabled.", "success");
      setSelected(new Set());
      await loadRows(examId);
    } catch (e) {
      toast(e instanceof Error ? e.message : "Grant failed.", "error");
    } finally {
      setGranting(false);
    }
  }

  return (
    <>
      <PortalTopbar title="Test retake" />
      <main className="mx-auto flex max-w-[1600px] gap-8 px-4 py-6 sm:px-6">
        <TeacherSidebar />
        <section className="min-w-0 flex-1 space-y-6">
          <div className="rounded-[2rem] bg-brand-navy p-7 text-white">
            <p className="text-xs font-bold uppercase tracking-widest text-brand-green">
              Second chances
            </p>
            <h1 className="mt-2 font-display text-4xl tracking-widest">
              TEST <span className="text-brand-green">RETAKE</span>
            </h1>
            <p className="mt-3 max-w-2xl text-sm text-white/65">
              Grant a retake to one student or the whole class. The student can then start a fresh
              attempt from their exams page.
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <label className="flex-1 text-xs font-bold uppercase tracking-widest">
              Select exam
              <select
                value={examId}
                onChange={(e) => setExamId(e.target.value)}
                className="mt-2 w-full rounded-xl border border-[var(--input-border)] bg-[var(--input-bg)] p-3 text-sm normal-case"
              >
                <option value="">— choose an exam —</option>
                {exams.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.title} · {e.subjectName} · {e.className}
                  </option>
                ))}
              </select>
            </label>
            {examId && (
              <button
                onClick={grant}
                disabled={granting || !selected.size}
                className="inline-flex items-center justify-center gap-2 rounded-full bg-brand-green px-6 py-3 text-xs font-bold uppercase tracking-widest text-brand-navy disabled:opacity-50"
              >
                {granting ? (
                  <LoaderCircle className="animate-spin" size={15} />
                ) : (
                  <RotateCcw size={15} />
                )}
                Grant retake ({selected.size})
              </button>
            )}
          </div>

          {!examId ? (
            <p className="p-10 text-center text-sm text-[var(--text-muted)]">
              Pick an exam to see its class students.
            </p>
          ) : loadingRows ? (
            <div className="flex items-center gap-2 p-10 text-[var(--text-muted)]">
              <LoaderCircle className="animate-spin" size={18} /> Loading students…
            </div>
          ) : (
            <div className="overflow-hidden rounded-3xl border border-[var(--border-subtle)] bg-[var(--surface-card)]">
              <div className="flex items-center justify-between border-b border-[var(--border-subtle)] p-4">
                <span className="text-[10px] uppercase tracking-widest text-[var(--text-muted)]">
                  {rows.length} students
                </span>
                <button
                  onClick={toggleAll}
                  className="text-[10px] font-bold uppercase tracking-widest text-brand-green"
                >
                  {selected.size === rows.length && rows.length ? "Clear all" : "Select all"}
                </button>
              </div>
              <table className="w-full text-left text-sm">
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id} className="border-t border-[var(--border-subtle)]">
                      <td className="w-10 p-4">
                        <input
                          type="checkbox"
                          checked={selected.has(r.id)}
                          onChange={() => toggle(r.id)}
                          className="h-4 w-4 accent-brand-green"
                        />
                      </td>
                      <td className="p-4">
                        <b>{r.displayName}</b>
                        <span className="mt-1 block font-mono text-xs text-[var(--text-muted)]">
                          {r.studentId}
                        </span>
                      </td>
                      <td className="p-4 text-right">
                        {r.hasRetake && !r.retakeUsed && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-brand-green/15 px-2 py-1 text-[10px] font-bold uppercase tracking-widest text-brand-green">
                            <CheckCircle2 size={11} /> Retake ready
                          </span>
                        )}
                        {r.retakeUsed && (
                          <span className="rounded-full bg-[var(--surface-disabled)] px-2 py-1 text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)]">
                            Used
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!rows.length && (
                <p className="p-10 text-center text-sm text-[var(--text-muted)]">
                  No active students in this class.
                </p>
              )}
            </div>
          )}
        </section>
      </main>
    </>
  );
}
