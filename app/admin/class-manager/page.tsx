"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import PortalTopbar from "@/components/PortalTopbar";
import AdminSidebar from "@/components/AdminSidebar";
import ConfirmDialog from "@/components/ConfirmDialog";
import { useToast } from "@/components/Toast";
import {
  ArchiveRestore,
  Archive,
  ChevronDown,
  GraduationCap,
  LoaderCircle,
  MoveRight,
  School,
  Search,
  UserCog,
  Users,
} from "lucide-react";

type StudentRow = {
  id: string;
  studentId: string;
  displayName: string;
  gender: string | null;
  guardianName: string | null;
  guardianPhone: string | null;
};

type ClassRow = {
  id: string;
  displayName: string;
  level: string;
  arm: string;
  capacity: number | null;
  studentCount: number;
  formTeacher: { assignmentId: string; teacherProfileId: string; displayName: string } | null;
  students: StudentRow[];
};

type Response = {
  archivedCount: number;
  teachers: Array<{ id: string; displayName: string; roleLabel: string | null }>;
  classes: ClassRow[];
};

type LifecycleReport = {
  generatedAt: string;
  total: number;
  blocking: number;
  warnings: number;
  byCode: Record<string, number>;
  exceptions: Array<{
    code: string;
    severity: "blocking" | "warning";
    message: string;
    studentProfileId?: string;
    studentLabel?: string;
    className?: string;
    suggestedFix?: string;
  }>;
};

type LifecyclePlan = {
  ok: boolean;
  student?: { displayName: string; studentId: string };
  fromClass?: { displayName: string };
  toClass?: { displayName: string };
  capacity?: { occupied: number; capacity: number | null; projected: number; full: boolean };
  enrolmentAction?: string;
  enrolmentsOpen?: number;
  loginOpen?: boolean;
  loginReopens?: boolean;
  outstandingBalance?: number;
  subjects?: { add: string[]; reactivate: string[]; deactivate: string[] };
  exceptions: Array<{ severity: "blocking" | "warning"; message: string }>;
  warnings?: string[];
};

type ArchivedStudent = {
  id: string;
  studentId: string;
  displayName: string;
  className: string;
  guardianName: string | null;
  archivedAt: string;
};

export default function AdminClassManagerPage() {
  const { toast } = useToast();
  const [data, setData] = useState<Response | null>(null);
  const [archived, setArchived] = useState<ArchivedStudent[] | null>(null);
  const [lifecycleReport, setLifecycleReport] = useState<LifecycleReport | null>(null);
  const [showLifecycleReport, setShowLifecycleReport] = useState(false);
  const lifecycleKeyRef = useRef<{ fingerprint: string; key: string } | null>(null);
  const [openClassId, setOpenClassId] = useState("");
  const [teacherPick, setTeacherPick] = useState<Record<string, string>>({});
  const [movePick, setMovePick] = useState<Record<string, string>>({});
  const [search, setSearch] = useState("");
  // Class creation — there was no way to add a class from the app at all, which
  // also made the promotion engine's own advice ("Create it, or choose a
  // class") impossible to follow.
  const [newLevel, setNewLevel] = useState("");
  const [newArm, setNewArm] = useState("");
  const [creating, setCreating] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [confirm, setConfirm] = useState<{
    label: string;
    run: () => Promise<void>;
    danger?: boolean;
  } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/admin/class-manager", { cache: "no-store" });
      const body = (await response.json()) as Response & { error?: string };
      if (!response.ok) throw new Error(body.error || "Unable to load classes.");
      setData(body);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load classes.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function act(payload: Record<string, unknown>, refreshArchived = false) {
    setBusy(true);
    try {
      const response = await fetch("/api/admin/class-manager", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = (await response.json()) as { message?: string; error?: string };
      if (!response.ok) throw new Error(body.error || "Action failed.");
      toast(body.message || "Done.", "success");
      await load();
      if (refreshArchived && archived !== null) await loadArchived();
    } catch (actError) {
      toast(actError instanceof Error ? actError.message : "Action failed.", "error");
    } finally {
      setBusy(false);
      setConfirm(null);
    }
  }

  async function loadLifecycleReport() {
    const response = await fetch("/api/admin/student-lifecycle", { cache: "no-store" });
    const body = (await response.json()) as LifecycleReport & { error?: string };
    if (!response.ok) throw new Error(body.error || "Unable to load the lifecycle report.");
    setLifecycleReport(body);
    setShowLifecycleReport(true);
  }

  async function previewLifecycle(
    planRequest: Record<string, unknown>,
    commitRequest: Record<string, unknown>,
    refreshArchived = false,
  ) {
    setBusy(true);
    try {
      const response = await fetch("/api/admin/student-lifecycle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(planRequest),
      });
      const body = (await response.json()) as { plan?: LifecyclePlan; error?: string };
      if (!response.ok || !body.plan)
        throw new Error(body.error || "Unable to preview this change.");
      const plan = body.plan;
      const blockers = plan.exceptions.filter((entry) => entry.severity === "blocking");
      if (!plan.ok || blockers.length) {
        toast(
          blockers.map((entry) => entry.message).join(" ") ||
            "Resolve the lifecycle exceptions first.",
          "error",
        );
        return;
      }

      const fingerprint = JSON.stringify(commitRequest);
      if (lifecycleKeyRef.current?.fingerprint !== fingerprint) {
        lifecycleKeyRef.current = { fingerprint, key: crypto.randomUUID() };
      }
      const idempotencyKey = lifecycleKeyRef.current.key;
      const parts = [
        plan.fromClass && plan.toClass
          ? `${plan.fromClass.displayName} → ${plan.toClass.displayName}`
          : plan.toClass?.displayName
            ? `Class: ${plan.toClass.displayName}`
            : "",
        plan.capacity
          ? `Capacity: ${plan.capacity.occupied}/${plan.capacity.capacity ?? "unlimited"} → ${plan.capacity.projected}`
          : "",
        plan.enrolmentAction ? `Enrolment: ${plan.enrolmentAction}` : "",
        plan.subjects
          ? `Subjects: +${plan.subjects.add.length} added, ${plan.subjects.reactivate.length} reactivated, ${plan.subjects.deactivate.length} retired`
          : "",
        plan.enrolmentsOpen !== undefined ? `Open enrolments to close: ${plan.enrolmentsOpen}` : "",
        plan.loginOpen !== undefined
          ? `Student login will be ${plan.loginOpen ? "revoked" : "left unchanged"}`
          : "",
        plan.loginReopens ? "Student login will reopen; existing sessions will be revoked." : "",
        plan.outstandingBalance ? `Outstanding fees remain: ${plan.outstandingBalance}` : "",
        ...plan.exceptions
          .filter((entry) => entry.severity === "warning")
          .map((entry) => entry.message),
        ...(plan.warnings ?? []),
      ].filter(Boolean);
      const studentName = plan.student?.displayName ?? "this student";
      setConfirm({
        label: `Review for ${studentName}: ${parts.join(" · ")}. Commit this lifecycle change?`,
        danger: planRequest.action === "PLAN_WITHDRAW",
        run: async () => {
          setBusy(true);
          try {
            const commitResponse = await fetch("/api/admin/student-lifecycle", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "Idempotency-Key": idempotencyKey,
              },
              body: JSON.stringify(commitRequest),
            });
            const commitBody = (await commitResponse.json()) as {
              result?: unknown;
              error?: string;
            };
            if (!commitResponse.ok) throw new Error(commitBody.error || "Lifecycle change failed.");
            toast("Student lifecycle updated.", "success");
            await load();
            if (refreshArchived && archived !== null) await loadArchived();
          } catch (commitError) {
            toast(
              commitError instanceof Error ? commitError.message : "Lifecycle change failed.",
              "error",
            );
          } finally {
            setBusy(false);
            setConfirm(null);
          }
        },
      });
    } catch (previewError) {
      toast(
        previewError instanceof Error ? previewError.message : "Unable to preview this change.",
        "error",
      );
    } finally {
      setBusy(false);
    }
  }

  async function loadArchived() {
    const response = await fetch("/api/admin/class-manager/archived", { cache: "no-store" });
    const body = (await response.json()) as { students: ArchivedStudent[]; error?: string };
    if (response.ok) setArchived(body.students);
  }

  const query = search.trim().toLowerCase();

  async function createClass() {
    const level = newLevel.trim().toUpperCase();
    const arm = newArm.trim().toUpperCase();
    if (!level || !arm) return;
    setCreating(true);
    try {
      const response = await fetch("/api/admin/class-manager", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ level, arm }),
      });
      const body = (await response.json()) as { message?: string; error?: string };
      if (!response.ok) throw new Error(body.error || "Unable to create the class.");
      toast(body.message || `${level}${arm} created.`, "success");
      setNewLevel("");
      setNewArm("");
      await load();
    } catch (createError) {
      toast(
        createError instanceof Error ? createError.message : "Unable to create the class.",
        "error",
      );
    } finally {
      setCreating(false);
    }
  }

  return (
    <>
      <PortalTopbar />
      <main className="min-h-screen bg-[var(--bg-primary)] theme-transition">
        <section className="bg-brand-navy px-6 pt-28 pb-14">
          <div className="mx-auto max-w-7xl">
            <span className="mb-3 inline-flex items-center gap-1.5 rounded-full border border-brand-green/40 bg-famex-lime/20 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-brand-green">
              <School size={11} /> Class Management
            </span>
            <h1 className="font-display text-4xl tracking-widest text-white md:text-6xl">
              TEACHER &amp; CLASS <span className="text-brand-green">MANAGER</span>
            </h1>
            <p className="mt-3 max-w-2xl font-body text-sm text-white/85">
              Class list with live rosters — change form teachers, move students between arms, and
              archive or restore student records.
            </p>
          </div>
        </section>

        <section className="px-6 py-10">
          <div className="mx-auto flex max-w-7xl flex-col gap-8 lg:flex-row">
            <AdminSidebar />

            <div className="min-w-0 flex-1 space-y-6">
              {/* Create a class. Level + arm are separate fields and the
                  display name is derived server-side — a hand-typed "JSS 1 A"
                  would not match LEVEL_PROGRESSION and would break promotion
                  for that class. */}
              <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-card)] p-4">
                <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--text-muted)]">
                  Add a class
                </p>
                <div className="flex flex-wrap items-end gap-2">
                  <label className="flex-1 min-w-[120px]">
                    <span className="mb-1.5 block text-xs text-[var(--text-secondary)]">Level</span>
                    <input
                      value={newLevel}
                      onChange={(event) => setNewLevel(event.target.value)}
                      placeholder="JSS1"
                      className="w-full rounded-xl border border-[var(--input-border)] bg-[var(--input-bg)] p-3 text-sm uppercase text-[var(--input-text)]"
                    />
                  </label>
                  <label className="w-24">
                    <span className="mb-1.5 block text-xs text-[var(--text-secondary)]">Arm</span>
                    <input
                      value={newArm}
                      onChange={(event) => setNewArm(event.target.value)}
                      placeholder="A"
                      className="w-full rounded-xl border border-[var(--input-border)] bg-[var(--input-bg)] p-3 text-sm uppercase text-[var(--input-text)]"
                    />
                  </label>
                  <button
                    onClick={() => void createClass()}
                    disabled={creating || !newLevel.trim() || !newArm.trim()}
                    className="rounded-full bg-famex-lime px-6 py-3 text-sm font-bold text-brand-navy disabled:opacity-60"
                  >
                    {creating
                      ? "Creating…"
                      : `Create ${newLevel.trim().toUpperCase()}${newArm.trim().toUpperCase()}`}
                  </button>
                </div>
              </div>

              {error ? (
                <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-500">
                  {error}
                </div>
              ) : null}

              {loading ? (
                <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-card)] p-10 shadow-[var(--card-shadow)]">
                  <div className="flex items-center gap-3 text-[var(--text-secondary)]">
                    <LoaderCircle className="animate-spin text-brand-green" size={20} /> Loading
                    class manager...
                  </div>
                </div>
              ) : null}

              {!loading && data ? (
                <>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="relative">
                      <Search
                        size={15}
                        className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--text-muted)]"
                      />
                      <input
                        value={search}
                        onChange={(event) => setSearch(event.target.value)}
                        placeholder="Search students..."
                        className="w-72 rounded-full border border-[var(--input-border)] bg-[var(--input-bg)] py-2.5 pl-11 pr-4 text-sm text-[var(--input-text)]"
                      />
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={() => {
                          if (archived === null) void loadArchived();
                          else setArchived(null);
                        }}
                        className="inline-flex items-center gap-2 rounded-full bg-brand-orange px-5 py-2.5 text-xs font-bold uppercase tracking-widest text-brand-navy shadow"
                      >
                        <Archive size={13} />{" "}
                        {archived === null
                          ? `Archived Students (${data.archivedCount})`
                          : "Hide Archived"}
                      </button>
                      <button
                        onClick={() => {
                          if (showLifecycleReport) setShowLifecycleReport(false);
                          else
                            void loadLifecycleReport().catch((reportError: unknown) =>
                              toast(
                                reportError instanceof Error
                                  ? reportError.message
                                  : "Unable to load the lifecycle report.",
                                "error",
                              ),
                            );
                        }}
                        className="rounded-full border border-[var(--border-subtle)] bg-[var(--surface-card)] px-5 py-2.5 text-xs font-bold uppercase tracking-widest text-[var(--text-primary)]"
                      >
                        {showLifecycleReport ? "Hide lifecycle report" : "Lifecycle exceptions"}
                        {lifecycleReport ? ` (${lifecycleReport.total})` : ""}
                      </button>
                    </div>
                  </div>

                  {/* Archived panel */}
                  {archived !== null ? (
                    <div className="rounded-[2rem] border border-brand-orange/25 bg-brand-orange/5 p-6">
                      <h2 className="mb-4 font-display text-xl text-[var(--text-primary)]">
                        Archived Students
                      </h2>
                      {archived.length ? (
                        <div className="space-y-2">
                          {archived.map((student) => (
                            <div
                              key={student.id}
                              className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-[var(--surface-card)] border border-[var(--border-subtle)] px-4 py-3"
                            >
                              <div>
                                <div className="text-sm font-bold text-[var(--text-primary)]">
                                  {student.displayName}
                                </div>
                                <div className="text-[10px] uppercase tracking-widest text-[var(--text-muted)]">
                                  {student.studentId} · {student.className} · archived{" "}
                                  {new Date(student.archivedAt).toLocaleDateString()}
                                </div>
                              </div>
                              <button
                                onClick={() =>
                                  void previewLifecycle(
                                    { action: "PLAN_READMIT", studentProfileId: student.id },
                                    {
                                      action: "COMMIT_READMIT",
                                      studentProfileId: student.id,
                                      reason: "Student re-entry approved",
                                    },
                                    true,
                                  )
                                }
                                disabled={busy}
                                className="inline-flex items-center gap-1.5 rounded-full bg-famex-lime px-4 py-2 text-[10px] font-bold uppercase tracking-widest text-brand-navy disabled:opacity-50"
                              >
                                <ArchiveRestore size={12} /> Restore
                              </button>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-[var(--text-muted)]">No archived students.</p>
                      )}
                    </div>
                  ) : null}

                  {showLifecycleReport && lifecycleReport ? (
                    <div className="rounded-[2rem] border border-[var(--border-subtle)] bg-[var(--surface-card)] p-6">
                      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
                        <h2 className="font-display text-xl text-[var(--text-primary)]">
                          Student lifecycle exceptions
                        </h2>
                        <span className="text-xs text-[var(--text-muted)]">
                          {lifecycleReport.blocking} blocking · {lifecycleReport.warnings} warnings
                        </span>
                      </div>
                      {lifecycleReport.exceptions.length === 0 ? (
                        <p className="text-sm text-[var(--text-secondary)]">
                          No enrolment, subject, capacity, login or guardian drift found.
                        </p>
                      ) : (
                        <ul className="space-y-3">
                          {lifecycleReport.exceptions.map((exception, index) => (
                            <li
                              key={`${exception.code}-${exception.studentProfileId ?? exception.className ?? index}`}
                              className="rounded-xl border border-[var(--border-subtle)] p-4"
                            >
                              <div className="flex flex-wrap items-center gap-2">
                                <span
                                  className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${exception.severity === "blocking" ? "bg-red-500/10 text-red-600" : "bg-brand-orange/10 text-brand-orange"}`}
                                >
                                  {exception.severity}
                                </span>
                                <span className="text-xs font-bold text-[var(--text-primary)]">
                                  {exception.code}
                                </span>
                                {exception.studentLabel || exception.className ? (
                                  <span className="text-xs text-[var(--text-muted)]">
                                    {exception.studentLabel ?? exception.className}
                                  </span>
                                ) : null}
                              </div>
                              <p className="mt-2 text-sm text-[var(--text-secondary)]">
                                {exception.message}
                              </p>
                              {exception.suggestedFix ? (
                                <p className="mt-1 text-xs text-[var(--text-muted)]">
                                  Suggested fix: {exception.suggestedFix}
                                </p>
                              ) : null}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  ) : null}

                  {/* Class list */}
                  <div className="space-y-3">
                    {data.classes.map((schoolClass) => {
                      const isOpen = openClassId === schoolClass.id;
                      const visibleStudents = query
                        ? schoolClass.students.filter(
                            (student) =>
                              student.displayName.toLowerCase().includes(query) ||
                              student.studentId.toLowerCase().includes(query),
                          )
                        : schoolClass.students;
                      if (query && !visibleStudents.length) return null;
                      return (
                        <div
                          key={schoolClass.id}
                          className="overflow-hidden rounded-[2rem] border border-[var(--border-subtle)] bg-[var(--surface-card)] shadow-[var(--card-shadow)]"
                        >
                          <button
                            onClick={() => setOpenClassId(isOpen ? "" : schoolClass.id)}
                            className="flex w-full items-center justify-between gap-4 px-6 py-5 text-left"
                          >
                            <div className="flex items-center gap-4">
                              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-famex-lime/10 text-brand-green">
                                <School size={19} />
                              </div>
                              <div>
                                <div className="font-display text-xl text-[var(--text-primary)]">
                                  {schoolClass.displayName}
                                </div>
                                <div className="text-[10px] uppercase tracking-widest text-[var(--text-muted)]">
                                  Form teacher:{" "}
                                  {schoolClass.formTeacher?.displayName || "Not assigned"}
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-3">
                              <span className="inline-flex items-center gap-1 rounded-full bg-famex-lime/10 px-3 py-1 text-xs font-bold text-brand-green">
                                <Users size={12} /> {schoolClass.studentCount}
                              </span>
                              <ChevronDown
                                size={18}
                                className={`text-[var(--text-muted)] transition-transform ${isOpen ? "rotate-180" : ""}`}
                              />
                            </div>
                          </button>

                          {isOpen ? (
                            <div className="border-t border-[var(--border-subtle)] px-6 py-6 space-y-6">
                              {/* Change form teacher */}
                              <div className="rounded-2xl bg-gradient-to-br from-brand-navy to-brand-navy-light p-6">
                                <div className="mb-3 flex items-center gap-2 text-white">
                                  <UserCog size={18} className="text-brand-green" />
                                  <span className="font-display text-lg">Change Form Teacher</span>
                                </div>
                                <div className="flex flex-wrap gap-3">
                                  <select
                                    value={teacherPick[schoolClass.id] || ""}
                                    onChange={(event) =>
                                      setTeacherPick({
                                        ...teacherPick,
                                        [schoolClass.id]: event.target.value,
                                      })
                                    }
                                    className="w-64 rounded-xl border border-white/20 bg-white/10 px-4 py-3 text-sm text-white [&>option]:text-brand-navy"
                                  >
                                    <option value="">Select new teacher...</option>
                                    {data.teachers.map((teacher) => (
                                      <option key={teacher.id} value={teacher.id}>
                                        {teacher.displayName}
                                      </option>
                                    ))}
                                  </select>
                                  <button
                                    onClick={() => {
                                      const teacherProfileId = teacherPick[schoolClass.id];
                                      if (!teacherProfileId) {
                                        toast("Select a teacher first.", "warning");
                                        return;
                                      }
                                      void act({
                                        action: "CHANGE_FORM_TEACHER",
                                        classId: schoolClass.id,
                                        teacherProfileId,
                                      });
                                    }}
                                    disabled={busy}
                                    className="inline-flex items-center gap-2 rounded-full bg-famex-lime px-6 py-3 text-xs font-bold uppercase tracking-widest text-brand-navy disabled:opacity-50"
                                  >
                                    <GraduationCap size={13} /> Update Teacher
                                  </button>
                                </div>
                              </div>

                              {/* Roster */}
                              <div className="space-y-2">
                                {visibleStudents.map((student) => (
                                  <div
                                    key={student.id}
                                    className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-[var(--surface-disabled)] px-4 py-3"
                                  >
                                    <div className="min-w-0">
                                      <div className="text-sm font-bold text-[var(--text-primary)]">
                                        {student.displayName}
                                      </div>
                                      <div className="text-[10px] uppercase tracking-widest text-[var(--text-muted)]">
                                        {student.studentId}
                                        {student.gender ? ` · ${student.gender}` : ""}
                                        {student.guardianName
                                          ? ` · Guardian: ${student.guardianName}`
                                          : ""}
                                      </div>
                                    </div>
                                    <div className="flex flex-wrap items-center gap-2">
                                      <select
                                        value={movePick[student.id] || ""}
                                        onChange={(event) =>
                                          setMovePick({
                                            ...movePick,
                                            [student.id]: event.target.value,
                                          })
                                        }
                                        className="rounded-lg border border-[var(--input-border)] bg-[var(--input-bg)] px-3 py-2 text-xs text-[var(--input-text)]"
                                      >
                                        <option value="">Move to...</option>
                                        {data.classes
                                          .filter((entry) => entry.id !== schoolClass.id)
                                          .map((entry) => (
                                            <option key={entry.id} value={entry.id}>
                                              {entry.displayName}
                                            </option>
                                          ))}
                                      </select>
                                      <button
                                        onClick={() => {
                                          const targetClassId = movePick[student.id];
                                          if (!targetClassId) {
                                            toast("Choose a destination class.", "warning");
                                            return;
                                          }
                                          void previewLifecycle(
                                            {
                                              action: "PLAN_CLASS_CHANGE",
                                              studentProfileId: student.id,
                                              toClassId: targetClassId,
                                            },
                                            {
                                              action: "COMMIT_CLASS_CHANGE",
                                              studentProfileId: student.id,
                                              toClassId: targetClassId,
                                              reason: "Class manager transfer",
                                            },
                                          );
                                        }}
                                        disabled={busy}
                                        className="inline-flex items-center gap-1 rounded-full bg-famex-lime px-3.5 py-2 text-[10px] font-bold uppercase tracking-widest text-brand-navy disabled:opacity-50"
                                      >
                                        <MoveRight size={11} /> Move
                                      </button>
                                      <button
                                        onClick={() =>
                                          void previewLifecycle(
                                            {
                                              action: "PLAN_WITHDRAW",
                                              studentProfileId: student.id,
                                            },
                                            {
                                              action: "COMMIT_WITHDRAW",
                                              studentProfileId: student.id,
                                              reason: "Student withdrawn from active roll",
                                            },
                                            true,
                                          )
                                        }
                                        disabled={busy}
                                        className="inline-flex items-center gap-1 rounded-full bg-red-500 px-3.5 py-2 text-[10px] font-bold uppercase tracking-widest text-white disabled:opacity-50"
                                      >
                                        <Archive size={11} /> Archive
                                      </button>
                                    </div>
                                  </div>
                                ))}
                                {!visibleStudents.length ? (
                                  <p className="text-sm text-[var(--text-muted)]">
                                    No active students in this class.
                                  </p>
                                ) : null}
                              </div>
                            </div>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                </>
              ) : null}
            </div>
          </div>
        </section>
      </main>

      <ConfirmDialog
        open={Boolean(confirm)}
        title="Please confirm"
        message={confirm?.label || ""}
        confirmText="Confirm"
        cancelText="Cancel"
        variant={confirm?.danger ? "danger" : "warning"}
        onConfirm={() => void confirm?.run()}
        onCancel={() => setConfirm(null)}
      />
    </>
  );
}
