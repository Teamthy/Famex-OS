"use client";

import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, History, LoaderCircle, XCircle } from "lucide-react";
import { useToast } from "@/components/Toast";

/**
 * Post-lock result corrections (W6) — panel on the gradebook-lock screen.
 *
 * Locked gradebooks are never edited in place. A correction is requested
 * (the server captures the published value), then decided by academic
 * leadership — never by the requester. Applying recomputes the total/grade
 * and warns when a report card snapshot needs regenerating.
 */

type Correction = {
  id: string;
  status: "PENDING" | "APPLIED" | "REJECTED";
  field: string;
  oldValue: string;
  newValue: string;
  reason: string;
  subjectName: string;
  className: string;
  sessionLabel: string;
  termLabel: string;
  studentName: string;
  requestedBy: string;
  decidedBy: string | null;
  decidedAt: string | null;
  decisionNote: string | null;
  appliedTotal: number | null;
  appliedGrade: string | null;
  createdAt: string;
};

const FIELDS = ["ca1", "ca2", "midterm", "assignment", "exam", "comment"] as const;

const inputClass =
  "w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--input-bg)] px-3 py-2 text-sm text-[var(--text-primary)]";

function chip(status: Correction["status"]) {
  if (status === "APPLIED") return "bg-brand-green/10 text-brand-green";
  if (status === "REJECTED") return "bg-red-500/10 text-red-500";
  return "bg-brand-orange/10 text-brand-orange";
}

export default function ResultCorrectionsPanel() {
  const { toast } = useToast();
  const [corrections, setCorrections] = useState<Correction[]>([]);
  const [viewerIsAdmin, setViewerIsAdmin] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [entryId, setEntryId] = useState("");
  const [field, setField] = useState<(typeof FIELDS)[number]>("exam");
  const [newValue, setNewValue] = useState("");
  const [reason, setReason] = useState("");
  const [requesting, setRequesting] = useState(false);
  const [decisionNote, setDecisionNote] = useState<Record<string, string>>({});
  const [deciding, setDeciding] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/admin/gradebook/corrections", { cache: "no-store" });
      const body = (await response.json()) as {
        corrections?: Correction[];
        viewerIsAdmin?: boolean;
        pendingCount?: number;
        error?: string;
      };
      if (!response.ok) throw new Error(body.error || "Unable to load correction requests.");
      setCorrections(body.corrections ?? []);
      setViewerIsAdmin(Boolean(body.viewerIsAdmin));
      setPendingCount(body.pendingCount ?? 0);
    } catch (error) {
      toast(
        error instanceof Error ? error.message : "Unable to load correction requests.",
        "error",
      );
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    void load();
  }, [load]);

  async function submitRequest() {
    setRequesting(true);
    try {
      const response = await fetch("/api/admin/gradebook/corrections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "REQUEST",
          entryId: entryId.trim(),
          field,
          newValue,
          reason: reason.trim(),
        }),
      });
      const body = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(body.error || "The request could not be raised.");
      toast("Correction requested. Academic leadership will decide it.", "success");
      setEntryId("");
      setNewValue("");
      setReason("");
      await load();
    } catch (error) {
      toast(error instanceof Error ? error.message : "The request could not be raised.", "error");
    } finally {
      setRequesting(false);
    }
  }

  async function decide(correction: Correction, approve: boolean) {
    setDeciding(correction.id);
    try {
      const response = await fetch("/api/admin/gradebook/corrections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: approve ? "APPROVE" : "REJECT",
          correctionId: correction.id,
          decisionNote: decisionNote[correction.id]?.trim() || undefined,
        }),
      });
      const body = (await response.json()) as { error?: string; message?: string };
      if (!response.ok) throw new Error(body.error || "The decision could not be saved.");
      toast(body.message || (approve ? "Correction applied." : "Correction rejected."), "success");
      await load();
    } catch (error) {
      toast(error instanceof Error ? error.message : "The decision could not be saved.", "error");
    } finally {
      setDeciding(null);
    }
  }

  return (
    <div className="rounded-[2rem] border border-[var(--border-subtle)] bg-[var(--surface-card)] p-6 shadow-[var(--card-shadow)]">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 font-display text-xl tracking-widest">
          <History size={20} className="text-brand-green" /> RESULT CORRECTIONS
        </h2>
        <span className="text-xs text-[var(--text-muted)]">{pendingCount} awaiting a decision</span>
      </div>
      <p className="mt-2 text-sm text-[var(--text-muted)]">
        Locked results are never edited in place. Request a correction here; academic leadership
        (never the requester) approves it, and the original value stays in the history forever.
      </p>

      <div className="mt-5 rounded-2xl bg-[var(--surface-disabled)] p-4">
        <h3 className="text-[10px] font-bold uppercase tracking-widest text-brand-green">
          Request a correction
        </h3>
        <div className="mt-3 grid gap-2 md:grid-cols-4">
          <input
            className={inputClass}
            placeholder="Gradebook entry ID"
            value={entryId}
            onChange={(e) => setEntryId(e.target.value)}
          />
          <select
            className={inputClass}
            value={field}
            onChange={(e) => setField(e.target.value as (typeof FIELDS)[number])}
          >
            {FIELDS.map((f) => (
              <option key={f} value={f}>
                {f === "comment" ? "Teacher comment" : f.toUpperCase()}
              </option>
            ))}
          </select>
          <input
            className={inputClass}
            placeholder={field === "comment" ? "New comment" : "New value (exact, no rounding)"}
            value={newValue}
            onChange={(e) => setNewValue(e.target.value)}
          />
          <input
            className={inputClass}
            placeholder="Reason (kept permanently)"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        </div>
        <button
          type="button"
          disabled={requesting || !entryId.trim() || reason.trim().length < 4}
          onClick={() => void submitRequest()}
          className="mt-3 rounded-full bg-brand-green px-5 py-2.5 text-xs font-bold uppercase tracking-widest text-white disabled:opacity-50"
        >
          {requesting ? "Requesting…" : "Request correction"}
        </button>
        <p className="mt-2 text-xs text-[var(--text-muted)]">
          The entry ID is shown on the broadsheet/entry export. The current published value is
          captured by the server when you request — it cannot be edited afterwards.
        </p>
      </div>

      {loading ? (
        <p className="mt-5 flex items-center gap-2 text-sm text-[var(--text-muted)]">
          <LoaderCircle size={16} className="animate-spin" /> Loading correction requests…
        </p>
      ) : corrections.length ? (
        <ul className="mt-5 space-y-2">
          {corrections.map((c) => (
            <li key={c.id} className="rounded-2xl bg-[var(--surface-disabled)] p-4 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <b>
                  {c.studentName} · {c.subjectName} ({c.className})
                </b>
                <span
                  className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${chip(c.status)}`}
                >
                  {c.status}
                </span>
              </div>
              <p className="mt-1 text-xs text-[var(--text-muted)]">
                {c.sessionLabel} · {c.termLabel} · requested by {c.requestedBy} on{" "}
                {new Date(c.createdAt).toLocaleDateString("en-NG")}
              </p>
              <p className="mt-2">
                <span className="font-bold uppercase">{c.field}</span>: “{c.oldValue}” → “
                {c.newValue}”
                {c.status === "APPLIED" && c.appliedTotal !== null ? (
                  <span className="text-[var(--text-muted)]">
                    {" "}
                    · new total {c.appliedTotal} ({c.appliedGrade})
                  </span>
                ) : null}
              </p>
              <p className="mt-1 text-xs">Reason: {c.reason}</p>
              {c.decidedBy ? (
                <p className="mt-1 text-xs text-[var(--text-muted)]">
                  Decided by {c.decidedBy}
                  {c.decisionNote ? ` — ${c.decisionNote}` : ""}
                </p>
              ) : null}

              {c.status === "PENDING" && viewerIsAdmin ? (
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <input
                    className={`${inputClass} max-w-xs`}
                    placeholder="Decision note (optional)"
                    value={decisionNote[c.id] ?? ""}
                    onChange={(e) =>
                      setDecisionNote((notes) => ({ ...notes, [c.id]: e.target.value }))
                    }
                  />
                  <button
                    type="button"
                    disabled={deciding === c.id}
                    onClick={() => void decide(c, true)}
                    className="inline-flex items-center gap-1.5 rounded-full bg-brand-green px-4 py-2 text-[10px] font-bold uppercase tracking-widest text-white disabled:opacity-50"
                  >
                    <CheckCircle2 size={12} /> Approve &amp; apply
                  </button>
                  <button
                    type="button"
                    disabled={deciding === c.id}
                    onClick={() => void decide(c, false)}
                    className="inline-flex items-center gap-1.5 rounded-full bg-red-500 px-4 py-2 text-[10px] font-bold uppercase tracking-widest text-white disabled:opacity-50"
                  >
                    <XCircle size={12} /> Reject
                  </button>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-5 text-sm text-[var(--text-muted)]">No correction requests yet.</p>
      )}
    </div>
  );
}
