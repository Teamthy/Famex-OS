"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import PortalTopbar from "@/components/PortalTopbar";
import TeacherSidebar from "@/components/TeacherSidebar";
import { useToast } from "@/components/Toast";
import { AlertCircle, ArrowLeft, LoaderCircle, Send, User } from "lucide-react";

/**
 * Message a student's parent.
 *
 * Reached from the class roster's "Message" button, which was previously a
 * `<button>` with no onClick — it looked functional and did nothing.
 *
 * Threads are anchored to a STUDENT (see lib/messaging.ts), so the only thing
 * this needs is a studentProfileId. Participation is derived server-side from
 * ParentStudentLink / TeacherClassAssignment, so a teacher cannot message a
 * parent they have no legitimate connection to — the API returns 403.
 */

type Student = {
  id: string;
  displayName: string;
  studentId: string;
  className: string;
  guardianName?: string | null;
  guardianPhone?: string | null;
};

function ComposeInner() {
  const router = useRouter();
  const { toast } = useToast();
  const studentProfileId = useSearchParams().get("studentProfileId") || "";

  const [student, setStudent] = useState<Student | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);

  const load = useCallback(async () => {
    if (!studentProfileId) {
      setError("No student selected. Open this from the class roster.");
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/teacher/students", { cache: "no-store" });
      const data = (await response.json()) as { students?: Student[]; error?: string };
      if (!response.ok) throw new Error(data.error || "Unable to load the student.");
      const match = (data.students || []).find((s) => s.id === studentProfileId);
      if (!match) throw new Error("That student is not in one of your classes.");
      setStudent(match);
      // Prefill so the teacher writes the message, not the admin around it.
      setSubject(`About ${match.displayName}`);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load the student.");
    } finally {
      setLoading(false);
    }
  }, [studentProfileId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function send() {
    if (!student || !subject.trim() || !body.trim()) return;
    setSending(true);
    try {
      const response = await fetch("/api/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentProfileId: student.id,
          subject: subject.trim(),
          body: body.trim(),
        }),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(data.error || "Unable to send the message.");
      toast(`Message sent about ${student.displayName}.`, "success");
      router.push("/teacher/messages");
    } catch (sendError) {
      toast(sendError instanceof Error ? sendError.message : "Unable to send.", "error");
    } finally {
      setSending(false);
    }
  }

  return (
    <>
      <PortalTopbar title="Message parent" />
      <main className="min-h-screen bg-[var(--bg-primary)] theme-transition">
        <section className="bg-brand-navy px-6 pt-28 pb-14">
          <div className="mx-auto max-w-7xl">
            <Link
              href="/teacher/class/roster"
              className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-brand-green"
            >
              <ArrowLeft size={13} /> Back to roster
            </Link>
            <h1 className="mt-4 font-display text-4xl tracking-widest text-white md:text-6xl">
              MESSAGE <span className="text-brand-green">PARENT</span>
            </h1>
            <p className="mt-3 max-w-2xl font-body text-sm text-white/60">
              Goes to the parents linked to this student. They can reply from the parent portal or
              the app.
            </p>
          </div>
        </section>

        <section className="px-6 py-10">
          <div className="mx-auto flex max-w-7xl flex-col gap-8 lg:flex-row">
            <TeacherSidebar />

            <div className="min-w-0 flex-1 space-y-6">
              {error ? (
                <div className="flex items-start gap-3 rounded-2xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-500">
                  <AlertCircle size={18} className="mt-0.5 shrink-0" />
                  <span className="flex-1">{error}</span>
                </div>
              ) : null}

              {loading ? (
                <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-card)] p-10">
                  <div className="flex items-center gap-3 text-[var(--text-secondary)]">
                    <LoaderCircle className="animate-spin text-brand-green" size={20} /> Loading…
                  </div>
                </div>
              ) : null}

              {!loading && student ? (
                <div className="rounded-[var(--radius-card)] border border-[var(--border-subtle)] bg-[var(--surface-card)] p-6 shadow-[var(--card-shadow)]">
                  <div className="mb-6 flex items-center gap-3 border-b border-[var(--border-subtle)] pb-4">
                    <span className="grid h-11 w-11 place-items-center rounded-full bg-brand-green/15 text-brand-green">
                      <User size={18} />
                    </span>
                    <div>
                      <b className="text-[var(--text-primary)]">{student.displayName}</b>
                      <p className="text-xs text-[var(--text-muted)]">
                        {student.studentId} · {student.className}
                        {student.guardianName ? ` · Guardian: ${student.guardianName}` : ""}
                      </p>
                    </div>
                  </div>

                  <label className="block">
                    <span className="mb-2 block text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--text-muted)]">
                      Subject
                    </span>
                    <input
                      value={subject}
                      onChange={(event) => setSubject(event.target.value)}
                      maxLength={140}
                      className="w-full rounded-xl border border-[var(--input-border)] bg-[var(--input-bg)] p-3 text-sm text-[var(--input-text)]"
                    />
                  </label>

                  <label className="mt-4 block">
                    <span className="mb-2 block text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--text-muted)]">
                      Message
                    </span>
                    <textarea
                      value={body}
                      onChange={(event) => setBody(event.target.value)}
                      rows={8}
                      maxLength={4000}
                      placeholder={`Dear parent/guardian of ${student.displayName},`}
                      className="w-full rounded-xl border border-[var(--input-border)] bg-[var(--input-bg)] p-3 text-sm text-[var(--input-text)] placeholder:text-[var(--input-placeholder)]"
                    />
                    <span className="mt-1 block text-right text-xs text-[var(--text-muted)]">
                      {body.length}/4000
                    </span>
                  </label>

                  <button
                    onClick={() => void send()}
                    disabled={sending || !subject.trim() || !body.trim()}
                    className="mt-5 flex w-full items-center justify-center gap-2 rounded-full bg-brand-green py-3.5 font-bold text-brand-navy disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {sending ? (
                      <LoaderCircle size={16} className="animate-spin" />
                    ) : (
                      <Send size={16} />
                    )}
                    Send to parent
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        </section>
      </main>
    </>
  );
}

export default function ComposeMessagePage() {
  // useSearchParams needs a Suspense boundary in the app router.
  return (
    <Suspense fallback={null}>
      <ComposeInner />
    </Suspense>
  );
}
