"use client";

import { useCallback, useEffect, useState } from "react";
import PortalTopbar from "@/components/PortalTopbar";
import AdminSidebar from "@/components/AdminSidebar";
import { FileSpreadsheet, LoaderCircle, Printer, TrendingUp } from "lucide-react";

type BroadsheetStudent = {
  studentId: string;
  displayName: string;
  reportNumber: string;
  status: string;
  overallAverage: number;
  overallGrade: string;
  classPosition: string | null;
  subjects: Record<string, number>;
};

type Response = {
  classes: Array<{ id: string; displayName: string }>;
  broadsheet: {
    className: string;
    termLabel: string;
    sessionLabel: string;
    subjectNames: string[];
    students: BroadsheetStudent[];
    subjectAverages: Array<{ subject: string; average: number }>;
    classAverage: number;
  } | null;
};

export default function AdminBroadsheetPage() {
  const [data, setData] = useState<Response | null>(null);
  const [classId, setClassId] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async (selected: string) => {
    setLoading(true);
    setError("");
    try {
      const query = selected ? `?classId=${encodeURIComponent(selected)}` : "";
      const response = await fetch(`/api/admin/broadsheet${query}`, { cache: "no-store" });
      const body = (await response.json()) as Response & { error?: string };
      if (!response.ok) throw new Error(body.error || "Unable to load broadsheet.");
      setData(body);
      if (!selected && body.classes[0]) {
        setClassId(body.classes[0].id);
        return load(body.classes[0].id);
      }
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load broadsheet.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load("");
  }, [load]);

  const sheet = data?.broadsheet || null;

  return (
    <>
      <div className="no-print">
        <PortalTopbar />
      </div>
      <main className="min-h-screen bg-[var(--bg-primary)] theme-transition">
        <section className="bg-brand-navy px-6 pt-28 pb-14 no-print">
          <div className="mx-auto max-w-7xl">
            <span className="mb-3 inline-flex items-center gap-1.5 rounded-full border border-brand-green/40 bg-brand-green/20 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-brand-green">
              <FileSpreadsheet size={11} /> Session Management
            </span>
            <h1 className="font-display text-4xl tracking-widest text-white md:text-6xl">
              CLASS <span className="text-brand-green">BROADSHEET</span>
            </h1>
            <p className="mt-3 max-w-2xl font-body text-sm text-white/60">
              One-page academic summary per class — every student, every subject, ranked by average.
              Print or save as PDF for records and NEMIS submissions.
            </p>
          </div>
        </section>

        <section className="px-6 py-10">
          <div className="mx-auto flex max-w-7xl flex-col gap-8 lg:flex-row">
            <div className="no-print">
              <AdminSidebar />
            </div>

            <div className="min-w-0 flex-1 space-y-6">
              {error ? (
                <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-500 no-print">
                  {error}
                </div>
              ) : null}

              <div className="flex flex-wrap items-end gap-4 no-print">
                <label className="block text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)]">
                  Class
                  <select
                    value={classId}
                    onChange={(event) => {
                      setClassId(event.target.value);
                      void load(event.target.value);
                    }}
                    className="mt-2 block w-64 rounded-xl border border-[var(--input-border)] bg-[var(--input-bg)] px-4 py-3 text-sm text-[var(--input-text)]"
                  >
                    {data?.classes.map((entry) => (
                      <option key={entry.id} value={entry.id}>
                        {entry.displayName}
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  onClick={() => window.print()}
                  disabled={!sheet?.students.length}
                  className="inline-flex items-center gap-2 rounded-full bg-brand-green px-6 py-3 text-xs font-bold uppercase tracking-widest text-brand-navy shadow-lg hover:bg-brand-green-dark disabled:opacity-40"
                >
                  <Printer size={14} /> Print / Save PDF
                </button>
              </div>

              {loading ? (
                <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-card)] p-10 shadow-[var(--card-shadow)]">
                  <div className="flex items-center gap-3 text-[var(--text-secondary)]">
                    <LoaderCircle className="animate-spin text-brand-green" size={20} /> Building
                    broadsheet...
                  </div>
                </div>
              ) : null}

              {!loading && sheet ? (
                sheet.students.length ? (
                  <div className="overflow-hidden rounded-[2rem] border border-[var(--border-subtle)] bg-[var(--surface-card)] shadow-[var(--card-shadow)] print:border-none print:shadow-none">
                    <div className="border-b border-[var(--border-subtle)] px-8 py-6">
                      <h2 className="font-display text-2xl text-[var(--text-primary)]">
                        {sheet.className} — Broadsheet
                      </h2>
                      <p className="mt-1 text-xs text-[var(--text-muted)]">
                        {sheet.sessionLabel} · {sheet.termLabel} · {sheet.students.length} students
                        · Class average:{" "}
                        <span className="font-bold text-brand-green">{sheet.classAverage}%</span>
                      </p>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead className="bg-brand-navy">
                          <tr>
                            <th className="px-3 py-3 text-left font-display text-[9px] uppercase tracking-wider text-white/70">
                              #
                            </th>
                            <th className="px-3 py-3 text-left font-display text-[9px] uppercase tracking-wider text-white/70">
                              Student
                            </th>
                            {sheet.subjectNames.map((subject) => (
                              <th
                                key={subject}
                                className="px-2 py-3 text-center font-display text-[9px] uppercase tracking-wider text-white/70"
                              >
                                {subject.length > 12 ? `${subject.slice(0, 11)}…` : subject}
                              </th>
                            ))}
                            <th className="px-3 py-3 text-center font-display text-[9px] uppercase tracking-wider text-white/70">
                              Avg
                            </th>
                            <th className="px-3 py-3 text-center font-display text-[9px] uppercase tracking-wider text-white/70">
                              Grade
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {sheet.students.map((student, position) => (
                            <tr
                              key={student.studentId}
                              className="border-b border-[var(--border-subtle)] hover:bg-[var(--surface-disabled)]"
                            >
                              <td className="px-3 py-2.5 font-bold text-[var(--text-muted)]">
                                {position + 1}
                              </td>
                              <td className="px-3 py-2.5">
                                <div className="font-bold text-[var(--text-primary)]">
                                  {student.displayName}
                                </div>
                                <div className="text-[9px] text-[var(--text-muted)]">
                                  {student.studentId}
                                </div>
                              </td>
                              {sheet.subjectNames.map((subject) => {
                                const score = student.subjects[subject];
                                return (
                                  <td
                                    key={subject}
                                    className={`px-2 py-2.5 text-center font-medium ${
                                      typeof score !== "number"
                                        ? "text-[var(--text-muted)]"
                                        : score >= 70
                                          ? "text-brand-green"
                                          : score >= 40
                                            ? "text-[var(--text-secondary)]"
                                            : "text-red-500"
                                    }`}
                                  >
                                    {typeof score === "number" ? score : "—"}
                                  </td>
                                );
                              })}
                              <td className="px-3 py-2.5 text-center font-display text-sm font-bold text-brand-green">
                                {student.overallAverage}%
                              </td>
                              <td className="px-3 py-2.5 text-center font-bold text-[var(--text-primary)]">
                                {student.overallGrade}
                              </td>
                            </tr>
                          ))}
                          <tr className="bg-[var(--surface-disabled)]">
                            <td
                              colSpan={2}
                              className="px-3 py-3 text-[9px] font-bold uppercase tracking-widest text-[var(--text-muted)]"
                            >
                              <span className="inline-flex items-center gap-1">
                                <TrendingUp size={11} /> Subject Average
                              </span>
                            </td>
                            {sheet.subjectNames.map((subject) => {
                              const found = sheet.subjectAverages.find(
                                (entry) => entry.subject === subject,
                              );
                              return (
                                <td
                                  key={subject}
                                  className="px-2 py-3 text-center font-bold text-brand-green"
                                >
                                  {found?.average ?? "—"}
                                </td>
                              );
                            })}
                            <td className="px-3 py-3 text-center font-display font-bold text-brand-green">
                              {sheet.classAverage}%
                            </td>
                            <td />
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-[2rem] border border-[var(--border-subtle)] bg-[var(--surface-card)] p-12 text-center shadow-[var(--card-shadow)]">
                    <FileSpreadsheet className="mx-auto mb-3 text-[var(--text-muted)]" size={32} />
                    <p className="text-sm text-[var(--text-muted)]">
                      No report cards exist for this class yet. Generate them from the Gradebook
                      Lock page first.
                    </p>
                  </div>
                )
              ) : null}
            </div>
          </div>
        </section>
      </main>
      <div className="no-print"></div>
    </>
  );
}
