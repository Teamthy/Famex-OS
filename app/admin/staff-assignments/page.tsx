"use client";
import { FormEvent, useCallback, useEffect, useState } from "react";
import AdminSidebar from "@/components/AdminSidebar";
import PortalTopbar from "@/components/PortalTopbar";
import { Plus, UserCog, X } from "lucide-react";
type T = {
  id: string;
  name: string;
  email: string;
  role: string;
  assignments: {
    id: string;
    role: string;
    subjectName: string | null;
    classId: string;
    className: string;
  }[];
};
type C = { id: string; displayName: string };
export default function Assignments() {
  const [teachers, setTeachers] = useState<T[]>([]),
    [classes, setClasses] = useState<C[]>([]),
    [open, setOpen] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  const load = useCallback(async () => {
    const r = await fetch("/api/admin/staff/assignments", { cache: "no-store" }),
      j = await r.json();
    if (r.ok) {
      setTeachers(j.teachers);
      setClasses(j.classes);
    } else setError(j.error || "Unable to load assignments.");
  }, []);
  useEffect(() => {
    void load();
  }, [load]);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const classIds = form.getAll("classIds");
    const r = await fetch("/api/admin/staff/assignments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          teacherProfileId: form.get("teacherProfileId"),
          subjectName: form.get("subjectName"),
          classIds,
        }),
      }),
      j = await r.json();
    if (!r.ok) {
      setError(j.error || "Could not save assignment.");
      return;
    }
    setOpen(false);
    setNotice(
      "Subject assignment saved. The teacher dashboard and gradebook now use the live assignment.",
    );
    await load();
  }
  return (
    <>
      <PortalTopbar title="Staff teaching assignments" />
      <main className="mx-auto flex max-w-[1600px] gap-8 px-4 py-6 sm:px-6">
        <AdminSidebar />
        <section className="min-w-0 flex-1">
          <div className="rounded-[2rem] bg-brand-navy p-7 text-white">
            <p className="text-xs font-bold uppercase tracking-widest text-brand-green">
              Academic access control
            </p>
            <h1 className="mt-2 font-display text-4xl tracking-widest">
              STAFF <span className="text-brand-green">ASSIGNMENTS</span>
            </h1>
            <p className="mt-3 text-sm text-white/65">
              Assign subject teachers to specific class arms. Assignments immediately govern roster,
              attendance and gradebook access.
            </p>
          </div>
          {error && (
            <p className="mt-5 rounded-2xl bg-red-500/10 p-4 text-sm text-red-600">{error}</p>
          )}
          {notice && (
            <p className="mt-5 rounded-2xl border border-brand-green/30 bg-brand-green/10 p-4 text-sm">
              {notice}
            </p>
          )}
          <div className="mt-6 flex justify-end">
            <button
              onClick={() => setOpen(true)}
              className="inline-flex items-center gap-2 rounded-full bg-brand-green px-5 py-2.5 text-xs font-bold uppercase tracking-widest text-brand-navy"
            >
              <Plus size={15} /> Assign subject
            </button>
          </div>
          <div className="mt-5 grid gap-4 lg:grid-cols-2">
            {teachers.map((t) => (
              <article
                key={t.id}
                className="rounded-3xl border border-[var(--border-subtle)] bg-[var(--surface-card)] p-6"
              >
                <div className="flex gap-3">
                  <span className="grid h-11 w-11 place-items-center rounded-2xl bg-brand-green/10 text-brand-green">
                    <UserCog />
                  </span>
                  <div>
                    <h2 className="font-display text-xl">{t.name}</h2>
                    <p className="text-xs text-[var(--text-muted)]">
                      {t.email} · {t.role.replaceAll("_", " ")}
                    </p>
                  </div>
                </div>
                <div className="mt-5 space-y-2">
                  {t.assignments.map((a) => (
                    <div
                      className="rounded-xl bg-[var(--surface-disabled)] px-3 py-2 text-sm"
                      key={a.id}
                    >
                      <b>{a.className}</b>
                      <span className="float-right text-xs text-brand-green">
                        {a.subjectName || a.role.replaceAll("_", " ")}
                      </span>
                    </div>
                  ))}
                  {!t.assignments.length && (
                    <p className="text-sm text-[var(--text-muted)]">No current class assignment.</p>
                  )}
                </div>
              </article>
            ))}
          </div>
        </section>
      </main>
      {open && (
        <div className="fixed inset-0 z-[100] grid place-items-center bg-black/60 p-4">
          <form
            onSubmit={submit}
            className="w-full max-w-xl rounded-3xl bg-[var(--bg-primary)] p-7"
          >
            <div className="flex justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-brand-green">
                  Live access assignment
                </p>
                <h2 className="font-display text-3xl">ASSIGN SUBJECT</h2>
              </div>
              <button type="button" onClick={() => setOpen(false)}>
                <X />
              </button>
            </div>
            <label className="mt-6 block text-xs font-bold uppercase tracking-widest">
              Teacher
              <select
                required
                name="teacherProfileId"
                className="mt-2 w-full rounded-xl border p-3 text-sm"
              >
                {teachers.map((t) => (
                  <option value={t.id} key={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="mt-4 block text-xs font-bold uppercase tracking-widest">
              Subject
              <input
                required
                name="subjectName"
                className="mt-2 w-full rounded-xl border p-3 text-sm"
                placeholder="e.g. Mathematics"
              />
            </label>
            <fieldset className="mt-4">
              <legend className="text-xs font-bold uppercase tracking-widest">Class arms</legend>
              <div className="mt-2 grid grid-cols-2 gap-2">
                {classes.map((c) => (
                  <label className="flex gap-2 rounded-xl border p-3 text-sm" key={c.id}>
                    <input name="classIds" value={c.id} type="checkbox" />
                    {c.displayName}
                  </label>
                ))}
              </div>
            </fieldset>
            <button className="mt-6 w-full rounded-full bg-brand-green py-3 text-xs font-bold uppercase tracking-widest text-brand-navy">
              Save subject assignment
            </button>
          </form>
        </div>
      )}
    </>
  );
}
