"use client";

import { useState } from "react";
import PortalTopbar from "@/components/PortalTopbar";
import TeacherSidebar from "@/components/TeacherSidebar";
import { useApi } from "@/lib/useApi";
import { useToast } from "@/components/Toast";
import {
  FileText,
  Plus,
  Trash2,
  School,
  ChevronDown,
  ChevronUp,
  Save,
  HelpCircle,
} from "lucide-react";

interface Instruction {
  id: string;
  fromQ: string;
  toQ: string;
  text: string;
}

export default function AddInstructionsPage() {
  const { toast } = useToast();
  const { data, loading: _apiLoading, error: _apiError } = useApi<any>("/api/teacher/profile");
  const teacher = data?.teacher || ({} as any);
  const [selectedClass, setSelectedClass] = useState("SS 3");
  const [expanded, setExpanded] = useState(true);
  const [subject, setSubject] = useState("");
  const [instructions, setInstructions] = useState<Instruction[]>([
    { id: "1", fromQ: "", toQ: "", text: "" },
  ]);

  const allClasses = [
    ...new Set((teacher.subjectAssignments || []).flatMap((sa: any) => sa.classes)),
  ];
  const availableSubjects: string[] = (teacher.subjectAssignments || [])
    .filter((sa: any) => sa.classes.includes(selectedClass))
    .map((sa: any) => sa.subject);

  const addInstruction = () => {
    setInstructions([...instructions, { id: String(Date.now()), fromQ: "", toQ: "", text: "" }]);
  };

  const removeInstruction = (id: string) => {
    setInstructions(instructions.filter((i) => i.id !== id));
  };

  const updateInstruction = (id: string, field: keyof Instruction, value: string) => {
    setInstructions((prev) => prev.map((i: any) => (i.id === id ? { ...i, [field]: value } : i)));
  };

  const handleSave = () => {
    const valid = instructions.filter((i) => i.fromQ && i.toQ && i.text);
    if (valid.length === 0) {
      toast("Please add at least one complete instruction", "warning");
      return;
    }
    toast(`${valid.length} instructions saved`, "success");
  };

  return (
    <>
      <PortalTopbar />
      <main className="bg-[var(--bg-primary)] min-h-screen theme-transition">
        <section className="pt-24 pb-10 bg-brand-navy px-6">
          <div className="mx-auto max-w-7xl">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-brand-green/20 border border-brand-green/40 text-brand-green text-[10px] font-bold uppercase tracking-widest mb-3">
              <FileText size={11} /> Custom Instructions
            </span>
            <h1 className="font-display text-4xl md:text-5xl tracking-widest text-white mb-2 text-center">
              ADD QUESTIONS & <span className="text-brand-green">INSTRUCTIONS</span>
            </h1>
            <p className="text-white/60 text-sm text-center">
              Set up custom instructions for specific question ranges
            </p>
          </div>
        </section>

        <section className="py-10 px-6">
          <div className="mx-auto max-w-7xl flex flex-col lg:flex-row gap-8">
            <TeacherSidebar />

            <div className="flex-1 min-w-0 space-y-6">
              {/* Class Section */}
              <div className="rounded-2xl bg-[var(--surface-card)] border border-blue-500/40 overflow-hidden shadow-[var(--card-shadow)]">
                <button
                  onClick={() => setExpanded(!expanded)}
                  className="w-full p-4 flex items-center justify-between bg-blue-500/10 hover:bg-blue-500/20 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <School className="text-blue-500" size={16} />
                    <span className="font-bold text-[var(--text-primary)]">Class:</span>
                    <select
                      value={selectedClass}
                      onChange={(e) => {
                        e.stopPropagation();
                        setSelectedClass(e.target.value);
                      }}
                      onClick={(e) => e.stopPropagation()}
                      className="bg-white/50 dark:bg-white/10 border border-blue-500/30 rounded-lg px-3 py-1 text-sm font-bold text-[var(--text-primary)]"
                    >
                      {allClasses.map((c: any) => (
                        <option key={String(c)}>{String(c)}</option>
                      ))}
                    </select>
                  </div>
                  {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                </button>

                {expanded && (
                  <div className="p-6 space-y-5">
                    {/* Subject Selector */}
                    <div>
                      <label className="text-sm font-bold text-[var(--text-primary)] block mb-2">
                        Subject
                      </label>
                      <select
                        value={subject}
                        onChange={(e) => setSubject(e.target.value)}
                        className="w-full p-3 rounded-xl bg-[var(--input-bg)] border border-[var(--input-border)] text-[var(--input-text)] focus:outline-none focus:border-brand-green"
                      >
                        <option value="">-- Select a Subject --</option>
                        {availableSubjects.map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Instructions Header */}
                    <div className="pt-4 border-t border-[var(--border-subtle)]">
                      <h3 className="font-display text-xl text-[var(--text-primary)] mb-4">
                        Instructions
                      </h3>

                      {instructions.map((inst, _idx) => (
                        <div
                          key={inst.id}
                          className="mb-4 p-4 rounded-xl bg-[var(--surface-disabled)] relative"
                        >
                          {instructions.length > 1 && (
                            <button
                              onClick={() => removeInstruction(inst.id)}
                              className="absolute top-3 right-3 p-1.5 rounded-lg bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white transition-all"
                            >
                              <Trash2 size={12} />
                            </button>
                          )}

                          <div className="grid md:grid-cols-2 gap-4 mb-3">
                            <div>
                              <label className="text-sm font-medium text-[var(--text-primary)] block mb-2">
                                From Question:
                              </label>
                              <input
                                type="number"
                                value={inst.fromQ}
                                onChange={(e) =>
                                  updateInstruction(inst.id, "fromQ", e.target.value)
                                }
                                min="1"
                                placeholder="e.g., 1"
                                className="w-full p-3 rounded-xl bg-[var(--input-bg)] border border-[var(--input-border)] text-[var(--input-text)] focus:outline-none focus:border-brand-green"
                              />
                            </div>
                            <div>
                              <label className="text-sm font-medium text-[var(--text-primary)] block mb-2">
                                To Question:
                              </label>
                              <input
                                type="number"
                                value={inst.toQ}
                                onChange={(e) => updateInstruction(inst.id, "toQ", e.target.value)}
                                min="1"
                                placeholder="e.g., 10"
                                className="w-full p-3 rounded-xl bg-[var(--input-bg)] border border-[var(--input-border)] text-[var(--input-text)] focus:outline-none focus:border-brand-green"
                              />
                            </div>
                          </div>

                          <div>
                            <label className="text-sm font-medium text-[var(--text-primary)] block mb-2">
                              Instruction:
                            </label>
                            <textarea
                              value={inst.text}
                              onChange={(e) => updateInstruction(inst.id, "text", e.target.value)}
                              rows={3}
                              placeholder="e.g., Read the following passage carefully and answer questions 1-10..."
                              className="w-full p-3 rounded-xl bg-[var(--input-bg)] border border-[var(--input-border)] text-[var(--input-text)] focus:outline-none focus:border-brand-green resize-none"
                            />
                          </div>
                        </div>
                      ))}

                      <div className="flex gap-3">
                        <button
                          onClick={addInstruction}
                          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[var(--surface-card)] border border-[var(--border-subtle)] text-[var(--text-primary)] text-sm font-bold hover:bg-brand-green/10 hover:border-brand-green transition-all"
                        >
                          <Plus size={14} /> Add More Instructions
                        </button>
                      </div>
                    </div>

                    {/* Save Button */}
                    <button
                      onClick={handleSave}
                      className="w-full py-4 rounded-2xl bg-gradient-to-r from-brand-green to-brand-green-dark text-white font-bold uppercase tracking-widest text-sm hover:opacity-90 transition-all shadow-lg flex items-center justify-center gap-2"
                    >
                      <Save size={16} /> Save All Instructions
                    </button>
                  </div>
                )}
              </div>

              {/* Help Panel */}
              <div className="rounded-2xl bg-blue-500/10 border border-blue-500/30 p-6">
                <div className="flex items-start gap-3">
                  <HelpCircle className="text-blue-500 shrink-0 mt-0.5" size={20} />
                  <div>
                    <h3 className="font-bold text-[var(--text-primary)] mb-2">
                      How Instructions Work
                    </h3>
                    <ul className="space-y-1 text-sm text-[var(--text-secondary)]">
                      <li>• Instructions appear at the top of questions in the specified range</li>
                      <li>• Useful for reading comprehension, multi-part problems, or context</li>
                      <li>• Students see the instruction before answering related questions</li>
                      <li>• You can add multiple instruction ranges per subject</li>
                    </ul>
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
