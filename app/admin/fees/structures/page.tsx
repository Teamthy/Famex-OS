"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import PortalTopbar from "@/components/PortalTopbar";
import AdminSidebar from "@/components/AdminSidebar";
import { useToast } from "@/components/Toast";
import { AlertCircle, LoaderCircle, Plus, Receipt, Save, Trash2, Wallet } from "lucide-react";

/**
 * Fee structures — what each level costs this term.
 *
 * Until this screen existed there was no way to bill anybody: FeeInvoice rows
 * could only be created by a demo seed.
 */

type Item = { label: string; amount: number; mandatory: boolean; sortOrder: number };

type Structure = {
  id: string;
  level: string;
  title: string;
  dueInDays: number | null;
  total: number;
  items: Item[];
};

type Payload = {
  selectedTermId: string | null;
  labelSource?: "TERM" | "CALENDAR";
  terms: Array<{
    id: string;
    label: string;
    index: number;
    sessionLabel: string;
    isCurrent: boolean;
  }>;
  levels: string[];
  structures: Structure[];
};

const naira = (n: number) => "₦" + Number(n || 0).toLocaleString();

const BLANK_ITEMS: Item[] = [
  { label: "Tuition Fee", amount: 0, mandatory: true, sortOrder: 1 },
  { label: "Development Levy", amount: 0, mandatory: true, sortOrder: 2 },
  { label: "Exam Fee", amount: 0, mandatory: true, sortOrder: 3 },
];

export default function FeeStructuresPage() {
  const { toast } = useToast();
  const [data, setData] = useState<Payload | null>(null);
  const [termId, setTermId] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const [editLevel, setEditLevel] = useState("");
  const [title, setTitle] = useState("");
  const [dueInDays, setDueInDays] = useState<string>("14");
  const [items, setItems] = useState<Item[]>(BLANK_ITEMS);

  const load = useCallback(async (term?: string) => {
    setLoading(true);
    setError("");
    try {
      const query = term ? `?termId=${encodeURIComponent(term)}` : "";
      const response = await fetch(`/api/admin/fees/structures${query}`, { cache: "no-store" });
      const body = (await response.json()) as Payload & { error?: string };
      if (!response.ok) throw new Error(body.error || "Unable to load fee structures.");
      setData(body);
      setTermId(body.selectedTermId || "");
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load fee structures.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const total = useMemo(() => items.reduce((sum, i) => sum + (i.amount || 0), 0), [items]);

  const unpriced = useMemo(() => {
    if (!data) return [];
    const priced = new Set(data.structures.map((s) => s.level));
    return data.levels.filter((l) => !priced.has(l));
  }, [data]);

  function startEdit(structure: Structure) {
    setEditLevel(structure.level);
    setTitle(structure.title);
    setDueInDays(structure.dueInDays === null ? "" : String(structure.dueInDays));
    setItems(structure.items.length ? structure.items : BLANK_ITEMS);
  }

  function startNew(level: string) {
    setEditLevel(level);
    setTitle(`${level} School Fees`);
    setDueInDays("14");
    setItems(BLANK_ITEMS.map((i) => ({ ...i })));
  }

  async function save() {
    if (!editLevel || !termId) return;
    if (total <= 0) {
      toast("A fee structure must total more than ₦0.", "error");
      return;
    }
    setSaving(true);
    try {
      const response = await fetch("/api/admin/fees/structures", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          termId,
          level: editLevel,
          title,
          dueInDays: dueInDays === "" ? null : Number(dueInDays),
          items: items.filter((i) => i.label.trim()),
        }),
      });
      const body = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(body.error || "Unable to save.");
      toast(`${editLevel} fees saved — ${naira(total)} per student.`, "success");
      setEditLevel("");
      await load(termId);
    } catch (saveError) {
      toast(saveError instanceof Error ? saveError.message : "Unable to save.", "error");
    } finally {
      setSaving(false);
    }
  }

  const selectedTerm = data?.terms.find((t) => t.id === termId);

  return (
    <>
      <PortalTopbar title="Fee structures" />
      <main className="min-h-screen bg-[var(--bg-primary)] theme-transition">
        <section className="bg-brand-navy px-6 pt-28 pb-14">
          <div className="mx-auto max-w-7xl">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-brand-green/40 bg-brand-green/20 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-brand-green">
              <Wallet size={11} /> Bursary
            </span>
            <h1 className="mt-3 font-display text-4xl tracking-widest text-white md:text-6xl">
              FEE <span className="text-brand-green">STRUCTURES</span>
            </h1>
            <p className="mt-3 max-w-2xl font-body text-sm text-white/60">
              Set what each level pays this term, then raise invoices from the Generate Invoices
              page. Editing a structure never changes invoices already issued.
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
                    <label className="flex-1">
                      <span className="mb-2 block text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--text-muted)]">
                        Term
                      </span>
                      <select
                        value={termId}
                        onChange={(event) => {
                          setTermId(event.target.value);
                          setEditLevel("");
                          void load(event.target.value);
                        }}
                        className="w-full rounded-xl border border-[var(--input-border)] bg-[var(--input-bg)] p-3 text-sm text-[var(--input-text)]"
                      >
                        {data.terms.map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.sessionLabel} · {t.label}
                            {t.isCurrent ? "  (current)" : ""}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>

                  {unpriced.length ? (
                    <div className="flex items-start gap-3 rounded-2xl border border-brand-orange/30 bg-brand-orange/10 p-4 text-sm text-brand-orange">
                      <AlertCircle size={18} className="mt-0.5 shrink-0" />
                      <span>
                        No fees set for <b>{unpriced.join(", ")}</b> in{" "}
                        {selectedTerm?.label ?? "this term"}. Students at{" "}
                        {unpriced.length === 1 ? "this level" : "these levels"} cannot be invoiced.
                      </span>
                    </div>
                  ) : null}

                  <div className="grid gap-4 md:grid-cols-2">
                    {data.structures.map((structure) => (
                      <button
                        key={structure.id}
                        onClick={() => startEdit(structure)}
                        className="rounded-3xl border border-[var(--border-subtle)] bg-[var(--surface-card)] p-5 text-left transition-colors hover:bg-[var(--surface-card-hover)]"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <b className="text-[var(--text-primary)]">{structure.level}</b>
                            <p className="mt-0.5 text-xs text-[var(--text-muted)]">
                              {structure.title}
                            </p>
                          </div>
                          <span className="rounded-full bg-brand-green/15 px-2.5 py-1 text-xs font-bold text-brand-green">
                            {naira(structure.total)}
                          </span>
                        </div>
                        <ul className="mt-3 space-y-1 text-xs text-[var(--text-secondary)]">
                          {structure.items.map((item) => (
                            <li key={item.label} className="flex justify-between">
                              <span>{item.label}</span>
                              <span>{naira(item.amount)}</span>
                            </li>
                          ))}
                        </ul>
                      </button>
                    ))}

                    {data.levels
                      .filter((level) => !data.structures.some((s) => s.level === level))
                      .map((level) => (
                        <button
                          key={level}
                          onClick={() => startNew(level)}
                          className="flex items-center justify-center gap-2 rounded-3xl border border-dashed border-[var(--border-default)] p-8 text-sm text-[var(--text-muted)] hover:border-brand-green hover:text-brand-green"
                        >
                          <Plus size={16} /> Set {level} fees
                        </button>
                      ))}
                  </div>

                  {editLevel ? (
                    <div className="rounded-[var(--radius-card)] border border-[var(--border-subtle)] bg-[var(--surface-card)] p-6">
                      <div className="flex items-center gap-2">
                        <Receipt size={17} className="text-brand-green" />
                        <h2 className="font-display text-2xl tracking-widest text-[var(--text-primary)]">
                          {editLevel}
                        </h2>
                      </div>

                      <div className="mt-4 grid gap-3 sm:grid-cols-2">
                        <label>
                          <span className="mb-2 block text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--text-muted)]">
                            Invoice title
                          </span>
                          <input
                            value={title}
                            onChange={(event) => setTitle(event.target.value)}
                            className="w-full rounded-xl border border-[var(--input-border)] bg-[var(--input-bg)] p-3 text-sm text-[var(--input-text)]"
                          />
                        </label>
                        <label>
                          <span className="mb-2 block text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--text-muted)]">
                            Due after (days) — blank for no due date
                          </span>
                          <input
                            type="number"
                            min={0}
                            value={dueInDays}
                            onChange={(event) => setDueInDays(event.target.value)}
                            className="w-full rounded-xl border border-[var(--input-border)] bg-[var(--input-bg)] p-3 text-sm text-[var(--input-text)]"
                          />
                        </label>
                      </div>

                      <div className="mt-5 space-y-2">
                        {items.map((item, index) => (
                          <div key={index} className="flex gap-2">
                            <input
                              value={item.label}
                              placeholder="Item, e.g. Tuition Fee"
                              onChange={(event) =>
                                setItems((rows) =>
                                  rows.map((r, i) =>
                                    i === index ? { ...r, label: event.target.value } : r,
                                  ),
                                )
                              }
                              className="flex-1 rounded-xl border border-[var(--input-border)] bg-[var(--input-bg)] p-3 text-sm text-[var(--input-text)]"
                            />
                            <input
                              type="number"
                              min={0}
                              value={item.amount || ""}
                              placeholder="0"
                              onChange={(event) =>
                                setItems((rows) =>
                                  rows.map((r, i) =>
                                    i === index
                                      ? { ...r, amount: Number(event.target.value) || 0 }
                                      : r,
                                  ),
                                )
                              }
                              className="w-36 rounded-xl border border-[var(--input-border)] bg-[var(--input-bg)] p-3 text-sm text-[var(--input-text)]"
                            />
                            <button
                              onClick={() => setItems((rows) => rows.filter((_, i) => i !== index))}
                              aria-label={`Remove ${item.label || "item"}`}
                              className="rounded-xl px-3 text-[var(--text-muted)] hover:bg-red-500/10 hover:text-red-500"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        ))}
                        <button
                          onClick={() =>
                            setItems((rows) => [
                              ...rows,
                              { label: "", amount: 0, mandatory: true, sortOrder: rows.length + 1 },
                            ])
                          }
                          className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-brand-green"
                        >
                          <Plus size={13} /> Add item
                        </button>
                      </div>

                      <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-[var(--border-subtle)] pt-4">
                        <span className="text-sm text-[var(--text-secondary)]">
                          Total per student:{" "}
                          <b className="text-lg text-brand-green">{naira(total)}</b>
                        </span>
                        <div className="flex gap-2">
                          <button
                            onClick={() => setEditLevel("")}
                            className="rounded-full border border-[var(--border-default)] px-5 py-2.5 text-sm text-[var(--text-secondary)]"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={() => void save()}
                            disabled={saving || total <= 0}
                            className="flex items-center gap-2 rounded-full bg-brand-green px-6 py-2.5 text-sm font-bold text-brand-navy disabled:opacity-60"
                          >
                            {saving ? (
                              <LoaderCircle size={15} className="animate-spin" />
                            ) : (
                              <Save size={15} />
                            )}
                            Save {editLevel} fees
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : null}
                </>
              ) : null}
            </div>
          </div>
        </section>
      </main>
    </>
  );
}
