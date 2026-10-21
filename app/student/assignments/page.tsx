"use client";

import { useCallback, useEffect, useState } from "react";
import PortalSidebar from "@/components/PortalSidebar";
import PortalTopbar from "@/components/PortalTopbar";
import { useToast } from "@/components/Toast";
import {
  Bell,
  BookOpenCheck,
  CalendarClock,
  CalendarDays,
  CheckCircle2,
  ClipboardCheck,
  FileText,
  GraduationCap,
  LayoutDashboard,
  LoaderCircle,
  MessageCircle,
  MonitorPlay,
  Send,
  User,
} from "lucide-react";

const SIDEBAR_ITEMS = [
  { label: "Dashboard", href: "/student/dashboard", icon: LayoutDashboard },
  { label: "Assignments", href: "/student/assignments", icon: BookOpenCheck },
  { label: "Live Classes", href: "/student/virtual-classes", icon: MonitorPlay },
  { label: "Attendance", href: "/student/attendance", icon: CalendarDays },
  { label: "Timetable", href: "/student/timetable", icon: CalendarDays },
  { label: "CBT Tests", href: "/student/exams", icon: ClipboardCheck },
  { label: "Report Cards", href: "/student/report-cards", icon: FileText },
  { label: "Messages", href: "/student/messages", icon: MessageCircle },
  { label: "Announcements", href: "/student/announcements", icon: Bell },
  { label: "My Profile", href: "/student/profile", icon: User },
  { label: "Teachers", href: "/student/teachers", icon: GraduationCap },
];

type Submission = {
  id: string;
  content: string;
  attachmentUrl: string | null;
  status: "SUBMITTED" | "GRADED" | "RETURNED";
  score: number | null;
  feedback: string | null;
  submittedAt: string;
  gradedAt: string | null;
  isLate: boolean;
};

type Assignment = {
  id: string;
  subjectName: string;
  teacherName: string;
  className: string;
  title: string;
  instructions: string;
  dueAt: string;
  maxScore: number;
  status: "PUBLISHED" | "CLOSED";
  isOverdue: boolean;
  canSubmit: boolean;
  submitBlockedReason: string | null;
  submission: Submission | null;
};

type Response = {
  student: { displayName: string; studentId: string; className: string };
  assignments: Assignment[];
};

const inputClass =
  "w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-card)] px-3 py-2.5 text-sm text-[var(--text-primary)] outline-none focus:border-brand-green";
const labelClass =
  "mb-1.5 block text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)]";

function formatDate(value: string) {
  return new Date(value).toLocaleString("en-NG", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function StudentAssignmentsPage() {
  const { toast } = useToast();
  const [data, setData] = useState<Response | null>(null);
  const [drafts, setDrafts] = useState<Record<string, { content: string; attachmentUrl: string }>>(
    {},
  );
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/student/assignments", { cache: "no-store" });
      const body = (await response.json()) as Response & { error?: string };
      if (!response.ok) throw new Error(body.error || "Unable to load assignments.");
      setData(body);
      setDrafts((previous) => {
        const next = { ...previous };
        for (const assignment of body.assignments) {
          if (!next[assignment.id]) {
            next[assignment.id] = {
              content: assignment.submission?.content ?? "",
              attachmentUrl: assignment.submission?.attachmentUrl ?? "",
            };
          }
        }
        return next;
      });
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load assignments.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function submit(assignment: Assignment) {
    const draft = drafts[assignment.id] ?? { content: "", attachmentUrl: "" };
    setSavingId(assignment.id);
    try {
      const response = await fetch(`/api/student/assignments/${assignment.id}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: draft.content,
          attachmentUrl: draft.attachmentUrl || null,
        }),
      });
      const body = (await response.json()) as { error?: string; isLate?: boolean };
      if (!response.ok) throw new Error(body.error || "Could not submit your work.");
      toast(body.isLate ? "Submitted late. Your teacher can now see it." : "Assignment submitted.");
      await load();
    } catch (submitError) {
      toast(
        submitError instanceof Error ? submitError.message : "Could not submit your work.",
        "error",
      );
    } finally {
      setSavingId(null);
    }
  }

  return (
    <>
      <PortalTopbar title="My assignments" />
      <main className="min-h-screen bg-[var(--bg-primary)] theme-transition">
        <section className="bg-brand-navy px-6 pt-28 pb-12">
          <div className="mx-auto max-w-7xl">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-brand-green/40 bg-brand-green/20 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-brand-green">
              <BookOpenCheck size={11} /> Homework & classwork
            </span>
            <h1 className="mt-3 font-display text-4xl tracking-widest text-white md:text-5xl">
              MY ASSIGNMENTS
            </h1>
            <p className="mt-3 max-w-3xl text-sm text-white/60">
              Read your teacher's instructions, write your answer, and submit. You can revise an
              ungraded or returned submission while the assignment remains open.
            </p>
          </div>
        </section>

        <section className="px-6 py-10">
          <div className="mx-auto flex max-w-7xl flex-col gap-8 lg:flex-row">
            <PortalSidebar portalName="Student" portalType="student" items={SIDEBAR_ITEMS} />
            <div className="min-w-0 flex-1 space-y-5">
              {error ? (
                <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-500">
                  {error}
                </div>
              ) : null}
              {loading ? (
                <div className="flex items-center gap-3 rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-card)] p-8 text-sm text-[var(--text-secondary)]">
                  <LoaderCircle className="animate-spin text-brand-green" size={18} /> Loading your
                  assignments…
                </div>
              ) : null}
              {!loading && data && data.assignments.length === 0 ? (
                <div className="rounded-[2rem] border border-dashed border-[var(--border-subtle)] bg-[var(--surface-card)] p-8 text-center text-sm text-[var(--text-muted)]">
                  No assignments have been published for {data.student.className} yet.
                </div>
              ) : null}
              {!loading &&
                data?.assignments.map((assignment) => {
                  const draft = drafts[assignment.id] ?? { content: "", attachmentUrl: "" };
                  const submission = assignment.submission;
                  return (
                    <article
                      key={assignment.id}
                      data-testid="student-assignment-card"
                      className="rounded-[2rem] border border-[var(--border-subtle)] bg-[var(--surface-card)] p-6 shadow-[var(--card-shadow)]"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-4">
                        <div>
                          <div className="text-[10px] font-bold uppercase tracking-widest text-brand-green">
                            {assignment.subjectName} · {assignment.teacherName}
                          </div>
                          <h2 className="mt-1 font-display text-2xl text-[var(--text-primary)]">
                            {assignment.title}
                          </h2>
                          <p className="mt-2 flex items-center gap-1.5 text-xs text-[var(--text-muted)]">
                            <CalendarClock size={13} /> Due {formatDate(assignment.dueAt)} · Maximum{" "}
                            {assignment.maxScore} mark{assignment.maxScore === 1 ? "" : "s"}
                          </p>
                        </div>
                        <span className="rounded-full bg-brand-green/10 px-3 py-1 text-[9px] font-bold uppercase tracking-widest text-brand-green">
                          {submission ? submission.status : assignment.status}
                          {assignment.isOverdue ? " · OVERDUE" : ""}
                          {submission?.isLate ? " · LATE" : ""}
                        </span>
                      </div>

                      <div className="mt-5 whitespace-pre-wrap rounded-2xl bg-[var(--surface-disabled)] p-4 text-sm text-[var(--text-secondary)]">
                        {assignment.instructions}
                      </div>

                      {submission?.status === "GRADED" ? (
                        <div className="mt-5 rounded-2xl border border-brand-green/25 bg-brand-green/10 p-4">
                          <div className="flex items-center gap-2 font-semibold text-brand-green">
                            <CheckCircle2 size={17} /> Score: {submission.score}/
                            {assignment.maxScore}
                          </div>
                          {submission.feedback ? (
                            <p className="mt-2 text-sm text-[var(--text-secondary)]">
                              Teacher feedback: {submission.feedback}
                            </p>
                          ) : null}
                        </div>
                      ) : null}

                      {submission?.status === "RETURNED" && submission.feedback ? (
                        <div className="mt-5 rounded-2xl border border-brand-orange/30 bg-brand-orange/10 p-4 text-sm text-[var(--text-secondary)]">
                          <strong className="text-brand-orange">Returned for revision:</strong>{" "}
                          {submission.feedback}
                        </div>
                      ) : null}

                      {assignment.canSubmit ? (
                        <div className="mt-5 space-y-4">
                          <div>
                            <label htmlFor={`work-${assignment.id}`} className={labelClass}>
                              Your work
                            </label>
                            <textarea
                              id={`work-${assignment.id}`}
                              data-testid="assignment-answer"
                              className={`${inputClass} min-h-36`}
                              value={draft.content}
                              onChange={(event) =>
                                setDrafts((previous) => ({
                                  ...previous,
                                  [assignment.id]: {
                                    content: event.target.value,
                                    attachmentUrl: draft.attachmentUrl,
                                  },
                                }))
                              }
                              placeholder="Write your answer here…"
                            />
                          </div>
                          <div>
                            <label htmlFor={`attachment-${assignment.id}`} className={labelClass}>
                              Attachment link (optional, HTTPS)
                            </label>
                            <input
                              id={`attachment-${assignment.id}`}
                              data-testid="assignment-attachment"
                              className={inputClass}
                              value={draft.attachmentUrl}
                              onChange={(event) =>
                                setDrafts((previous) => ({
                                  ...previous,
                                  [assignment.id]: {
                                    content: draft.content,
                                    attachmentUrl: event.target.value,
                                  },
                                }))
                              }
                              placeholder="https://…"
                            />
                          </div>
                          <button
                            type="button"
                            data-testid="submit-assignment"
                            disabled={savingId === assignment.id || !draft.content.trim()}
                            onClick={() => void submit(assignment)}
                            className="inline-flex items-center gap-2 rounded-xl bg-brand-green px-5 py-3 text-sm font-bold text-brand-navy disabled:opacity-60"
                          >
                            {savingId === assignment.id ? (
                              <LoaderCircle className="animate-spin" size={16} />
                            ) : (
                              <Send size={16} />
                            )}
                            {submission ? "Resubmit assignment" : "Submit assignment"}
                          </button>
                        </div>
                      ) : (
                        <p className="mt-5 text-sm text-[var(--text-muted)]">
                          {assignment.submitBlockedReason ||
                            "This assignment is not accepting submissions."}
                        </p>
                      )}

                      {submission ? (
                        <p className="mt-4 text-xs text-[var(--text-muted)]">
                          Last submitted {formatDate(submission.submittedAt)}
                          {submission.isLate ? " (late)" : ""}.
                        </p>
                      ) : null}
                    </article>
                  );
                })}
            </div>
          </div>
        </section>
      </main>
    </>
  );
}
