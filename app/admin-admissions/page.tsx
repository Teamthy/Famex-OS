"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  CheckCircle2,
  ClipboardCheck,
  ClipboardList,
  LoaderCircle,
  UserPlus,
  XCircle,
} from "lucide-react";
import AdminSidebar from "@/components/AdminSidebar";
import PortalTopbar from "@/components/PortalTopbar";
import { useAuth } from "@/components/AuthProvider";

type Doc = { id: string; type: string; fileName: string; sizeBytes: number };
type AppRow = {
  applicationId: string;
  firstName: string;
  lastName: string;
  classApplying: string;
  preferredArm: string | null;
  parentEmail: string;
  parentPhone: string;
  previousSchool: string;
  status: string;
  statusNote: string | null;
  submittedAt: string | null;
  paymentStatus?: string;
  entranceScore: number | null;
  entrancePassed: boolean | null;
  recommendedClassId: string | null;
  documents: Doc[];
  payment: { status: string; reference: string } | null;
  enrolledStudent?: { studentId: string; displayName: string } | null;
};

type SchoolClass = {
  id: string;
  displayName: string;
  level: string;
  capacity: number | null;
  studentCount?: number;
};

const statuses = [
  "PENDING_REVIEW",
  "DOCUMENTS_REQUESTED",
  "APPROVED",
  "DECLINED",
  "WAITLISTED",
] as const;

function idemp() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto)
    return crypto.randomUUID().replaceAll("-", "");
  return `${Date.now()}${Math.random().toString(16).slice(2)}`;
}

export default function AdminAdmissionsPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [apps, setApps] = useState<AppRow[]>([]);
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [selected, setSelected] = useState<AppRow | null>(null);
  const [note, setNote] = useState("");
  const [status, setStatus] = useState<string>("PENDING_REVIEW");
  const [entranceScore, setEntranceScore] = useState(70);
  const [entrancePassed, setEntrancePassed] = useState(true);
  const [classId, setClassId] = useState("");
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const [a, s] = await Promise.all([
      fetch("/api/admin/admissions", { cache: "no-store" }),
      fetch("/api/admin/students", { cache: "no-store" }),
    ]);
    const aj = await a.json();
    const sj = await s.json();
    if (a.ok) setApps(aj.applications || []);
    if (s.ok) {
      setClasses(
        (sj.classes || []).map((c: SchoolClass & { _count?: { students: number } }) => ({
          ...c,
          studentCount: c.studentCount ?? c._count?.students,
        })),
      );
    }
  }, []);

  useEffect(() => {
    if (!loading && !user) router.replace("/login");
    if (user) void load();
  }, [user, loading, router, load]);

  const matchingClasses = useMemo(() => {
    if (!selected) return [] as SchoolClass[];
    return classes.filter(
      (c) => c.level === selected.classApplying || c.displayName.startsWith(selected.classApplying),
    );
  }, [classes, selected]);

  useEffect(() => {
    if (!selected) return;
    setStatus(selected.status);
    setNote(selected.statusNote || "");
    setEntranceScore(selected.entranceScore ?? 70);
    setEntrancePassed(selected.entrancePassed ?? true);
    const preferred =
      selected.recommendedClassId ||
      matchingClasses.find(
        (c) => selected.preferredArm && c.displayName.includes(selected.preferredArm),
      )?.id ||
      matchingClasses[0]?.id ||
      "";
    setClassId(preferred);
  }, [selected, matchingClasses]);

  async function saveDecision() {
    if (!selected) return;
    setBusy(true);
    setErr("");
    setMsg("");
    try {
      const r = await fetch("/api/admin/admissions", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ applicationId: selected.applicationId, status, note }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "Unable to update.");
      setMsg("Application decision saved and parent email queued.");
      setSelected(null);
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Unable to update.");
    } finally {
      setBusy(false);
    }
  }

  async function enrollApplicant(e: FormEvent) {
    e.preventDefault();
    if (!selected) return;
    setBusy(true);
    setErr("");
    setMsg("");
    try {
      const r = await fetch("/api/admin/admissions/enroll", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": idemp(),
        },
        body: JSON.stringify({
          applicationId: selected.applicationId,
          classId,
          entranceScore: Number(entranceScore),
          entrancePassed,
          placementNote: note || undefined,
        }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "Enrollment failed.");
      const temp = j.parentAccount?.temporaryPassword
        ? ` Parent temporary password (copy now): ${j.parentAccount.temporaryPassword}`
        : "";
      setMsg(
        `Enrolled ${j.student.displayName} as ${j.student.studentId} into ${j.student.className}.${temp}`,
      );
      setSelected(null);
      await load();
    } catch (error) {
      setErr(error instanceof Error ? error.message : "Enrollment failed.");
    } finally {
      setBusy(false);
    }
  }

  if (loading) return null;

  return (
    <>
      <PortalTopbar title="Admissions queue" />
      <main className="mx-auto flex max-w-[1600px] gap-8 px-4 py-6 sm:px-6">
        <AdminSidebar />
        <section className="min-w-0 flex-1">
          <div className="rounded-[2rem] bg-brand-navy p-7 text-white">
            <p className="text-xs font-bold uppercase tracking-widest text-brand-green">
              Protected admin area
            </p>
            <h1 className="mt-2 font-display text-4xl tracking-widest">
              ADMISSIONS <span className="text-brand-green">QUEUE</span>
            </h1>
            <p className="mt-3 max-w-3xl text-sm text-white/65">
              Review paid applications, record entrance results, and place successful applicants
              into the class they applied for — with one-time parent credentials.
            </p>
            <Link
              href="/admin-admissions/paper"
              className="mt-5 inline-flex items-center gap-2 rounded-full bg-brand-green px-5 py-2.5 text-sm font-bold text-brand-navy transition-all hover:opacity-90"
            >
              <ClipboardList size={15} /> Enter a paper application
            </Link>
          </div>

          {msg && (
            <div className="mt-5 break-all rounded-2xl border border-brand-green/30 bg-brand-green/10 p-4 text-sm">
              {msg}
            </div>
          )}
          {err && (
            <div className="mt-5 rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-600">
              {err}
            </div>
          )}

          <div className="mt-6 overflow-hidden rounded-3xl border border-[var(--border-subtle)] bg-[var(--surface-card)]">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-[var(--surface-disabled)] text-[10px] uppercase tracking-widest text-[var(--text-muted)]">
                  <tr>
                    <th className="p-4">Applicant</th>
                    <th className="p-4">Class</th>
                    <th className="p-4">Payment</th>
                    <th className="p-4">Entrance</th>
                    <th className="p-4">Status</th>
                    <th className="p-4" />
                  </tr>
                </thead>
                <tbody>
                  {apps.map((app) => (
                    <tr key={app.applicationId} className="border-t border-[var(--border-subtle)]">
                      <td className="p-4">
                        <b>
                          {app.firstName} {app.lastName}
                        </b>
                        <span className="mt-1 block font-mono text-xs text-[var(--text-muted)]">
                          {app.applicationId}
                        </span>
                      </td>
                      <td className="p-4">{app.classApplying}</td>
                      <td className="p-4">{app.payment?.status || app.paymentStatus || "—"}</td>
                      <td className="p-4">
                        {app.entrancePassed == null
                          ? "Not scored"
                          : app.entrancePassed
                            ? `Pass · ${app.entranceScore ?? "—"}`
                            : `Fail · ${app.entranceScore ?? "—"}`}
                      </td>
                      <td className="p-4">{app.status.replaceAll("_", " ")}</td>
                      <td className="p-4">
                        <button
                          onClick={() => setSelected(app)}
                          className="inline-flex items-center gap-1 font-bold text-brand-green"
                        >
                          <ClipboardCheck size={14} /> Review
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!apps.length && (
                <p className="p-10 text-center text-sm text-[var(--text-muted)]">
                  No submitted applications yet.
                </p>
              )}
            </div>
          </div>
        </section>
      </main>

      {selected && (
        <div className="fixed inset-0 z-[100] grid place-items-center bg-black/60 p-4">
          <div className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-3xl bg-[var(--bg-primary)] p-7">
            <div className="flex justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-brand-green">
                  Application review
                </p>
                <h2 className="mt-2 font-display text-3xl">
                  {selected.firstName} {selected.lastName}
                </h2>
                <p className="mt-1 text-sm text-[var(--text-muted)]">
                  {selected.applicationId} · {selected.classApplying}
                </p>
              </div>
              <button type="button" onClick={() => setSelected(null)} aria-label="Close">
                <XCircle />
              </button>
            </div>

            <div className="mt-6 grid gap-4 rounded-2xl bg-[var(--surface-disabled)] p-5 text-sm md:grid-cols-2">
              <p>
                <b>Parent:</b> {selected.parentEmail}
                <br />
                {selected.parentPhone}
              </p>
              <p>
                <b>Previous school:</b>
                <br />
                {selected.previousSchool}
              </p>
              <p>
                <b>Payment:</b> {selected.payment?.status || "Pending"}
              </p>
              <p>
                <b>Documents:</b> {selected.documents.map((d) => d.fileName).join(", ") || "None"}
              </p>
            </div>

            <label className="mt-6 block text-xs font-bold uppercase tracking-widest">
              Decision
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="mt-2 w-full rounded-xl border border-[var(--input-border)] bg-[var(--input-bg)] p-3 text-sm normal-case"
              >
                {statuses.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </label>

            <label className="mt-4 block text-xs font-bold uppercase tracking-widest">
              Message to parent
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                className="mt-2 w-full rounded-xl border border-[var(--input-border)] bg-[var(--input-bg)] p-3 text-sm normal-case"
                rows={3}
              />
            </label>

            <button
              disabled={busy}
              onClick={() => void saveDecision()}
              className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-full bg-[var(--btn-outline-border)] py-3 text-xs font-bold uppercase tracking-widest text-[var(--btn-outline-text-hover)]"
              style={{ background: "var(--accent-navy)", color: "#fff" }}
            >
              {busy ? (
                <LoaderCircle className="animate-spin" size={16} />
              ) : (
                <CheckCircle2 size={16} />
              )}
              Save decision and notify parent
            </button>

            <form
              onSubmit={enrollApplicant}
              className="mt-8 rounded-3xl border border-brand-green/30 bg-brand-green/5 p-5"
            >
              <div className="flex items-center gap-2 text-brand-green">
                <UserPlus size={18} />
                <h3 className="font-display text-xl tracking-widest">PLACE INTO CLASS</h3>
              </div>
              <p className="mt-2 text-xs text-[var(--text-muted)]">
                Requires verified admission payment and a passing entrance result. Placement class
                must match the applied level ({selected.classApplying}).
              </p>

              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <label className="text-xs font-bold uppercase tracking-wider">
                  Entrance score
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={entranceScore}
                    onChange={(e) => setEntranceScore(Number(e.target.value))}
                    className="mt-2 w-full rounded-xl border border-[var(--input-border)] bg-[var(--input-bg)] p-3 text-sm normal-case"
                    required
                  />
                </label>
                <label className="text-xs font-bold uppercase tracking-wider">
                  Result
                  <select
                    value={entrancePassed ? "pass" : "fail"}
                    onChange={(e) => setEntrancePassed(e.target.value === "pass")}
                    className="mt-2 w-full rounded-xl border border-[var(--input-border)] bg-[var(--input-bg)] p-3 text-sm normal-case"
                  >
                    <option value="pass">Passed — eligible for class</option>
                    <option value="fail">Failed — cannot enrol</option>
                  </select>
                </label>
                <label className="sm:col-span-2 text-xs font-bold uppercase tracking-wider">
                  Suggested class / arm
                  <select
                    value={classId}
                    onChange={(e) => setClassId(e.target.value)}
                    className="mt-2 w-full rounded-xl border border-[var(--input-border)] bg-[var(--input-bg)] p-3 text-sm normal-case"
                    required
                  >
                    <option value="">Select class</option>
                    {matchingClasses.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.displayName}
                        {c.capacity != null ? ` · ${c.studentCount ?? 0}/${c.capacity}` : ""}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <button
                disabled={busy || !entrancePassed}
                className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-full bg-brand-green py-3 text-xs font-bold uppercase tracking-widest text-brand-navy disabled:opacity-50"
              >
                {busy ? (
                  <LoaderCircle className="animate-spin" size={16} />
                ) : (
                  <UserPlus size={16} />
                )}
                Enrol student into class
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
