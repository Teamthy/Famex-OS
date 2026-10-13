"use client";

import { cacheGet, cacheSet } from "@/lib/offline/db";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import PortalTopbar from "@/components/PortalTopbar";
import TeacherSidebar from "@/components/TeacherSidebar";
import ConfirmDialog from "@/components/ConfirmDialog";
import { useToast } from "@/components/Toast";
import {
  BookOpen,
  CheckCircle2,
  Clock,
  LoaderCircle,
  Lock,
  Save,
  Send,
  ShieldCheck,
  TrendingUp,
} from "lucide-react";

type ScoreField = "ca1" | "ca2" | "midterm" | "assignment" | "exam";

type EntryRow = {
  studentProfileId: string;
  studentId: string;
  displayName: string;
  ca1: number;
  ca2: number;
  midterm: number;
  assignment: number;
  exam: number;
  total: number;
  grade: string;
};

type GradebookResponse = {
  teacher: { displayName: string };
  assignments: Array<{ id: string; subjectName: string; className: string }>;
  selectedAssignmentId?: string;
  scoreLimits: Record<ScoreField, number>;
  gradebook: {
    id: string;
    subjectName: string;
    className: string;
    sessionLabel: string;
    termLabel: string;
    status: "OPEN" | "SUBMITTED" | "LOCKED";
    statusLabel: string;
    submittedAt: string | null;
    lockedAt: string | null;
    isEditable: boolean;
    entries: EntryRow[];
  } | null;
};

const SCORE_FIELDS: Array<{ key: ScoreField; label: string }> = [
  { key: "ca1", label: "CA1" },
  { key: "ca2", label: "CA2" },
  { key: "midterm", label: "Midterm" },
  { key: "assignment", label: "Assignment" },
  { key: "exam", label: "Exam" },
];

function waecGrade(total: number) {
  if (total >= 75) return "A1";
  if (total >= 70) return "B2";
  if (total >= 65) return "B3";
  if (total >= 60) return "C4";
  if (total >= 55) return "C5";
  if (total >= 50) return "C6";
  if (total >= 45) return "D7";
  if (total >= 40) return "E8";
  return "F9";
}

export default function TeacherGradebookPage() {
  const { toast } = useToast();
  const searchParams = useSearchParams();
  const [data, setData] = useState<GradebookResponse | null>(null);
  const [rows, setRows] = useState<EntryRow[]>([]);
  const [selectedAssignmentId, setSelectedAssignmentId] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [, setIsStale] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [confirmSubmit, setConfirmSubmit] = useState(false);

  const loadGradebook = useCallback(async (assignmentId: string, _pushUrl = false) => {
    const query = assignmentId ? `?assignmentId=${encodeURIComponent(assignmentId)}` : "";
    const url = `/api/teacher/gradebook${query}`;
    // Offline: show cached data instantly
    const cached = await cacheGet<any>(url);
    if (cached) {
      const body = cached.data;
      setData(body);
      setRows(body?.gradebook?.entries || []);
      setSelectedAssignmentId(body?.selectedAssignmentId || assignmentId || "");
      setIsStale(true);
      setLoading(false);
    }
    if (typeof navigator !== "undefined" && !navigator.onLine) return;
    setLoading(!cached);
    setError("");
    try {
      const response = await fetch(url, { cache: "no-store" });
      const body = (await response.json()) as GradebookResponse & { error?: string };
      if (!response.ok) throw new Error(body.error || "Unable to load the gradebook.");
      setData(body);
      setRows(body.gradebook?.entries || []);
      setSelectedAssignmentId(body.selectedAssignmentId || "");
      setDirty(false);
      setIsStale(false);
      await cacheSet(url, body);
    } catch (loadError) {
      if (!cached)
        setError(loadError instanceof Error ? loadError.message : "Unable to load the gradebook.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const fromUrl = searchParams.get("assignmentId") || "";
    void loadGradebook(fromUrl, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadGradebook]);

  const limits = data?.scoreLimits || { ca1: 10, ca2: 10, midterm: 10, assignment: 10, exam: 60 };
  const isEditable = Boolean(data?.gradebook?.isEditable);

  const stats = useMemo(() => {
    if (!rows.length) return { average: 0, highest: 0, belowPass: 0 };
    const totals = rows.map((row) => row.total);
    return {
      average: Math.round(totals.reduce((sum, total) => sum + total, 0) / rows.length),
      highest: Math.max(...totals),
      belowPass: rows.filter((row) => row.total < 40).length,
    };
  }, [rows]);

  function handleScoreChange(studentProfileId: string, field: ScoreField, rawValue: string) {
    if (!isEditable) return;
    const max = limits[field];
    const value = Math.max(0, Math.min(max, Math.round(Number(rawValue) || 0)));
    setRows((previous) =>
      previous.map((row) => {
        if (row.studentProfileId !== studentProfileId) return row;
        const updated = { ...row, [field]: value };
        updated.total =
          updated.ca1 + updated.ca2 + updated.midterm + updated.assignment + updated.exam;
        updated.grade = waecGrade(updated.total);
        return updated;
      }),
    );
    setDirty(true);
  }

  async function persist(action: "SAVE" | "SUBMIT") {
    if (!selectedAssignmentId) return;
    setSaving(true);
    try {
      const response = await fetch("/api/teacher/gradebook", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assignmentId: selectedAssignmentId,
          action,
          scores: rows.map((row) => ({
            studentProfileId: row.studentProfileId,
            ca1: row.ca1,
            ca2: row.ca2,
            midterm: row.midterm,
            assignment: row.assignment,
            exam: row.exam,
          })),
        }),
      });
      const body = (await response.json()) as { ok?: boolean; message?: string; error?: string };
      if (!response.ok) throw new Error(body.error || "Unable to save scores.");
      toast(body.message || "Scores saved.", "success");
      await loadGradebook(selectedAssignmentId);
    } catch (saveError) {
      toast(saveError instanceof Error ? saveError.message : "Unable to save scores.", "error");
    } finally {
      setSaving(false);
      setConfirmSubmit(false);
    }
  }

  return (
    <>
      <PortalTopbar title="Gradebook" />
      <main className="min-h-screen bg-[var(--bg-primary)] theme-transition">
        <section className="bg-brand-navy px-6 pt-28 pb-14">
          <div className="mx-auto max-w-7xl">
            <div className="mb-3 flex flex-wrap items-center gap-3">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-brand-green/40 bg-brand-green/20 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-brand-green">
                <BookOpen size={11} /> Live gradebook
              </span>
              {data?.gradebook ? (
                <span className="text-xs text-white/45">
                  {data.gradebook.sessionLabel} · {data.gradebook.termLabel}
                </span>
              ) : null}
            </div>
            <h1 className="font-display text-4xl tracking-widest text-white md:text-6xl">
              GRADEBOOK <span className="text-brand-green">& CA SCORES</span>
            </h1>
            <p className="mt-3 max-w-2xl font-body text-sm text-white/60">
              Enter continuous assessment and exam scores. Save while working, then submit for
              administrative lock when the term&apos;s scores are final.
            </p>
          </div>
        </section>

        <section className="px-6 py-10">
          <div className="mx-auto flex max-w-7xl flex-col gap-8 lg:flex-row">
            <TeacherSidebar />

            <div className="min-w-0 flex-1 space-y-6">
              {error ? (
                <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-500">
                  {error}
                </div>
              ) : null}

              {loading ? (
                <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-card)] p-10 shadow-[var(--card-shadow)]">
                  <div className="flex items-center gap-3 text-[var(--text-secondary)]">
                    <LoaderCircle className="animate-spin text-brand-green" size={20} /> Loading
                    gradebook...
                  </div>
                </div>
              ) : null}

              {!loading && data && !data.assignments.length ? (
                <div className="rounded-[2rem] border border-[var(--border-subtle)] bg-[var(--surface-card)] p-10 text-center shadow-[var(--card-shadow)]">
                  <ShieldCheck className="mx-auto mb-4 text-[var(--text-accent-warm)]" size={36} />
                  <h2 className="font-display text-2xl text-[var(--text-primary)]">
                    No subject assignment found
                  </h2>
                  <p className="mx-auto mt-2 max-w-md text-sm text-[var(--text-secondary)]">
                    You have no active subject-teacher assignment. Contact the school administrator
                    to be assigned a subject and class before entering scores.
                  </p>
                </div>
              ) : null}

              {!loading && data?.gradebook ? (
                <>
                  <div className="grid gap-4 md:grid-cols-4">
                    <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-card)] p-4 shadow-[var(--card-shadow)] md:col-span-2">
                      <label className="mb-2 block text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--text-muted)]">
                        Subject · Class
                      </label>
                      <select
                        value={selectedAssignmentId}
                        onChange={(event) => void loadGradebook(event.target.value)}
                        disabled={saving}
                        className="w-full rounded-xl border border-[var(--input-border)] bg-[var(--input-bg)] px-4 py-3 text-sm text-[var(--input-text)] outline-none focus:border-[var(--input-border-focus)]"
                      >
                        {data.assignments.map((assignment) => (
                          <option key={assignment.id} value={assignment.id}>
                            {assignment.subjectName} — {assignment.className}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-card)] p-4 shadow-[var(--card-shadow)]">
                      <div className="mb-2 text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--text-muted)]">
                        Status
                      </div>
                      <div
                        className={`inline-flex items-center gap-2 rounded-full px-3 py-2 text-xs font-bold uppercase tracking-widest ${
                          data.gradebook.status === "LOCKED"
                            ? "bg-red-500/15 text-red-500"
                            : data.gradebook.status === "SUBMITTED"
                              ? "bg-brand-orange/15 text-brand-orange"
                              : "bg-brand-green/15 text-brand-green"
                        }`}
                      >
                        {data.gradebook.status === "OPEN" ? (
                          <Clock size={12} />
                        ) : (
                          <Lock size={12} />
                        )}
                        {data.gradebook.statusLabel}
                      </div>
                    </div>
                    <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-card)] p-4 shadow-[var(--card-shadow)]">
                      <div className="mb-2 text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--text-muted)]">
                        Class Average
                      </div>
                      <div className="flex items-center gap-2 font-display text-2xl text-[var(--text-accent)]">
                        <TrendingUp size={18} /> {stats.average}%
                      </div>
                    </div>
                  </div>

                  {!isEditable ? (
                    <div className="flex items-center gap-3 rounded-2xl border border-brand-orange/25 bg-brand-orange/10 px-5 py-4">
                      <Lock size={18} className="shrink-0 text-brand-orange" />
                      <p className="text-sm font-medium text-brand-orange">
                        {data.gradebook.status === "SUBMITTED"
                          ? "Scores submitted and awaiting administrative lock. Ask an administrator to reopen the gradebook if corrections are needed."
                          : "This gradebook has been locked by the administration and is read-only."}
                      </p>
                    </div>
                  ) : null}

                  <div className="overflow-hidden rounded-[2rem] border border-[var(--border-subtle)] bg-[var(--surface-card)] shadow-[var(--card-shadow)]">
                    <div className="flex flex-col justify-between gap-4 border-b border-[var(--border-subtle)] px-8 py-6 md:flex-row md:items-center">
                      <div>
                        <h2 className="font-display text-xl text-[var(--text-primary)]">
                          {data.gradebook.subjectName} — {data.gradebook.className}
                        </h2>
                        <p className="text-xs text-[var(--text-muted)]">
                          CA1: {limits.ca1} · CA2: {limits.ca2} · Midterm: {limits.midterm} ·
                          Assignment: {limits.assignment} · Exam: {limits.exam} — Total 100
                        </p>
                      </div>
                      <div className="flex gap-3">
                        <button
                          onClick={() => void persist("SAVE")}
                          disabled={!isEditable || saving || !dirty}
                          className="inline-flex items-center gap-2 rounded-full bg-brand-green px-6 py-2.5 text-xs font-bold text-brand-navy shadow-lg transition-all hover:bg-brand-green-dark disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {saving ? (
                            <LoaderCircle size={14} className="animate-spin" />
                          ) : (
                            <Save size={14} />
                          )}{" "}
                          Save Progress
                        </button>
                        <button
                          onClick={() => setConfirmSubmit(true)}
                          disabled={!isEditable || saving}
                          className="inline-flex items-center gap-2 rounded-full bg-brand-orange px-6 py-2.5 text-xs font-bold text-brand-navy shadow-lg transition-all hover:bg-brand-orange-dark disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          <Send size={14} /> Submit Final
                        </button>
                      </div>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-brand-navy">
                          <tr>
                            <th className="px-4 py-3 text-left font-display text-[10px] uppercase tracking-wider text-white/70">
                              Student
                            </th>
                            {SCORE_FIELDS.map((field) => (
                              <th
                                key={field.key}
                                className="px-4 py-3 text-center font-display text-[10px] uppercase tracking-wider text-white/70"
                              >
                                {field.label}{" "}
                                <span className="text-white/40">/{limits[field.key]}</span>
                              </th>
                            ))}
                            <th className="px-4 py-3 text-center font-display text-[10px] uppercase tracking-wider text-white/70">
                              Total
                            </th>
                            <th className="px-4 py-3 text-center font-display text-[10px] uppercase tracking-wider text-white/70">
                              Grade
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {rows.map((row) => {
                            const belowPass = row.total < 40;
                            return (
                              <tr
                                key={row.studentProfileId}
                                className={`border-b border-[var(--border-subtle)] transition-colors ${belowPass ? "bg-red-500/5" : "hover:bg-[var(--surface-disabled)]"}`}
                              >
                                <td className="px-4 py-3">
                                  <div className="font-bold text-[var(--text-primary)]">
                                    {row.displayName}
                                  </div>
                                  <div className="text-[10px] text-[var(--text-muted)]">
                                    {row.studentId}
                                  </div>
                                </td>
                                {SCORE_FIELDS.map((field) => (
                                  <td key={field.key} className="px-2 py-3 text-center">
                                    <input
                                      type="number"
                                      inputMode="numeric"
                                      min={0}
                                      max={limits[field.key]}
                                      value={row[field.key]}
                                      onChange={(event) =>
                                        handleScoreChange(
                                          row.studentProfileId,
                                          field.key,
                                          event.target.value,
                                        )
                                      }
                                      disabled={!isEditable || saving}
                                      aria-label={`${row.displayName} ${field.label}`}
                                      className="w-16 rounded-lg border border-[var(--input-border)] bg-[var(--input-bg)] px-2 py-2 text-center text-sm text-[var(--input-text)] outline-none focus:border-[var(--input-border-focus)] disabled:opacity-60"
                                    />
                                  </td>
                                ))}
                                <td
                                  className={`px-4 py-3 text-center font-display text-base font-bold ${belowPass ? "text-red-500" : "text-brand-green"}`}
                                >
                                  {row.total}
                                </td>
                                <td className="px-4 py-3 text-center">
                                  <span
                                    className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest ${
                                      row.total >= 70
                                        ? "bg-brand-green/15 text-brand-green"
                                        : row.total >= 45
                                          ? "bg-brand-orange/15 text-brand-orange"
                                          : "bg-red-500/15 text-red-500"
                                    }`}
                                  >
                                    {row.grade}
                                  </span>
                                </td>
                              </tr>
                            );
                          })}
                          {!rows.length ? (
                            <tr>
                              <td
                                colSpan={8}
                                className="px-6 py-10 text-center text-sm text-[var(--text-muted)]"
                              >
                                No active students found in this class.
                              </td>
                            </tr>
                          ) : null}
                        </tbody>
                      </table>
                    </div>

                    <div className="flex flex-wrap items-center gap-6 border-t border-[var(--border-subtle)] px-8 py-5 text-xs text-[var(--text-muted)]">
                      <span className="inline-flex items-center gap-2">
                        <CheckCircle2 size={14} className="text-brand-green" /> Highest score:{" "}
                        <strong className="text-[var(--text-primary)]">{stats.highest}</strong>
                      </span>
                      <span className="inline-flex items-center gap-2">
                        <TrendingUp size={14} className="text-brand-green" /> Class average:{" "}
                        <strong className="text-[var(--text-primary)]">{stats.average}</strong>
                      </span>
                      <span className="inline-flex items-center gap-2">
                        <ShieldCheck size={14} className="text-brand-orange" /> Below pass mark:{" "}
                        <strong className="text-[var(--text-primary)]">{stats.belowPass}</strong>
                      </span>
                      {dirty ? (
                        <span className="font-bold text-brand-orange">Unsaved changes</span>
                      ) : null}
                    </div>
                  </div>
                </>
              ) : null}
            </div>
          </div>
        </section>
      </main>

      <ConfirmDialog
        open={confirmSubmit}
        title="Submit final scores?"
        message="Submitting marks this gradebook as final and sends it to the administration for locking. You will not be able to edit scores after submission unless an administrator reopens the gradebook."
        confirmText="Submit Final Scores"
        cancelText="Keep Editing"
        variant="warning"
        onConfirm={() => void persist("SUBMIT")}
        onCancel={() => setConfirmSubmit(false)}
      />
    </>
  );
}
