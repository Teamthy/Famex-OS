"use client";

import { useEffect, useState } from "react";
import PortalTopbar from "@/components/PortalTopbar";
import AdminSidebar from "@/components/AdminSidebar";
import { CheckCircle2, LoaderCircle, ShieldAlert, XCircle } from "lucide-react";

type CorrectionRequest = {
  id: string;
  reason: string;
  status: string;
  resolutionNote: string | null;
  createdAt: string;
  reviewedAt: string | null;
  attendanceSession: {
    id: string;
    sessionDate: string;
    periodKey: string;
    isLocked: boolean;
    classroom: { displayName: string };
  };
  teacherProfile: { displayName: string };
  requestedBy: { name: string; email: string };
  reviewedBy: { name: string } | null;
};

export default function AdminAttendanceCorrectionsPage() {
  const [requests, setRequests] = useState<CorrectionRequest[]>([]);
  const [selected, setSelected] = useState<CorrectionRequest | null>(null);
  const [decision, setDecision] = useState<"APPROVED" | "REJECTED">("APPROVED");
  const [resolutionNote, setResolutionNote] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  async function loadRequests() {
    setLoading(true);
    try {
      const response = await fetch("/api/admin/attendance/corrections", { cache: "no-store" });
      const body = (await response.json()) as { requests?: CorrectionRequest[]; error?: string };
      if (!response.ok) throw new Error(body.error || "Unable to load correction requests.");
      setRequests(body.requests || []);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to load correction requests.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadRequests();
  }, []);

  async function submitDecision() {
    if (!selected) return;
    setSaving(true);
    setMessage("");
    try {
      const response = await fetch("/api/admin/attendance/corrections", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requestId: selected.id,
          decision,
          resolutionNote,
        }),
      });
      const body = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(body.error || "Unable to update the correction request.");
      setSelected(null);
      setResolutionNote("");
      setMessage(
        decision === "APPROVED"
          ? "Correction request approved and session unlocked."
          : "Correction request rejected.",
      );
      await loadRequests();
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Unable to update the correction request.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <PortalTopbar />
      <main className="min-h-screen bg-[var(--bg-primary)] theme-transition">
        <section className="bg-brand-navy px-6 pb-10 pt-24">
          <div className="mx-auto max-w-7xl">
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-brand-green/30 bg-brand-green/10 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-brand-green">
              <ShieldAlert size={12} /> Admin attendance workflow
            </div>
            <h1 className="font-display text-4xl tracking-widest text-white md:text-5xl">
              ATTENDANCE <span className="text-brand-green">CORRECTIONS</span>
            </h1>
            <p className="mt-2 max-w-3xl text-sm text-white/65">
              Review teacher requests to unlock submitted attendance sessions for correction and
              resubmission.
            </p>
          </div>
        </section>

        <section className="px-6 py-10">
          <div className="mx-auto flex max-w-7xl flex-col gap-8 lg:flex-row">
            <AdminSidebar />

            <div className="flex-1 min-w-0 space-y-6">
              {message ? (
                <div className="rounded-2xl border border-brand-green/20 bg-brand-green/5 p-4 text-sm text-[var(--text-secondary)]">
                  {message}
                </div>
              ) : null}

              {loading ? (
                <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-card)] p-8 shadow-[var(--card-shadow)]">
                  <div className="flex items-center gap-3 text-[var(--text-secondary)]">
                    <LoaderCircle className="animate-spin text-brand-green" size={20} /> Loading
                    correction requests...
                  </div>
                </div>
              ) : (
                <div className="overflow-hidden rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-card)] shadow-[var(--card-shadow)]">
                  <div className="border-b border-[var(--border-subtle)] px-6 py-4">
                    <h2 className="font-display text-xl text-[var(--text-primary)]">
                      Correction queue
                    </h2>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                      <thead className="bg-[var(--surface-disabled)] text-[10px] uppercase tracking-widest text-[var(--text-muted)]">
                        <tr>
                          <th className="px-6 py-3">Class</th>
                          <th className="px-6 py-3">Teacher</th>
                          <th className="px-6 py-3">Date</th>
                          <th className="px-6 py-3">Status</th>
                          <th className="px-6 py-3">Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {requests.map((request) => (
                          <tr key={request.id} className="border-t border-[var(--border-subtle)]">
                            <td className="px-6 py-4 font-medium text-[var(--text-primary)]">
                              {request.attendanceSession.classroom.displayName}
                            </td>
                            <td className="px-6 py-4 text-[var(--text-secondary)]">
                              {request.teacherProfile.displayName}
                            </td>
                            <td className="px-6 py-4 text-[var(--text-secondary)]">
                              {new Date(request.attendanceSession.sessionDate).toLocaleDateString()}
                            </td>
                            <td className="px-6 py-4">
                              <span
                                className={`inline-flex rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-widest ${request.status === "PENDING" ? "bg-brand-orange/15 text-brand-orange" : request.status === "APPROVED" ? "bg-brand-green/15 text-brand-green" : "bg-red-500/15 text-red-500"}`}
                              >
                                {request.status}
                              </span>
                            </td>
                            <td className="px-6 py-4">
                              <button
                                onClick={() => {
                                  setSelected(request);
                                  setDecision(
                                    request.status === "REJECTED" ? "REJECTED" : "APPROVED",
                                  );
                                  setResolutionNote(request.resolutionNote || "");
                                }}
                                className="font-bold text-brand-green"
                              >
                                Review
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {!requests.length ? (
                      <div className="px-6 py-10 text-center text-sm text-[var(--text-muted)]">
                        No attendance correction requests found.
                      </div>
                    ) : null}
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>
      </main>

      {selected ? (
        <div className="fixed inset-0 z-[200] grid place-items-center bg-black/60 p-5">
          <div className="w-full max-w-2xl rounded-3xl bg-white p-7 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-bold tracking-widest text-brand-green">
                  ATTENDANCE CORRECTION REVIEW
                </p>
                <h2 className="mt-2 font-display text-3xl text-brand-navy">
                  {selected.attendanceSession.classroom.displayName}
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  {selected.teacherProfile.displayName} ·{" "}
                  {new Date(selected.attendanceSession.sessionDate).toLocaleDateString()}
                </p>
              </div>
              <button
                onClick={() => setSelected(null)}
                className="text-slate-500 hover:text-slate-800"
              >
                <XCircle size={22} />
              </button>
            </div>

            <div className="mt-6 rounded-2xl bg-slate-50 p-5 text-sm text-slate-700">
              <p>
                <strong>Requested by:</strong> {selected.requestedBy.name} (
                {selected.requestedBy.email})
              </p>
              <p className="mt-3">
                <strong>Reason:</strong> {selected.reason}
              </p>
              {selected.resolutionNote ? (
                <p className="mt-3">
                  <strong>Current admin note:</strong> {selected.resolutionNote}
                </p>
              ) : null}
            </div>

            <label className="mt-6 block text-xs font-bold uppercase tracking-widest text-slate-700">
              Decision
            </label>
            <select
              value={decision}
              onChange={(event) => setDecision(event.target.value as "APPROVED" | "REJECTED")}
              className="mt-2 w-full rounded-xl border border-slate-300 p-3 text-sm"
            >
              <option value="APPROVED">Approve and unlock session</option>
              <option value="REJECTED">Reject request</option>
            </select>

            <label className="mt-5 block text-xs font-bold uppercase tracking-widest text-slate-700">
              Resolution note
            </label>
            <textarea
              value={resolutionNote}
              onChange={(event) => setResolutionNote(event.target.value)}
              className="mt-2 min-h-28 w-full rounded-xl border border-slate-300 p-3 text-sm"
            />

            <div className="mt-6 flex gap-3">
              <button
                onClick={() => setSelected(null)}
                className="flex-1 rounded-full border border-slate-300 px-5 py-3 text-sm font-bold uppercase tracking-widest text-slate-700"
              >
                Cancel
              </button>
              <button
                onClick={() => void submitDecision()}
                disabled={saving}
                className="flex-1 rounded-full bg-brand-green px-5 py-3 text-sm font-bold uppercase tracking-widest text-brand-navy disabled:opacity-50"
              >
                {saving ? (
                  <span className="inline-flex items-center gap-2">
                    <LoaderCircle className="animate-spin" size={16} /> Saving
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-2">
                    <CheckCircle2 size={16} /> Save Decision
                  </span>
                )}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
