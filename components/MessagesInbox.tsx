"use client";

import { useCallback, useEffect, useState } from "react";
import {
  AlertCircle,
  LoaderCircle,
  MessageSquare,
  Plus,
  Send,
  ArrowLeft,
  User as UserIcon,
} from "lucide-react";

/**
 * One inbox, every portal.
 *
 * Messaging was in three inconsistent states before this:
 *
 *   /teacher/messages   rendered `useState<any[]>([])` — a permanently empty
 *                       mock that never called an API at all.
 *   /parent/messages    read `userNotification` rows: one-way system notices,
 *                       hardcoded `from: "School"`, with no reply path.
 *   /student, /admin    no page whatsoever.
 *
 * Meanwhile the REAL threaded system — MessageThread, MessageParticipant,
 * Message, with GET and POST on /api/messages and /api/messages/[id] — was
 * fully built and used by exactly one screen, the teacher compose page.
 *
 * The API is deliberately role-agnostic: it authorises on `reachableStudentIds`
 * rather than on role, so a parent, teacher, student and admin all get the same
 * response shape. That means one component can serve every portal, and a fix
 * to threading behaviour lands everywhere at once instead of in one of four
 * near-identical copies.
 */

type Thread = {
  id: string;
  subject: string;
  status: string;
  lastMessageAt: string;
  preview: string | null;
  unread: number;
  student: {
    id: string;
    displayName: string;
    studentId: string;
    className: string | null;
  };
};

type ThreadMessage = {
  id: string;
  body: string;
  at: string;
  mine: boolean;
  senderName: string;
  senderRole: string | null;
};

type StudentOption = { id: string; displayName: string; className: string | null };

function whenLabel(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const today = new Date();
  const sameDay = date.toDateString() === today.toDateString();
  return sameDay
    ? date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })
    : date.toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

export default function MessagesInbox({
  /** Shown when the inbox is empty — the wording differs per portal. */
  emptyHint,
  /** Students cannot start a thread about anyone but themselves; admins can. */
  canCompose = true,
}: {
  emptyHint?: string;
  canCompose?: boolean;
}) {
  const [threads, setThreads] = useState<Thread[]>([]);
  const [students, setStudents] = useState<StudentOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [openId, setOpenId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ThreadMessage[]>([]);
  const [openSubject, setOpenSubject] = useState("");
  const [loadingThread, setLoadingThread] = useState(false);

  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);

  const [composing, setComposing] = useState(false);
  const [form, setForm] = useState({ studentProfileId: "", subject: "", body: "" });

  const loadInbox = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/messages", { cache: "no-store" });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Unable to load messages.");
      setThreads(body.threads || []);
      setStudents(body.students || []);
      setForm((f) => ({
        ...f,
        studentProfileId: f.studentProfileId || body.students?.[0]?.id || "",
      }));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load messages.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadInbox();
  }, [loadInbox]);

  const openThread = useCallback(async (threadId: string) => {
    setOpenId(threadId);
    setLoadingThread(true);
    setMessages([]);
    try {
      const response = await fetch(`/api/messages/${threadId}`, { cache: "no-store" });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Unable to open this conversation.");
      setMessages(body.messages || []);
      setOpenSubject(body.thread?.subject || "");
      // Opening marks it read server-side; reflect that immediately rather
      // than waiting for a refetch.
      setThreads((previous) => previous.map((t) => (t.id === threadId ? { ...t, unread: 0 } : t)));
    } catch (openError) {
      setError(openError instanceof Error ? openError.message : "Unable to open.");
    } finally {
      setLoadingThread(false);
    }
  }, []);

  async function sendReply() {
    if (!openId || !reply.trim() || sending) return;
    setSending(true);
    try {
      const response = await fetch(`/api/messages/${openId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: reply.trim() }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Unable to send.");
      setReply("");
      await openThread(openId);
      await loadInbox();
    } catch (sendError) {
      setError(sendError instanceof Error ? sendError.message : "Unable to send.");
    } finally {
      setSending(false);
    }
  }

  async function startThread() {
    if (!form.studentProfileId || !form.subject.trim() || !form.body.trim() || sending) return;
    setSending(true);
    try {
      const response = await fetch("/api/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentProfileId: form.studentProfileId,
          subject: form.subject.trim(),
          body: form.body.trim(),
        }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Unable to start the conversation.");
      setComposing(false);
      setForm((f) => ({ ...f, subject: "", body: "" }));
      await loadInbox();
      if (body.threadId) await openThread(body.threadId);
    } catch (startError) {
      setError(startError instanceof Error ? startError.message : "Unable to start.");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="space-y-4">
      {error ? (
        <div className="flex items-center gap-3 rounded-2xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-500">
          <AlertCircle size={18} className="shrink-0" />
          <span className="flex-1">{error}</span>
          <button onClick={() => void loadInbox()} className="font-bold uppercase tracking-widest">
            Retry
          </button>
        </div>
      ) : null}

      {canCompose && students.length > 0 ? (
        <div className="flex justify-end">
          <button
            onClick={() => setComposing((v) => !v)}
            className="inline-flex items-center gap-2 rounded-full bg-brand-green px-5 py-2.5 text-xs font-bold uppercase tracking-widest text-brand-navy"
          >
            <Plus size={13} /> New message
          </button>
        </div>
      ) : null}

      {composing ? (
        <div className="rounded-[var(--radius-card)] border border-[var(--border-subtle)] bg-[var(--surface-card)] p-6">
          <h3 className="font-display text-xl tracking-widest text-[var(--text-primary)]">
            NEW CONVERSATION
          </h3>
          <label className="mt-4 block">
            <span className="mb-1.5 block text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--text-muted)]">
              About which student
            </span>
            <select
              value={form.studentProfileId}
              onChange={(e) => setForm({ ...form, studentProfileId: e.target.value })}
              className="w-full rounded-xl border border-[var(--input-border)] bg-[var(--input-bg)] p-3 text-sm text-[var(--input-text)]"
            >
              {students.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.displayName}
                  {s.className ? ` — ${s.className}` : ""}
                </option>
              ))}
            </select>
          </label>
          <label className="mt-3 block">
            <span className="mb-1.5 block text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--text-muted)]">
              Subject
            </span>
            <input
              value={form.subject}
              onChange={(e) => setForm({ ...form, subject: e.target.value })}
              placeholder="e.g. Absence on Friday"
              className="w-full rounded-xl border border-[var(--input-border)] bg-[var(--input-bg)] p-3 text-sm text-[var(--input-text)]"
            />
          </label>
          <label className="mt-3 block">
            <span className="mb-1.5 block text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--text-muted)]">
              Message
            </span>
            <textarea
              value={form.body}
              onChange={(e) => setForm({ ...form, body: e.target.value })}
              rows={5}
              className="w-full rounded-xl border border-[var(--input-border)] bg-[var(--input-bg)] p-3 text-sm text-[var(--input-text)]"
            />
          </label>
          <div className="mt-4 flex gap-2">
            <button
              onClick={() => setComposing(false)}
              className="rounded-full border border-[var(--border-default)] px-5 py-2.5 text-sm text-[var(--text-secondary)]"
            >
              Cancel
            </button>
            <button
              onClick={() => void startThread()}
              disabled={sending || !form.subject.trim() || !form.body.trim()}
              className="flex flex-1 items-center justify-center gap-2 rounded-full bg-brand-green py-2.5 text-sm font-bold text-brand-navy disabled:opacity-50"
            >
              {sending ? <LoaderCircle size={15} className="animate-spin" /> : <Send size={15} />}
              Send
            </button>
          </div>
        </div>
      ) : null}

      {loading ? (
        <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-card)] p-10">
          <div className="flex items-center gap-3 text-[var(--text-secondary)]">
            <LoaderCircle className="animate-spin text-brand-green" size={20} /> Loading messages…
          </div>
        </div>
      ) : null}

      {/* Thread view */}
      {!loading && openId ? (
        <div className="rounded-[var(--radius-card)] border border-[var(--border-subtle)] bg-[var(--surface-card)] p-6">
          <button
            onClick={() => {
              setOpenId(null);
              setMessages([]);
            }}
            className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-[var(--text-muted)] hover:text-[var(--text-accent)]"
          >
            <ArrowLeft size={13} /> Back to inbox
          </button>
          <h3 className="mt-3 font-display text-xl tracking-widest text-[var(--text-primary)]">
            {openSubject}
          </h3>

          {loadingThread ? (
            <div className="mt-6 flex items-center gap-2 text-sm text-[var(--text-secondary)]">
              <LoaderCircle className="animate-spin text-brand-green" size={16} /> Loading…
            </div>
          ) : (
            <div className="mt-5 space-y-3">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`max-w-[85%] rounded-2xl p-4 ${
                    message.mine
                      ? "ml-auto bg-brand-green/10 border border-brand-green/25"
                      : "bg-[var(--card-bg-subtle)] border border-[var(--border-subtle)]"
                  }`}
                >
                  <div className="mb-1 flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)]">
                    <UserIcon size={10} />
                    {message.mine ? "You" : message.senderName}
                    {message.senderRole ? (
                      <span className="opacity-60">{message.senderRole}</span>
                    ) : null}
                    <span className="ml-auto opacity-60">{whenLabel(message.at)}</span>
                  </div>
                  <p className="whitespace-pre-wrap text-sm text-[var(--text-primary)]">
                    {message.body}
                  </p>
                </div>
              ))}
            </div>
          )}

          <div className="mt-5 flex gap-2">
            <input
              value={reply}
              onChange={(e) => setReply(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void sendReply();
                }
              }}
              placeholder="Write a reply…"
              className="flex-1 rounded-full border border-[var(--input-border)] bg-[var(--input-bg)] px-5 py-3 text-sm text-[var(--input-text)]"
            />
            <button
              onClick={() => void sendReply()}
              disabled={sending || !reply.trim()}
              className="inline-flex items-center gap-2 rounded-full bg-brand-green px-6 py-3 text-xs font-bold uppercase tracking-widest text-brand-navy disabled:opacity-50"
            >
              {sending ? <LoaderCircle size={13} className="animate-spin" /> : <Send size={13} />}
              Send
            </button>
          </div>
        </div>
      ) : null}

      {/* Inbox list */}
      {!loading && !openId
        ? threads.map((thread) => (
            <button
              key={thread.id}
              onClick={() => void openThread(thread.id)}
              className="flex w-full items-start gap-4 rounded-[var(--radius-card)] border border-[var(--border-subtle)] bg-[var(--surface-card)] p-5 text-left transition hover:border-brand-green/40"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-green/10 text-brand-green">
                <MessageSquare size={16} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <b className="text-[var(--text-primary)]">{thread.subject}</b>
                  {thread.unread > 0 ? (
                    <span className="rounded-full bg-brand-orange px-2 py-0.5 text-[9px] font-bold uppercase tracking-widest text-brand-navy">
                      {thread.unread} new
                    </span>
                  ) : null}
                  {thread.status !== "OPEN" ? (
                    <span className="rounded-full bg-[var(--surface-disabled)] px-2 py-0.5 text-[9px] font-bold uppercase tracking-widest text-[var(--text-muted)]">
                      {thread.status}
                    </span>
                  ) : null}
                </div>
                <p className="mt-0.5 text-[10px] uppercase tracking-widest text-[var(--text-muted)]">
                  {thread.student.displayName}
                  {thread.student.className ? ` · ${thread.student.className}` : ""}
                </p>
                {thread.preview ? (
                  <p className="mt-1 truncate text-sm text-[var(--text-secondary)]">
                    {thread.preview}
                  </p>
                ) : null}
              </div>
              <span className="shrink-0 text-[10px] uppercase tracking-widest text-[var(--text-muted)]">
                {whenLabel(thread.lastMessageAt)}
              </span>
            </button>
          ))
        : null}

      {!loading && !openId && !threads.length ? (
        <div className="rounded-[var(--radius-card)] border border-dashed border-[var(--border-default)] p-12 text-center">
          <MessageSquare className="mx-auto mb-3 text-[var(--text-muted)]" size={28} />
          <p className="text-sm text-[var(--text-muted)]">{emptyHint || "No conversations yet."}</p>
        </div>
      ) : null}
    </div>
  );
}
