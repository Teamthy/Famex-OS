"use client";

import { useMemo, useState } from "react";
import PortalTopbar from "@/components/PortalTopbar";
import TeacherSidebar from "@/components/TeacherSidebar";
import { useApi } from "@/lib/useApi";
import { useToast } from "@/components/Toast";
import {
  Megaphone,
  Users,
  User,
  Send,
  Calendar,
  Bell,
  Eye,
  Check,
  MessageCircle,
  Mail,
  Phone,
  Sparkles,
  Zap,
  AlertCircle,
} from "lucide-react";

export default function BulkAnnouncementPage() {
  const { toast } = useToast();
  const { data, loading: _apiLoading, error: _apiError } = useApi<any>("/api/teacher/profile");
  const teacher = data?.teacher || ({} as any);

  const [audience, setAudience] = useState<
    "all-classes" | "specific-class" | "all-parents" | "specific-parents"
  >("all-classes");
  const [selectedClasses, setSelectedClasses] = useState<string[]>([]);
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [priority, setPriority] = useState<"normal" | "urgent">("normal");
  const [channels, setChannels] = useState<string[]>(["portal"]);
  const [schedule, setSchedule] = useState<"now" | "later">("now");
  const [scheduledDate, setScheduledDate] = useState("");
  const [, setSending] = useState(false);

  /**
   * Real classes with real ids.
   *
   * This used to flatten `sa.classes` into display names, which meant the
   * page had no class id to send anywhere — and the recipient count was
   * `selectedClasses.length * 30`, a literal guess of thirty children per
   * class shown to the teacher as fact.
   */
  const classOptions: { id: string; name: string }[] = useMemo(() => {
    // /api/teacher/profile returns `classes: [{ id, name, role, subject }]`.
    // A Map because a teacher assigned to one class for two subjects appears
    // twice, and offering the same class twice in the picker is confusing.
    const seen = new Map<string, string>();
    for (const entry of teacher.classes || []) {
      if (entry?.id && entry?.name) seen.set(entry.id, entry.name);
    }
    return [...seen].map(([id, name]) => ({ id, name }));
  }, [teacher]);

  const targetClassIds =
    audience === "all-classes" || audience === "all-parents"
      ? classOptions.map((c) => c.id)
      : selectedClasses;

  const toggleClass = (c: string) => {
    setSelectedClasses((prev) => (prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]));
  };

  const toggleChannel = (c: string) => {
    setChannels((prev) => (prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]));
  };

  /**
   * Actually send.
   *
   * This used to be a toast and nothing else: no request, no recipients, no
   * record. The teacher was told "Announcement sent to N recipients" where N
   * was an estimate the page had invented.
   *
   * One request per class, because the endpoint authorises per class — a
   * teacher must only be able to address classes they are assigned to.
   */
  const handleSend = async () => {
    if (!title.trim() || !message.trim()) {
      toast("Please fill title and message", "warning");
      return;
    }
    if (!targetClassIds.length) {
      toast("Select at least one class", "warning");
      return;
    }

    setSending(true);
    try {
      const apiAudience = audience.includes("parents") ? "PARENTS" : "BOTH";
      let delivered = 0;
      const failures: string[] = [];

      for (const classId of targetClassIds) {
        const response = await fetch("/api/teacher/announcements", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            classId,
            title: title.trim(),
            body: message.trim(),
            audience: apiAudience,
          }),
        });
        const body = await response.json();
        if (!response.ok) {
          failures.push(body.error || "failed");
          continue;
        }
        delivered += body.sent || 0;
      }

      if (failures.length && !delivered) {
        throw new Error(failures[0]);
      }
      toast(
        `Announcement sent to ${delivered} recipient(s)` +
          (failures.length ? ` — ${failures.length} class(es) failed.` : "."),
        failures.length ? "warning" : "success",
      );
      setTitle("");
      setMessage("");
    } catch (sendError) {
      toast(sendError instanceof Error ? sendError.message : "Could not send.", "error");
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      <PortalTopbar />
      <main className="bg-[var(--bg-primary)] min-h-screen theme-transition">
        <section className="pt-24 pb-10 bg-brand-navy px-6">
          <div className="mx-auto max-w-7xl">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-brand-green/20 border border-brand-green/40 text-brand-green text-[10px] font-bold uppercase tracking-widest mb-3">
              <Megaphone size={11} /> Bulk Announcement
            </span>
            <h1 className="font-display text-4xl md:text-5xl tracking-widest text-white mb-2">
              CREATE <span className="text-brand-green">ANNOUNCEMENT</span>
            </h1>
            <p className="text-white/60 text-sm">
              Send updates to students, parents, or entire classes via multiple channels.
            </p>
          </div>
        </section>

        <section className="py-10 px-6">
          <div className="mx-auto max-w-7xl flex flex-col lg:flex-row gap-8">
            <TeacherSidebar />

            <div className="flex-1 min-w-0 grid lg:grid-cols-[1fr_360px] gap-6">
              {/* Main Form */}
              <div className="space-y-6">
                {/* Audience */}
                <div className="rounded-2xl bg-[var(--surface-card)] border border-[var(--border-subtle)] p-6 shadow-[var(--card-shadow)]">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-xl bg-brand-green/10 text-brand-green flex items-center justify-center">
                      <Users size={18} />
                    </div>
                    <div>
                      <h3 className="font-display text-lg text-[var(--text-primary)]">
                        Choose Audience
                      </h3>
                      <p className="text-xs text-[var(--text-muted)]">
                        Who should receive this announcement?
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    {[
                      {
                        key: "all-classes",
                        label: "All My Students",
                        desc: `${teacher.totalStudentsTaught} students`,
                        icon: Users,
                      },
                      {
                        key: "specific-class",
                        label: "Specific Classes",
                        desc: "Choose classes",
                        icon: User,
                      },
                      {
                        key: "all-parents",
                        label: "All Parents",
                        desc: `${teacher.totalStudentsTaught} parents`,
                        icon: MessageCircle,
                      },
                      {
                        key: "specific-parents",
                        label: "Specific Parents",
                        desc: "Choose parents",
                        icon: Mail,
                      },
                    ].map((a) => (
                      <button
                        key={a.key}
                        onClick={() => setAudience(a.key as any)}
                        className={`p-4 rounded-xl border text-left transition-all ${
                          audience === a.key
                            ? "bg-brand-green/10 border-brand-green"
                            : "border-[var(--border-subtle)] hover:border-brand-green/30"
                        }`}
                      >
                        <a.icon
                          className={
                            audience === a.key
                              ? "text-brand-green mb-2"
                              : "text-[var(--text-muted)] mb-2"
                          }
                          size={16}
                        />
                        <div className="font-bold text-[var(--text-primary)] text-sm">
                          {a.label}
                        </div>
                        <div className="text-[10px] text-[var(--text-muted)] mt-1">{a.desc}</div>
                      </button>
                    ))}
                  </div>

                  {audience === "specific-class" && (
                    <div className="mt-4 pt-4 border-t border-[var(--border-subtle)]">
                      <div className="text-xs font-bold uppercase tracking-widest text-brand-green mb-3">
                        Select Classes
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {classOptions.map((c) => (
                          <button
                            key={c.id}
                            onClick={() => toggleClass(c.id)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                              selectedClasses.includes(c.id)
                                ? "bg-brand-green text-white"
                                : "bg-[var(--surface-disabled)] text-[var(--text-muted)] hover:bg-brand-green/10"
                            }`}
                          >
                            {c.name}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Message */}
                <div className="rounded-2xl bg-[var(--surface-card)] border border-[var(--border-subtle)] p-6 shadow-[var(--card-shadow)]">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-xl bg-brand-orange/10 text-brand-orange flex items-center justify-center">
                      <Megaphone size={18} />
                    </div>
                    <div>
                      <h3 className="font-display text-lg text-[var(--text-primary)]">
                        Compose Message
                      </h3>
                      <p className="text-xs text-[var(--text-muted)]">
                        What do you want to announce?
                      </p>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <label className="text-xs font-bold uppercase tracking-widest text-[var(--text-muted)] block mb-2">
                        Title *
                      </label>
                      <input
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        placeholder="e.g., Mid-Term Exam Reminder"
                        className="w-full p-3 rounded-xl bg-[var(--input-bg)] border border-[var(--input-border)] text-[var(--input-text)] focus:outline-none focus:border-brand-green"
                      />
                    </div>

                    <div>
                      <label className="text-xs font-bold uppercase tracking-widest text-[var(--text-muted)] block mb-2">
                        Message *
                      </label>
                      <textarea
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                        rows={8}
                        placeholder="Type your announcement here..."
                        className="w-full p-4 rounded-xl bg-[var(--input-bg)] border border-[var(--input-border)] text-[var(--input-text)] focus:outline-none focus:border-brand-green resize-none"
                      />
                      <div className="text-[10px] text-[var(--text-muted)] mt-1 text-right">
                        {message.length} / 500 characters
                      </div>
                    </div>

                    <div>
                      <label className="text-xs font-bold uppercase tracking-widest text-[var(--text-muted)] block mb-2">
                        Priority
                      </label>
                      <div className="grid grid-cols-2 gap-2">
                        {[
                          { key: "normal", label: "Normal", icon: Bell },
                          { key: "urgent", label: "Urgent", icon: AlertCircle },
                        ].map((p) => (
                          <button
                            key={p.key}
                            onClick={() => setPriority(p.key as any)}
                            className={`p-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 ${priority === p.key ? (p.key === "urgent" ? "bg-red-500 text-white" : "bg-brand-green text-white") : "bg-[var(--surface-disabled)] text-[var(--text-muted)]"}`}
                          >
                            <p.icon size={12} /> {p.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Channels */}
                <div className="rounded-2xl bg-[var(--surface-card)] border border-[var(--border-subtle)] p-6 shadow-[var(--card-shadow)]">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-500 flex items-center justify-center">
                      <Send size={18} />
                    </div>
                    <div>
                      <h3 className="font-display text-lg text-[var(--text-primary)]">
                        Delivery Channels
                      </h3>
                      <p className="text-xs text-[var(--text-muted)]">
                        How should this be delivered?
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {[
                      { key: "portal", label: "Portal", icon: Bell },
                      { key: "sms", label: "SMS", icon: Phone },
                      { key: "whatsapp", label: "WhatsApp", icon: MessageCircle },
                      { key: "email", label: "Email", icon: Mail },
                    ].map((c: any) => (
                      <button
                        key={c.key}
                        onClick={() => toggleChannel(c.key)}
                        className={`p-4 rounded-xl border-2 transition-all ${
                          channels.includes(c.key)
                            ? "border-brand-green bg-brand-green/10 text-brand-green"
                            : "border-[var(--border-subtle)] text-[var(--text-muted)] hover:border-brand-green/30"
                        }`}
                      >
                        <c.icon className="mx-auto mb-2" size={18} />
                        <div className="text-xs font-bold">{c.label}</div>
                        {channels.includes(c.key) && (
                          <Check className="mx-auto mt-1 text-brand-green" size={12} />
                        )}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Schedule */}
                <div className="rounded-2xl bg-[var(--surface-card)] border border-[var(--border-subtle)] p-6 shadow-[var(--card-shadow)]">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-xl bg-purple-500/10 text-purple-500 flex items-center justify-center">
                      <Calendar size={18} />
                    </div>
                    <div>
                      <h3 className="font-display text-lg text-[var(--text-primary)]">
                        Delivery Timing
                      </h3>
                      <p className="text-xs text-[var(--text-muted)]">
                        Send now or schedule for later
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <button
                      onClick={() => setSchedule("now")}
                      className={`p-4 rounded-xl border-2 text-left transition-all ${schedule === "now" ? "border-brand-green bg-brand-green/10" : "border-[var(--border-subtle)] hover:border-brand-green/30"}`}
                    >
                      <Zap
                        className={
                          schedule === "now"
                            ? "text-brand-green mb-2"
                            : "text-[var(--text-muted)] mb-2"
                        }
                        size={16}
                      />
                      <div className="font-bold text-[var(--text-primary)] text-sm">Send Now</div>
                      <div className="text-[10px] text-[var(--text-muted)]">
                        Deliver immediately
                      </div>
                    </button>
                    <button
                      onClick={() => setSchedule("later")}
                      className={`p-4 rounded-xl border-2 text-left transition-all ${schedule === "later" ? "border-brand-green bg-brand-green/10" : "border-[var(--border-subtle)] hover:border-brand-green/30"}`}
                    >
                      <Calendar
                        className={
                          schedule === "later"
                            ? "text-brand-green mb-2"
                            : "text-[var(--text-muted)] mb-2"
                        }
                        size={16}
                      />
                      <div className="font-bold text-[var(--text-primary)] text-sm">Schedule</div>
                      <div className="text-[10px] text-[var(--text-muted)]">Set date & time</div>
                    </button>
                  </div>

                  {schedule === "later" && (
                    <input
                      type="datetime-local"
                      value={scheduledDate}
                      onChange={(e) => setScheduledDate(e.target.value)}
                      className="w-full mt-3 p-3 rounded-xl bg-[var(--input-bg)] border border-[var(--input-border)] text-[var(--input-text)] focus:outline-none focus:border-brand-green"
                    />
                  )}
                </div>

                {/* Send Button */}
                <button
                  onClick={handleSend}
                  className="w-full py-4 rounded-full bg-gradient-to-r from-brand-green to-brand-green-dark text-white font-bold uppercase tracking-widest text-sm hover:opacity-90 transition-all shadow-2xl flex items-center justify-center gap-2"
                >
                  <Send size={16} />{" "}
                  {schedule === "now" ? "Send Announcement" : "Schedule Announcement"}
                </button>
              </div>

              {/* Preview Sidebar */}
              <div className="lg:sticky lg:top-24 space-y-4 h-fit">
                <div className="p-5 rounded-2xl bg-gradient-to-br from-brand-navy to-brand-navy-light text-white">
                  <div className="flex items-center gap-2 mb-3">
                    <Eye size={14} className="text-brand-green" />
                    <span className="text-xs font-bold uppercase tracking-widest text-brand-green">
                      Live Preview
                    </span>
                  </div>

                  <div className="p-4 rounded-xl bg-white/10 border border-white/20">
                    <div className="flex items-center gap-2 mb-2">
                      <Sparkles size={12} className="text-brand-green" />
                      <span className="text-[9px] uppercase tracking-widest text-brand-green font-bold">
                        Ykay College
                      </span>
                      {priority === "urgent" && (
                        <span className="text-[9px] px-2 py-0.5 rounded-full bg-red-500 text-white font-bold">
                          URGENT
                        </span>
                      )}
                    </div>
                    <div className="font-bold text-white mb-2">
                      {title || "Your title will appear here"}
                    </div>
                    <div className="text-xs text-white/80 whitespace-pre-line">
                      {message || "Your message will appear here..."}
                    </div>
                    <div className="mt-3 pt-3 border-t border-white/10 text-[10px] text-white/50">
                      From {teacher.fullName} · Now
                    </div>
                  </div>
                </div>

                <div className="p-5 rounded-2xl bg-[var(--surface-card)] border border-[var(--border-subtle)]">
                  <div className="text-xs font-bold uppercase tracking-widest text-[var(--text-muted)] mb-3">
                    Delivery Summary
                  </div>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-[var(--text-muted)]">Classes</span>
                      {/* Was `selectedClasses.length * 30` — an invented head
                          count presented to the teacher as fact. The real
                          recipient total is only known after sending, so it is
                          reported in the confirmation instead of guessed here. */}
                      <span className="font-bold text-brand-green">{targetClassIds.length}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[var(--text-muted)]">Channels</span>
                      <span className="font-bold text-[var(--text-primary)]">
                        {channels.length}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[var(--text-muted)]">Priority</span>
                      <span
                        className={`font-bold ${priority === "urgent" ? "text-red-500" : "text-brand-green"}`}
                      >
                        {priority.toUpperCase()}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[var(--text-muted)]">Timing</span>
                      <span className="font-bold text-[var(--text-primary)]">
                        {schedule === "now" ? "Immediate" : "Scheduled"}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>
    </>
  );
}
