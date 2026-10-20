"use client";

import { useState, type ChangeEvent, type DragEvent } from "react";
import AdminSidebar from "@/components/AdminSidebar";
import PortalTopbar from "@/components/PortalTopbar";
import { useToast } from "@/components/Toast";
import { FileUp, LoaderCircle, Upload, Download, CheckCircle2, AlertTriangle } from "lucide-react";

const SAMPLE_CSV = `subjectSlug,subjectName,classLevel,topic,difficulty,stem,optionA,optionB,optionC,optionD,correctIndex,explanation
mathematics,Mathematics,jss1,BODMAS,1,Solve 12 + 4 × 2,20,20,32,16,1,"Multiplication before addition: 4×2=8, 12+8=20"
english,English Language,jss2,Grammar,1,Choose the correct article: __ umbrella,an,a,the,any,0,"'An' precedes vowel sounds."
physics,Physics,ss1,Motion,2,SI unit of velocity?,m/s,ms,m/s²,N,0,"Velocity is metres per second (m/s)."
`;

type ImportResult = {
  imported: number;
  skipped: number;
  errors: string[];
};

export default function AdminCbtImportPage() {
  const { toast } = useToast();
  const [csv, setCsv] = useState<string>("");
  const [fileName, setFileName] = useState<string>("");
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);

  function handleFile(file: File | undefined) {
    if (!file) return;
    setFileName(file.name);
    setResult(null);
    setParseError(null);
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result || "");
      setCsv(text);
      if (!text.includes("subjectSlug") || !text.includes("stem")) {
        setParseError(
          "This file does not look like a Famex CBT CSV. It must include the columns: subjectSlug, subjectName, classLevel, topic, difficulty, stem, optionA, optionB, optionC, optionD, correctIndex, explanation.",
        );
      }
    };
    reader.onerror = () => setParseError("Could not read the file.");
    reader.readAsText(file);
  }

  function onDrop(e: DragEvent<HTMLLabelElement>) {
    e.preventDefault();
    setDragOver(false);
    handleFile(e.dataTransfer.files?.[0]);
  }

  function onPick(e: ChangeEvent<HTMLInputElement>) {
    handleFile(e.target.files?.[0]);
  }

  function downloadSample() {
    const blob = new Blob([SAMPLE_CSV], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "famex-cbt-sample.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  async function upload() {
    if (!csv.trim()) {
      toast("Select or paste a CSV first.", "error");
      return;
    }
    setUploading(true);
    setResult(null);
    setParseError(null);
    try {
      const r = await fetch("/api/admin/cbt/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ csv }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "Import failed.");
      setResult(j as ImportResult);
      toast(
        `Imported ${j.imported} question${j.imported === 1 ? "" : "s"} (skipped ${j.skipped} duplicates).`,
        "success",
      );
    } catch (e) {
      toast(e instanceof Error ? e.message : "Import failed.", "error");
    } finally {
      setUploading(false);
    }
  }

  return (
    <>
      <PortalTopbar />
      <main className="min-h-screen bg-[var(--bg-primary)] theme-transition">
        <section className="bg-brand-navy px-6 pt-28 pb-14">
          <div className="mx-auto max-w-7xl">
            <span className="mb-3 inline-flex items-center gap-1.5 rounded-full border border-brand-green/40 bg-brand-green/20 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-brand-green">
              <FileUp size={11} /> CBT bank
            </span>
            <h1 className="font-display text-4xl tracking-widest text-white md:text-6xl">
              BULK <span className="text-brand-green">QUESTION IMPORT</span>
            </h1>
            <p className="mt-3 max-w-2xl text-sm text-white/60">
              Upload CSV question papers to add to the offline CBT bank. Questions auto-download to
              student devices so CBT tests can be taken completely without internet.
            </p>
          </div>
        </section>

        <section className="px-6 py-10">
          <div className="mx-auto flex max-w-7xl flex-col gap-8 lg:flex-row">
            <AdminSidebar />

            <div className="min-w-0 flex-1 space-y-6">
              <div className="rounded-[2rem] border border-[var(--border-subtle)] bg-[var(--surface-card)] p-8">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <h2 className="font-display text-xl tracking-widest">UPLOAD CSV</h2>
                    <p className="mt-1 text-sm text-[var(--text-muted)]">
                      Drag &amp; drop, browse, or paste CSV text below. Duplicate questions (same
                      subject + stem) are skipped automatically.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={downloadSample}
                    className="inline-flex items-center gap-2 rounded-full border border-[var(--border-subtle)] px-4 py-2 text-xs font-bold uppercase tracking-widest text-[var(--text-secondary)]"
                  >
                    <Download size={14} /> Download sample
                  </button>
                </div>

                <label
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDragOver(true);
                  }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={onDrop}
                  className={`mt-6 flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed p-10 text-center transition ${
                    dragOver
                      ? "border-brand-green bg-brand-green/5"
                      : "border-[var(--border-subtle)] bg-[var(--surface-disabled)]"
                  }`}
                >
                  <Upload size={28} className="text-brand-green" />
                  <p className="text-sm font-bold text-[var(--text-primary)]">
                    Drop CSV here, or click to browse
                  </p>
                  <p className="text-xs text-[var(--text-muted)]">
                    Required columns: subjectSlug, subjectName, classLevel, topic, difficulty, stem,
                    optionA, optionB, optionC, optionD, correctIndex, explanation
                  </p>
                  <input type="file" accept=".csv,text/csv" onChange={onPick} className="hidden" />
                  {fileName && (
                    <p className="mt-2 text-xs text-brand-green">Selected: {fileName}</p>
                  )}
                </label>

                <div className="mt-5">
                  <span className="text-xs font-bold uppercase tracking-widest text-[var(--text-muted)]">
                    Or paste CSV text
                  </span>
                  <textarea
                    value={csv}
                    onChange={(e) => {
                      setCsv(e.target.value);
                      setFileName("");
                      setResult(null);
                    }}
                    rows={8}
                    placeholder="subjectSlug,subjectName,classLevel,..."
                    className="mt-2 w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--input-bg)] p-4 font-mono text-xs text-[var(--text-primary)]"
                  />
                </div>

                {parseError && (
                  <div className="mt-4 flex items-start gap-2 rounded-xl bg-red-50 p-3 text-sm text-red-700">
                    <AlertTriangle size={16} className="mt-0.5" /> {parseError}
                  </div>
                )}

                <button
                  type="button"
                  onClick={upload}
                  disabled={uploading || !csv.trim()}
                  className="mt-5 inline-flex items-center gap-2 rounded-full bg-brand-green px-6 py-3 text-sm font-bold uppercase tracking-widest text-brand-navy disabled:opacity-50"
                >
                  {uploading ? (
                    <LoaderCircle className="animate-spin" size={16} />
                  ) : (
                    <Upload size={16} />
                  )}
                  {uploading ? "Uploading…" : "Import questions"}
                </button>

                {result && (
                  <div className="mt-6 rounded-2xl border border-brand-green/30 bg-brand-green/5 p-5">
                    <div className="flex items-center gap-2 text-brand-green">
                      <CheckCircle2 size={18} />
                      <span className="text-sm font-bold">Import complete</span>
                    </div>
                    <div className="mt-2 grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
                      <StatPill label="Imported" value={result.imported} tone="green" />
                      <StatPill label="Skipped" value={result.skipped} tone="muted" />
                      <StatPill
                        label="Errors"
                        value={result.errors.length}
                        tone={result.errors.length ? "red" : "muted"}
                      />
                    </div>
                    {result.errors.length > 0 && (
                      <details className="mt-3 text-xs text-red-600">
                        <summary>Show errors ({result.errors.length})</summary>
                        <ul className="mt-2 list-disc pl-5">
                          {result.errors.slice(0, 20).map((err, i) => (
                            <li key={i}>{err}</li>
                          ))}
                          {result.errors.length > 20 && (
                            <li>…and {result.errors.length - 20} more.</li>
                          )}
                        </ul>
                      </details>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>
      </main>
    </>
  );
}

function StatPill({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "green" | "muted" | "red";
}) {
  const color =
    tone === "green"
      ? "text-brand-green"
      : tone === "red"
        ? "text-red-600"
        : "text-[var(--text-muted)]";
  return (
    <div className="rounded-xl bg-white/60 p-3">
      <div className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)]">
        {label}
      </div>
      <div className={`font-display text-2xl ${color}`}>{value}</div>
    </div>
  );
}
