"use client";

import { useCallback, useEffect, useState } from "react";
import PortalTopbar from "@/components/PortalTopbar";
import AdminSidebar from "@/components/AdminSidebar";
import { useToast } from "@/components/Toast";
import { AlertCircle, BookOpen, LoaderCircle, Plus, Sparkles, Trash2, Users } from "lucide-react";

/**
 * Subject catalogue.
 *
 * Subjects were free-text strings, so there was nowhere to record that Maths
 * is compulsory and Further Maths is chosen — every exam therefore appeared
 * for every student in the class.
 */

type Subject = {
  id: string;
  name: string;
  code: string | null;
  level: string;
  category: "COMPULSORY" | "ELECTIVE";
  studentCount: number;
};

type Payload = {
  selectedLevel: string | null;
  levels: string[];
  hasDefaultsFor: string[];
  subjects: Subject[];
};

export default function AdminSubjectsPage() {
  const { toast } = useToast();
  const [data, setData] = useState<Payload | null>(null);
  const [level, setLevel] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [category, setCategory] = useState<"COMPULSORY" | "ELECTIVE">("COMPULSORY");

  const load = useCallback(async (selected?: string) => {
    setLoading(true);
    setError("");
    try {
      const query = selected ? `?level=${encodeURIComponent(selected)}` : "";
      const response = await fetch(`/api/admin/subjects${query}`, { cache: "no-store" });
      const body = (await response.json()) as Payload & { error?: string };
      if (!response.ok) throw new Error(body.error || "Unable to load subjects.");
      setData(body);
      if (!selected && body.levels.length) setLevel(body.levels[0]);
      else if (selected) setLevel(selected);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load subjects.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function addSubject() {
    if (!name.trim() || !level) return;
    setBusy(true);
    try {
      const response = await fetch("/api/admin/subjects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ level, name, code: code.trim() || null, category }),
      });
      const body = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(body.error || "Unable to save.");
      toast(`${name.trim()} added to ${level}.`, "success");
      setName("");
      setCode("");
      await load(level);
    } catch (saveError) {
      toast(saveError instanceof Error ? saveError.message : "Unable to save.", "error");
    } finally {
      setBusy(false);
    }
  }

  async function runAction(action: "SEED_DEFAULTS" | "SYNC_COMPULSORY") {
    setBusy(true);
    try {
      const response = await fetch("/api/admin/subjects", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, level }),
      });
      const body = (await response.json()) as { message?: string; error?: string };
      if (!response.ok) throw new Error(body.error || "Action failed.");
      toast(body.message || "Done.", "success");
      await load(level);
    } catch (actionError) {
      toast(actionError instanceof Error ? actionError.message : "Action failed.", "error");
    } finally {
      setBusy(false);
    }
  }

  async function retire(subject: Subject) {
    setBusy(true);
    try {
      const response = await fetch(`/api/admin/subjects?id=${encodeURIComponent(subject.id)}`, {
        method: "DELETE",
      });
      const body = (await response.json()) as { message?: string; error?: string };
      if (!response.ok) throw new Error(body.error || "Unable to retire.");
      toast(body.message || "Retired.", "success");
      await load(level);
    } catch (deleteError) {
      toast(deleteError instanceof Error ? deleteError.message : "Unable to retire.", "error");
    } finally {
      setBusy(false);
    }
  }

  const compulsory = (data?.subjects ?? []).filter((s) => s.category === "COMPULSORY");
  const electives = (data?.subjects ?? []).filter((s) => s.category === "ELECTIVE");

  return (
    <>
      <PortalTopbar title="Subjects" />
      <main className="min-h-screen bg-[var(--bg-primary)] theme-transition">
        <section className="bg-brand-navy px-6 pt-28 pb-14">
          <div className="mx-auto max-w-7xl">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-brand-green/40 bg-brand-green/20 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-brand-green">
              <BookOpen size={11} /> Curriculum
            </span>
            <h1 className="mt-3 font-display text-4xl tracking-widest text-white md:text-6xl">
              SUBJECT <span className="text-brand-green">CATALOGUE</span>
            </h1>
            <p className="mt-3 max-w-2xl font-body text-sm text-white/60">
              Compulsory subjects are taken by every student at the level. Electives are chosen per
              student, so exams and gradebooks only appear for those who take them.
            </p>
          </div>
        </section>

        <section className="px-6 py-10">
          <div className="mx-auto flex max-w-7xl flex-col gap-8 lg:flex-row">
            <AdminSidebar />

            <div className="min-w-0 flex-1 space-y-6">
              {error ? (
                <div className="flex items-center gap-3 rounded-2xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-500">
                  <AlertCircle size={18} className="shrink-0" />
                  <span className="flex-1">{error}</span>
                  <button
                    onClick={() => void load()}
                    className="font-bold uppercase tracking-widest"
                  >
                    Retry
                  </button>
                </div>
              ) : null}

              {loading ? (
                <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-card)] p-10">
                  <div className="flex items-center gap-3 text-[var(--text-secondary)]">
                    <LoaderCircle className="animate-spin text-brand-green" size={20} /> Loading…
                  </div>
                </div>
              ) : null}

              {!loading && data ? (
                <>
                  <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-card)] p-4">
                    <label className="flex-1 min-w-[160px]">
                      <span className="mb-2 block text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--text-muted)]">
                        Level
                      </span>
                      <select
                        value={level}
                        onChange={(event) => {
                          setLevel(event.target.value);
                          void load(event.target.value);
                        }}
                        className="w-full rounded-xl border border-[var(--input-border)] bg-[var(--input-bg)] p-3 text-sm text-[var(--input-text)]"
                      >
                        {data.levels.map((l) => (
                          <option key={l} value={l}>
                            {l}
                          </option>
                        ))}
                      </select>
                    </label>

                    {data.hasDefaultsFor.includes(level) && !data.subjects.length ? (
                      <button
                        onClick={() => void runAction("SEED_DEFAULTS")}
                        disabled={busy}
                        className="inline-flex items-center gap-2 rounded-full border border-brand-green/40 px-5 py-3 text-xs font-bold uppercase tracking-widest text-brand-green disabled:opacity-60"
                      >
                        <Sparkles size={13} /> Use {level} defaults
                      </button>
                    ) : null}

                    <button
                      onClick={() => void runAction("SYNC_COMPULSORY")}
                      disabled={busy || !compulsory.length}
                      title="Enrol every student at this level into its compulsory subjects. Safe to re-run."
                      className="inline-flex items-center gap-2 rounded-full bg-brand-green px-5 py-3 text-xs font-bold uppercase tracking-widest text-brand-navy disabled:opacity-60"
                    >
                      <Users size={13} /> Enrol students
                    </button>
                  </div>

                  {/* Add a subject */}
                  <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-card)] p-4">
                    <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--text-muted)]">
                      Add a subject to {level}
                    </p>
                    <div className="flex flex-wrap items-end gap-2">
                      <input
                        value={name}
                        onChange={(event) => setName(event.target.value)}
                        placeholder="Subject name"
                        className="min-w-[180px] flex-1 rounded-xl border border-[var(--input-border)] bg-[var(--input-bg)] p-3 text-sm text-[var(--input-text)]"
                      />
                      <input
                        value={code}
                        onChange={(event) => setCode(event.target.value)}
                        placeholder="Code"
                        maxLength={12}
                        className="w-24 rounded-xl border border-[var(--input-border)] bg-[var(--input-bg)] p-3 text-sm uppercase text-[var(--input-text)]"
                      />
                      <select
                        value={category}
                        onChange={(event) =>
                          setCategory(event.target.value as "COMPULSORY" | "ELECTIVE")
                        }
                        className="rounded-xl border border-[var(--input-border)] bg-[var(--input-bg)] p-3 text-sm text-[var(--input-text)]"
                      >
                        <option value="COMPULSORY">Compulsory</option>
                        <option value="ELECTIVE">Elective</option>
                      </select>
                      <button
                        onClick={() => void addSubject()}
                        disabled={busy || !name.trim()}
                        className="inline-flex items-center gap-2 rounded-full bg-brand-green px-6 py-3 text-sm font-bold text-brand-navy disabled:opacity-60"
                      >
                        <Plus size={15} /> Add
                      </button>
                    </div>
                  </div>

                  {[
                    { title: "Compulsory", rows: compulsory, hint: "Every student takes these." },
                    { title: "Electives", rows: electives, hint: "Chosen per student." },
                  ].map((group) => (
                    <div key={group.title}>
                      <h2 className="mb-3 font-display text-xl tracking-widest text-[var(--text-primary)]">
                        {group.title.toUpperCase()}
                        <span className="ml-3 text-xs font-normal tracking-normal text-[var(--text-muted)]">
                          {group.hint}
                        </span>
                      </h2>
                      <div className="grid gap-3 sm:grid-cols-2">
                        {group.rows.map((subject) => (
                          <div
                            key={subject.id}
                            className="flex items-center justify-between gap-3 rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-card)] p-4"
                          >
                            <div className="min-w-0">
                              <b className="text-[var(--text-primary)]">{subject.name}</b>
                              {subject.code ? (
                                <span className="ml-2 rounded bg-[var(--surface-disabled)] px-1.5 py-0.5 text-[10px] text-[var(--text-muted)]">
                                  {subject.code}
                                </span>
                              ) : null}
                              <p className="mt-0.5 text-xs text-[var(--text-muted)]">
                                {subject.studentCount} student
                                {subject.studentCount === 1 ? "" : "s"} enrolled
                              </p>
                            </div>
                            <button
                              onClick={() => void retire(subject)}
                              disabled={busy}
                              title="Retire — keeps existing gradebooks and enrolment history"
                              aria-label={`Retire ${subject.name}`}
                              className="rounded-xl p-2 text-[var(--text-muted)] hover:bg-red-500/10 hover:text-red-500"
                            >
                              <Trash2 size={15} />
                            </button>
                          </div>
                        ))}
                        {!group.rows.length ? (
                          <p className="col-span-full rounded-2xl border border-dashed border-[var(--border-default)] p-8 text-center text-sm text-[var(--text-muted)]">
                            None yet.
                          </p>
                        ) : null}
                      </div>
                    </div>
                  ))}
                </>
              ) : null}
            </div>
          </div>
        </section>
      </main>
    </>
  );
}
