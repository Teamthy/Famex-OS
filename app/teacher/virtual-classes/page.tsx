"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import PortalTopbar from "@/components/PortalTopbar";
import TeacherSidebar from "@/components/TeacherSidebar";
import { useToast } from "@/components/Toast";
import {
  CalendarClock,
  ChevronRight,
  CircleStop,
  CircleX,
  ExternalLink,
  LoaderCircle,
  MonitorPlay,
  Radio,
  Users,
} from "lucide-react";

type ClassSubject = {
  id: string;
  classId: string;
  className: string;
  subjectName: string;
};

type Session = {
  id: string;
  classId: string;
  className: string;
  subjectName: string;
  title: string;
  description: string | null;
  meetingUrl: string;
  startsAt: string;
  endsAt: string;
  joinOpensAt: string;
  joinOpensMinutesBefore: number;
  status: "SCHEDULED" | "CANCELLED" | "ENDED";
  phase: "BEFORE_OPEN" | "OPEN" | "LIVE" | "ENDED" | "CANCELLED";
  canJoin: boolean;
  joinCount: number;
};

type ListResponse = {
  teacher: { displayName: string };
  classSubjects: ClassSubject[];
  sessions: Session[];
};

type Detail = {
  session: Session;
  attendees: Array<{
    studentProfileId: string;
    studentId: string;
    displayName: string;
    joinedAt: string | null;
  }>;
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

function localInputValue(date: Date) {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

function defaultStart() {
  const date = new Date(Date.now() + 15 * 60_000);
  date.setSeconds(0, 0);
  return localInputValue(date);
}

function defaultEnd() {
  const date = new Date(Date.now() + 75 * 60_000);
  date.setSeconds(0, 0);
  return localInputValue(date);
}

function phaseLabel(session: Session) {
  if (session.phase === "LIVE") return "LIVE NOW";
  if (session.phase === "OPEN") return "JOINING OPEN";
  if (session.phase === "BEFORE_OPEN") return `JOINING OPENS ${formatDate(session.joinOpensAt)}`;
  return session.phase;
}

export default function TeacherVirtualClassesPage() {
  const { toast } = useToast();
  const [data, setData] = useState<ListResponse | null>(null);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [classSubject, setClassSubject] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [meetingUrl, setMeetingUrl] = useState("");
  const [startsAt, setStartsAt] = useState(defaultStart);
  const [endsAt, setEndsAt] = useState(defaultEnd);
  const [joinOpensMinutesBefore, setJoinOpensMinutesBefore] = useState(10);

  const loadDetail = useCallback(
    async (sessionId: string) => {
      setDetailLoading(true);
      try {
        const response = await fetch(`/api/teacher/virtual-classes/${sessionId}`, {
          cache: "no-store",
        });
        const body = (await response.json()) as Detail & { error?: string };
        if (!response.ok) throw new Error(body.error || "Unable to load class attendance.");
        setDetail(body);
      } catch (loadError) {
        toast(
          loadError instanceof Error ? loadError.message : "Unable to load class attendance.",
          "error",
        );
      } finally {
        setDetailLoading(false);
      }
    },
    [toast],
  );

  const loadList = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/teacher/virtual-classes", { cache: "no-store" });
      const body = (await response.json()) as ListResponse & { error?: string };
      if (!response.ok) throw new Error(body.error || "Unable to load live classes.");
      setData(body);
      setClassSubject((previous) => {
        if (previous) return previous;
        const first = body.classSubjects[0];
        return first ? `${first.classId}||${first.subjectName}` : "";
      });
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load live classes.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadList();
  }, [loadList]);

  const selectedClassSubject = useMemo(
    () =>
      data?.classSubjects.find((item) => `${item.classId}||${item.subjectName}` === classSubject) ??
      null,
    [classSubject, data],
  );

  async function schedule(event: FormEvent) {
    event.preventDefault();
    if (!selectedClassSubject) {
      toast("Choose a class and subject first.", "error");
      return;
    }
    setSaving(true);
    try {
      const response = await fetch("/api/teacher/virtual-classes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          classId: selectedClassSubject.classId,
          subjectName: selectedClassSubject.subjectName,
          title,
          description: description || null,
          meetingUrl,
          startsAt: new Date(startsAt).toISOString(),
          endsAt: new Date(endsAt).toISOString(),
          joinOpensMinutesBefore,
        }),
      });
      const body = (await response.json()) as {
        session?: { id: string };
        error?: string;
      };
      if (!response.ok || !body.session) {
        throw new Error(body.error || "Could not schedule the live class.");
      }
      toast("Live class scheduled.");
      setTitle("");
      setDescription("");
      setMeetingUrl("");
      await loadList();
      await loadDetail(body.session.id);
    } catch (scheduleError) {
      toast(
        scheduleError instanceof Error ? scheduleError.message : "Could not schedule the class.",
        "error",
      );
    } finally {
      setSaving(false);
    }
  }

  async function changeStatus(session: Session, action: "CANCEL" | "END") {
    if (action === "CANCEL" && !window.confirm(`Cancel “${session.title}”?`)) return;
    try {
      const response = await fetch(`/api/teacher/virtual-classes/${session.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const body = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(body.error || "Could not update the live class.");
      toast(action === "CANCEL" ? "Live class cancelled." : "Live class ended.");
      await loadList();
      if (detail?.session.id === session.id) await loadDetail(session.id);
    } catch (statusError) {
      toast(
        statusError instanceof Error ? statusError.message : "Could not update the live class.",
        "error",
      );
    }
  }

  return (
    <>
      <PortalTopbar title="Live classes" />
      <main className="min-h-screen bg-[var(--bg-primary)] theme-transition">
        <section className="bg-brand-navy px-6 pt-28 pb-12">
          <div className="mx-auto max-w-7xl">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-brand-green/40 bg-brand-green/20 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-brand-green">
              <MonitorPlay size={11} /> Virtual classroom
            </span>
            <h1 className="mt-3 font-display text-4xl tracking-widest text-white md:text-5xl">
              LIVE CLASSES
            </h1>
            <p className="mt-3 max-w-3xl text-sm text-white/60">
              Schedule a lesson with the school's meeting link. Students can launch it only during
              the joining window you set. FIS records the launch; the meeting provider remains the
              source of truth for time spent inside the call.
            </p>
          </div>
        </section>

        <section className="px-6 py-10">
          <div className="mx-auto flex max-w-7xl flex-col gap-8 lg:flex-row">
            <TeacherSidebar />
            <div className="min-w-0 flex-1 space-y-6">
              {error ? (
                <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-500">
                  {error}
                </div>
              ) : null}
              {loading ? (
                <div className="flex items-center gap-3 rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-card)] p-8 text-sm text-[var(--text-secondary)]">
                  <LoaderCircle className="animate-spin text-brand-green" size={18} /> Loading live
                  classes…
                </div>
              ) : null}

              {!loading && data ? (
                <>
                  <form
                    onSubmit={schedule}
                    className="rounded-[2rem] border border-[var(--border-subtle)] bg-[var(--surface-card)] p-6 shadow-[var(--card-shadow)]"
                  >
                    <h2 className="font-display text-xl text-[var(--text-primary)]">
                      Schedule a live class
                    </h2>
                    <div className="mt-5 grid gap-4 md:grid-cols-2">
                      <div>
                        <label htmlFor="virtual-class-subject" className={labelClass}>
                          Class & subject
                        </label>
                        <select
                          id="virtual-class-subject"
                          data-testid="virtual-class-subject"
                          className={inputClass}
                          value={classSubject}
                          onChange={(event) => setClassSubject(event.target.value)}
                          required
                        >
                          <option value="">Choose a class and subject</option>
                          {data.classSubjects.map((item) => (
                            <option key={item.id} value={`${item.classId}||${item.subjectName}`}>
                              {item.className} — {item.subjectName}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label htmlFor="virtual-title" className={labelClass}>
                          Lesson title
                        </label>
                        <input
                          id="virtual-title"
                          data-testid="virtual-title"
                          className={inputClass}
                          value={title}
                          onChange={(event) => setTitle(event.target.value)}
                          placeholder="e.g. Comprehension skills — live lesson"
                          required
                        />
                      </div>
                      <div className="md:col-span-2">
                        <label htmlFor="virtual-description" className={labelClass}>
                          What should students bring?
                        </label>
                        <textarea
                          id="virtual-description"
                          data-testid="virtual-description"
                          className={`${inputClass} min-h-20`}
                          value={description}
                          onChange={(event) => setDescription(event.target.value)}
                          placeholder="Textbook, notebook, calculator…"
                        />
                      </div>
                      <div className="md:col-span-2">
                        <label htmlFor="virtual-meeting-url" className={labelClass}>
                          Meeting link (HTTPS)
                        </label>
                        <input
                          id="virtual-meeting-url"
                          data-testid="virtual-meeting-url"
                          className={inputClass}
                          value={meetingUrl}
                          onChange={(event) => setMeetingUrl(event.target.value)}
                          placeholder="Paste the HTTPS meeting link"
                          required
                        />
                      </div>
                      <div>
                        <label htmlFor="virtual-starts" className={labelClass}>
                          Starts
                        </label>
                        <input
                          id="virtual-starts"
                          data-testid="virtual-starts"
                          type="datetime-local"
                          className={inputClass}
                          value={startsAt}
                          onChange={(event) => setStartsAt(event.target.value)}
                          required
                        />
                      </div>
                      <div>
                        <label htmlFor="virtual-ends" className={labelClass}>
                          Ends
                        </label>
                        <input
                          id="virtual-ends"
                          data-testid="virtual-ends"
                          type="datetime-local"
                          className={inputClass}
                          value={endsAt}
                          onChange={(event) => setEndsAt(event.target.value)}
                          required
                        />
                      </div>
                      <div>
                        <label htmlFor="virtual-join-early" className={labelClass}>
                          Students may join (minutes early)
                        </label>
                        <input
                          id="virtual-join-early"
                          data-testid="virtual-join-early"
                          type="number"
                          min={0}
                          max={120}
                          className={inputClass}
                          value={joinOpensMinutesBefore}
                          onChange={(event) =>
                            setJoinOpensMinutesBefore(Number(event.target.value))
                          }
                          required
                        />
                      </div>
                    </div>
                    <button
                      type="submit"
                      data-testid="schedule-virtual-class"
                      disabled={saving || !data.classSubjects.length}
                      className="mt-5 inline-flex items-center gap-2 rounded-xl bg-brand-green px-5 py-3 text-sm font-bold text-brand-navy disabled:opacity-60"
                    >
                      {saving ? (
                        <LoaderCircle className="animate-spin" size={16} />
                      ) : (
                        <Radio size={16} />
                      )}
                      Schedule live class
                    </button>
                  </form>

                  <div className="grid gap-6 xl:grid-cols-[minmax(320px,0.9fr)_1.3fr]">
                    <div className="space-y-3">
                      <h2 className="font-display text-xl text-[var(--text-primary)]">
                        Scheduled classes
                      </h2>
                      {data.sessions.length === 0 ? (
                        <div className="rounded-2xl border border-dashed border-[var(--border-subtle)] p-6 text-sm text-[var(--text-muted)]">
                          No live classes scheduled yet.
                        </div>
                      ) : null}
                      {data.sessions.map((session) => (
                        <article
                          key={session.id}
                          data-testid="teacher-virtual-session-card"
                          className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-card)] p-5 shadow-[var(--card-shadow)]"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <div className="text-[10px] font-bold uppercase tracking-widest text-brand-green">
                                {session.className} · {session.subjectName}
                              </div>
                              <h3 className="mt-1 font-semibold text-[var(--text-primary)]">
                                {session.title}
                              </h3>
                              <p className="mt-1 flex items-center gap-1 text-xs text-[var(--text-muted)]">
                                <CalendarClock size={12} /> {formatDate(session.startsAt)} —{" "}
                                {formatDate(session.endsAt)}
                              </p>
                              <p className="mt-1 flex items-center gap-1 text-xs text-[var(--text-muted)]">
                                <Users size={12} /> {session.joinCount} student launch
                                {session.joinCount === 1 ? "" : "es"} recorded
                              </p>
                            </div>
                            <span className="rounded-full bg-brand-green/10 px-2.5 py-1 text-[9px] font-bold uppercase tracking-widest text-brand-green">
                              {phaseLabel(session)}
                            </span>
                          </div>
                          <div className="mt-4 flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={() => void loadDetail(session.id)}
                              className="inline-flex items-center gap-1 rounded-lg bg-brand-navy px-3 py-2 text-xs font-bold text-white"
                            >
                              View launches <ChevronRight size={14} />
                            </button>
                            <a
                              href={session.meetingUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 rounded-lg bg-brand-green px-3 py-2 text-xs font-bold text-brand-navy"
                            >
                              Open room <ExternalLink size={13} />
                            </a>
                            {session.status === "SCHEDULED" ? (
                              <>
                                <button
                                  type="button"
                                  onClick={() => void changeStatus(session, "END")}
                                  className="inline-flex items-center gap-1 rounded-lg border border-[var(--border-subtle)] px-3 py-2 text-xs font-bold text-[var(--text-secondary)]"
                                >
                                  <CircleStop size={13} /> End
                                </button>
                                <button
                                  type="button"
                                  onClick={() => void changeStatus(session, "CANCEL")}
                                  className="inline-flex items-center gap-1 rounded-lg border border-red-500/30 px-3 py-2 text-xs font-bold text-red-500"
                                >
                                  <CircleX size={13} /> Cancel
                                </button>
                              </>
                            ) : null}
                          </div>
                        </article>
                      ))}
                    </div>

                    <div className="rounded-[2rem] border border-[var(--border-subtle)] bg-[var(--surface-card)] p-6 shadow-[var(--card-shadow)]">
                      <h2 className="font-display text-xl text-[var(--text-primary)]">
                        Student launches
                      </h2>
                      <p className="mt-2 text-sm text-[var(--text-muted)]">
                        A launch means the student opened the meeting from FIS during the allowed
                        window. It does not prove how long they remained in the external meeting.
                      </p>
                      {detailLoading ? (
                        <div className="mt-5 flex items-center gap-2 text-sm text-[var(--text-muted)]">
                          <LoaderCircle className="animate-spin" size={16} /> Loading…
                        </div>
                      ) : !detail ? (
                        <p className="mt-4 text-sm text-[var(--text-muted)]">
                          Select “View launches” on a class.
                        </p>
                      ) : (
                        <div className="mt-5 space-y-2">
                          <h3 className="font-semibold text-[var(--text-primary)]">
                            {detail.session.title}
                          </h3>
                          {detail.attendees.map((student) => (
                            <div
                              key={student.studentProfileId}
                              data-testid="virtual-attendee-row"
                              className="flex items-center justify-between gap-3 rounded-xl border border-[var(--border-subtle)] px-4 py-3"
                            >
                              <div>
                                <div className="text-sm font-semibold text-[var(--text-primary)]">
                                  {student.displayName}
                                </div>
                                <div className="text-xs text-[var(--text-muted)]">
                                  {student.studentId}
                                </div>
                              </div>
                              <span
                                className={`rounded-full px-2.5 py-1 text-[9px] font-bold uppercase tracking-widest ${
                                  student.joinedAt
                                    ? "bg-brand-green/10 text-brand-green"
                                    : "bg-[var(--surface-disabled)] text-[var(--text-muted)]"
                                }`}
                              >
                                {student.joinedAt
                                  ? `Launched ${formatDate(student.joinedAt)}`
                                  : "Not launched"}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
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
