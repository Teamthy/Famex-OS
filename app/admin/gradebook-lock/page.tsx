"use client";

import { useCallback, useEffect, useState } from "react";
import PortalTopbar from "@/components/PortalTopbar";
import AdminSidebar from "@/components/AdminSidebar";
import ConfirmDialog from "@/components/ConfirmDialog";
import { useToast } from "@/components/Toast";
import {
  CheckCircle2,
  Clock,
  FileText,
  LoaderCircle,
  Lock,
  ShieldCheck,
  Sparkles,
  Unlock,
} from "lucide-react";

type GradebookRow = {
  id: string;
  subjectName: string;
  className: string;
  teacherName: string;
  sessionLabel: string;
  termLabel: string;
  status: "OPEN" | "SUBMITTED" | "LOCKED";
  statusLabel: string;
  submittedAt: string | null;
  lockedAt: string | null;
  studentCount: number;
  classAverage: number;
};

type LocksResponse = {
  summary: { total: number; open: number; submitted: number; locked: number };
  gradebooks: GradebookRow[];
};

type GenerateClass = {
  id: string;
  displayName: string;
  studentCount: number;
  gradebookCount: number;
  lockedGradebookCount: number;
  readyToGenerate: boolean;
  subjects: Array<{ subjectName: string; status: string }>;
};

type GenerateResponse = {
  sessionLabel: string;
  termLabel: string;
  /** "CALENDAR" means no term is set and these labels are a month-based guess. */
  labelSource?: "TERM" | "CALENDAR";
  classes: GenerateClass[];
};

export default function AdminGradebookLockPage() {
  const { toast } = useToast();
  const [locks, setLocks] = useState<LocksResponse | null>(null);
  const [generation, setGeneration] = useState<GenerateResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [pendingAction, setPendingAction] = useState<{
    gradebook: GradebookRow;
    action: "LOCK" | "REOPEN";
  } | null>(null);
  const [pendingGenerate, setPendingGenerate] = useState<GenerateClass | null>(null);

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [locksResponse, generateResponse] = await Promise.all([
        fetch("/api/admin/gradebook/locks", { cache: "no-store" }),
        fetch("/api/admin/report-cards/generate", { cache: "no-store" }),
      ]);
      const locksBody = (await locksResponse.json()) as LocksResponse & { error?: string };
      const generateBody = (await generateResponse.json()) as GenerateResponse & { error?: string };
      if (!locksResponse.ok) throw new Error(locksBody.error || "Unable to load gradebooks.");
      if (!generateResponse.ok)
        throw new Error(generateBody.error || "Unable to load class readiness.");
      setLocks(locksBody);
      setGeneration(generateBody);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load gradebook data.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  async function applyLockAction() {
    if (!pendingAction) return;
    setBusy(true);
    try {
      const response = await fetch("/api/admin/gradebook/locks", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          gradebookId: pendingAction.gradebook.id,
          action: pendingAction.action,
        }),
      });
      const body = (await response.json()) as { message?: string; error?: string };
      if (!response.ok) throw new Error(body.error || "Unable to update the gradebook.");
      toast(body.message || "Gradebook updated.", "success");
      await loadAll();
    } catch (actionError) {
      toast(
        actionError instanceof Error ? actionError.message : "Unable to update the gradebook.",
        "error",
      );
    } finally {
      setBusy(false);
      setPendingAction(null);
    }
  }

  async function generateReportCards() {
    if (!pendingGenerate) return;
    setBusy(true);
    try {
      const response = await fetch("/api/admin/report-cards/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ classId: pendingGenerate.id }),
      });
      const body = (await response.json()) as { message?: string; error?: string };
      if (!response.ok) throw new Error(body.error || "Unable to generate report cards.");
      toast(body.message || "Report cards generated.", "success");
      await loadAll();
    } catch (generateError) {
      toast(
        generateError instanceof Error ? generateError.message : "Unable to generate report cards.",
        "error",
      );
    } finally {
      setBusy(false);
      setPendingGenerate(null);
    }
  }

  const statusChip = (status: GradebookRow["status"]) =>
    status === "LOCKED"
      ? "bg-red-500/10 text-red-500"
      : status === "SUBMITTED"
        ? "bg-brand-orange/10 text-brand-orange"
        : "bg-brand-green/10 text-brand-green";

  return (
    <>
      <PortalTopbar />
      <main className="min-h-screen bg-[var(--bg-primary)] theme-transition">
        <section className="bg-brand-navy px-6 pt-28 pb-14">
          <div className="mx-auto max-w-7xl">
            <div className="mb-3 flex flex-wrap items-center gap-3">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-brand-green/40 bg-brand-green/20 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-brand-green">
                <ShieldCheck size={11} /> Results governance
              </span>
              {generation ? (
                <span className="text-xs text-white/45">
                  {generation.sessionLabel} · {generation.termLabel}
                </span>
              ) : null}
              {generation?.labelSource === "CALENDAR" ? (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-brand-orange/40 bg-brand-orange/20 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-brand-orange">
                  No term set — guessed from date
                </span>
              ) : null}
            </div>
            <h1 className="font-display text-4xl tracking-widest text-white md:text-6xl">
              GRADEBOOK <span className="text-brand-green">LOCK & RESULTS</span>
            </h1>
            <p className="mt-3 max-w-2xl font-body text-sm text-white/60">
              Lock submitted gradebooks to freeze scores, then generate draft report cards per class
              once every subject is locked.
            </p>
          </div>
        </section>

        <section className="px-6 py-10">
          <div className="mx-auto flex max-w-7xl flex-col gap-8 lg:flex-row">
            <AdminSidebar />

            <div className="min-w-0 flex-1 space-y-8">
              {error ? (
                <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-500">
                  {error}
                </div>
              ) : null}

              {loading ? (
                <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-card)] p-10 shadow-[var(--card-shadow)]">
                  <div className="flex items-center gap-3 text-[var(--text-secondary)]">
                    <LoaderCircle className="animate-spin text-brand-green" size={20} /> Loading
                    gradebooks...
                  </div>
                </div>
              ) : null}

              {!loading && locks ? (
                <>
                  <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                    {[
                      {
                        label: "Total Gradebooks",
                        value: locks.summary.total,
                        icon: FileText,
                        tone: "text-brand-green",
                      },
                      {
                        label: "Open",
                        value: locks.summary.open,
                        icon: Clock,
                        tone: "text-brand-green",
                      },
                      {
                        label: "Awaiting Lock",
                        value: locks.summary.submitted,
                        icon: Unlock,
                        tone: "text-brand-orange",
                      },
                      {
                        label: "Locked",
                        value: locks.summary.locked,
                        icon: Lock,
                        tone: "text-red-500",
                      },
                    ].map((card) => (
                      <div
                        key={card.label}
                        className="rounded-[2rem] border border-[var(--border-subtle)] bg-[var(--surface-card)] p-5 shadow-[var(--card-shadow)]"
                      >
                        <card.icon size={18} className={`mb-3 ${card.tone}`} />
                        <div className={`font-display text-3xl ${card.tone}`}>{card.value}</div>
                        <div className="mt-1 text-[10px] uppercase tracking-wider text-[var(--text-muted)]">
                          {card.label}
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="overflow-hidden rounded-[2rem] border border-[var(--border-subtle)] bg-[var(--surface-card)] shadow-[var(--card-shadow)]">
                    <div className="border-b border-[var(--border-subtle)] px-8 py-6">
                      <h2 className="font-display text-2xl text-[var(--text-primary)]">
                        Subject Gradebooks
                      </h2>
                      <p className="mt-1 text-xs text-[var(--text-muted)]">
                        Lock a gradebook once the teacher has submitted final scores. Reopen it only
                        for approved corrections.
                      </p>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="border-b border-[var(--border-subtle)]">
                          <tr>
                            {[
                              "Subject",
                              "Class",
                              "Teacher",
                              "Students",
                              "Average",
                              "Status",
                              "Action",
                            ].map((heading) => (
                              <th
                                key={heading}
                                className="px-4 py-3 text-left font-display text-[10px] uppercase tracking-wider text-[var(--text-muted)]"
                              >
                                {heading}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {locks.gradebooks.map((gradebook) => (
                            <tr
                              key={gradebook.id}
                              className="border-b border-[var(--border-subtle)] hover:bg-[var(--surface-disabled)]"
                            >
                              <td className="px-4 py-4 font-bold text-[var(--text-primary)]">
                                {gradebook.subjectName}
                              </td>
                              <td className="px-4 py-4 text-xs text-[var(--text-muted)]">
                                {gradebook.className}
                              </td>
                              <td className="px-4 py-4 text-xs text-[var(--text-secondary)]">
                                {gradebook.teacherName}
                              </td>
                              <td className="px-4 py-4 text-xs text-[var(--text-secondary)]">
                                {gradebook.studentCount}
                              </td>
                              <td className="px-4 py-4 font-display text-base font-bold text-brand-green">
                                {gradebook.classAverage}%
                              </td>
                              <td className="px-4 py-4">
                                <span
                                  className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest ${statusChip(gradebook.status)}`}
                                >
                                  {gradebook.status === "LOCKED" ? (
                                    <Lock size={10} />
                                  ) : gradebook.status === "SUBMITTED" ? (
                                    <Clock size={10} />
                                  ) : (
                                    <Unlock size={10} />
                                  )}
                                  {gradebook.statusLabel}
                                </span>
                              </td>
                              <td className="px-4 py-4">
                                {gradebook.status === "LOCKED" ? (
                                  <button
                                    onClick={() =>
                                      setPendingAction({ gradebook, action: "REOPEN" })
                                    }
                                    disabled={busy}
                                    className="inline-flex items-center gap-1.5 rounded-full bg-[var(--surface-disabled)] px-4 py-1.5 text-[10px] font-bold text-[var(--text-secondary)] transition-all hover:bg-brand-orange hover:text-brand-navy disabled:opacity-50"
                                  >
                                    <Unlock size={12} /> Reopen
                                  </button>
                                ) : (
                                  <button
                                    onClick={() => setPendingAction({ gradebook, action: "LOCK" })}
                                    disabled={busy}
                                    className="inline-flex items-center gap-1.5 rounded-full bg-brand-green/10 px-4 py-1.5 text-[10px] font-bold text-brand-green transition-all hover:bg-brand-green hover:text-brand-navy disabled:opacity-50"
                                  >
                                    <Lock size={12} /> Lock Scores
                                  </button>
                                )}
                              </td>
                            </tr>
                          ))}
                          {!locks.gradebooks.length ? (
                            <tr>
                              <td
                                colSpan={7}
                                className="px-6 py-10 text-center text-sm text-[var(--text-muted)]"
                              >
                                No gradebooks yet. Gradebooks are created automatically when subject
                                teachers open their score sheets.
                              </td>
                            </tr>
                          ) : null}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </>
              ) : null}

              {!loading && generation ? (
                <div className="overflow-hidden rounded-[2rem] border border-[var(--border-subtle)] bg-[var(--surface-card)] shadow-[var(--card-shadow)]">
                  <div className="border-b border-[var(--border-subtle)] px-8 py-6">
                    <h2 className="flex items-center gap-2 font-display text-2xl text-[var(--text-primary)]">
                      <Sparkles size={20} className="text-brand-green" /> Report Card Generation
                    </h2>
                    <p className="mt-1 text-xs text-[var(--text-muted)]">
                      A class becomes ready once every subject gradebook for {generation.termLabel}{" "}
                      is locked. Generated report cards start as drafts and are released from the
                      Report Cards page.
                    </p>
                  </div>
                  <div className="grid gap-4 p-8 md:grid-cols-2">
                    {generation.classes.map((schoolClass) => (
                      <div
                        key={schoolClass.id}
                        className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--card-bg-subtle)] p-6"
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <h3 className="font-display text-xl text-[var(--text-primary)]">
                              {schoolClass.displayName}
                            </h3>
                            <p className="mt-1 text-xs text-[var(--text-muted)]">
                              {schoolClass.studentCount} students ·{" "}
                              {schoolClass.lockedGradebookCount}/{schoolClass.gradebookCount}{" "}
                              gradebooks locked
                            </p>
                          </div>
                          {schoolClass.readyToGenerate ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-brand-green/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest text-brand-green">
                              <CheckCircle2 size={10} /> Ready
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 rounded-full bg-brand-orange/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest text-brand-orange">
                              <Clock size={10} /> Waiting
                            </span>
                          )}
                        </div>
                        {schoolClass.subjects.length ? (
                          <div className="mt-4 flex flex-wrap gap-1.5">
                            {schoolClass.subjects.map((subject) => (
                              <span
                                key={subject.subjectName}
                                className={`rounded-full px-2.5 py-1 text-[10px] font-medium ${
                                  subject.status === "LOCKED"
                                    ? "bg-brand-green/10 text-brand-green"
                                    : "bg-[var(--surface-disabled)] text-[var(--text-muted)]"
                                }`}
                              >
                                {subject.subjectName}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <p className="mt-4 text-xs text-[var(--text-muted)]">
                            No gradebooks for this term yet.
                          </p>
                        )}
                        <button
                          onClick={() => setPendingGenerate(schoolClass)}
                          disabled={!schoolClass.readyToGenerate || busy}
                          className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-full bg-brand-green px-5 py-3 text-xs font-bold text-brand-navy shadow-lg transition-all hover:bg-brand-green-dark disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          <FileText size={14} /> Generate Draft Report Cards
                        </button>
                      </div>
                    ))}
                    {!generation.classes.length ? (
                      <p className="text-sm text-[var(--text-muted)] md:col-span-2">
                        No active classes found.
                      </p>
                    ) : null}
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </section>
      </main>

      <ConfirmDialog
        open={Boolean(pendingAction)}
        title={pendingAction?.action === "LOCK" ? "Lock this gradebook?" : "Reopen this gradebook?"}
        message={
          pendingAction?.action === "LOCK"
            ? `Locking "${pendingAction?.gradebook.subjectName} — ${pendingAction?.gradebook.className}" freezes all scores. Teachers will no longer be able to edit until it is reopened.`
            : `Reopening "${pendingAction?.gradebook.subjectName} — ${pendingAction?.gradebook.className}" allows the teacher to edit scores again. Use this only for approved corrections.`
        }
        confirmText={pendingAction?.action === "LOCK" ? "Lock Gradebook" : "Reopen Gradebook"}
        cancelText="Cancel"
        variant={pendingAction?.action === "LOCK" ? "warning" : "danger"}
        onConfirm={() => void applyLockAction()}
        onCancel={() => setPendingAction(null)}
      />

      <ConfirmDialog
        open={Boolean(pendingGenerate)}
        title="Generate draft report cards?"
        message={`This compiles all locked gradebooks for ${pendingGenerate?.displayName} into draft report cards with class positions, attendance, and fee balances. Existing released report cards are never overwritten.`}
        confirmText="Generate Drafts"
        cancelText="Cancel"
        variant="info"
        onConfirm={() => void generateReportCards()}
        onCancel={() => setPendingGenerate(null)}
      />
    </>
  );
}
