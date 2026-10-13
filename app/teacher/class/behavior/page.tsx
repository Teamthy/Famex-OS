"use client";

import { useMemo, useState } from "react";
import PortalTopbar from "@/components/PortalTopbar";
import TeacherSidebar from "@/components/TeacherSidebar";
import ConfirmDialog from "@/components/ConfirmDialog";
import { useApi } from "@/lib/useApi";
import { useToast } from "@/components/Toast";
import {
  Plus,
  Award,
  AlertTriangle,
  FileText,
  X,
  School,
  Bell,
  Trash2,
  Search,
} from "lucide-react";

type RecordType = "COMMENDATION" | "WARNING" | "NOTE";

type BehaviorRecord = {
  id: string;
  type: RecordType;
  category: string | null;
  description: string;
  at: string;
  parentNotified: boolean;
  recordedBy: string;
  studentProfileId: string;
  studentName: string;
};

type BehaviorResponse = {
  className: string | null;
  students: { id: string; studentId: string; displayName: string; className: string | null }[];
  recent: BehaviorRecord[];
  summary: { total: number; commendations: number; warnings: number; notes: number };
};

const TYPE_CONFIG: Record<
  RecordType,
  { label: string; icon: typeof Award; color: string; bg: string; border: string }
> = {
  COMMENDATION: {
    label: "Commendation",
    icon: Award,
    color: "text-brand-green",
    bg: "bg-brand-green/10",
    border: "border-brand-green/30",
  },
  WARNING: {
    label: "Warning",
    icon: AlertTriangle,
    color: "text-red-500",
    bg: "bg-red-500/10",
    border: "border-red-500/30",
  },
  NOTE: {
    label: "Note",
    icon: FileText,
    color: "text-blue-500",
    bg: "bg-blue-500/10",
    border: "border-blue-500/30",
  },
};

const CATEGORIES = [
  "Punctuality",
  "Teamwork",
  "Effort",
  "Uniform",
  "Homework",
  "Conduct",
  "Leadership",
];

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default function BehaviorRecordsPage() {
  const { toast } = useToast();

  // Previously this page held records in useState, so everything a teacher
  // typed vanished on refresh. It now reads and writes the real API.
  const { data, loading, error, refetch } = useApi<BehaviorResponse>("/api/teacher/class/behavior");

  const students = data?.students ?? [];
  const records = useMemo(() => data?.recent ?? [], [data]);
  const summary = data?.summary ?? { total: 0, commendations: 0, warnings: 0, notes: 0 };

  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<BehaviorRecord | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"all" | RecordType>("all");

  const [form, setForm] = useState({
    studentProfileId: "",
    type: "COMMENDATION" as RecordType,
    category: "",
    description: "",
    notifyParent: true,
  });

  const visible = useMemo(() => {
    let list = records;
    if (filter !== "all") list = list.filter((r) => r.type === filter);
    if (query.trim()) {
      const needle = query.toLowerCase();
      list = list.filter((r) =>
        `${r.studentName} ${r.description} ${r.category ?? ""}`.toLowerCase().includes(needle),
      );
    }
    return list;
  }, [records, filter, query]);

  function resetForm() {
    setForm({
      studentProfileId: "",
      type: "COMMENDATION",
      category: "",
      description: "",
      notifyParent: true,
    });
    setFormError(null);
  }

  async function handleAdd() {
    if (!form.studentProfileId) {
      setFormError("Choose a student.");
      return;
    }
    if (form.description.trim().length < 2) {
      setFormError("Describe what happened.");
      return;
    }
    setFormError(null);
    setSaving(true);
    try {
      const res = await fetch("/api/teacher/class/behavior", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentProfileId: form.studentProfileId,
          type: form.type,
          category: form.category.trim() || undefined,
          description: form.description.trim(),
          notifyParent: form.notifyParent,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Could not save the record.");

      toast(form.notifyParent ? "Record saved & guardian notified" : "Record saved", "success");
      setShowModal(false);
      resetForm();
      await refetch();
    } catch (e) {
      setFormError(e instanceof Error ? e.message : "Could not save the record.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!pendingDelete) return;
    setDeleting(true);
    try {
      const res = await fetch(
        `/api/teacher/class/behavior?id=${encodeURIComponent(pendingDelete.id)}`,
        { method: "DELETE" },
      );
      const json = await res.json();
      // The API refuses records authored by a colleague — surface that plainly
      // rather than leaving the row on screen with no explanation.
      if (!res.ok) throw new Error(json.error || "Could not delete the record.");
      toast("Record deleted", "info");
      setPendingDelete(null);
      await refetch();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Could not delete the record.", "error");
      setPendingDelete(null);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <>
      <PortalTopbar />
      <main className="bg-[var(--bg-primary)] min-h-screen theme-transition">
        <section className="pt-24 pb-10 bg-brand-navy px-6">
          <div className="mx-auto max-w-7xl">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-brand-orange/20 border border-brand-orange/40 text-brand-orange text-[10px] font-bold uppercase tracking-widest mb-3">
              <School size={11} /> Form Teacher{data?.className ? ` · ${data.className}` : ""}
            </span>
            <h1 className="font-display text-4xl md:text-5xl tracking-widest text-white mb-2">
              BEHAVIOR <span className="text-brand-orange">RECORDS</span>
            </h1>
            <p className="text-white/60 text-sm">
              Log commendations, warnings, and notes for students in your classes.
            </p>
          </div>
        </section>

        <section className="py-10 px-6">
          <div className="mx-auto max-w-7xl flex flex-col lg:flex-row gap-8">
            <TeacherSidebar />

            <div className="flex-1 min-w-0 space-y-6">
              {error ? (
                <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4 flex items-center justify-between gap-4">
                  <p className="text-sm text-red-400">{error}</p>
                  <button
                    onClick={() => void refetch()}
                    className="text-xs font-bold text-red-400 hover:underline shrink-0"
                  >
                    Retry
                  </button>
                </div>
              ) : null}

              {/* Stats */}
              <div className="grid grid-cols-3 gap-4">
                {(["COMMENDATION", "WARNING", "NOTE"] as const).map((t) => {
                  const cfg = TYPE_CONFIG[t];
                  const value =
                    t === "COMMENDATION"
                      ? summary.commendations
                      : t === "WARNING"
                        ? summary.warnings
                        : summary.notes;
                  return (
                    <div key={t} className={`rounded-2xl ${cfg.bg} border ${cfg.border} p-5`}>
                      <cfg.icon className={`${cfg.color} mb-3`} size={22} />
                      <div className={`font-display text-3xl ${cfg.color}`}>
                        {loading ? "—" : value}
                      </div>
                      <div className={`text-xs uppercase tracking-widest ${cfg.color} mt-1`}>
                        {cfg.label}s
                      </div>
                    </div>
                  );
                })}
              </div>

              <button
                onClick={() => setShowModal(true)}
                disabled={students.length === 0}
                className="w-full py-4 rounded-2xl border-2 border-dashed border-brand-orange/40 text-brand-orange font-bold hover:bg-brand-orange/5 transition-all flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Plus size={18} /> Add New Behavior Record
              </button>

              {/* Search + filter */}
              {records.length > 0 ? (
                <div className="flex flex-col sm:flex-row gap-3">
                  <div className="flex-1 flex items-center gap-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-card)] px-4">
                    <Search size={16} className="text-[var(--text-muted)]" />
                    <input
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder="Search student, note or category…"
                      className="flex-1 bg-transparent py-3 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none"
                    />
                  </div>
                  <div className="flex gap-2">
                    {(["all", "COMMENDATION", "WARNING"] as const).map((f) => (
                      <button
                        key={f}
                        onClick={() => setFilter(f)}
                        className={`px-4 py-2 rounded-xl text-xs font-bold transition-colors ${
                          filter === f
                            ? "bg-brand-orange text-white"
                            : "border border-[var(--border-subtle)] text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                        }`}
                      >
                        {f === "all" ? "All" : f === "COMMENDATION" ? "Praise" : "Warnings"}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}

              {/* Records */}
              {loading ? (
                <div className="space-y-3">
                  {[0, 1, 2].map((i) => (
                    <div
                      key={i}
                      className="h-28 rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-card)] animate-pulse"
                    />
                  ))}
                </div>
              ) : visible.length === 0 ? (
                <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-card)] p-12 text-center">
                  <Award size={38} className="mx-auto mb-3 text-[var(--text-muted)]" />
                  <p className="text-sm font-semibold text-[var(--text-primary)]">
                    {query || filter !== "all" ? "No matches" : "No records yet"}
                  </p>
                  <p className="mt-1 text-xs text-[var(--text-muted)]">
                    {query || filter !== "all"
                      ? "Try a different search or filter."
                      : "Log a commendation or a concern as it happens."}
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {visible.map((r) => {
                    const config = TYPE_CONFIG[r.type] ?? TYPE_CONFIG.NOTE;
                    return (
                      <div
                        key={r.id}
                        className={`p-5 rounded-2xl bg-[var(--surface-card)] border-l-4 ${config.border} border-y border-r border-[var(--border-subtle)] shadow-[var(--card-shadow)]`}
                      >
                        <div className="flex items-start gap-4">
                          <div
                            className={`w-11 h-11 rounded-xl ${config.bg} ${config.color} flex items-center justify-center shrink-0`}
                          >
                            <config.icon size={20} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-3 mb-2">
                              <div className="min-w-0">
                                <div className="font-bold text-[var(--text-primary)] truncate">
                                  {r.studentName}
                                </div>
                                <div className="text-[11px] text-[var(--text-muted)]">
                                  {formatDate(r.at)}
                                </div>
                              </div>
                              <div className="flex items-center gap-2 shrink-0">
                                <span
                                  className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-widest ${config.bg} ${config.color}`}
                                >
                                  {config.label}
                                </span>
                                <button
                                  onClick={() => setPendingDelete(r)}
                                  aria-label="Delete record"
                                  className="rounded-lg p-1.5 text-[var(--text-muted)] hover:bg-red-500/10 hover:text-red-500 transition-colors"
                                >
                                  <Trash2 size={14} />
                                </button>
                              </div>
                            </div>
                            {r.category ? (
                              <div className="text-xs text-brand-orange font-bold uppercase tracking-widest mb-1">
                                {r.category}
                              </div>
                            ) : null}
                            <p className="text-sm text-[var(--text-secondary)] mb-3">
                              {r.description}
                            </p>
                            <div className="flex items-center gap-3 text-[10px] text-[var(--text-muted)]">
                              <span>By {r.recordedBy}</span>
                              {r.parentNotified && (
                                <span className="inline-flex items-center gap-1 text-brand-green">
                                  <Bell size={10} /> Guardian notified
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </section>
      </main>

      <ConfirmDialog
        open={!!pendingDelete}
        variant="danger"
        title="Delete record?"
        message={
          pendingDelete
            ? `${pendingDelete.studentName} — "${pendingDelete.description.slice(0, 80)}${
                pendingDelete.description.length > 80 ? "…" : ""
              }". This cannot be undone.`
            : ""
        }
        confirmText={deleting ? "Deleting…" : "Delete"}
        cancelText="Keep"
        onCancel={() => {
          if (!deleting) setPendingDelete(null);
        }}
        onConfirm={() => {
          if (!deleting) void handleDelete();
        }}
      />

      {/* Add Record Modal */}
      {showModal && (
        <div
          className="fixed inset-0 z-[150] bg-black/80 backdrop-blur-sm flex items-center justify-center p-6"
          onClick={() => {
            if (!saving) {
              setShowModal(false);
              resetForm();
            }
          }}
        >
          <div
            className="rounded-3xl max-w-lg w-full p-8 max-h-[90vh] overflow-y-auto"
            style={{ backgroundColor: "#0C1824" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-display text-xl text-white">Add Behavior Record</h3>
              <button
                onClick={() => {
                  setShowModal(false);
                  resetForm();
                }}
                className="text-white/60 hover:text-white"
              >
                <X size={20} />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-xs font-bold uppercase tracking-widest text-brand-orange block mb-2">
                  Student
                </label>
                <select
                  value={form.studentProfileId}
                  onChange={(e) => setForm({ ...form, studentProfileId: e.target.value })}
                  className="w-full p-3 rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none focus:border-brand-orange"
                >
                  <option value="">Select student...</option>
                  {students.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.displayName} ({s.studentId})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-bold uppercase tracking-widest text-brand-orange block mb-2">
                  Type
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(["COMMENDATION", "WARNING", "NOTE"] as const).map((t) => {
                    const config = TYPE_CONFIG[t];
                    return (
                      <button
                        key={t}
                        onClick={() => setForm({ ...form, type: t })}
                        className={`p-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                          form.type === t
                            ? `${config.bg} ${config.color} border-2 ${config.border}`
                            : "bg-white/5 text-white/60 border-2 border-transparent hover:bg-white/10"
                        }`}
                      >
                        <config.icon size={12} /> {config.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="text-xs font-bold uppercase tracking-widest text-brand-orange block mb-2">
                  Category
                </label>
                <div className="flex flex-wrap gap-2 mb-2">
                  {CATEGORIES.map((c) => (
                    <button
                      key={c}
                      onClick={() => setForm({ ...form, category: form.category === c ? "" : c })}
                      className={`px-3 py-1.5 rounded-full text-[11px] font-medium transition-colors ${
                        form.category === c
                          ? "bg-brand-orange text-white"
                          : "bg-white/5 text-white/60 hover:bg-white/10"
                      }`}
                    >
                      {c}
                    </button>
                  ))}
                </div>
                <input
                  value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value })}
                  placeholder="Or type your own…"
                  className="w-full p-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder:text-white/30 focus:outline-none focus:border-brand-orange"
                />
              </div>

              <div>
                <label className="text-xs font-bold uppercase tracking-widest text-brand-orange block mb-2">
                  Description
                </label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  rows={4}
                  placeholder="Keep it factual — a guardian may read this."
                  className="w-full p-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder:text-white/30 focus:outline-none focus:border-brand-orange resize-none"
                />
              </div>

              <label className="flex items-center gap-3 p-3 rounded-xl bg-white/5 cursor-pointer hover:bg-white/10">
                <input
                  type="checkbox"
                  checked={form.notifyParent}
                  onChange={(e) => setForm({ ...form, notifyParent: e.target.checked })}
                  className="w-4 h-4 accent-brand-orange"
                />
                <div className="flex-1">
                  <div className="text-sm text-white font-medium">Notify guardian</div>
                  <div className="text-[10px] text-white/50">
                    Sends this note to the linked parents in their portal
                  </div>
                </div>
              </label>

              {formError ? <p className="text-xs text-red-400">{formError}</p> : null}

              <button
                onClick={handleAdd}
                disabled={saving}
                className="w-full py-3 rounded-full bg-brand-orange text-brand-navy font-bold text-sm hover:bg-brand-orange-dark transition-all disabled:opacity-60"
              >
                {saving ? "Saving…" : "Save Record"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
