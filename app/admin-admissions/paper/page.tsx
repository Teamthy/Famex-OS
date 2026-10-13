"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CheckCircle2, ClipboardList, LoaderCircle, ArrowLeft, AlertCircle } from "lucide-react";
import AdminSidebar from "@/components/AdminSidebar";
import PortalTopbar from "@/components/PortalTopbar";
import { useAuth } from "@/components/AuthProvider";

/**
 * Front-desk entry for handwritten application forms.
 *
 * Ykay still receives paper forms while moving parents online. This keys one in
 * and drops it into the same review -> entrance -> enrolment pipeline as an
 * online application, optionally recording the fee if it was paid at the desk.
 */

const CLASSES = ["JSS1", "JSS2", "JSS3", "SS1", "SS2", "SS3"] as const;
const GENDERS = ["Female", "Male", "Prefer not to say"] as const;
const CONTACTS = ["MOTHER", "FATHER", "GUARDIAN"] as const;
const BLOOD = ["", "A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"] as const;
const GENOTYPES = ["", "AA", "AS", "AC", "SS", "SC"] as const;

function idemKey() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID().replaceAll("-", "");
  }
  return `${Date.now()}${Math.random().toString(16).slice(2)}`;
}

const EMPTY = {
  firstName: "",
  middleName: "",
  lastName: "",
  dateOfBirth: "",
  gender: "",
  stateOfOrigin: "",
  lga: "",
  religion: "",
  bloodGroup: "",
  genotype: "",
  classApplying: "",
  preferredArm: "",
  fatherName: "",
  motherName: "",
  guardianName: "",
  guardianRelationship: "",
  primaryContact: "MOTHER",
  parentPhone: "",
  whatsappPhone: "",
  parentEmail: "",
  parentAddress: "",
  occupation: "",
  previousSchool: "",
  previousClass: "",
  reasonForLeaving: "",
  achievements: "",
};

export default function PaperIntakePage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  const [form, setForm] = useState({ ...EMPTY });
  const [feePaid, setFeePaid] = useState(false);
  const [feeMethod, setFeeMethod] = useState<"CASH" | "BANK_TRANSFER" | "POS">("CASH");
  const [feeReference, setFeeReference] = useState("");
  const [intakeNote, setIntakeNote] = useState("");

  const [busy, setBusy] = useState(false);
  const [issues, setIssues] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [done, setDone] = useState<{ applicationId: string; studentName: string } | null>(null);

  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [user, loading, router]);

  const set = (key: keyof typeof EMPTY, value: string) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setIssues([]);
    try {
      const response = await fetch("/api/admin/admissions/paper", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Idempotency-Key": idemKey() },
        body: JSON.stringify({
          draft: form,
          feePaid,
          feeMethod: feePaid ? feeMethod : undefined,
          feeReference: feePaid ? feeReference : undefined,
          intakeNote: intakeNote || undefined,
        }),
      });
      const body = await response.json();
      if (!response.ok) {
        setIssues(body.issues || []);
        throw new Error(body.error || "Could not save the application.");
      }
      setDone({
        applicationId: body.application.applicationId,
        studentName: body.application.studentName,
      });
      setForm({ ...EMPTY });
      setFeePaid(false);
      setFeeReference("");
      setIntakeNote("");
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Could not save.");
    } finally {
      setBusy(false);
    }
  }

  const field =
    "w-full px-3 py-2 rounded-xl bg-[var(--surface-input)] border border-[var(--border-subtle)] text-sm text-[var(--text-primary)] focus:border-brand-orange outline-none";
  const label = "block text-[11px] uppercase tracking-widest text-[var(--text-muted)] mb-1";

  return (
    <>
      <PortalTopbar />
      <main className="bg-[var(--bg-primary)] min-h-screen theme-transition pt-20">
        <div className="mx-auto max-w-7xl px-6 py-8 flex flex-col lg:flex-row gap-8">
          <AdminSidebar />

          <div className="flex-1 min-w-0 space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h1 className="font-display text-3xl text-[var(--text-primary)]">
                  Paper application
                </h1>
                <p className="text-sm text-[var(--text-muted)]">
                  Key in a handwritten form. It joins the same review queue as online applications.
                </p>
              </div>
              <Link
                href="/admin-admissions"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[var(--surface-disabled)] text-[var(--text-primary)] text-sm font-bold"
              >
                <ArrowLeft size={14} /> Review queue
              </Link>
            </div>

            {done && (
              <div className="p-5 rounded-2xl bg-brand-green/5 border border-brand-green/40 flex items-start gap-3">
                <CheckCircle2 size={20} className="text-brand-green shrink-0 mt-0.5" />
                <div className="text-sm">
                  <p className="font-bold text-[var(--text-primary)]">Saved — {done.studentName}</p>
                  <p className="text-[var(--text-muted)]">
                    Reference <strong>{done.applicationId}</strong>. Give this to the parent. The
                    application is now in the review queue.
                  </p>
                </div>
              </div>
            )}

            {error && (
              <div className="p-5 rounded-2xl bg-red-500/5 border border-red-500/30">
                <div className="flex items-start gap-3">
                  <AlertCircle size={20} className="text-red-500 shrink-0 mt-0.5" />
                  <div className="text-sm">
                    <p className="font-bold text-[var(--text-primary)]">{error}</p>
                    {issues.length > 0 && (
                      <ul className="mt-2 space-y-0.5 text-[var(--text-muted)] list-disc pl-4">
                        {issues.map((issue) => (
                          <li key={issue}>{issue}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              </div>
            )}

            <form onSubmit={submit} className="space-y-6">
              <section className="p-6 rounded-2xl bg-[var(--surface-card)] border border-[var(--border-subtle)]">
                <h2 className="font-display text-lg text-[var(--text-primary)] mb-4">Applicant</h2>
                <div className="grid md:grid-cols-3 gap-4">
                  <div>
                    <label className={label}>First name *</label>
                    <input
                      className={field}
                      value={form.firstName}
                      onChange={(e) => set("firstName", e.target.value)}
                      required
                    />
                  </div>
                  <div>
                    <label className={label}>Middle name</label>
                    <input
                      className={field}
                      value={form.middleName}
                      onChange={(e) => set("middleName", e.target.value)}
                    />
                  </div>
                  <div>
                    <label className={label}>Surname *</label>
                    <input
                      className={field}
                      value={form.lastName}
                      onChange={(e) => set("lastName", e.target.value)}
                      required
                    />
                  </div>
                  <div>
                    <label className={label}>Date of birth *</label>
                    <input
                      type="date"
                      className={field}
                      value={form.dateOfBirth}
                      onChange={(e) => set("dateOfBirth", e.target.value)}
                      required
                    />
                  </div>
                  <div>
                    <label className={label}>Gender *</label>
                    <select
                      className={field}
                      value={form.gender}
                      onChange={(e) => set("gender", e.target.value)}
                      required
                    >
                      <option value="">Select…</option>
                      {GENDERS.map((g) => (
                        <option key={g} value={g}>
                          {g}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className={label}>Class applying for *</label>
                    <select
                      className={field}
                      value={form.classApplying}
                      onChange={(e) => set("classApplying", e.target.value)}
                      required
                    >
                      <option value="">Select…</option>
                      {CLASSES.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className={label}>State of origin *</label>
                    <input
                      className={field}
                      value={form.stateOfOrigin}
                      onChange={(e) => set("stateOfOrigin", e.target.value)}
                      required
                    />
                  </div>
                  <div>
                    <label className={label}>LGA *</label>
                    <input
                      className={field}
                      value={form.lga}
                      onChange={(e) => set("lga", e.target.value)}
                      required
                    />
                  </div>
                  <div>
                    <label className={label}>Religion</label>
                    <input
                      className={field}
                      value={form.religion}
                      onChange={(e) => set("religion", e.target.value)}
                    />
                  </div>
                  <div>
                    <label className={label}>Blood group</label>
                    <select
                      className={field}
                      value={form.bloodGroup}
                      onChange={(e) => set("bloodGroup", e.target.value)}
                    >
                      {BLOOD.map((b) => (
                        <option key={b} value={b}>
                          {b || "—"}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className={label}>Genotype</label>
                    <select
                      className={field}
                      value={form.genotype}
                      onChange={(e) => set("genotype", e.target.value)}
                    >
                      {GENOTYPES.map((g) => (
                        <option key={g} value={g}>
                          {g || "—"}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className={label}>Preferred arm</label>
                    <input
                      className={field}
                      value={form.preferredArm}
                      onChange={(e) => set("preferredArm", e.target.value)}
                      placeholder="A, B…"
                    />
                  </div>
                </div>
              </section>

              <section className="p-6 rounded-2xl bg-[var(--surface-card)] border border-[var(--border-subtle)]">
                <h2 className="font-display text-lg text-[var(--text-primary)] mb-4">
                  Parent / guardian
                </h2>
                <div className="grid md:grid-cols-3 gap-4">
                  <div>
                    <label className={label}>Primary contact *</label>
                    <select
                      className={field}
                      value={form.primaryContact}
                      onChange={(e) => set("primaryContact", e.target.value)}
                    >
                      {CONTACTS.map((c) => (
                        <option key={c} value={c}>
                          {c.charAt(0) + c.slice(1).toLowerCase()}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className={label}>Mother&apos;s name *</label>
                    <input
                      className={field}
                      value={form.motherName}
                      onChange={(e) => set("motherName", e.target.value)}
                      required
                    />
                  </div>
                  <div>
                    <label className={label}>Father&apos;s name</label>
                    <input
                      className={field}
                      value={form.fatherName}
                      onChange={(e) => set("fatherName", e.target.value)}
                    />
                  </div>
                  <div>
                    <label className={label}>Guardian name</label>
                    <input
                      className={field}
                      value={form.guardianName}
                      onChange={(e) => set("guardianName", e.target.value)}
                    />
                  </div>
                  <div>
                    <label className={label}>Guardian relationship</label>
                    <input
                      className={field}
                      value={form.guardianRelationship}
                      onChange={(e) => set("guardianRelationship", e.target.value)}
                      placeholder="Uncle, Aunt…"
                    />
                  </div>
                  <div>
                    <label className={label}>Occupation</label>
                    <input
                      className={field}
                      value={form.occupation}
                      onChange={(e) => set("occupation", e.target.value)}
                    />
                  </div>
                  <div>
                    <label className={label}>Phone *</label>
                    <input
                      className={field}
                      value={form.parentPhone}
                      onChange={(e) => set("parentPhone", e.target.value)}
                      placeholder="08031234567"
                      required
                    />
                  </div>
                  <div>
                    <label className={label}>WhatsApp</label>
                    <input
                      className={field}
                      value={form.whatsappPhone}
                      onChange={(e) => set("whatsappPhone", e.target.value)}
                    />
                  </div>
                  <div>
                    <label className={label}>Email *</label>
                    <input
                      type="email"
                      className={field}
                      value={form.parentEmail}
                      onChange={(e) => set("parentEmail", e.target.value)}
                      required
                    />
                  </div>
                  <div className="md:col-span-3">
                    <label className={label}>Home address *</label>
                    <input
                      className={field}
                      value={form.parentAddress}
                      onChange={(e) => set("parentAddress", e.target.value)}
                      required
                    />
                  </div>
                </div>
                <p className="text-xs text-[var(--text-muted)] mt-3">
                  The email becomes the parent&apos;s portal login when the applicant is enrolled,
                  so double-check the spelling against the form.
                </p>
              </section>

              <section className="p-6 rounded-2xl bg-[var(--surface-card)] border border-[var(--border-subtle)]">
                <h2 className="font-display text-lg text-[var(--text-primary)] mb-4">
                  Previous school
                </h2>
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <label className={label}>Previous school *</label>
                    <input
                      className={field}
                      value={form.previousSchool}
                      onChange={(e) => set("previousSchool", e.target.value)}
                      required
                    />
                  </div>
                  <div>
                    <label className={label}>Previous class *</label>
                    <input
                      className={field}
                      value={form.previousClass}
                      onChange={(e) => set("previousClass", e.target.value)}
                      required
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className={label}>Reason for leaving</label>
                    <input
                      className={field}
                      value={form.reasonForLeaving}
                      onChange={(e) => set("reasonForLeaving", e.target.value)}
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className={label}>Achievements</label>
                    <textarea
                      rows={2}
                      className={field}
                      value={form.achievements}
                      onChange={(e) => set("achievements", e.target.value)}
                    />
                  </div>
                </div>
              </section>

              <section className="p-6 rounded-2xl bg-[var(--surface-card)] border border-[var(--border-subtle)]">
                <h2 className="font-display text-lg text-[var(--text-primary)] mb-1">
                  Application fee
                </h2>
                <p className="text-xs text-[var(--text-muted)] mb-4">
                  An applicant cannot be enrolled until the fee is recorded. If it hasn&apos;t been
                  paid yet, leave this unticked and record it later from the review queue.
                </p>

                <label className="flex items-center gap-2 text-sm text-[var(--text-primary)] mb-4">
                  <input
                    type="checkbox"
                    checked={feePaid}
                    onChange={(e) => setFeePaid(e.target.checked)}
                    className="w-4 h-4 accent-[var(--brand-orange,#f97316)]"
                  />
                  Fee was paid at the school
                </label>

                {feePaid && (
                  <div className="grid md:grid-cols-2 gap-4">
                    <div>
                      <label className={label}>Method *</label>
                      <select
                        className={field}
                        value={feeMethod}
                        onChange={(e) => setFeeMethod(e.target.value as typeof feeMethod)}
                      >
                        <option value="CASH">Cash</option>
                        <option value="BANK_TRANSFER">Bank transfer</option>
                        <option value="POS">POS</option>
                      </select>
                    </div>
                    <div>
                      <label className={label}>Teller / slip reference *</label>
                      <input
                        className={field}
                        value={feeReference}
                        onChange={(e) => setFeeReference(e.target.value)}
                        placeholder="TELLER-99182"
                        required
                      />
                    </div>
                  </div>
                )}

                <div className="mt-4">
                  <label className={label}>Intake note</label>
                  <input
                    className={field}
                    value={intakeNote}
                    onChange={(e) => setIntakeNote(e.target.value)}
                    placeholder="Form received at front desk, 12 Aug"
                  />
                </div>
              </section>

              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="submit"
                  disabled={busy}
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-brand-orange text-brand-navy text-sm font-bold disabled:opacity-60"
                >
                  {busy ? (
                    <LoaderCircle size={16} className="animate-spin" />
                  ) : (
                    <ClipboardList size={16} />
                  )}
                  Save application
                </button>
                <span className="text-xs text-[var(--text-muted)]">
                  Fields marked * are required, matching the online form.
                </span>
              </div>
            </form>
          </div>
        </div>
      </main>
    </>
  );
}
