"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import PortalTopbar from "@/components/PortalTopbar";
import TeacherSidebar from "@/components/TeacherSidebar";
import { useToast } from "@/components/Toast";
import { cacheGet, cacheSet, queueWrite, getQueueCount } from "@/lib/offline/db";
import {
  BellRing,
  Calendar,
  Check,
  Clock,
  FileWarning,
  LoaderCircle,
  Lock,
  MessageSquareWarning,
  Save,
  Send,
  UserCheck,
  X,
} from "lucide-react";

type AttendanceStatus = "PRESENT" | "ABSENT" | "LATE";

type AttendanceRow = {
  studentProfileId: string;
  studentId: string;
  displayName: string;
  guardianName: string | null;
  guardianPhone: string | null;
  status: AttendanceStatus;
  note: string;
};

type RegisterResponse = {
  teacher: { displayName: string };
  availableClasses: Array<{
    id: string;
    displayName: string;
    level: string;
    arm: string;
    roles: string[];
    subjectNames: string[];
  }>;
  selectedClass: {
    id: string;
    displayName: string;
    level: string;
    arm: string;
    role: string;
    subjectName: string | null;
  } | null;
  session: {
    id: string | null;
    date: string;
    periodKey: string;
    notes: string | null;
    isLocked: boolean;
    submittedAt: string | null;
    correctionRequest: {
      id: string;
      status: string;
      reason: string;
      resolutionNote: string | null;
      createdAt: string;
      reviewedAt: string | null;
    } | null;
  } | null;
  roster: AttendanceRow[];
  summary: {
    present: number;
    absent: number;
    late: number;
    total: number;
  };
};

const STATUS_BUTTONS: Array<{ label: string; value: AttendanceStatus; accent: string }> = [
  { label: "P", value: "PRESENT", accent: "bg-brand-green text-white" },
  { label: "A", value: "ABSENT", accent: "bg-red-500 text-white" },
  { label: "L", value: "LATE", accent: "bg-brand-orange text-white" },
];

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function summarize(rows: AttendanceRow[]) {
  return rows.reduce(
    (summary, row) => {
      if (row.status === "PRESENT") summary.present += 1;
      if (row.status === "ABSENT") summary.absent += 1;
      if (row.status === "LATE") summary.late += 1;
      summary.total += 1;
      return summary;
    },
    { present: 0, absent: 0, late: 0, total: 0 },
  );
}

export default function ClassAttendancePage() {
  const { toast } = useToast();
  const searchParams = useSearchParams();
  const [selectedClassId, setSelectedClassId] = useState(() => searchParams.get("classId") || "");
  const [selectedDate, setSelectedDate] = useState(() => searchParams.get("date") || todayKey());
  const [register, setRegister] = useState<RegisterResponse | null>(null);
  const [rows, setRows] = useState<AttendanceRow[]>([]);
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(true);
  const [savingMode, setSavingMode] = useState<"draft" | "submit" | null>(null);
  const [isStale, setIsStale] = useState(false);
  const [pendingSync, setPendingSync] = useState(0);
  const [error, setError] = useState("");
  const [correctionReason, setCorrectionReason] = useState("");
  const [requestingCorrection, setRequestingCorrection] = useState(false);

  const stats = useMemo(() => summarize(rows), [rows]);
  const isLocked = Boolean(register?.session?.isLocked);
  const correctionRequest = register?.session?.correctionRequest || null;
  const notificationPreview = stats.absent + stats.late;

  async function loadRegister(params?: { classId?: string; date?: string }) {
    const query = new URLSearchParams({ date: params?.date || selectedDate });
    if (params?.classId || selectedClassId)
      query.set("classId", params?.classId || selectedClassId);
    const cacheKey = `/api/teacher/attendance/register?${query.toString()}`;

    // ── Offline: show cached data instantly ──
    const cached = await cacheGet<RegisterResponse>(cacheKey);
    if (cached) {
      setRegister(cached.data);
      setRows(cached.data.roster);
      setNotes(cached.data.session?.notes || "");
      setIsStale(true);
      setLoading(false);
    }

    // ── Online: fetch fresh data ──
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      setPendingSync(await getQueueCount());
      return;
    }

    setLoading(!cached);
    setError("");
    try {
      const response = await fetch(cacheKey, {
        cache: "no-store",
      });
      const body = (await response.json()) as RegisterResponse & { error?: string };
      if (!response.ok) throw new Error(body.error || "Unable to load the attendance register.");

      setRegister(body);
      setRows(body.roster);
      setNotes(body.session?.notes || "");
      setCorrectionReason("");
      setIsStale(false);
      await cacheSet(cacheKey, body);

      if ((!selectedClassId || params?.classId) && body.selectedClass?.id) {
        setSelectedClassId(body.selectedClass.id);
      }
    } catch (loadError) {
      if (!cached) {
        setRegister(null);
        setRows([]);
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Unable to load the attendance register.",
        );
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadRegister();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedClassId, selectedDate]);

  function updateStatus(studentProfileId: string, status: AttendanceStatus) {
    if (isLocked || savingMode) return;
    setRows((current) =>
      current.map((row) =>
        row.studentProfileId === studentProfileId
          ? {
              ...row,
              status,
              note: status === "PRESENT" ? "" : row.note,
            }
          : row,
      ),
    );
  }

  function updateNote(studentProfileId: string, note: string) {
    if (isLocked || savingMode) return;
    setRows((current) =>
      current.map((row) => (row.studentProfileId === studentProfileId ? { ...row, note } : row)),
    );
  }

  function markAllPresent() {
    if (isLocked || savingMode) return;
    setRows((current) => current.map((row) => ({ ...row, status: "PRESENT", note: "" })));
    toast("All active students marked present.", "success");
  }

  async function saveRegister(finalize: boolean) {
    if (!register?.selectedClass) return;

    setSavingMode(finalize ? "submit" : "draft");
    setError("");

    const payload = {
      classId: register.selectedClass.id,
      sessionDate: selectedDate,
      periodKey: register.session?.periodKey || "DAILY_REGISTER",
      notes,
      finalize,
      entries: rows.map((row) => ({
        studentProfileId: row.studentProfileId,
        status: row.status,
        note: row.note || null,
      })),
    };

    // ── Offline: queue the write ──
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      await queueWrite({ url: "/api/teacher/attendance/register", method: "POST", body: payload });
      setPendingSync(await getQueueCount());
      toast(
        finalize ? "Attendance saved offline. Will sync when back online." : "Draft saved offline.",
        "success",
      );
      setSavingMode(null);
      return;
    }

    // ── Online: POST immediately ──
    try {
      const response = await fetch("/api/teacher/attendance/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const body = (await response.json()) as {
        error?: string;
        notificationPreview?: { absent: number; late: number; queuedParentAlerts: number };
      };
      if (!response.ok) throw new Error(body.error || "Unable to save attendance.");

      if (finalize) {
        toast(
          body.notificationPreview?.queuedParentAlerts
            ? `Attendance submitted. ${body.notificationPreview.queuedParentAlerts} alert job(s) queued.`
            : "Attendance submitted and locked successfully.",
          "success",
        );
      } else {
        toast("Attendance draft saved successfully.", "success");
      }

      await loadRegister({ classId: register.selectedClass.id, date: selectedDate });
    } catch (saveError) {
      // Network dropped mid-request — queue it
      if (saveError instanceof TypeError && saveError.message.includes("fetch")) {
        await queueWrite({
          url: "/api/teacher/attendance/register",
          method: "POST",
          body: payload,
        });
        setPendingSync(await getQueueCount());
        toast("Connection lost. Attendance saved offline and will sync automatically.", "success");
      } else {
        setError(saveError instanceof Error ? saveError.message : "Unable to save attendance.");
        toast("Attendance could not be saved.", "error");
      }
    } finally {
      setSavingMode(null);
    }
  }

  async function requestCorrection() {
    if (!register?.session?.id) return;
    setRequestingCorrection(true);
    setError("");
    try {
      const response = await fetch("/api/teacher/attendance/correction-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: register.session.id,
          reason: correctionReason,
        }),
      });
      const body = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(body.error || "Unable to create correction request.");
      toast("Correction request submitted for admin review.", "success");
      await loadRegister({ classId: register.selectedClass?.id || undefined, date: selectedDate });
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to create correction request.",
      );
      toast("Correction request failed.", "error");
    } finally {
      setRequestingCorrection(false);
    }
  }

  return (
    <>
      <PortalTopbar />
      <main className="min-h-screen bg-[var(--bg-primary)] theme-transition">
        <section className="bg-brand-navy px-6 pb-10 pt-24">
          <div className="mx-auto max-w-7xl">
            <div className="mb-3 flex flex-wrap items-center gap-3">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-brand-orange/40 bg-brand-orange/20 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-brand-orange">
                <Calendar size={11} /> Teacher attendance workflow
              </span>
              {register?.selectedClass ? (
                <span className="text-xs text-white/45">{register.selectedClass.displayName}</span>
              ) : null}
            </div>
            <h1 className="font-display text-4xl tracking-widest text-white md:text-5xl">
              ATTENDANCE <span className="text-brand-orange">REGISTER</span>
            </h1>
            <p className="mt-2 max-w-3xl text-sm text-white/65">
              Live class attendance register backed by the database. Save progress while marking or
              submit to lock the register and queue parent attendance alerts.
            </p>
          </div>
        </section>

        <section className="px-6 py-10">
          <div className="mx-auto flex max-w-7xl flex-col gap-8 lg:flex-row">
            <TeacherSidebar />

            <div className="flex-1 min-w-0 space-y-6">
              <div className="grid gap-4 lg:grid-cols-[1fr_auto_auto]">
                <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-card)] p-4 shadow-[var(--card-shadow)]">
                  <label className="mb-2 block text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--text-muted)]">
                    Assigned class
                  </label>
                  <select
                    value={selectedClassId}
                    onChange={(event) => setSelectedClassId(event.target.value)}
                    className="w-full rounded-xl border border-[var(--input-border)] bg-[var(--input-bg)] px-4 py-3 text-sm text-[var(--input-text)] outline-none focus:border-[var(--input-border-focus)]"
                    disabled={loading || !register?.availableClasses.length}
                  >
                    {!register?.availableClasses.length ? (
                      <option value="">No class assignment found</option>
                    ) : null}
                    {register?.availableClasses.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.displayName}
                        {item.roles.includes("FORM_TEACHER") ? " · Form teacher" : ""}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-card)] p-4 shadow-[var(--card-shadow)]">
                  <label className="mb-2 block text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--text-muted)]">
                    Session date
                  </label>
                  <input
                    type="date"
                    value={selectedDate}
                    onChange={(event) => setSelectedDate(event.target.value)}
                    className="rounded-xl border border-[var(--input-border)] bg-[var(--input-bg)] px-4 py-3 text-sm text-[var(--input-text)] outline-none focus:border-[var(--input-border-focus)]"
                    disabled={loading}
                  />
                </div>

                <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-card)] p-4 shadow-[var(--card-shadow)]">
                  <div className="mb-2 text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--text-muted)]">
                    Register state
                  </div>
                  <div
                    className={`inline-flex items-center gap-2 rounded-full px-3 py-2 text-xs font-bold uppercase tracking-widest ${isLocked ? "bg-brand-green/15 text-brand-green" : "bg-brand-orange/15 text-brand-orange"}`}
                  >
                    <Lock size={12} /> {isLocked ? "Locked" : "Editable"}
                  </div>
                  {isStale && (
                    <div className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-orange-500/10 px-3 py-1.5 text-xs font-bold uppercase tracking-widest text-orange-500">
                      <Clock size={12} /> Cached (offline)
                    </div>
                  )}
                  {pendingSync > 0 && (
                    <div className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-blue-500/10 px-3 py-1.5 text-xs font-bold uppercase tracking-widest text-blue-500">
                      <Clock size={12} /> {pendingSync} queued
                    </div>
                  )}
                </div>
              </div>

              {loading ? (
                <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-card)] p-10 shadow-[var(--card-shadow)]">
                  <div className="flex items-center gap-3 text-[var(--text-secondary)]">
                    <LoaderCircle className="animate-spin text-brand-green" size={20} /> Loading
                    attendance register...
                  </div>
                </div>
              ) : null}

              {!loading && error ? (
                <div className="rounded-2xl border border-red-500/20 bg-red-500/8 p-4 text-sm text-red-500">
                  {error}
                </div>
              ) : null}

              {!loading && register && !register.availableClasses.length ? (
                <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-card)] p-8 shadow-[var(--card-shadow)]">
                  <div className="flex items-start gap-3">
                    <FileWarning className="mt-0.5 text-brand-orange" size={20} />
                    <div>
                      <h2 className="font-display text-2xl text-[var(--text-primary)]">
                        No class assignment found
                      </h2>
                      <p className="mt-2 text-sm leading-7 text-[var(--text-secondary)]">
                        This teacher account does not yet have an active class assignment in the
                        database. Create a teacher profile and class assignment before using the
                        attendance register.
                      </p>
                    </div>
                  </div>
                </div>
              ) : null}

              {!loading && register?.availableClasses.length ? (
                <>
                  <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                    {[
                      {
                        label: "Present",
                        value: stats.present,
                        icon: UserCheck,
                        color: "text-brand-green",
                        bg: "bg-brand-green/10",
                      },
                      {
                        label: "Absent",
                        value: stats.absent,
                        icon: X,
                        color: "text-red-500",
                        bg: "bg-red-500/10",
                      },
                      {
                        label: "Late",
                        value: stats.late,
                        icon: Clock,
                        color: "text-brand-orange",
                        bg: "bg-brand-orange/10",
                      },
                      {
                        label: "Attendance rate",
                        value: stats.total
                          ? `${Math.round((stats.present / stats.total) * 100)}%`
                          : "0%",
                        icon: Calendar,
                        color: "text-brand-green",
                        bg: "bg-brand-green/10",
                      },
                    ].map((card) => (
                      <div
                        key={card.label}
                        className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-card)] p-4 shadow-[var(--card-shadow)]"
                      >
                        <div
                          className={`mb-2 flex h-10 w-10 items-center justify-center rounded-xl ${card.bg} ${card.color}`}
                        >
                          <card.icon size={18} />
                        </div>
                        <div className={`font-display text-3xl ${card.color}`}>{card.value}</div>
                        <div className="text-[10px] uppercase tracking-widest text-[var(--text-muted)]">
                          {card.label}
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="flex flex-wrap items-center gap-3">
                    <button
                      onClick={markAllPresent}
                      disabled={isLocked || Boolean(savingMode)}
                      className="inline-flex items-center gap-2 rounded-xl bg-brand-green/10 px-4 py-2.5 text-sm font-bold text-brand-green transition-all hover:bg-brand-green hover:text-brand-navy disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <Check size={14} /> Mark all present
                    </button>
                    <span className="text-xs text-[var(--text-muted)]">
                      {stats.total} active student{stats.total === 1 ? "" : "s"} in the selected
                      class
                    </span>
                    {register.session?.submittedAt ? (
                      <span className="text-xs text-brand-green">
                        Submitted: {new Date(register.session.submittedAt).toLocaleString()}
                      </span>
                    ) : null}
                  </div>

                  <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-card)] shadow-[var(--card-shadow)]">
                    <div className="border-b border-[var(--border-subtle)] px-6 py-4">
                      <h2 className="font-display text-xl text-[var(--text-primary)]">
                        {register.selectedClass?.displayName} · Daily register
                      </h2>
                      <p className="mt-1 text-xs text-[var(--text-muted)]">
                        Period key: {register.session?.periodKey || "DAILY_REGISTER"}
                      </p>
                    </div>

                    <div className="divide-y divide-[var(--border-subtle)]">
                      {rows.map((row) => (
                        <div
                          key={row.studentProfileId}
                          className="flex flex-col gap-4 px-6 py-4 lg:flex-row lg:items-center"
                        >
                          <div className="min-w-0 flex-1">
                            <div className="font-semibold text-[var(--text-primary)]">
                              {row.displayName}
                            </div>
                            <div className="text-[11px] text-[var(--text-muted)]">
                              {row.studentId}
                            </div>
                            {row.guardianPhone ? (
                              <div className="mt-1 text-[11px] text-[var(--text-muted)]">
                                Guardian: {row.guardianName || "Linked parent"} ·{" "}
                                {row.guardianPhone}
                              </div>
                            ) : null}
                          </div>

                          {(row.status === "ABSENT" || row.status === "LATE") && !isLocked ? (
                            <input
                              value={row.note}
                              onChange={(event) =>
                                updateNote(row.studentProfileId, event.target.value)
                              }
                              placeholder={
                                row.status === "ABSENT"
                                  ? "Optional absence note"
                                  : "Optional late note"
                              }
                              className="w-full rounded-xl border border-[var(--input-border)] bg-[var(--input-bg)] px-4 py-2.5 text-sm text-[var(--input-text)] outline-none focus:border-[var(--input-border-focus)] lg:w-72"
                              disabled={Boolean(savingMode)}
                            />
                          ) : row.note ? (
                            <div className="w-full rounded-xl bg-[var(--surface-disabled)] px-4 py-2.5 text-sm text-[var(--text-secondary)] lg:w-72">
                              {row.note}
                            </div>
                          ) : null}

                          <div className="flex gap-2">
                            {STATUS_BUTTONS.map((button) => {
                              const active = row.status === button.value;
                              return (
                                <button
                                  key={button.value}
                                  onClick={() => updateStatus(row.studentProfileId, button.value)}
                                  disabled={isLocked || Boolean(savingMode)}
                                  className={`h-11 w-11 rounded-xl text-xs font-bold transition-all ${active ? button.accent : "bg-[var(--surface-disabled)] text-[var(--text-muted)] hover:bg-[var(--border-subtle)]"} disabled:cursor-not-allowed disabled:opacity-50`}
                                  title={button.value}
                                >
                                  {button.label}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="border-t border-[var(--border-subtle)] bg-[var(--surface-disabled)] px-6 py-4">
                      <label className="mb-2 block text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--text-muted)]">
                        Register note
                      </label>
                      <textarea
                        value={notes}
                        onChange={(event) => setNotes(event.target.value)}
                        placeholder="Optional note for this attendance session"
                        className="min-h-24 w-full rounded-xl border border-[var(--input-border)] bg-[var(--input-bg)] px-4 py-3 text-sm text-[var(--input-text)] outline-none focus:border-[var(--input-border-focus)]"
                        disabled={isLocked || Boolean(savingMode)}
                      />
                    </div>
                  </div>

                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="rounded-2xl border border-brand-green/20 bg-brand-green/5 p-4 text-sm text-[var(--text-secondary)]">
                      <div className="flex items-start gap-3">
                        <BellRing className="mt-0.5 shrink-0 text-brand-green" size={18} />
                        <p>
                          When submitted, this session becomes locked. Alert jobs can be queued for
                          <strong className="text-brand-green"> {notificationPreview}</strong>{" "}
                          absent/late case(s).
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-col gap-3 sm:flex-row">
                      <button
                        onClick={() => void saveRegister(false)}
                        disabled={isLocked || Boolean(savingMode) || !rows.length}
                        className="inline-flex items-center justify-center gap-2 rounded-full border border-[var(--border-default)] px-6 py-3 text-sm font-bold uppercase tracking-widest text-[var(--text-primary)] transition-all hover:bg-[var(--surface-disabled)] disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {savingMode === "draft" ? (
                          <LoaderCircle className="animate-spin" size={16} />
                        ) : (
                          <Save size={16} />
                        )}{" "}
                        Save draft
                      </button>
                      <button
                        onClick={() => void saveRegister(true)}
                        disabled={isLocked || Boolean(savingMode) || !rows.length}
                        className="inline-flex items-center justify-center gap-2 rounded-full bg-brand-green px-6 py-3 text-sm font-bold uppercase tracking-widest text-brand-navy shadow-lg transition-all hover:bg-brand-green-dark disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {savingMode === "submit" ? (
                          <LoaderCircle className="animate-spin" size={16} />
                        ) : (
                          <Send size={16} />
                        )}{" "}
                        Submit & lock
                      </button>
                    </div>
                  </div>

                  {isLocked ? (
                    <div className="rounded-2xl border border-brand-orange/20 bg-brand-orange/10 p-5">
                      <div className="flex items-start gap-3">
                        <MessageSquareWarning
                          className="mt-0.5 shrink-0 text-brand-orange"
                          size={18}
                        />
                        <div className="flex-1">
                          <h3 className="font-display text-xl text-[var(--text-primary)]">
                            Locked register correction workflow
                          </h3>
                          {correctionRequest ? (
                            <div className="mt-3 space-y-3 text-sm text-[var(--text-secondary)]">
                              <div>
                                <span className="font-semibold text-brand-green">
                                  Current request status:
                                </span>{" "}
                                {correctionRequest.status.replaceAll("_", " ")}
                              </div>
                              <div>
                                <span className="font-semibold">Reason:</span>{" "}
                                {correctionRequest.reason}
                              </div>
                              {correctionRequest.resolutionNote ? (
                                <div>
                                  <span className="font-semibold">Admin note:</span>{" "}
                                  {correctionRequest.resolutionNote}
                                </div>
                              ) : null}
                              <div className="text-xs text-[var(--text-muted)]">
                                Requested on{" "}
                                {new Date(correctionRequest.createdAt).toLocaleString()}
                              </div>
                            </div>
                          ) : (
                            <div className="mt-3 space-y-3">
                              <p className="text-sm text-[var(--text-secondary)]">
                                If a locked attendance session needs an update, submit a correction
                                request for admin approval.
                              </p>
                              <textarea
                                value={correctionReason}
                                onChange={(event) => setCorrectionReason(event.target.value)}
                                placeholder="Explain what needs to be corrected and why."
                                className="min-h-24 w-full rounded-xl border border-[var(--input-border)] bg-[var(--input-bg)] px-4 py-3 text-sm text-[var(--input-text)] outline-none focus:border-[var(--input-border-focus)]"
                                disabled={requestingCorrection}
                              />
                              <button
                                onClick={() => void requestCorrection()}
                                disabled={
                                  requestingCorrection || correctionReason.trim().length < 10
                                }
                                className="inline-flex items-center gap-2 rounded-full bg-brand-orange px-5 py-3 text-sm font-bold uppercase tracking-widest text-brand-navy transition-all hover:bg-brand-orange-dark disabled:cursor-not-allowed disabled:opacity-50"
                              >
                                {requestingCorrection ? (
                                  <LoaderCircle className="animate-spin" size={16} />
                                ) : (
                                  <Send size={16} />
                                )}{" "}
                                Request correction
                              </button>
                            </div>
                          )}
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
