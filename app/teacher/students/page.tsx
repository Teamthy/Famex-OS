"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { cacheGet, cacheSet } from "@/lib/offline/db";
import { BookOpen, LoaderCircle, Search, UserPlus, Users, X } from "lucide-react";
import TeacherSidebar from "@/components/TeacherSidebar";
import PortalTopbar from "@/components/PortalTopbar";

type Assignment = {
  id: string;
  role: string;
  subjectName: string | null;
  classId: string;
  className: string;
  level: string;
  capacity: number | null;
  studentCount: number;
};

type Student = {
  id: string;
  studentId: string;
  displayName: string;
  gender: string | null;
  classId: string;
  className: string;
  guardianName: string | null;
  guardianPhone: string | null;
  canManage: boolean;
};

type Suggestion = {
  applicationId: string;
  firstName: string;
  lastName: string;
  classApplying: string;
  preferredArm: string | null;
  entranceScore: number | null;
  parentEmail: string;
  parentPhone: string;
  recommendedClassId: string | null;
};

function idemp() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto)
    return crypto.randomUUID().replaceAll("-", "");
  return `${Date.now()}${Math.random().toString(16).slice(2)}`;
}

export default function TeacherStudentsPage() {
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [teacher, setTeacher] = useState({
    displayName: "",
    isFormTeacher: false,
    isSubjectTeacher: false,
  });
  const [search, setSearch] = useState("");
  const [classId, setClassId] = useState("All");
  const [scope, setScope] = useState<"all" | "form" | "subject">("all");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(true);
  const [, setIsStale] = useState(false);
  const [open, setOpen] = useState(false);

  const load = useCallback(async () => {
    const url = "/api/teacher/students";
    // Offline: show cached data instantly
    const cached = await cacheGet(url);
    if (cached) {
      const j = cached.data as any;
      setAssignments(j.assignments || []);
      setStudents(j.students || []);
      setSuggestions(j.suggestions || []);
      setTeacher(j.teacher || { displayName: "", isFormTeacher: false, isSubjectTeacher: false });
      setIsStale(true);
      setLoading(false);
    }
    if (typeof navigator !== "undefined" && !navigator.onLine) return;
    setLoading(!cached);
    setError("");
    try {
      const r = await fetch(url, { cache: "no-store" });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "Unable to load students.");
      setAssignments(j.assignments || []);
      setStudents(j.students || []);
      setSuggestions(j.suggestions || []);
      setTeacher(j.teacher || { displayName: "", isFormTeacher: false, isSubjectTeacher: false });
      setIsStale(false);
      await cacheSet(url, j);
    } catch (e) {
      if (!cached) setError(e instanceof Error ? e.message : "Unable to load students.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const formClasses = useMemo(
    () => assignments.filter((a) => a.role === "FORM_TEACHER"),
    [assignments],
  );

  const shown = useMemo(() => {
    return students.filter((s) => {
      const q = search.trim().toLowerCase();
      const matchQ =
        !q ||
        s.displayName.toLowerCase().includes(q) ||
        s.studentId.toLowerCase().includes(q) ||
        (s.guardianPhone || "").includes(q);
      const matchC = classId === "All" || s.classId === classId;
      const matchScope = scope === "all" || (scope === "form" ? s.canManage : !s.canManage);
      return matchQ && matchC && matchScope;
    });
  }, [students, search, classId, scope]);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setNotice("");
    const fd = new FormData(e.currentTarget);
    const body = Object.fromEntries(fd.entries());
    const r = await fetch("/api/teacher/students", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Idempotency-Key": idemp(),
      },
      body: JSON.stringify(body),
    });
    const j = await r.json();
    if (!r.ok) {
      setError(j.error || "Unable to enrol student.");
      return;
    }
    setOpen(false);
    const temp = j.parentAccount?.temporaryPassword
      ? ` Parent temp password (copy now): ${j.parentAccount.temporaryPassword}`
      : "";
    setNotice(
      `Enrolled ${j.student.displayName} (${j.student.studentId}) into ${j.student.className}.${temp}`,
    );
    await load();
  }

  return (
    <>
      <PortalTopbar title="My students" />
      <main className="mx-auto flex max-w-[1600px] gap-8 px-4 py-6 sm:px-6">
        <TeacherSidebar />
        <section className="min-w-0 flex-1 space-y-6">
          <div className="rounded-[2rem] bg-brand-navy p-7 text-white">
            <p className="text-xs font-bold uppercase tracking-widest text-brand-green">
              Live class roster
            </p>
            <h1 className="mt-2 font-display text-4xl tracking-widest">
              MY <span className="text-brand-green">STUDENTS</span>
            </h1>
            <p className="mt-3 max-w-2xl text-sm text-white/65">
              {teacher.isFormTeacher
                ? "Form teachers can enrol learners into their class and see entrance-pass suggestions."
                : "Subject teachers see every learner across assigned classes. Enrolment is limited to form teachers and admins."}
            </p>
          </div>

          {notice && (
            <div className="break-all rounded-2xl border border-brand-green/30 bg-brand-green/10 p-4 text-sm">
              {notice}
            </div>
          )}
          {error && (
            <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-600">
              {error}
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-card)] p-4">
              <Users className="mb-2 text-[var(--text-accent)]" size={18} />
              <div className="font-display text-2xl">{students.length}</div>
              <div className="text-[10px] uppercase tracking-widest text-[var(--text-muted)]">
                Visible students
              </div>
            </div>
            <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-card)] p-4">
              <BookOpen className="mb-2 text-[var(--text-accent-warm)]" size={18} />
              <div className="font-display text-2xl">{assignments.length}</div>
              <div className="text-[10px] uppercase tracking-widest text-[var(--text-muted)]">
                Assignments
              </div>
            </div>
            <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-card)] p-4">
              <UserPlus className="mb-2 text-blue-500" size={18} />
              <div className="font-display text-2xl">{suggestions.length}</div>
              <div className="text-[10px] uppercase tracking-widest text-[var(--text-muted)]">
                Entrance suggestions
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {(["all", "form", "subject"] as const).map((sc) => (
              <button
                key={sc}
                type="button"
                onClick={() => setScope(sc)}
                className={`rounded-full px-4 py-2 text-[10px] font-bold uppercase tracking-widest ${
                  scope === sc
                    ? "bg-brand-green text-white"
                    : "border border-[var(--input-border)] text-[var(--text-muted)]"
                }`}
              >
                {sc === "all"
                  ? "All students"
                  : sc === "form"
                    ? "My form class"
                    : "Subject students"}
              </button>
            ))}
          </div>

          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="flex flex-1 flex-col gap-3 sm:flex-row">
              <label className="relative flex-1">
                <Search className="absolute left-3 top-3 text-[var(--text-muted)]" size={16} />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full rounded-full border border-[var(--input-border)] bg-[var(--input-bg)] py-2.5 pl-9 pr-4 text-sm"
                  placeholder="Search name, ID, phone"
                />
              </label>
              <select
                value={classId}
                onChange={(e) => setClassId(e.target.value)}
                className="rounded-full border border-[var(--input-border)] bg-[var(--input-bg)] px-4 py-2.5 text-sm"
              >
                <option value="All">All classes</option>
                {[...new Map(assignments.map((a) => [a.classId, a])).values()].map((a) => (
                  <option key={a.classId} value={a.classId}>
                    {a.className}
                  </option>
                ))}
              </select>
            </div>
            {teacher.isFormTeacher && (
              <button
                onClick={() => setOpen(true)}
                className="inline-flex items-center justify-center gap-2 rounded-full bg-brand-green px-5 py-2.5 text-xs font-bold uppercase tracking-widest text-brand-navy"
              >
                <UserPlus size={15} /> Enrol into my class
              </button>
            )}
          </div>

          {!!suggestions.length && teacher.isFormTeacher && (
            <div className="rounded-3xl border border-brand-orange/30 bg-brand-orange/5 p-5">
              <h2 className="font-display text-xl tracking-widest text-brand-orange">
                ENTRANCE PASS — SUGGESTED
              </h2>
              <p className="mt-1 text-xs text-[var(--text-muted)]">
                Paid applicants who passed entrance for your form class level. Complete placement
                from Admissions or enrol manually with matching details.
              </p>
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                {suggestions.map((s) => (
                  <div
                    key={s.applicationId}
                    className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-card)] p-4 text-sm"
                  >
                    <b>
                      {s.firstName} {s.lastName}
                    </b>
                    <div className="mt-1 text-xs text-[var(--text-muted)]">
                      {s.applicationId} · {s.classApplying}
                      {s.preferredArm ? s.preferredArm : ""} · score {s.entranceScore ?? "—"}
                    </div>
                    <div className="mt-1 text-xs text-[var(--text-muted)]">
                      {s.parentEmail} · {s.parentPhone}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="overflow-hidden rounded-3xl border border-[var(--border-subtle)] bg-[var(--surface-card)]">
            {loading ? (
              <div className="flex items-center justify-center gap-2 p-12 text-sm text-[var(--text-muted)]">
                <LoaderCircle className="animate-spin" size={18} /> Loading roster…
              </div>
            ) : (
              <table className="w-full text-left text-sm">
                <thead className="bg-[var(--surface-disabled)] text-[10px] uppercase tracking-widest text-[var(--text-muted)]">
                  <tr>
                    <th className="p-4">Student</th>
                    <th className="p-4">Class</th>
                    <th className="p-4">Guardian</th>
                    <th className="p-4">Access</th>
                  </tr>
                </thead>
                <tbody>
                  {shown.map((s) => (
                    <tr key={s.id} className="border-t border-[var(--border-subtle)]">
                      <td className="p-4">
                        <b>{s.displayName}</b>
                        <span className="mt-1 block font-mono text-xs text-[var(--text-muted)]">
                          {s.studentId}
                        </span>
                      </td>
                      <td className="p-4">{s.className}</td>
                      <td className="p-4">
                        {s.guardianName || "—"}
                        <span className="mt-1 block text-xs text-[var(--text-muted)]">
                          {s.guardianPhone || "—"}
                        </span>
                      </td>
                      <td className="p-4">
                        <span
                          className={`rounded-full px-2 py-1 text-[10px] font-bold uppercase tracking-wider ${
                            s.canManage
                              ? "bg-brand-green/15 text-brand-green"
                              : "bg-[var(--surface-disabled)] text-[var(--text-muted)]"
                          }`}
                        >
                          {s.canManage ? "Form class" : "Subject only"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {!loading && !shown.length && (
              <p className="p-10 text-center text-sm text-[var(--text-muted)]">
                No students match this filter.
              </p>
            )}
          </div>

          {!!formClasses.length && (
            <div className="grid gap-3 md:grid-cols-2">
              {formClasses.map((c) => (
                <div
                  key={c.id}
                  className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-card)] p-4 text-sm"
                >
                  <b>{c.className}</b>
                  <div className="mt-1 text-xs text-[var(--text-muted)]">
                    Form teacher · {c.studentCount}
                    {c.capacity != null ? ` / ${c.capacity}` : ""} learners
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>

      {open && (
        <div className="fixed inset-0 z-[100] grid place-items-center bg-black/60 p-4">
          <form
            onSubmit={submit}
            className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-3xl bg-[var(--bg-primary)] p-7"
          >
            <div className="flex justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-brand-green">
                  Form teacher enrolment
                </p>
                <h2 className="font-display text-3xl tracking-widest">NEW STUDENT</h2>
              </div>
              <button type="button" onClick={() => setOpen(false)} aria-label="Close">
                <X />
              </button>
            </div>
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              {(
                [
                  ["firstName", "First name", true],
                  ["otherNames", "Other names", false],
                  ["lastName", "Last name", true],
                  ["guardianName", "Parent / guardian name", true],
                  ["guardianPhone", "Guardian phone", true],
                  ["guardianEmail", "Guardian email (optional)", false],
                ] as const
              ).map(([n, l, required]) => (
                <label key={n} className="text-xs font-bold uppercase tracking-wider">
                  {l}
                  <input
                    name={n}
                    required={required}
                    type={n === "guardianEmail" ? "email" : "text"}
                    className="mt-2 w-full rounded-xl border border-[var(--input-border)] bg-[var(--input-bg)] p-3 text-sm normal-case"
                  />
                </label>
              ))}
              <label className="text-xs font-bold uppercase tracking-wider">
                Gender
                <select
                  name="gender"
                  className="mt-2 w-full rounded-xl border border-[var(--input-border)] bg-[var(--input-bg)] p-3 text-sm normal-case"
                >
                  <option value="">Prefer not to say</option>
                  <option>Female</option>
                  <option>Male</option>
                </select>
              </label>
              <label className="text-xs font-bold uppercase tracking-wider">
                My form class
                <select
                  name="classId"
                  required
                  className="mt-2 w-full rounded-xl border border-[var(--input-border)] bg-[var(--input-bg)] p-3 text-sm normal-case"
                >
                  <option value="">Select class</option>
                  {formClasses.map((c) => (
                    <option key={c.classId} value={c.classId}>
                      {c.className}
                      {c.capacity != null ? ` · ${c.studentCount}/${c.capacity}` : ""}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <p className="mt-5 text-xs text-[var(--text-muted)]">
              Requests are idempotent. A new parent account receives a one-time temporary password
              shown once.
            </p>
            <button className="mt-6 w-full rounded-full bg-brand-green py-3 text-xs font-bold uppercase tracking-widest text-brand-navy">
              Create student in my class
            </button>
          </form>
        </div>
      )}
    </>
  );
}
