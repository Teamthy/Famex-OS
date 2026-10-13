"use client";

import { useState } from "react";
import PortalTopbar from "@/components/PortalTopbar";
import TeacherSidebar from "@/components/TeacherSidebar";
import { useApi } from "@/lib/useApi";
import { useToast } from "@/components/Toast";
import { FileText, School, Eye, CheckCircle2, Clock, Send, Edit3, X, Save } from "lucide-react";

export default function ClassReportCardsPage() {
  const { toast } = useToast();
  const { data, loading: _apiLoading, error: _apiError } = useApi<any>("/api/teacher/profile");
  const teacher = data?.teacher || ({} as any);
  const [selectedStudent, setSelectedStudent] = useState<any | null>(null);
  const [showRemarkModal, setShowRemarkModal] = useState(false);
  const [remark, setRemark] = useState("");

  const reportStatus = [].map((s, i) => ({
    ...(s as any),
    reportStatus: i % 3 === 0 ? "Approved" : i % 3 === 1 ? "Pending Review" : "Draft",
    hasRemark: i % 2 === 0,
  }));

  const approved = reportStatus.filter((r: any) => r.reportStatus === "Approved").length;
  const pending = reportStatus.filter((r: any) => r.reportStatus === "Pending Review").length;
  const draft = reportStatus.filter((r: any) => r.reportStatus === "Draft").length;

  const handleAddRemark = (student: any) => {
    setSelectedStudent(student);
    setRemark("");
    setShowRemarkModal(true);
  };

  const [savingRemark, setSavingRemark] = useState(false);

  /**
   * Actually save the remark.
   *
   * This used to be a toast and a closed modal — no request. A form teacher
   * could write a remark for every child in the class, be told it worked each
   * time, and none of it reached a report card.
   */
  const saveRemark = async () => {
    if (!remark.trim()) {
      toast("Please enter a remark", "warning");
      return;
    }
    const reportCardId = selectedStudent?.reportCardId || selectedStudent?.id;
    if (!reportCardId) {
      toast("No report card has been generated for this student yet.", "warning");
      return;
    }

    setSavingRemark(true);
    try {
      const response = await fetch("/api/teacher/class/report-cards", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reportCardId, remark: remark.trim() }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Could not save the remark.");
      toast(body.message || "Remark saved.", "success");
      setShowRemarkModal(false);
      setRemark("");
    } catch (saveError) {
      toast(saveError instanceof Error ? saveError.message : "Could not save.", "error");
    } finally {
      setSavingRemark(false);
    }
  };

  return (
    <>
      <PortalTopbar />
      <main className="bg-[var(--bg-primary)] min-h-screen theme-transition">
        <section className="pt-24 pb-10 bg-brand-navy px-6">
          <div className="mx-auto max-w-7xl">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-brand-orange/20 border border-brand-orange/40 text-brand-orange text-[10px] font-bold uppercase tracking-widest mb-3">
              <School size={11} /> Form Teacher · {teacher.formClass}
            </span>
            <h1 className="font-display text-4xl md:text-5xl tracking-widest text-white mb-2">
              CLASS <span className="text-brand-orange">REPORT CARDS</span>
            </h1>
            <p className="text-white/60 text-sm">
              Review and add remarks to report cards for your form class.
            </p>
          </div>
        </section>

        <section className="py-10 px-6">
          <div className="mx-auto max-w-7xl flex flex-col lg:flex-row gap-8">
            <TeacherSidebar />

            <div className="flex-1 min-w-0 space-y-6">
              {/* Stats */}
              <div className="grid grid-cols-3 gap-4">
                <div className="p-5 rounded-2xl bg-brand-green/10 border border-brand-green/30">
                  <CheckCircle2 className="text-brand-green mb-2" size={22} />
                  <div className="font-display text-3xl text-brand-green">{approved}</div>
                  <div className="text-xs uppercase tracking-widest text-brand-green">Approved</div>
                </div>
                <div className="p-5 rounded-2xl bg-brand-orange/10 border border-brand-orange/30">
                  <Clock className="text-brand-orange mb-2" size={22} />
                  <div className="font-display text-3xl text-brand-orange">{pending}</div>
                  <div className="text-xs uppercase tracking-widest text-brand-orange">
                    Pending Review
                  </div>
                </div>
                <div className="p-5 rounded-2xl bg-[var(--surface-card)] border border-[var(--border-subtle)]">
                  <FileText className="text-[var(--text-muted)] mb-2" size={22} />
                  <div className="font-display text-3xl text-[var(--text-primary)]">{draft}</div>
                  <div className="text-xs uppercase tracking-widest text-[var(--text-muted)]">
                    Draft
                  </div>
                </div>
              </div>

              {/* Report Cards List */}
              <div className="rounded-2xl bg-[var(--surface-card)] border border-[var(--border-subtle)] shadow-[var(--card-shadow)] overflow-hidden">
                <div className="p-6 border-b border-[var(--border-subtle)]">
                  <h3 className="font-display text-lg text-[var(--text-primary)]">
                    Form Class {teacher.formClass} — Report Cards
                  </h3>
                  <p className="text-xs text-[var(--text-muted)]">
                    First Term 2026/2027 · Add class teacher remarks before submission
                  </p>
                </div>

                <div className="divide-y divide-[var(--border-subtle)]">
                  {reportStatus.map((s) => (
                    <div
                      key={s.id}
                      className="p-5 flex items-center gap-4 hover:bg-[var(--surface-disabled)] transition-colors"
                    >
                      <img
                        src={s.photoUrl}
                        alt={s.name}
                        className="w-12 h-12 rounded-full object-cover border-2 border-[var(--border-subtle)]"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <div className="font-bold text-[var(--text-primary)]">{s.name}</div>
                          <span
                            className={`text-[9px] px-2 py-0.5 rounded-full font-bold uppercase tracking-widest ${
                              s.reportStatus === "Approved"
                                ? "bg-brand-green/20 text-brand-green"
                                : s.reportStatus === "Pending Review"
                                  ? "bg-brand-orange/20 text-brand-orange"
                                  : "bg-[var(--border-subtle)] text-[var(--text-muted)]"
                            }`}
                          >
                            {s.reportStatus}
                          </span>
                          {s.hasRemark && (
                            <span className="text-[9px] px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-500 font-bold uppercase tracking-widest">
                              Remark Added
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-[var(--text-muted)]">
                          {s.studentId} · Grade: <strong>{s.overallGrade}</strong> · Attendance:{" "}
                          <strong>{s.attendanceRate}%</strong>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleAddRemark(s)}
                          className="p-2 rounded-lg bg-brand-orange/10 text-brand-orange hover:bg-brand-orange hover:text-brand-navy transition-all"
                          title="Add Remark"
                        >
                          <Edit3 size={14} />
                        </button>
                        <button
                          className="p-2 rounded-lg bg-brand-green/10 text-brand-green hover:bg-brand-green hover:text-brand-navy transition-all"
                          title="Preview"
                        >
                          <Eye size={14} />
                        </button>
                        <button
                          className="p-2 rounded-lg bg-blue-500/10 text-blue-500 hover:bg-blue-500 hover:text-white transition-all"
                          title="Submit"
                        >
                          <Send size={14} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Bulk Action */}
              <div className="p-6 rounded-2xl bg-gradient-to-r from-brand-orange to-brand-orange-dark text-white flex items-center justify-between">
                <div>
                  <h3 className="font-display text-xl mb-1">Ready to Submit?</h3>
                  <p className="text-white/80 text-sm">
                    Send all approved reports to admin for final release.
                  </p>
                </div>
                <button className="px-6 py-3 rounded-full bg-white text-[#c2410c] font-bold text-sm hover:opacity-90 transition-all">
                  Submit to Admin
                </button>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Remark Modal */}
      {showRemarkModal && selectedStudent && (
        <div
          className="fixed inset-0 z-[150] bg-black/80 backdrop-blur-sm flex items-center justify-center p-6"
          onClick={() => setShowRemarkModal(false)}
        >
          <div
            className="rounded-3xl max-w-lg w-full p-8"
            style={{ backgroundColor: "#0C1824" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="font-display text-xl text-white">Class Teacher's Remark</h3>
                <p className="text-xs text-white/60">For {selectedStudent.name}</p>
              </div>
              <button
                onClick={() => setShowRemarkModal(false)}
                className="text-white/60 hover:text-white"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-3 rounded-xl bg-white/5 mb-4 flex items-center gap-3">
              <img
                src={selectedStudent.photoUrl}
                alt={selectedStudent.name}
                className="w-12 h-12 rounded-full object-cover"
              />
              <div>
                <div className="text-sm font-bold text-white">{selectedStudent.name}</div>
                <div className="text-[10px] text-white/50">
                  {selectedStudent.studentId} · Grade {selectedStudent.overallGrade}
                </div>
              </div>
            </div>

            <textarea
              value={remark}
              onChange={(e) => setRemark(e.target.value)}
              rows={5}
              placeholder="e.g., A hardworking student who has shown remarkable improvement this term. Keep up the excellent work!"
              className="w-full p-4 rounded-xl bg-white/5 border border-white/10 text-white placeholder:text-white/30 focus:outline-none focus:border-brand-orange resize-none mb-4"
            />

            <button
              onClick={() => void saveRemark()}
              disabled={savingRemark}
              className="w-full py-3 rounded-full bg-brand-orange text-brand-navy font-bold text-sm hover:bg-brand-orange-dark transition-all flex items-center justify-center gap-2"
            >
              <Save size={14} /> Save Remark
            </button>
          </div>
        </div>
      )}
    </>
  );
}
