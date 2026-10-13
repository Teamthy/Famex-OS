"use client";

import { useCallback, useEffect, useState } from "react";
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
            <span className="mb-3 inline-flex items-center gap-1.5 rounded-full border border-brand-green/40 bg-brand-green/20 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-brand-green">
              <School size={11} /> Class Management
            </span>
            <h1 className="font-display text-4xl tracking-widest text-white md:text-6xl">
              TEACHER &amp; CLASS <span className="text-brand-green">MANAGER</span>
            </h1>
            <p className="mt-3 max-w-2xl font-body text-sm text-white/60">
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
                    className="rounded-full bg-brand-green px-6 py-3 text-sm font-bold text-brand-navy disabled:opacity-60"
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
                                  void act(
                                    { action: "RESTORE_STUDENT", studentProfileId: student.id },
                                    true,
                                  )
                                }
                                disabled={busy}
                                className="inline-flex items-center gap-1.5 rounded-full bg-brand-green px-4 py-2 text-[10px] font-bold uppercase tracking-widest text-brand-navy disabled:opacity-50"
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
                              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-brand-green/10 text-brand-green">
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
                              <span className="inline-flex items-center gap-1 rounded-full bg-brand-green/10 px-3 py-1 text-xs font-bold text-brand-green">
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
                                    className="inline-flex items-center gap-2 rounded-full bg-brand-green px-6 py-3 text-xs font-bold uppercase tracking-widest text-brand-navy disabled:opacity-50"
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
                                          void act({
                                            action: "MOVE_STUDENT",
                                            studentProfileId: student.id,
                                            targetClassId,
                                          });
                                        }}
                                        disabled={busy}
                                        className="inline-flex items-center gap-1 rounded-full bg-brand-green px-3.5 py-2 text-[10px] font-bold uppercase tracking-widest text-brand-navy disabled:opacity-50"
                                      >
                                        <MoveRight size={11} /> Move
                                      </button>
                                      <button
                                        onClick={() =>
                                          setConfirm({
                                            label: `Archive ${student.displayName}? Their records are preserved and they can be restored later.`,
                                            danger: true,
                                            run: () =>
                                              act(
                                                {
                                                  action: "ARCHIVE_STUDENT",
                                                  studentProfileId: student.id,
                                                },
                                                true,
                                              ),
                                          })
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
