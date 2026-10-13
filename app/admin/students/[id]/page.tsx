"use client";

import { use, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import PortalTopbar from "@/components/PortalTopbar";
import AdminSidebar from "@/components/AdminSidebar";
import {
  AlertCircle,
  ArrowLeft,
  BookOpen,
  CalendarDays,
  CreditCard,
  FileText,
  LoaderCircle,
  Phone,
  School,
  User as UserIcon,
} from "lucide-react";

/**
 * One student, everything about them.
 *
 * The admin student list rendered rows that were not clickable and led
 * nowhere, so there was no way to see a single child's class, subjects or fee
 * position without querying the database directly.
 */

type Subject = { id: string; name: string; category: string };
type Invoice = {
  id: string;
  termLabel: string;
  totalAmount: number;
  amountPaid: number;
  balanceDue: number;
  status: string;
};

type Payload = {
  student: {
    id: string;
    displayName: string;
    studentId: string;
    isActive: boolean;
    gender?: string | null;
    dateOfBirth?: string | null;
    currentClass: { id: string; displayName: string } | null;
    parentLinks: Array<{
      parentProfile: {
        id: string;
        displayName: string;
        phone: string | null;
        user: { email: string } | null;
      } | null;
    }>;
    _count: {
      attendanceEntries: number;
      reportCards: number;
      feeInvoices: number;
      gradebookEntries: number;
      examAttempts: number;
    };
  };
  subjects: Subject[];
  fees: {
    totalBilled: number;
    totalPaid: number;
    outstanding: number;
    status: "PAID" | "OWING" | "NOT_BILLED";
    invoices: Invoice[];
  };
};

const naira = (n: number) => "₦" + Number(n || 0).toLocaleString();

const FEE_STYLE: Record<string, string> = {
  PAID: "bg-brand-green/15 text-brand-green",
  OWING: "bg-red-500/15 text-red-500",
  NOT_BILLED: "bg-brand-orange/15 text-brand-orange",
};

const FEE_LABEL: Record<string, string> = {
  PAID: "Fees paid",
  OWING: "Owing",
  NOT_BILLED: "Not billed yet",
};

export default function AdminStudentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [data, setData] = useState<Payload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`/api/admin/students/${id}`, { cache: "no-store" });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Unable to load this student.");
      setData(body);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load this student.");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  const student = data?.student;
  const fees = data?.fees;

  return (
    <>
      <PortalTopbar title="Student profile" />
      <main className="min-h-screen bg-[var(--bg-primary)] theme-transition">
        <section className="bg-brand-navy px-6 pt-28 pb-14">
          <div className="mx-auto max-w-7xl">
            <Link
              href="/admin/students"
              className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-white/60 hover:text-brand-green"
            >
              <ArrowLeft size={12} /> All students
            </Link>
            <h1 className="mt-3 font-display text-4xl tracking-widest text-white md:text-5xl">
              {student?.displayName || "STUDENT"}
            </h1>
            {student ? (
              <p className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-white/60">
                <span>{student.studentId}</span>
                <span>{student.currentClass?.displayName || "No class"}</span>
                <span
                  className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-widest ${
                    student.isActive
                      ? "bg-brand-green/20 text-brand-green"
                      : "bg-white/10 text-white/60"
                  }`}
                >
                  {student.isActive ? "Active" : "Inactive"}
                </span>
              </p>
            ) : null}
          </div>
        </section>

        <section className="px-6 py-10">
          <div className="mx-auto flex max-w-7xl flex-col gap-8 lg:flex-row">
            <AdminSidebar />

            <div className="min-w-0 flex-1 space-y-5">
              {error ? (
                <div className="flex items-center gap-3 rounded-2xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-500">
                  <AlertCircle size={18} className="shrink-0" />
                  <span className="flex-1">{error}</span>
                  <button
                    onClick={() => void load()}
                    className="font-bold uppercase tracking-widest"
                  >
                    Retry
                  </button>
                </div>
              ) : null}

              {loading ? (
                <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-card)] p-10">
                  <div className="flex items-center gap-3 text-[var(--text-secondary)]">
                    <LoaderCircle className="animate-spin text-brand-green" size={20} /> Loading…
                  </div>
                </div>
              ) : null}

              {!loading && student && fees ? (
                <>
                  {/* Fees first: it is the question an admin is usually on the
                      phone about. */}
                  <div className="rounded-[var(--radius-card)] border border-[var(--border-subtle)] bg-[var(--surface-card)] p-6">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <h2 className="inline-flex items-center gap-2 font-display text-lg tracking-widest text-[var(--text-primary)]">
                        <CreditCard size={16} className="text-brand-green" /> FEES
                      </h2>
                      <span
                        className={`rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-widest ${FEE_STYLE[fees.status]}`}
                      >
                        {FEE_LABEL[fees.status]}
                      </span>
                    </div>
                    <div className="mt-4 grid gap-4 sm:grid-cols-3">
                      <div>
                        <div className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)]">
                          Billed
                        </div>
                        <div className="font-display text-2xl text-[var(--text-primary)]">
                          {naira(fees.totalBilled)}
                        </div>
                      </div>
                      <div>
                        <div className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)]">
                          Paid
                        </div>
                        <div className="font-display text-2xl text-brand-green">
                          {naira(fees.totalPaid)}
                        </div>
                      </div>
                      <div>
                        <div className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)]">
                          Outstanding
                        </div>
                        <div
                          className={`font-display text-2xl ${fees.outstanding > 0 ? "text-red-500" : "text-[var(--text-primary)]"}`}
                        >
                          {naira(fees.outstanding)}
                        </div>
                      </div>
                    </div>

                    {fees.status === "NOT_BILLED" ? (
                      <p className="mt-4 rounded-xl border border-brand-orange/25 bg-brand-orange/10 p-3 text-xs text-brand-orange">
                        No invoice has been raised for this student. They are not “paid up” — nobody
                        has billed them. Use Fee Structures, then Generate Invoices.
                      </p>
                    ) : null}

                    {fees.invoices.length ? (
                      <div className="mt-4 overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b border-[var(--border-subtle)] text-left text-[10px] uppercase tracking-widest text-[var(--text-muted)]">
                              <th className="py-2">Term</th>
                              <th className="py-2">Billed</th>
                              <th className="py-2">Paid</th>
                              <th className="py-2">Balance</th>
                            </tr>
                          </thead>
                          <tbody>
                            {fees.invoices.map((invoice) => (
                              <tr
                                key={invoice.id}
                                className="border-b border-[var(--border-subtle)]"
                              >
                                <td className="py-2 text-[var(--text-primary)]">
                                  {invoice.termLabel}
                                </td>
                                <td className="py-2">{naira(invoice.totalAmount)}</td>
                                <td className="py-2">{naira(invoice.amountPaid)}</td>
                                <td
                                  className={`py-2 font-bold ${invoice.balanceDue > 0 ? "text-red-500" : "text-brand-green"}`}
                                >
                                  {naira(invoice.balanceDue)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : null}
                  </div>

                  <div className="rounded-[var(--radius-card)] border border-[var(--border-subtle)] bg-[var(--surface-card)] p-6">
                    <h2 className="inline-flex items-center gap-2 font-display text-lg tracking-widest text-[var(--text-primary)]">
                      <BookOpen size={16} className="text-brand-green" /> SUBJECTS OFFERED
                    </h2>
                    {data.subjects.length ? (
                      <div className="mt-4 flex flex-wrap gap-2">
                        {data.subjects.map((subject) => (
                          <span
                            key={subject.id}
                            className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
                              subject.category === "COMPULSORY"
                                ? "bg-brand-green/10 text-brand-green"
                                : "bg-[var(--surface-disabled)] text-[var(--text-secondary)]"
                            }`}
                          >
                            {subject.name}
                            <span className="ml-1.5 text-[9px] uppercase opacity-70">
                              {subject.category === "COMPULSORY" ? "core" : "elective"}
                            </span>
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p className="mt-3 text-sm text-[var(--text-muted)]">
                        No subjects enrolled yet. Use Subjects → Enrol students.
                      </p>
                    )}
                  </div>

                  <div className="rounded-[var(--radius-card)] border border-[var(--border-subtle)] bg-[var(--surface-card)] p-6">
                    <h2 className="inline-flex items-center gap-2 font-display text-lg tracking-widest text-[var(--text-primary)]">
                      <UserIcon size={16} className="text-brand-green" /> GUARDIANS
                    </h2>
                    {student.parentLinks.length ? (
                      <div className="mt-4 space-y-2">
                        {student.parentLinks.map((link, index) => (
                          <div
                            key={link.parentProfile?.id || index}
                            className="flex flex-wrap items-center gap-3 rounded-xl border border-[var(--border-subtle)] p-3 text-sm"
                          >
                            <span className="font-semibold text-[var(--text-primary)]">
                              {link.parentProfile?.displayName || "—"}
                            </span>
                            {link.parentProfile?.phone ? (
                              <a
                                href={`tel:${link.parentProfile.phone}`}
                                className="inline-flex items-center gap-1 text-brand-green"
                              >
                                <Phone size={12} /> {link.parentProfile.phone}
                              </a>
                            ) : null}
                            <span className="text-[var(--text-muted)]">
                              {link.parentProfile?.user?.email || "no email"}
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="mt-3 rounded-xl border border-brand-orange/25 bg-brand-orange/10 p-3 text-xs text-brand-orange">
                        No guardian linked. This child&apos;s parent cannot receive results, fee
                        reminders or announcements.
                      </p>
                    )}
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    {[
                      {
                        label: "Attendance records",
                        value: student._count.attendanceEntries,
                        icon: CalendarDays,
                      },
                      { label: "Report cards", value: student._count.reportCards, icon: FileText },
                      {
                        label: "Subject scores",
                        value: student._count.gradebookEntries,
                        icon: BookOpen,
                      },
                      { label: "Exam attempts", value: student._count.examAttempts, icon: School },
                    ].map((stat) => (
                      <div
                        key={stat.label}
                        className="rounded-[var(--radius-card)] border border-[var(--border-subtle)] bg-[var(--surface-card)] p-5"
                      >
                        <stat.icon size={16} className="text-brand-green" />
                        <div className="mt-2 font-display text-2xl text-[var(--text-primary)]">
                          {stat.value}
                        </div>
                        <div className="text-[10px] uppercase tracking-widest text-[var(--text-muted)]">
                          {stat.label}
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              ) : null}
            </div>
          </div>
        </section>
      </main>
    </>
  );
}
