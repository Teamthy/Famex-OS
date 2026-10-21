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
  ExternalLink,
  FileText,
  GraduationCap,
  LayoutDashboard,
  LoaderCircle,
  MessageCircle,
  MonitorPlay,
  Radio,
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

type Session = {
  id: string;
  subjectName: string;
  teacherName: string;
  className: string;
  title: string;
  description: string | null;
  startsAt: string;
  endsAt: string;
  joinOpensAt: string;
  phase: "BEFORE_OPEN" | "OPEN" | "LIVE" | "ENDED" | "CANCELLED";
  canJoin: boolean;
  joinedAt: string | null;
};

type Response = {
  student: { displayName: string; studentId: string; className: string };
  sessions: Session[];
};

function formatDate(value: string) {
  return new Date(value).toLocaleString("en-NG", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  });
}

function phaseLabel(session: Session) {
  if (session.phase === "LIVE") return "LIVE NOW";
  if (session.phase === "OPEN") return "READY TO JOIN";
  if (session.phase === "BEFORE_OPEN") return `JOINING OPENS ${formatDate(session.joinOpensAt)}`;
  return session.phase;
}

export default function StudentVirtualClassesPage() {
  const { toast } = useToast();
  const [data, setData] = useState<Response | null>(null);
  const [loading, setLoading] = useState(true);
  const [joiningId, setJoiningId] = useState<string | null>(null);
  const [launchedUrls, setLaunchedUrls] = useState<Record<string, string>>({});
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/student/virtual-classes", { cache: "no-store" });
      const body = (await response.json()) as Response & { error?: string };
      if (!response.ok) throw new Error(body.error || "Unable to load live classes.");
      setData(body);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load live classes.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function join(session: Session) {
    // Open synchronously in the click handler so browsers do not treat the
    // post-fetch navigation as an unsolicited popup.
    const popup = window.open("about:blank", "_blank");
    setJoiningId(session.id);
    try {
      const response = await fetch(`/api/student/virtual-classes/${session.id}/join`, {
        method: "POST",
      });
      const body = (await response.json()) as {
        meetingUrl?: string;
        error?: string;
      };
      if (!response.ok || !body.meetingUrl) {
        popup?.close();
        throw new Error(body.error || "Could not join this live class yet.");
      }
      setLaunchedUrls((previous) => ({ ...previous, [session.id]: body.meetingUrl! }));
      if (popup) {
        popup.opener = null;
        popup.location.href = body.meetingUrl;
      }
      toast("Join recorded. Opening your live class…");
      await load();
    } catch (joinError) {
      toast(
        joinError instanceof Error ? joinError.message : "Could not join this live class yet.",
        "error",
      );
    } finally {
      setJoiningId(null);
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
              Join a scheduled lesson when joining opens. FIS records that you launched the meeting;
              stay in the class on the meeting app until your teacher ends it.
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
                  <LoaderCircle className="animate-spin text-brand-green" size={18} /> Loading live
                  classes…
                </div>
              ) : null}
              {!loading && data && data.sessions.length === 0 ? (
                <div className="rounded-[2rem] border border-dashed border-[var(--border-subtle)] bg-[var(--surface-card)] p-8 text-center text-sm text-[var(--text-muted)]">
                  No upcoming live classes for {data.student.className}.
                </div>
              ) : null}
              {!loading &&
                data?.sessions.map((session) => (
                  <article
                    key={session.id}
                    data-testid="student-virtual-session-card"
                    className="rounded-[2rem] border border-[var(--border-subtle)] bg-[var(--surface-card)] p-6 shadow-[var(--card-shadow)]"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div>
                        <div className="text-[10px] font-bold uppercase tracking-widest text-brand-green">
                          {session.subjectName} · {session.teacherName}
                        </div>
                        <h2 className="mt-1 font-display text-2xl text-[var(--text-primary)]">
                          {session.title}
                        </h2>
                        <p className="mt-2 flex items-center gap-1.5 text-xs text-[var(--text-muted)]">
                          <CalendarClock size={13} /> {formatDate(session.startsAt)} —{" "}
                          {formatDate(session.endsAt)}
                        </p>
                      </div>
                      <span className="rounded-full bg-brand-green/10 px-3 py-1 text-[9px] font-bold uppercase tracking-widest text-brand-green">
                        {phaseLabel(session)}
                      </span>
                    </div>
                    {session.description ? (
                      <p className="mt-4 text-sm text-[var(--text-secondary)]">
                        {session.description}
                      </p>
                    ) : null}
                    {session.joinedAt ? (
                      <p className="mt-4 flex items-center gap-2 text-sm font-semibold text-brand-green">
                        <CheckCircle2 size={16} /> Join recorded {formatDate(session.joinedAt)}
                      </p>
                    ) : null}
                    <div className="mt-5 flex flex-wrap items-center gap-3">
                      <button
                        type="button"
                        data-testid="join-virtual-class"
                        disabled={!session.canJoin || joiningId === session.id}
                        onClick={() => void join(session)}
                        className="inline-flex items-center gap-2 rounded-xl bg-brand-green px-5 py-3 text-sm font-bold text-brand-navy disabled:opacity-60"
                      >
                        {joiningId === session.id ? (
                          <LoaderCircle className="animate-spin" size={16} />
                        ) : (
                          <Radio size={16} />
                        )}
                        {session.joinedAt ? "Join again" : "Join live class"}
                      </button>
                      {launchedUrls[session.id] ? (
                        <a
                          href={launchedUrls[session.id]}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-sm font-semibold text-brand-green"
                        >
                          Open meeting <ExternalLink size={14} />
                        </a>
                      ) : null}
                      {!session.canJoin ? (
                        <span className="text-sm text-[var(--text-muted)]">
                          Joining opens {formatDate(session.joinOpensAt)}.
                        </span>
                      ) : null}
                    </div>
                  </article>
                ))}
            </div>
          </div>
        </section>
      </main>
    </>
  );
}
