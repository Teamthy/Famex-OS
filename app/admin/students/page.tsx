"use client";
import { FormEvent, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import AdminSidebar from "@/components/AdminSidebar";
import PortalTopbar from "@/components/PortalTopbar";
import { Search, UserPlus, X } from "lucide-react";
type Class = { id: string; displayName: string; capacity: number | null };
type Student = {
  id: string;
  studentId: string;
  displayName: string;
  guardianName: string | null;
  guardianPhone: string | null;
  guardianEmail: string | null;
  className: string;
  classId: string;
  outstanding: number;
  feeStatus: "PAID" | "OWING" | "NOT_BILLED";
};
export default function StudentsPage() {
  const [students, setStudents] = useState<Student[]>([]),
    [classes, setClasses] = useState<Class[]>([]),
    [open, setOpen] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [search, setSearch] = useState(""),
    [classFilter, setClassFilter] = useState("ALL"),
    [feeFilter, setFeeFilter] = useState("ALL");
  const load = useCallback(async () => {
    const r = await fetch("/api/admin/students", { cache: "no-store" });
    const j = await r.json();
    if (r.ok) {
      setStudents(j.students);
      setClasses(j.classes);
    } else setError(j.error || "Could not load students.");
  }, []);
  useEffect(() => {
    void load();
  }, [load]);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    const form = new FormData(e.currentTarget);
    const r = await fetch("/api/admin/students", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Idempotency-Key": crypto.randomUUID() + crypto.randomUUID(),
      },
      body: JSON.stringify(Object.fromEntries(form)),
    });
    const j = await r.json();
    if (!r.ok) {
      setError(j.error || "Enrollment failed.");
      return;
    }
    setOpen(false);
    setNotice(
      `${j.student.displayName} enrolled in ${j.student.className}. ${j.parentAccount?.temporaryPassword ? `Temporary parent password (show once): ${j.parentAccount.temporaryPassword}` : "Parent account is already linked; no new password was created."}`,
    );
    await load();
  }
  /**
   * Text search alone was the only filter, over every student in the school.
   * An admin chasing unpaid fees in SS2 had to know a name before they could
   * narrow anything — the list is not useful at 600 rows.
   */
  const shown = students.filter((x) => {
    const matchesText = `${x.displayName} ${x.studentId} ${x.className}`
      .toLowerCase()
      .includes(search.toLowerCase());
    const matchesClass = classFilter === "ALL" || x.classId === classFilter;
    const matchesFee = feeFilter === "ALL" || x.feeStatus === feeFilter;
    return matchesText && matchesClass && matchesFee;
  });
  return (
    <>
      <PortalTopbar title="Student records" />
      <main className="mx-auto flex max-w-[1600px] gap-8 px-4 py-6 sm:px-6">
        <AdminSidebar />
        <section className="min-w-0 flex-1">
          <div className="rounded-[2rem] bg-brand-navy p-7 text-white">
            <p className="text-xs font-bold uppercase tracking-widest text-brand-green">
              People & placement
            </p>
            <h1 className="mt-2 font-display text-4xl tracking-widest">
              STUDENT <span className="text-brand-green">RECORDS</span>
            </h1>
            <p className="mt-3 max-w-2xl text-sm text-white/65">
              Create verified student profiles, link a parent, and place each learner into an active
              class.
            </p>
          </div>
          {notice && (
            <div className="mt-5 rounded-2xl border border-brand-green/30 bg-brand-green/10 p-4 text-sm text-[var(--text-primary)]">
              {notice}
            </div>
          )}
          {error && (
            <div className="mt-5 rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-600">
              {error}
            </div>
          )}
          <div className="mt-6 flex flex-wrap justify-between gap-3">
            <label className="relative">
              <Search className="absolute left-3 top-3 text-[var(--text-muted)]" size={16} />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="rounded-full border border-[var(--input-border)] bg-[var(--input-bg)] py-2.5 pl-9 pr-4 text-sm"
                placeholder="Search students"
              />
            </label>

            {/* Class and payment filters. Text search over every student in
                the school was the only way to narrow the list, which is
                useless for "show me everyone in SS2 who still owes". */}
            <select
              value={classFilter}
              onChange={(e) => setClassFilter(e.target.value)}
              className="rounded-full border border-[var(--input-border)] bg-[var(--input-bg)] px-4 py-2.5 text-sm"
            >
              <option value="ALL">All classes</option>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.displayName}
                </option>
              ))}
            </select>

            <select
              value={feeFilter}
              onChange={(e) => setFeeFilter(e.target.value)}
              className="rounded-full border border-[var(--input-border)] bg-[var(--input-bg)] px-4 py-2.5 text-sm"
            >
              <option value="ALL">Any fee status</option>
              <option value="OWING">Owing</option>
              <option value="PAID">Paid</option>
              <option value="NOT_BILLED">Not billed</option>
            </select>

            <span className="self-center text-xs text-[var(--text-muted)]">
              {shown.length} of {students.length}
            </span>

            <button
              onClick={() => setOpen(true)}
              className="inline-flex items-center gap-2 rounded-full bg-brand-green px-5 py-2.5 text-xs font-bold uppercase tracking-widest text-brand-navy"
            >
              <UserPlus size={15} /> Enrol student
            </button>
          </div>
          <div className="mt-5 overflow-hidden rounded-3xl border border-[var(--border-subtle)] bg-[var(--surface-card)]">
            <table className="w-full text-left text-sm">
              <thead className="bg-[var(--surface-disabled)] text-[10px] uppercase tracking-widest text-[var(--text-muted)]">
                <tr>
                  <th className="p-4">Student</th>
                  <th className="p-4">Class</th>
                  <th className="p-4">Parent / Guardian</th>
                </tr>
              </thead>
              <tbody>
                {shown.map((s) => (
                  <tr className="border-t border-[var(--border-subtle)]" key={s.id}>
                    <td className="p-4">
                      {/* The rows were static text. There was no way to open a
                          single child from here at all. */}
                      <Link
                        href={`/admin/students/${s.id}`}
                        className="font-bold text-[var(--text-primary)] hover:text-brand-green hover:underline"
                      >
                        {s.displayName}
                      </Link>
                      <small className="mt-1 block font-mono text-[var(--text-muted)]">
                        {s.studentId}
                      </small>
                      <span
                        className={`mt-1 inline-block rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-widest ${
                          s.feeStatus === "PAID"
                            ? "bg-brand-green/15 text-brand-green"
                            : s.feeStatus === "OWING"
                              ? "bg-red-500/15 text-red-500"
                              : "bg-brand-orange/15 text-brand-orange"
                        }`}
                      >
                        {s.feeStatus === "PAID"
                          ? "Paid"
                          : s.feeStatus === "OWING"
                            ? `Owing ₦${Number(s.outstanding || 0).toLocaleString()}`
                            : "Not billed"}
                      </span>
                    </td>
                    <td className="p-4">{s.className}</td>
                    <td className="p-4">
                      {s.guardianName || "—"}
                      <small className="mt-1 block text-[var(--text-muted)]">
                        {s.guardianPhone || s.guardianEmail || "—"}
                      </small>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!shown.length && (
              <p className="p-10 text-center text-sm text-[var(--text-muted)]">
                No student records found.
              </p>
            )}
          </div>
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
                  Secure enrollment
                </p>
                <h2 className="font-display text-3xl tracking-widest">NEW STUDENT</h2>
              </div>
              <button type="button" onClick={() => setOpen(false)}>
                <X />
              </button>
            </div>
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              {[
                ["firstName", "First name", true],
                ["otherNames", "Other names", false],
                ["lastName", "Last name", true],
                ["guardianName", "Parent / guardian name", true],
                ["guardianPhone", "Guardian phone", true],
                ["guardianEmail", "Guardian email (optional)", false],
              ].map(([n, l, required]) => (
                <label key={String(n)} className="text-xs font-bold uppercase tracking-wider">
                  {l}
                  <input
                    name={String(n)}
                    required={Boolean(required)}
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
                Class / arm
                <select
                  name="classId"
                  required
                  className="mt-2 w-full rounded-xl border border-[var(--input-border)] bg-[var(--input-bg)] p-3 text-sm normal-case"
                >
                  <option value="">Select a class</option>
                  {classes.map((c) => (
                    <option value={c.id} key={c.id}>
                      {c.displayName}
                      {c.capacity ? ` · capacity ${c.capacity}` : ""}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <p className="mt-5 text-xs text-[var(--text-muted)]">
              A new parent account receives a one-time temporary password. Existing parent accounts
              are linked without exposing or changing their password.
            </p>
            <button className="mt-6 w-full rounded-full bg-brand-green py-3 text-xs font-bold uppercase tracking-widest text-brand-navy">
              Create student record
            </button>
          </form>
        </div>
      )}
    </>
  );
}
