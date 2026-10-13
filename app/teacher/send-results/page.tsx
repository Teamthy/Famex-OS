"use client";

import { useState, useEffect } from "react";
import PortalTopbar from "@/components/PortalTopbar";
import TeacherSidebar from "@/components/TeacherSidebar";
import { useApi } from "@/lib/useApi";
import { useToast } from "@/components/Toast";
import {
  MessageSquare,
  Send,
  Check,
  ChevronRight,
  ChevronLeft,
  Mail,
  Phone,
  MessageCircle,
  CheckCircle2,
  Clock,
  Eye,
  Search,
} from "lucide-react";

interface Recipient {
  /** StudentProfile.id — what the API authorises against. */
  profileId: string;
  studentId: string;
  studentName: string;
  parentName: string;
  parentPhone: string;
  parentEmail: string;
  score: number;
  grade: string;
  selected: boolean;
  status?: "pending" | "sent" | "delivered" | "failed";
}

const INITIAL_RECIPIENTS: Recipient[] = [];

type Step = 1 | 2 | 3 | 4;
type Channel = "sms" | "whatsapp" | "email";

export default function SendResultsPage() {
  const { toast } = useToast();
  const { data } = useApi<{
    teacher: { displayName: string };
    classes: { id: string; className: string }[];
    students: { id: string; studentId: string; displayName: string }[];
  }>("/api/teacher/students");
  const teacher = data?.teacher || ({} as any);
  const [step, setStep] = useState<Step>(1);

  // Step 1
  const [subject, setSubject] = useState("");
  const [assessment, setAssessment] = useState("");
  const [className, setClassName] = useState("");

  // Step 2
  const [recipients, setRecipients] = useState<Recipient[]>(INITIAL_RECIPIENTS);

  useEffect(() => {
    if (data?.students) {
      setRecipients(
        data.students.map((s) => ({
          profileId: s.id,
          studentId: s.studentId,
          studentName: s.displayName,
          parentName: "—",
          parentPhone: "—",
          parentEmail: "",
          score: 0,
          grade: "—",
          selected: false,
        })),
      );
    }
  }, [data]);
  const [search, setSearch] = useState("");
  const [filterGrade, setFilterGrade] = useState<string>("all");

  // Step 3
  const [channels, setChannels] = useState<Channel[]>(["sms", "whatsapp"]);
  const [customMessage, setCustomMessage] = useState(
    "Dear {parent_name}, this is to inform you that {student_name} scored {score}% ({grade}) in the recent {assessment}. Please log in to the portal to view detailed report. Thank you. - Ykay College",
  );

  // Step 4
  const [sending, setSending] = useState(false);
  const [sentCount, setSentCount] = useState(0);

  const filtered = recipients.filter((r: any) => {
    const matchSearch = r.studentName.toLowerCase().includes(search.toLowerCase());
    const matchGrade = filterGrade === "all" || r.grade === filterGrade;
    return matchSearch && matchGrade;
  });

  const selectedRecipients = recipients.filter((r: any) => r.selected);

  const toggleSelect = (studentId: string) => {
    setRecipients((prev) =>
      prev.map((r: any) => (r.studentId === studentId ? { ...r, selected: !r.selected } : r)),
    );
  };

  const selectAll = () => {
    const allSelected = filtered.every((r) => r.selected);
    const idsToToggle = filtered.map((f) => f.studentId);
    setRecipients((prev) =>
      prev.map((r: any) =>
        idsToToggle.includes(r.studentId) ? { ...r, selected: !allSelected } : r,
      ),
    );
  };

  const toggleChannel = (c: Channel) => {
    setChannels((prev) => (prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]));
  };

  /**
   * Actually send.
   *
   * This used to be a simulation: a 500ms sleep per recipient and
   * `Math.random() > 0.1 ? "delivered" : "sent"` for the status. It reported
   * success to the teacher and delivered nothing — no notification, no email,
   * no record. There was no POST anywhere in this file.
   *
   * It now posts to /api/teacher/send-results, which notifies each linked
   * parent AND the student through the normal notification pipeline, so
   * per-user notification preferences are honoured and an in-app row is
   * written even when push is muted.
   */
  const handleSend = async () => {
    if (!selectedRecipients.length) return;
    setSending(true);
    setStep(4);
    try {
      const response = await fetch("/api/teacher/send-results", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assessmentLabel: assessment || "Assessment",
          subjectName: subject || "Result",
          results: selectedRecipients.map((r) => ({
            studentProfileId: r.profileId,
            score: Number(r.score) || 0,
            total: 100,
            comment: customMessage
              ? customMessage.replace("{student_name}", r.studentName)
              : undefined,
          })),
        }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Could not send the results.");

      setSentCount(body.sent ?? selectedRecipients.length);
      setRecipients((prev) =>
        prev.map((r: Recipient) =>
          selectedRecipients.some((sel) => sel.profileId === r.profileId)
            ? { ...r, status: "delivered" }
            : r,
        ),
      );
      toast(body.message || `Results sent for ${body.sent} student(s).`, "success");
    } catch (sendError) {
      // A failure must be visible. The old simulation could not fail, so the
      // teacher had no way to learn that nothing had gone out.
      setRecipients((prev) =>
        prev.map((r: Recipient) =>
          selectedRecipients.some((sel) => sel.profileId === r.profileId)
            ? { ...r, status: "failed" }
            : r,
        ),
      );
      toast(sendError instanceof Error ? sendError.message : "Could not send.", "error");
    } finally {
      setSending(false);
    }
  };

  const previewMessage = (r: Recipient) =>
    customMessage
      .replace("{parent_name}", r.parentName)
      .replace("{student_name}", r.studentName)
      .replace("{score}", String(r.score))
      .replace("{grade}", r.grade)
      .replace("{assessment}", assessment || "assessment");

  return (
    <>
      <PortalTopbar />
      <main className="bg-[var(--bg-primary)] min-h-screen theme-transition">
        <section className="pt-24 pb-10 bg-brand-navy px-6">
          <div className="mx-auto max-w-7xl">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-brand-green/20 border border-brand-green/40 text-brand-green text-[10px] font-bold uppercase tracking-widest mb-3">
              <MessageSquare size={11} /> Send Results
            </span>
            <h1 className="font-display text-4xl md:text-5xl tracking-widest text-white mb-2">
              SEND RESULTS <span className="text-brand-green">TO PARENTS</span>
            </h1>
            <p className="text-white/60 text-sm">
              Broadcast student results via SMS, WhatsApp, or Email with delivery tracking.
            </p>
          </div>
        </section>

        <section className="py-10 px-6">
          <div className="mx-auto max-w-7xl flex flex-col lg:flex-row gap-8">
            <TeacherSidebar />

            <div className="flex-1 min-w-0 space-y-6">
              {/* Progress Steps */}
              <div className="flex items-center gap-3 mb-6">
                {[
                  { num: 1, label: "Assessment" },
                  { num: 2, label: "Recipients" },
                  { num: 3, label: "Message" },
                  { num: 4, label: "Send" },
                ].map((s, i) => (
                  <div key={s.num} className="flex-1 flex items-center gap-3">
                    <div className="flex flex-col items-center">
                      <div
                        className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm transition-all ${
                          step > s.num
                            ? "bg-brand-green text-white"
                            : step === s.num
                              ? "bg-brand-green text-white ring-4 ring-brand-green/30"
                              : "bg-[var(--surface-disabled)] text-[var(--text-muted)]"
                        }`}
                      >
                        {step > s.num ? <Check size={16} /> : s.num}
                      </div>
                      <div className="text-[10px] uppercase tracking-widest mt-2 text-[var(--text-muted)]">
                        {s.label}
                      </div>
                    </div>
                    {i < 3 && (
                      <div
                        className={`flex-1 h-0.5 ${step > s.num ? "bg-brand-green" : "bg-[var(--border-subtle)]"}`}
                      />
                    )}
                  </div>
                ))}
              </div>

              {/* STEP 1: Select Assessment */}
              {step === 1 && (
                <div className="rounded-2xl bg-[var(--surface-card)] border border-[var(--border-subtle)] p-8 shadow-[var(--card-shadow)]">
                  <div className="mb-8">
                    <h2 className="font-display text-2xl text-[var(--text-primary)] mb-2">
                      Select Assessment
                    </h2>
                    <p className="text-sm text-[var(--text-muted)]">
                      Choose the assessment whose results you want to send.
                    </p>
                  </div>

                  <div className="space-y-5 max-w-2xl">
                    <div>
                      <label className="text-xs font-bold uppercase tracking-widest text-brand-green block mb-2">
                        Subject *
                      </label>
                      <select
                        value={subject}
                        onChange={(e) => {
                          setSubject(e.target.value);
                          setClassName("");
                        }}
                        className="w-full p-3 rounded-xl bg-[var(--input-bg)] border border-[var(--input-border)] text-[var(--input-text)] focus:outline-none focus:border-brand-green"
                      >
                        <option value="">Select subject...</option>
                        {(teacher.subjectAssignments || []).map((sa: any) => (
                          <option key={sa.subject} value={sa.subject}>
                            {sa.subject}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="text-xs font-bold uppercase tracking-widest text-brand-green block mb-2">
                        Class *
                      </label>
                      <select
                        value={className}
                        onChange={(e) => setClassName(e.target.value)}
                        disabled={!subject}
                        className="w-full p-3 rounded-xl bg-[var(--input-bg)] border border-[var(--input-border)] text-[var(--input-text)] focus:outline-none focus:border-brand-green disabled:opacity-40"
                      >
                        <option value="">Select class...</option>
                        {(
                          (teacher.subjectAssignments || []).find(
                            (sa: any) => sa.subject === subject,
                          )?.classes || []
                        ).map((c: any) => (
                          <option key={String(c)} value={String(c)}>
                            {c}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="text-xs font-bold uppercase tracking-widest text-brand-green block mb-2">
                        Assessment Type *
                      </label>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                        {[
                          "CA1",
                          "CA2",
                          "Mid-Term Test",
                          "Assignment",
                          "Terminal Exam",
                          "Mock Exam",
                        ].map((a) => (
                          <button
                            key={a}
                            onClick={() => setAssessment(a)}
                            className={`p-3 rounded-xl text-xs font-bold transition-all ${assessment === a ? "bg-brand-green text-white shadow-md" : "bg-[var(--surface-disabled)] text-[var(--text-muted)] hover:bg-brand-green/10"}`}
                          >
                            {a}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-end mt-8 pt-6 border-t border-[var(--border-subtle)]">
                    <button
                      onClick={() => setStep(2)}
                      disabled={!subject || !className || !assessment}
                      className="inline-flex items-center gap-2 px-8 py-3 rounded-full bg-brand-green text-brand-navy font-bold text-sm uppercase tracking-widest hover:bg-brand-green-dark transition-all shadow-lg disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      Next: Select Recipients <ChevronRight size={14} />
                    </button>
                  </div>
                </div>
              )}

              {/* STEP 2: Select Recipients */}
              {step === 2 && (
                <div className="rounded-2xl bg-[var(--surface-card)] border border-[var(--border-subtle)] p-8 shadow-[var(--card-shadow)]">
                  <div className="flex items-center justify-between flex-wrap gap-3 mb-6">
                    <div>
                      <h2 className="font-display text-2xl text-[var(--text-primary)] mb-2">
                        Select Recipients
                      </h2>
                      <p className="text-sm text-[var(--text-muted)]">
                        {subject} · {className} · {assessment} ·{" "}
                        <strong className="text-brand-green">
                          {selectedRecipients.length} selected
                        </strong>
                      </p>
                    </div>
                    <button
                      onClick={selectAll}
                      className="text-xs px-4 py-2 rounded-full bg-brand-green/10 text-brand-green font-bold hover:bg-brand-green hover:text-brand-navy transition-all"
                    >
                      {filtered.every((r) => r.selected) ? "Deselect All" : "Select All"}
                    </button>
                  </div>

                  {/* Filters */}
                  <div className="flex flex-col md:flex-row gap-3 mb-4">
                    <div className="relative flex-1">
                      <Search
                        size={16}
                        className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--text-muted)]"
                      />
                      <input
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Search students..."
                        className="w-full pl-11 pr-5 py-3 rounded-xl bg-[var(--input-bg)] border border-[var(--input-border)] text-[var(--input-text)] focus:outline-none focus:border-brand-green"
                      />
                    </div>
                    <select
                      value={filterGrade}
                      onChange={(e) => setFilterGrade(e.target.value)}
                      className="px-4 py-3 rounded-xl bg-[var(--input-bg)] border border-[var(--input-border)] text-[var(--input-text)]"
                    >
                      <option value="all">All Grades</option>
                      {["A1", "B2", "B3", "C4", "C5"].map((g) => (
                        <option key={g} value={g}>
                          {g} only
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Recipients List */}
                  <div className="border border-[var(--border-subtle)] rounded-xl overflow-hidden max-h-96 overflow-y-auto">
                    {filtered.map((r: any) => (
                      <label
                        key={r.studentId}
                        className={`flex items-center gap-4 p-4 cursor-pointer border-b border-[var(--border-subtle)] last:border-0 transition-colors ${r.selected ? "bg-brand-green/5" : "hover:bg-[var(--surface-disabled)]"}`}
                      >
                        <input
                          type="checkbox"
                          checked={r.selected}
                          onChange={() => toggleSelect(r.studentId)}
                          className="w-4 h-4 accent-brand-green"
                        />
                        <div className="flex-1 min-w-0 grid grid-cols-1 md:grid-cols-3 gap-2 items-center">
                          <div>
                            <div className="font-bold text-[var(--text-primary)] text-sm">
                              {r.studentName}
                            </div>
                            <div className="text-[10px] text-[var(--text-muted)]">
                              {r.studentId}
                            </div>
                          </div>
                          <div className="text-xs">
                            <div className="text-[var(--text-muted)]">Parent: {r.parentName}</div>
                            <div className="text-[var(--text-muted)] font-mono text-[10px]">
                              {r.parentPhone}
                            </div>
                          </div>
                          <div className="flex items-center gap-2 justify-end">
                            <span
                              className={`text-xs font-bold px-2 py-0.5 rounded-full ${r.score >= 70 ? "bg-brand-green/10 text-brand-green" : r.score >= 50 ? "bg-brand-orange/10 text-brand-orange" : "bg-red-500/10 text-red-500"}`}
                            >
                              {r.score}% · {r.grade}
                            </span>
                          </div>
                        </div>
                      </label>
                    ))}
                  </div>

                  <div className="flex justify-between mt-8 pt-6 border-t border-[var(--border-subtle)]">
                    <button
                      onClick={() => setStep(1)}
                      className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-[var(--surface-disabled)] text-[var(--text-primary)] font-bold text-sm hover:bg-[var(--border-subtle)] transition-all"
                    >
                      <ChevronLeft size={14} /> Back
                    </button>
                    <button
                      onClick={() => setStep(3)}
                      disabled={selectedRecipients.length === 0}
                      className="inline-flex items-center gap-2 px-8 py-3 rounded-full bg-brand-green text-brand-navy font-bold text-sm uppercase tracking-widest hover:bg-brand-green-dark transition-all shadow-lg disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      Next: Compose Message <ChevronRight size={14} />
                    </button>
                  </div>
                </div>
              )}

              {/* STEP 3: Compose Message */}
              {step === 3 && (
                <div className="rounded-2xl bg-[var(--surface-card)] border border-[var(--border-subtle)] p-8 shadow-[var(--card-shadow)]">
                  <div className="mb-6">
                    <h2 className="font-display text-2xl text-[var(--text-primary)] mb-2">
                      Compose Message
                    </h2>
                    <p className="text-sm text-[var(--text-muted)]">
                      Choose delivery channels and customize the message.
                    </p>
                  </div>

                  <div className="space-y-6">
                    {/* Channel Selection */}
                    <div>
                      <label className="text-xs font-bold uppercase tracking-widest text-brand-green block mb-3">
                        Delivery Channels *
                      </label>
                      <div className="grid grid-cols-3 gap-3">
                        {[
                          {
                            key: "sms" as Channel,
                            icon: Phone,
                            label: "SMS",
                            desc: "Via Termii · Instant",
                            color: "brand-green",
                          },
                          {
                            key: "whatsapp" as Channel,
                            icon: MessageCircle,
                            label: "WhatsApp",
                            desc: "WhatsApp Business API",
                            color: "brand-orange",
                          },
                          {
                            key: "email" as Channel,
                            icon: Mail,
                            label: "Email",
                            desc: "Via SendGrid · Rich text",
                            color: "blue-500",
                          },
                        ].map((c: any) => (
                          <button
                            key={c.key}
                            onClick={() => toggleChannel(c.key)}
                            className={`p-5 rounded-2xl border-2 text-left transition-all ${
                              channels.includes(c.key)
                                ? "border-brand-green bg-brand-green/10"
                                : "border-[var(--border-subtle)] hover:border-brand-green/30"
                            }`}
                          >
                            <div className="flex items-center justify-between mb-3">
                              <c.icon
                                className={
                                  channels.includes(c.key)
                                    ? "text-brand-green"
                                    : "text-[var(--text-muted)]"
                                }
                                size={20}
                              />
                              {channels.includes(c.key) && (
                                <Check className="text-brand-green" size={16} />
                              )}
                            </div>
                            <div className="font-bold text-[var(--text-primary)]">{c.label}</div>
                            <div className="text-[10px] text-[var(--text-muted)] mt-1">
                              {c.desc}
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Message Template */}
                    <div>
                      <label className="text-xs font-bold uppercase tracking-widest text-brand-green block mb-2">
                        Message Template
                      </label>
                      <textarea
                        value={customMessage}
                        onChange={(e) => setCustomMessage(e.target.value)}
                        rows={6}
                        className="w-full p-4 rounded-xl bg-[var(--input-bg)] border border-[var(--input-border)] text-[var(--input-text)] focus:outline-none focus:border-brand-green resize-none font-mono text-sm"
                      />
                      <div className="flex flex-wrap gap-2 mt-3">
                        <div className="text-[10px] text-[var(--text-muted)] uppercase tracking-widest mr-2">
                          Variables:
                        </div>
                        {[
                          "{parent_name}",
                          "{student_name}",
                          "{score}",
                          "{grade}",
                          "{assessment}",
                        ].map((v) => (
                          <button
                            key={v}
                            onClick={() => setCustomMessage(customMessage + " " + v)}
                            className="text-[10px] px-2 py-0.5 rounded bg-brand-green/10 text-brand-green font-mono hover:bg-brand-green hover:text-brand-navy transition-all"
                          >
                            {v}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Preview */}
                    {selectedRecipients.length > 0 && (
                      <div>
                        <label className="text-xs font-bold uppercase tracking-widest text-brand-green block mb-2 flex items-center gap-2">
                          <Eye size={12} /> Preview (for {selectedRecipients[0].studentName})
                        </label>
                        <div className="p-4 rounded-xl bg-gradient-to-br from-brand-navy to-brand-navy-light text-white">
                          <div className="flex items-center gap-2 text-[10px] text-white/60 mb-3 uppercase tracking-widest">
                            <MessageCircle size={11} /> WhatsApp Preview
                          </div>
                          <p className="text-sm leading-relaxed">
                            {previewMessage(selectedRecipients[0])}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="flex justify-between mt-8 pt-6 border-t border-[var(--border-subtle)]">
                    <button
                      onClick={() => setStep(2)}
                      className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-[var(--surface-disabled)] text-[var(--text-primary)] font-bold text-sm hover:bg-[var(--border-subtle)] transition-all"
                    >
                      <ChevronLeft size={14} /> Back
                    </button>
                    <button
                      onClick={handleSend}
                      disabled={channels.length === 0}
                      className="inline-flex items-center gap-2 px-8 py-3 rounded-full bg-brand-orange text-brand-navy font-bold text-sm uppercase tracking-widest hover:bg-brand-orange-dark transition-all shadow-lg disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      Send to {selectedRecipients.length} Parents <Send size={14} />
                    </button>
                  </div>
                </div>
              )}

              {/* STEP 4: Sending / Complete */}
              {step === 4 && (
                <div className="rounded-2xl bg-[var(--surface-card)] border border-[var(--border-subtle)] p-8 shadow-[var(--card-shadow)]">
                  {sending ? (
                    <div className="text-center py-12">
                      <div className="w-20 h-20 rounded-full border-4 border-brand-green border-t-transparent animate-spin mx-auto mb-6" />
                      <h2 className="font-display text-2xl text-[var(--text-primary)] mb-2">
                        Sending Results...
                      </h2>
                      <p className="text-sm text-[var(--text-muted)] mb-6">
                        Delivering messages to parents. Please wait.
                      </p>
                      <div className="max-w-md mx-auto">
                        <div className="text-2xl font-display text-brand-green mb-2">
                          {sentCount} / {selectedRecipients.length}
                        </div>
                        <div className="w-full h-2 rounded-full bg-[var(--surface-disabled)] overflow-hidden">
                          <div
                            className="h-full bg-brand-green transition-all"
                            style={{ width: `${(sentCount / selectedRecipients.length) * 100}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <div className="text-center py-8">
                        <div className="w-20 h-20 rounded-full bg-brand-green/20 flex items-center justify-center mx-auto mb-4">
                          <CheckCircle2 className="text-brand-green" size={40} />
                        </div>
                        <h2 className="font-display text-3xl text-[var(--text-primary)] mb-2">
                          Sent Successfully!
                        </h2>
                        <p className="text-sm text-[var(--text-muted)]">
                          Results delivered to {selectedRecipients.length} parents.
                        </p>
                      </div>

                      <div className="grid grid-cols-3 gap-4 mb-8">
                        {channels.includes("sms") && (
                          <div className="p-4 rounded-xl bg-brand-green/10 border border-brand-green/30 text-center">
                            <Phone className="mx-auto text-brand-green mb-2" size={18} />
                            <div className="font-display text-2xl text-brand-green">
                              {selectedRecipients.length}
                            </div>
                            <div className="text-[10px] uppercase tracking-widest text-brand-green">
                              SMS Sent
                            </div>
                          </div>
                        )}
                        {channels.includes("whatsapp") && (
                          <div className="p-4 rounded-xl bg-brand-orange/10 border border-brand-orange/30 text-center">
                            <MessageCircle className="mx-auto text-brand-orange mb-2" size={18} />
                            <div className="font-display text-2xl text-brand-orange">
                              {selectedRecipients.length}
                            </div>
                            <div className="text-[10px] uppercase tracking-widest text-brand-orange">
                              WhatsApp
                            </div>
                          </div>
                        )}
                        {channels.includes("email") && (
                          <div className="p-4 rounded-xl bg-blue-500/10 border border-blue-500/30 text-center">
                            <Mail className="mx-auto text-blue-500 mb-2" size={18} />
                            <div className="font-display text-2xl text-blue-500">
                              {selectedRecipients.length}
                            </div>
                            <div className="text-[10px] uppercase tracking-widest text-blue-500">
                              Emails
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Delivery Log */}
                      <div className="border border-[var(--border-subtle)] rounded-xl overflow-hidden max-h-64 overflow-y-auto mb-6">
                        {selectedRecipients.map((r: any) => (
                          <div
                            key={r.studentId}
                            className="flex items-center gap-3 p-3 border-b border-[var(--border-subtle)] last:border-0"
                          >
                            <div
                              className={`w-8 h-8 rounded-full flex items-center justify-center ${r.status === "delivered" ? "bg-brand-green/20 text-brand-green" : "bg-brand-orange/20 text-brand-orange"}`}
                            >
                              {r.status === "delivered" ? (
                                <CheckCircle2 size={14} />
                              ) : (
                                <Clock size={14} />
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-bold text-[var(--text-primary)]">
                                {r.parentName}
                              </div>
                              <div className="text-[10px] text-[var(--text-muted)]">
                                Re: {r.studentName} · {r.parentPhone}
                              </div>
                            </div>
                            <span
                              className={`text-[9px] px-2 py-0.5 rounded-full font-bold uppercase tracking-widest ${r.status === "delivered" ? "bg-brand-green/20 text-brand-green" : "bg-brand-orange/20 text-brand-orange"}`}
                            >
                              {r.status || "pending"}
                            </span>
                          </div>
                        ))}
                      </div>

                      <div className="flex justify-center gap-3">
                        <button
                          onClick={() => {
                            setStep(1);
                            setRecipients(INITIAL_RECIPIENTS);
                            setSentCount(0);
                          }}
                          className="px-6 py-3 rounded-full bg-brand-green text-brand-navy font-bold text-sm hover:bg-brand-green-dark transition-all"
                        >
                          Send Another
                        </button>
                        <button className="px-6 py-3 rounded-full bg-[var(--surface-disabled)] text-[var(--text-primary)] font-bold text-sm hover:bg-[var(--border-subtle)] transition-all">
                          Download Delivery Report
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </section>
      </main>
    </>
  );
}
