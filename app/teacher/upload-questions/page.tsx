"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import PortalTopbar from "@/components/PortalTopbar";
import TeacherSidebar from "@/components/TeacherSidebar";
import { useApi } from "@/lib/useApi";
import { useToast } from "@/components/Toast";
import {
  Upload,
  FileText,
  FileSpreadsheet,
  File,
  Download,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  LoaderCircle,
  Eye,
  ChevronDown,
  ChevronUp,
  Database,
  Info,
  X,
} from "lucide-react";
import readXlsxFile from "read-excel-file/browser";
import {
  importQuestionsFromDocx,
  importQuestionsFromText,
  type ImportResult,
} from "@/lib/question-import";

type QuestionType = "MCQ" | "TRUE_FALSE" | "FILL_BLANK" | "ESSAY";
type FileFormat = "docx" | "txt" | "xlsx";

/**
 * One place that maps a filename to a format.
 *
 * The drag-and-drop handler used to compute this inline and forgot .docx, so
 * a Word file dropped on the page was parsed as a spreadsheet and failed with
 * "Could not read this Excel file". The picker path had it right. Two copies
 * of the same decision is what let them disagree.
 */
function formatForFilename(name: string): FileFormat | null {
  const ext = name.split(".").pop()?.toLowerCase();
  if (ext === "xlsx" || ext === "xls") return "xlsx";
  if (ext === "docx") return "docx";
  if (ext === "txt" || ext === "text" || ext === "md") return "txt";
  // CSV and JSON were dropped deliberately. No teacher authors a question
  // paper in either; they existed because they were easy to parse, not
  // because anyone asked. Four tabs of near-identical choices was the real
  // cost — the format is detected from the file anyway.
  return null;
}

interface ParsedQuestion {
  type: QuestionType;
  questionText: string;
  options: { key: string; text: string }[] | null;
  correctKey: string | null;
  correctText: string | null;
  marks: number;
  explanation?: string;
  topic?: string;
  difficulty?: string;
}

interface ParseResult {
  questions: ParsedQuestion[];
  errors: { row: number; message: string }[];
  warnings: { row: number; message: string }[];
  stats: {
    total: number;
    valid: number;
    mcq: number;
    trueFalse: number;
    fillBlank: number;
    essay: number;
  };
}

const TYPE_COLORS: Record<QuestionType, string> = {
  MCQ: "bg-blue-500/10 text-blue-500 border-blue-500/30",
  TRUE_FALSE: "bg-purple-500/10 text-purple-500 border-purple-500/30",
  FILL_BLANK: "bg-orange-500/10 text-orange-500 border-orange-500/30",
  ESSAY: "bg-pink-500/10 text-pink-500 border-pink-500/30",
};

export default function UploadQuestionsPage() {
  const { toast } = useToast();

  // Exam selection
  const { data: examData, refetch: refetchExams } = useApi<any>("/api/teacher/exams");
  const [selectedExamId, setSelectedExamId] = useState("");

  /**
   * Preselect the exam when arriving from the Exam Centre.
   *
   * The Exam Centre links here as `?examId=...`, and this page ignored the
   * parameter entirely — a teacher who clicked "Questions" on a specific paper
   * landed on "Choose an exam..." and had to find it again in the dropdown.
   * Read from window.location rather than useSearchParams so the page does not
   * need a Suspense boundary for a single optional query value.
   */
  useEffect(() => {
    if (typeof window === "undefined") return;
    const fromUrl = new URLSearchParams(window.location.search).get("examId");
    if (fromUrl) setSelectedExamId(fromUrl);
  }, []);

  // File upload state
  const [file, setFile] = useState<File | null>(null);
  const [fileFormat, setFileFormat] = useState<FileFormat>("docx");
  const [dragging, setDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Parse result
  const [parseResult, setParseResult] = useState<ParseResult | null>(null);
  const [parsing, setParsing] = useState(false);

  // Sync state
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<{
    ok: boolean;
    message: string;
    created?: number;
    totalQuestions?: number;
    totalMarks?: number;
  } | null>(null);

  // Preview toggle
  const [previewOpen, setPreviewOpen] = useState(true);

  // ── File parsing ────────────────────────────────────────────
  const parseFile = useCallback(
    async (f: File, format: FileFormat) => {
      setParsing(true);
      setParseResult(null);
      setSyncResult(null);

      try {
        let result: ParseResult;

        if (format === "docx") {
          const buffer = await f.arrayBuffer();
          result = importedToParseResult(() => importQuestionsFromDocx(new Uint8Array(buffer)));
        } else if (format === "txt") {
          const text = await f.text();
          result = importedToParseResult(() => importQuestionsFromText(text));
        } else {
          const buffer = await f.arrayBuffer();
          result = await parseXLSXContent(buffer);
        }

        setParseResult(result);
        if (result.errors.length > 0) {
          toast(`${result.errors.length} error(s) found. Fix and re-upload.`, "error");
        } else if (result.warnings.length > 0) {
          toast(
            `${result.questions.length} questions parsed with ${result.warnings.length} warning(s).`,
            "success",
          );
        } else {
          toast(`${result.questions.length} questions parsed successfully!`, "success");
        }
      } catch (_err) {
        toast("Failed to parse file. Check the format.", "error");
      } finally {
        setParsing(false);
      }
    },
    [toast],
  );

  // ── XLSX parser (read-excel-file — replaces vulnerable SheetJS) ──
  async function parseXLSXContent(buffer: ArrayBuffer): Promise<ParseResult> {
    const emptyStats = { total: 0, valid: 0, mcq: 0, trueFalse: 0, fillBlank: 0, essay: 0 };
    try {
      const sheets = await readXlsxFile(buffer);
      const data = sheets[0]?.data ?? [];
      if (!data.length) {
        return {
          questions: [],
          errors: [{ row: 0, message: "No sheet found." }],
          warnings: [],
          stats: emptyStats,
        };
      }
      const headers = (data[0] ?? []).map((h) => String(h ?? ""));
      const dataRows: Record<string, string>[] = [];
      for (let i = 1; i < data.length; i += 1) {
        const row = data[i] ?? [];
        const obj: Record<string, string> = {};
        headers.forEach((h, idx) => {
          if (h) {
            obj[
              h
                .trim()
                .toLowerCase()
                .replace(/[^a-z0-9]/g, "_")
            ] = String(row[idx] ?? "");
          }
        });
        dataRows.push(obj);
      }
      return validateRows(dataRows, []);
    } catch {
      return {
        questions: [],
        errors: [{ row: 0, message: "Could not read this Excel file." }],
        warnings: [],
        stats: emptyStats,
      };
    }
  }

  /**
   * Bridge the shared importer's result into this page's ParseResult shape.
   *
   * The .docx/.txt reading now lives in lib/question-import.ts so it can be
   * unit-tested against real OOXML under Node — this page's original version
   * used DOMParser and could only ever run in a browser, which is why it was
   * never covered by a test.
   */
  function importedToParseResult(run: () => ImportResult): ParseResult {
    const emptyStats = { total: 0, valid: 0, mcq: 0, trueFalse: 0, fillBlank: 0, essay: 0 };
    let imported: ImportResult;
    try {
      imported = run();
    } catch (importError) {
      return {
        questions: [],
        errors: [
          {
            row: 0,
            message:
              importError instanceof Error ? importError.message : "Could not read that file.",
          },
        ],
        warnings: [],
        stats: emptyStats,
      };
    }

    const questions: ParsedQuestion[] = imported.questions.map((q) => ({
      type: q.type as QuestionType,
      questionText: q.questionText,
      options: q.options,
      correctKey: q.correctKey,
      correctText: q.correctText,
      marks: q.marks,
      topic: undefined,
      difficulty: undefined,
      explanation: undefined,
    }));

    return {
      questions,
      errors: imported.errors.map((message) => ({ row: 0, message })),
      warnings: imported.warnings.map((message) => ({ row: 0, message })),
      stats: {
        total: questions.length,
        valid: questions.length,
        mcq: questions.filter((q) => q.type === "MCQ").length,
        trueFalse: questions.filter((q) => q.type === "TRUE_FALSE").length,
        fillBlank: questions.filter((q) => q.type === "FILL_BLANK").length,
        essay: questions.filter((q) => q.type === "ESSAY").length,
      },
    };
  }

  function validateRows(
    rows: Record<string, string>[],
    csvErrors: { row: number; message: string }[],
  ): ParseResult {
    const questions: ParsedQuestion[] = [];
    const errors: { row: number; message: string }[] = [...csvErrors];
    const warnings: { row: number; message: string }[] = [];

    rows.forEach((row, idx) => {
      const rowNum = idx + 2;
      const type = (row.type || "").trim().toUpperCase().replace(/[\s-]/g, "_");
      const questionText = (row.question || row.question_text || "").trim();
      const optA = (row.option_a || row.optiona || row.a || "").trim();
      const optB = (row.option_b || row.optionb || row.b || "").trim();
      const optC = (row.option_c || row.optionc || row.c || "").trim();
      const optD = (row.option_d || row.optiond || row.d || "").trim();
      const correct = (row.correct || row.correct_answer || row.answer || "").trim();
      const marks = Math.max(1, Math.min(20, parseInt(row.marks || "1", 10) || 1));
      const topic = (row.topic || "").trim();
      const difficulty = (row.difficulty || "").trim();
      const explanation = (row.explanation || "").trim();

      if (!type && !questionText) return;
      if (!["MCQ", "TRUE_FALSE", "FILL_BLANK", "ESSAY"].includes(type)) {
        errors.push({ row: rowNum, message: `Invalid type "${type}".` });
        return;
      }
      if (!questionText) {
        errors.push({ row: rowNum, message: "Question text required." });
        return;
      }

      switch (type as QuestionType) {
        case "MCQ": {
          const opts = [
            { key: "A", text: optA },
            { key: "B", text: optB },
            { key: "C", text: optC },
            { key: "D", text: optD },
          ].filter((o) => o.text);
          if (opts.length < 2) {
            errors.push({ row: rowNum, message: "MCQ needs at least 2 options." });
            return;
          }
          const ck = correct.toUpperCase();
          if (!["A", "B", "C", "D"].includes(ck) || !opts.some((o) => o.key === ck)) {
            errors.push({ row: rowNum, message: `Correct "${correct}" doesn't match options.` });
            return;
          }
          if (opts.length < 4)
            warnings.push({ row: rowNum, message: `Only ${opts.length}/4 options.` });
          questions.push({
            type: "MCQ",
            questionText,
            options: opts,
            correctKey: ck,
            correctText: null,
            marks,
            explanation: explanation || undefined,
            topic: topic || undefined,
            difficulty: difficulty || undefined,
          });
          break;
        }
        case "TRUE_FALSE": {
          const ck = correct.toUpperCase();
          if (ck !== "TRUE" && ck !== "FALSE") {
            errors.push({ row: rowNum, message: `Must be TRUE or FALSE.` });
            return;
          }
          questions.push({
            type: "TRUE_FALSE",
            questionText,
            options: [
              { key: "TRUE", text: "True" },
              { key: "FALSE", text: "False" },
            ],
            correctKey: ck,
            correctText: null,
            marks,
            explanation: explanation || undefined,
          });
          break;
        }
        case "FILL_BLANK": {
          if (!correct) {
            errors.push({ row: rowNum, message: "Fill blank answer required." });
            return;
          }
          if (!questionText.includes("___"))
            warnings.push({ row: rowNum, message: 'Add "______" placeholder.' });
          questions.push({
            type: "FILL_BLANK",
            questionText,
            options: null,
            correctKey: null,
            correctText: correct,
            marks,
            explanation: explanation || undefined,
          });
          break;
        }
        case "ESSAY":
          questions.push({
            type: "ESSAY",
            questionText,
            options: null,
            correctKey: null,
            correctText: null,
            marks: Math.max(marks, 5),
            explanation: explanation || undefined,
          });
          break;
      }
    });

    return {
      questions,
      errors,
      warnings,
      stats: {
        total: rows.filter((r) => r.type || r.question).length,
        valid: questions.length,
        mcq: questions.filter((q) => q.type === "MCQ").length,
        trueFalse: questions.filter((q) => q.type === "TRUE_FALSE").length,
        fillBlank: questions.filter((q) => q.type === "FILL_BLANK").length,
        essay: questions.filter((q) => q.type === "ESSAY").length,
      },
    };
  }

  // ── Sync to database ────────────────────────────────────────
  async function syncToDatabase() {
    if (!parseResult || parseResult.questions.length === 0 || !selectedExamId) return;
    setSyncing(true);
    setSyncResult(null);

    try {
      const r = await fetch("/api/teacher/questions/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          examId: selectedExamId,
          questions: parseResult.questions,
        }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "Sync failed.");
      setSyncResult({
        ok: true,
        message: j.message,
        created: j.created,
        totalQuestions: j.totalQuestions,
        totalMarks: j.totalMarks,
      });
      toast(j.message, "success");
      refetchExams();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Sync failed.";
      setSyncResult({ ok: false, message: msg });
      toast(msg, "error");
    } finally {
      setSyncing(false);
    }
  }

  // ── Template downloads ──────────────────────────────────────
  /**
   * A .txt template written the way a teacher writes a paper.
   *
   * The old "Word template" button downloaded a CSV, which is not a Word file
   * and not the shape a teacher would ever type. This is the prose format the
   * importer now reads, so a teacher can open it, replace the text, and save
   * as .docx or .txt.
   */
  const PROSE_TEMPLATE = [
    "1. What is the capital of Nigeria?",
    "A) Lagos",
    "B) Abuja",
    "C) Kano",
    "D) Port Harcourt",
    "Answer: B",
    "Marks: 2",
    "",
    "2. Water boils at 100 degrees Celsius at sea level.",
    "Answer: TRUE",
    "",
    "3. Photosynthesis occurs in the ______.",
    "FILL: chloroplast",
    "Marks: 2",
    "",
    "4. Explain the water cycle.",
    "ESSAY",
    "Marks: 10",
    "",
    "-- Notes ------------------------------------------------------",
    "Options may be written A) A. A: or (A), up to E.",
    "The answer line may be Answer:, Correct: or Ans:, and may give",
    "either the letter or the full option text.",
    "Marks: defaults to 1 if you leave it out.",
    "Leave a blank line between questions, or just start the next",
    "number -- both work.",
    "",
    "If you type this in Word, turn OFF automatic numbering",
    "(Home -> Numbering), because Word stores those numbers outside",
    "the text and they will not reach us.",
  ].join("\r\n");

  function downloadTemplate(format: FileFormat) {
    if (format === "txt" || format === "docx") {
      // Same content for both: .docx is authored by opening this in Word.
      downloadBlob(
        new Blob([PROSE_TEMPLATE], { type: "text/plain;charset=utf-8" }),
        "ykay-question-template.txt",
      );
      return;
    }
    {
      // A CSV the spreadsheet apps open natively. read-excel-file can read
      // .xlsx but cannot write one, so the Excel template is delivered as CSV
      // — Excel opens it without complaint and saves back as .xlsx.
      const templateRows = [
        [
          "type",
          "question",
          "option_a",
          "option_b",
          "option_c",
          "option_d",
          "correct",
          "marks",
          "topic",
          "difficulty",
          "explanation",
        ],
        [
          "MCQ",
          "What is the capital of Nigeria?",
          "Lagos",
          "Abuja",
          "Kano",
          "Port Harcourt",
          "B",
          "2",
          "Geography",
          "Easy",
          "Abuja became the capital in 1991",
        ],
        [
          "TRUE_FALSE",
          "Water boils at 100°C at sea level",
          "",
          "",
          "",
          "",
          "TRUE",
          "1",
          "Science",
          "Easy",
          "",
        ],
        [
          "FILL_BLANK",
          "Photosynthesis occurs in the ______",
          "",
          "",
          "",
          "",
          "chloroplast",
          "2",
          "Biology",
          "Medium",
          "",
        ],
        ["ESSAY", "Explain the water cycle", "", "", "", "", "", "10", "Science", "Hard", ""],
      ];
      const csv = templateRows
        .map((r) => r.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
        .join("\n");
      downloadBlob(
        new Blob([csv], { type: "text/csv;charset=utf-8" }),
        "ykay-question-template.csv",
      );
    }
  }

  function downloadBlob(blob: Blob, filename: string) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  // ── File handlers ───────────────────────────────────────────
  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files[0];
    if (!f) return;
    const detected = formatForFilename(f.name);
    if (!detected) {
      if (/\.doc$/i.test(f.name)) {
        toast(
          "Legacy .doc is not supported. Open it in Word and use File \u2192 Save As \u2192 Word Document (.docx).",
          "error",
        );
      } else {
        toast("Unsupported file type. Use .docx, .txt, .csv, .xlsx or .json.", "error");
      }
      return;
    }
    setFile(f);
    setFileFormat(detected);
    // Parse with the DETECTED format, not a guess: dropping a .docx used to
    // be handed to the Excel reader.
    void parseFile(f, detected);
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    // Trust the file over the selected tab: picking a .docx while the CSV tab
    // happens to be active must still read it as Word.
    const detected = formatForFilename(f.name) ?? fileFormat;
    if (detected !== fileFormat) setFileFormat(detected);
    void parseFile(f, detected);
  }

  function resetAll() {
    setFile(null);
    setParseResult(null);
    setSyncResult(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  const selectedExam = examData?.exams?.find((e: any) => e.id === selectedExamId);

  return (
    <>
      <PortalTopbar title="Upload Questions" />
      <main className="mx-auto flex max-w-[1600px] gap-8 px-4 py-6 sm:px-6">
        <TeacherSidebar />
        <section className="min-w-0 flex-1 space-y-6">
          {/* Header */}
          <div className="rounded-[2rem] bg-brand-navy p-7 text-white">
            <p className="text-xs font-bold uppercase tracking-widest text-brand-green">
              Exam Management
            </p>
            <h1 className="mt-2 font-display text-4xl tracking-widest">
              UPLOAD <span className="text-brand-green">QUESTIONS</span>
            </h1>
            <p className="mt-3 max-w-2xl text-sm text-white/65">
              Upload questions in CSV, JSON, or Excel format. Supports MCQ, True/False,
              Fill-in-the-Blank, and Essay questions. Preview and validate before syncing to the
              exam.
            </p>
          </div>

          {/* Step 1: Select exam */}
          <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-card)] p-6">
            <h2 className="mb-4 flex items-center gap-2 text-sm font-bold uppercase tracking-widest text-[var(--text-muted)]">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-brand-green text-xs text-brand-navy">
                1
              </span>
              Select Exam
            </h2>
            <select
              value={selectedExamId}
              onChange={(e) => setSelectedExamId(e.target.value)}
              className="w-full max-w-lg rounded-xl border border-[var(--input-border)] bg-[var(--input-bg)] p-3 text-sm"
            >
              <option value="">Choose an exam...</option>
              {(examData?.exams || []).map((e: any) => (
                <option key={e.id} value={e.id}>
                  {e.title} — {e.className} ({e.questionCount} questions, {e.totalMarks} marks)
                </option>
              ))}
            </select>
            {selectedExam && (
              <div className="mt-3 flex items-center gap-3 rounded-xl bg-brand-green/5 border border-brand-green/20 p-3 text-sm">
                <Info size={14} className="text-brand-green" />
                <span>
                  <b>{selectedExam.title}</b> currently has <b>{selectedExam.questionCount}</b>{" "}
                  questions ({selectedExam.totalMarks} marks).
                </span>
              </div>
            )}
          </div>

          {/* Step 2: Download template */}
          <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-card)] p-6">
            <h2 className="mb-4 flex items-center gap-2 text-sm font-bold uppercase tracking-widest text-[var(--text-muted)]">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-brand-green text-xs text-brand-navy">
                2
              </span>
              Download Template
            </h2>
            <div className="grid gap-3 sm:grid-cols-3">
              {(["docx", "txt", "xlsx"] as FileFormat[]).map((fmt) => (
                <button
                  key={fmt}
                  onClick={() => downloadTemplate(fmt)}
                  className="flex items-center gap-3 rounded-xl border border-[var(--border-subtle)] p-4 text-left transition hover:border-brand-green hover:bg-brand-green/5"
                >
                  {fmt === "docx" ? (
                    <FileText size={20} className="text-blue-500" />
                  ) : fmt === "txt" ? (
                    <File size={20} className="text-brand-orange" />
                  ) : (
                    <FileSpreadsheet size={20} className="text-brand-green" />
                  )}
                  <div>
                    <div className="text-sm font-bold">
                      {fmt === "docx" ? "Word" : fmt === "txt" ? "Text" : "Excel"} template
                    </div>
                    <div className="text-[11px] text-[var(--text-muted)]">
                      {fmt === "docx"
                        ? "Type your paper as normal"
                        : fmt === "txt"
                          ? "Plain text, same layout"
                          : "Spreadsheet columns"}
                    </div>
                  </div>
                  <Download size={14} className="ml-auto text-[var(--text-muted)]" />
                </button>
              ))}
            </div>
          </div>

          {/* Step 3: Upload file */}
          <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-card)] p-6">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-widest text-[var(--text-muted)]">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-brand-green text-xs text-brand-navy">
                  3
                </span>
                Upload & Parse
              </h2>
              {file && (
                <button
                  onClick={resetAll}
                  className="flex items-center gap-1.5 rounded-full bg-red-500/10 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-red-500 hover:bg-red-500/20"
                >
                  <X size={12} /> Clear
                </button>
              )}
            </div>

            {/* Format selector */}
            <div className="mb-4 flex gap-2">
              {(["docx", "txt", "xlsx"] as FileFormat[]).map((fmt) => (
                <button
                  key={fmt}
                  onClick={() => setFileFormat(fmt)}
                  className={`rounded-full px-4 py-2 text-xs font-bold uppercase tracking-wider transition ${
                    fileFormat === fmt
                      ? "bg-brand-green text-white"
                      : "bg-[var(--surface-disabled)] text-[var(--text-secondary)]"
                  }`}
                >
                  {fmt.toUpperCase()}
                </button>
              ))}
            </div>

            {/* Drop zone */}
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`cursor-pointer rounded-2xl border-2 border-dashed p-10 text-center transition ${
                dragging
                  ? "border-brand-green bg-brand-green/5"
                  : "border-[var(--border-subtle)] hover:border-brand-green/50"
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                // Always allow every supported type: the format is detected
                // from the filename anyway, and a teacher whose Word file was
                // greyed out because the CSV tab was selected would conclude
                // Word upload does not work.
                accept=".docx,.txt,.xlsx,.xls"
                onChange={handleFileChange}
                className="hidden"
              />
              {parsing ? (
                <div className="flex flex-col items-center gap-3">
                  <LoaderCircle className="animate-spin text-brand-green" size={32} />
                  <p className="text-sm text-[var(--text-muted)]">Parsing {file?.name}...</p>
                </div>
              ) : file ? (
                <div className="flex flex-col items-center gap-2">
                  <FileText size={32} className="text-brand-green" />
                  <p className="font-bold text-[var(--text-primary)]">{file.name}</p>
                  <p className="text-xs text-[var(--text-muted)]">
                    {(file.size / 1024).toFixed(1)} KB · {fileFormat.toUpperCase()}
                  </p>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-3">
                  <Upload size={32} className="text-[var(--text-muted)]" />
                  <p className="text-sm font-bold text-[var(--text-primary)]">
                    Drop your {fileFormat.toUpperCase()} file here
                  </p>
                  <p className="text-xs text-[var(--text-muted)]">or click to browse</p>
                </div>
              )}
            </div>
          </div>

          {/* Parse results */}
          {parseResult && (
            <div className="space-y-4">
              {/* Stats */}
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
                <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-card)] p-4 text-center">
                  <div className="text-2xl font-bold text-[var(--text-accent)]">
                    {parseResult.stats.valid}
                  </div>
                  <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
                    Valid
                  </div>
                </div>
                <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-card)] p-4 text-center">
                  <div className="text-2xl font-bold text-blue-500">{parseResult.stats.mcq}</div>
                  <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
                    MCQ
                  </div>
                </div>
                <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-card)] p-4 text-center">
                  <div className="text-2xl font-bold text-purple-500">
                    {parseResult.stats.trueFalse}
                  </div>
                  <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
                    True/False
                  </div>
                </div>
                <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-card)] p-4 text-center">
                  <div className="text-2xl font-bold text-orange-500">
                    {parseResult.stats.fillBlank}
                  </div>
                  <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
                    Fill Blank
                  </div>
                </div>
                <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-card)] p-4 text-center">
                  <div className="text-2xl font-bold text-pink-500">{parseResult.stats.essay}</div>
                  <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
                    Essay
                  </div>
                </div>
                <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-card)] p-4 text-center">
                  <div className="text-2xl font-bold text-red-500">{parseResult.errors.length}</div>
                  <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
                    Errors
                  </div>
                </div>
              </div>

              {/* Errors */}
              {parseResult.errors.length > 0 && (
                <div className="rounded-2xl border border-red-500/30 bg-red-500/5 p-4">
                  <h3 className="mb-2 flex items-center gap-2 text-sm font-bold text-red-500">
                    <AlertCircle size={16} /> {parseResult.errors.length} Error(s) — Fix and
                    re-upload
                  </h3>
                  <div className="max-h-40 space-y-1 overflow-y-auto">
                    {parseResult.errors.map((err, i) => (
                      <div key={i} className="text-xs text-red-400">
                        <span className="font-bold">Row {err.row}:</span> {err.message}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Warnings */}
              {parseResult.warnings.length > 0 && (
                <div className="rounded-2xl border border-yellow-500/30 bg-yellow-500/5 p-4">
                  <h3 className="mb-2 flex items-center gap-2 text-sm font-bold text-yellow-500">
                    <AlertTriangle size={16} /> {parseResult.warnings.length} Warning(s)
                  </h3>
                  <div className="max-h-32 space-y-1 overflow-y-auto">
                    {parseResult.warnings.map((w, i) => (
                      <div key={i} className="text-xs text-yellow-400">
                        <span className="font-bold">Row {w.row}:</span> {w.message}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Question preview */}
              {parseResult.questions.length > 0 && (
                <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-card)] p-6">
                  <button
                    onClick={() => setPreviewOpen(!previewOpen)}
                    className="mb-4 flex w-full items-center justify-between"
                  >
                    <h3 className="flex items-center gap-2 text-sm font-bold uppercase tracking-widest text-[var(--text-muted)]">
                      <Eye size={14} /> Question Preview ({parseResult.questions.length})
                    </h3>
                    {previewOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                  </button>

                  {previewOpen && (
                    <div className="max-h-[500px] space-y-3 overflow-y-auto pr-2">
                      {parseResult.questions.map((q, idx) => (
                        <div
                          key={idx}
                          className="rounded-xl border border-[var(--border-subtle)] p-4"
                        >
                          <div className="mb-2 flex items-center gap-2">
                            <span className="text-xs font-bold text-[var(--text-muted)]">
                              Q{idx + 1}
                            </span>
                            <span
                              className={`rounded-full border px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider ${TYPE_COLORS[q.type]}`}
                            >
                              {q.type.replace("_", "/")}
                            </span>
                            <span className="ml-auto text-[10px] font-bold text-brand-green">
                              {q.marks} mark{q.marks > 1 ? "s" : ""}
                            </span>
                            {q.topic && (
                              <span className="text-[10px] text-[var(--text-muted)]">
                                {q.topic}
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-[var(--text-primary)]">{q.questionText}</p>
                          {q.options && (
                            <div className="mt-2 space-y-1">
                              {q.options.map((opt) => (
                                <div
                                  key={opt.key}
                                  className={`flex items-center gap-2 rounded-lg p-2 text-xs ${
                                    opt.key === q.correctKey
                                      ? "bg-brand-green/10 text-brand-green font-bold"
                                      : "text-[var(--text-secondary)]"
                                  }`}
                                >
                                  <span className="font-bold">{opt.key}.</span> {opt.text}
                                  {opt.key === q.correctKey && (
                                    <CheckCircle2 size={12} className="ml-auto" />
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                          {q.correctText && (
                            <div className="mt-2 rounded-lg bg-brand-green/10 p-2 text-xs font-bold text-brand-green">
                              Answer: {q.correctText}
                            </div>
                          )}
                          {q.explanation && (
                            <div className="mt-2 text-[11px] text-[var(--text-muted)]">
                              <b>Explanation:</b> {q.explanation}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Sync button */}
              {parseResult.questions.length > 0 &&
                parseResult.errors.length === 0 &&
                selectedExamId && (
                  <div className="flex items-center justify-between rounded-2xl border border-brand-green/30 bg-brand-green/5 p-6">
                    <div>
                      <h3 className="font-bold text-[var(--text-primary)]">
                        Ready to sync {parseResult.questions.length} questions
                      </h3>
                      <p className="mt-1 text-sm text-[var(--text-muted)]">
                        Questions will be added to <b>{selectedExam?.title}</b> in a single atomic
                        transaction.
                        {selectedExam && ` Current total: ${selectedExam.questionCount} questions.`}
                      </p>
                    </div>
                    <button
                      onClick={() => void syncToDatabase()}
                      disabled={syncing}
                      className="flex items-center gap-2 rounded-full bg-brand-green px-6 py-3 text-sm font-bold text-brand-navy shadow-lg shadow-brand-green/20 transition hover:bg-brand-green/90 disabled:opacity-50"
                    >
                      {syncing ? (
                        <LoaderCircle className="animate-spin" size={16} />
                      ) : (
                        <Database size={16} />
                      )}
                      {syncing ? "Syncing..." : "Sync to Database"}
                    </button>
                  </div>
                )}

              {!selectedExamId && parseResult.questions.length > 0 && (
                <div className="flex items-center gap-2 rounded-xl bg-yellow-500/10 border border-yellow-500/20 p-4 text-sm text-yellow-600">
                  <AlertTriangle size={16} /> Select an exam above to sync these questions.
                </div>
              )}

              {/* Sync result */}
              {syncResult && (
                <div
                  className={`rounded-2xl border p-6 ${syncResult.ok ? "border-brand-green/30 bg-brand-green/5" : "border-red-500/30 bg-red-500/5"}`}
                >
                  <div className="flex items-center gap-3">
                    {syncResult.ok ? (
                      <CheckCircle2 size={24} className="text-brand-green" />
                    ) : (
                      <AlertCircle size={24} className="text-red-500" />
                    )}
                    <div>
                      <h3
                        className={`font-bold ${syncResult.ok ? "text-brand-green" : "text-red-500"}`}
                      >
                        {syncResult.message}
                      </h3>
                      {syncResult.ok && (
                        <p className="mt-1 text-sm text-[var(--text-muted)]">
                          {syncResult.created} new questions · {syncResult.totalQuestions} total ·{" "}
                          {syncResult.totalMarks} total marks
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </section>
      </main>
    </>
  );
}
