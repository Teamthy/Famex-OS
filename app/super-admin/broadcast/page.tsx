"use client";

import { useState } from "react";
import Link from "next/link";
import PortalTopbar from "@/components/PortalTopbar";
import { useToast } from "@/components/Toast";
import { ArrowLeft, Send, LoaderCircle, Megaphone } from "lucide-react";

export default function SuperAdminBroadcastPage() {
  const { toast } = useToast();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [scope, setScope] = useState<"all" | "school">("all");
  const [sending, setSending] = useState(false);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !body.trim()) {
      toast("Title and message are required.", "warning");
      return;
    }
    setSending(true);
    try {
      const r = await fetch("/api/super-admin/broadcast", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, body, scope }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "Broadcast failed.");
      toast(j.message || "Broadcast sent.", "success");
      setTitle("");
      setBody("");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Broadcast failed.", "error");
    } finally {
      setSending(false);
    }
  }

  return (
    <>
      <PortalTopbar title="Broadcast" />
      <main className="mx-auto max-w-3xl px-6 py-8">
        <Link
          href="/super-admin/portals"
          className="mb-3 inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-brand-green"
        >
          <ArrowLeft size={12} /> Portal Hub
        </Link>
        <div className="rounded-[2rem] bg-brand-navy p-7 text-white">
          <div className="flex items-center gap-3">
            <Megaphone className="text-brand-green" size={28} />
            <h1 className="font-display text-3xl tracking-widest">BROADCAST</h1>
          </div>
          <p className="mt-3 text-sm text-white/65">
            Push an in-app notification to every active user across the platform (or a single
            school).
          </p>
        </div>

        <form
          onSubmit={send}
          className="mt-6 space-y-5 rounded-3xl border border-[var(--border-subtle)] bg-[var(--surface-card)] p-7"
        >
          <div className="flex gap-2">
            {(["all", "school"] as const).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setScope(s)}
                className={`rounded-full px-5 py-2.5 text-xs font-bold uppercase tracking-widest ${scope === s ? "bg-brand-green text-white" : "border border-[var(--input-border)] text-[var(--text-muted)]"}`}
              >
                {s === "all" ? "All schools" : "Single school"}
              </button>
            ))}
          </div>
          <label className="block text-xs font-bold uppercase tracking-widest">
            Title
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={200}
              className="mt-2 w-full rounded-xl border border-[var(--input-border)] bg-[var(--input-bg)] p-3 text-sm normal-case"
              placeholder="e.g. Scheduled maintenance this weekend"
            />
          </label>
          <label className="block text-xs font-bold uppercase tracking-widest">
            Message
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={4}
              maxLength={2000}
              className="mt-2 w-full rounded-xl border border-[var(--input-border)] bg-[var(--input-bg)] p-3 text-sm normal-case"
              placeholder="Write the announcement…"
            />
          </label>
          <button
            type="submit"
            disabled={sending || !title.trim() || !body.trim()}
            className="inline-flex items-center gap-2 rounded-full bg-brand-orange px-6 py-3 text-xs font-bold uppercase tracking-widest text-brand-navy disabled:opacity-50"
          >
            {sending ? <LoaderCircle className="animate-spin" size={15} /> : <Send size={15} />}{" "}
            Send broadcast
          </button>
        </form>
      </main>
    </>
  );
}
