"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Download, IdCard, LoaderCircle, Printer, Search } from "lucide-react";
import AdminSidebar from "@/components/AdminSidebar";
import PortalTopbar from "@/components/PortalTopbar";
import { useToast } from "@/components/Toast";
import QrImage from "@/components/QrImage";

type Student = {
  id: string;
  studentId: string;
  displayName: string;
  className: string;
  gender: string | null;
};

/**
 * Production ID card sheet: live student list + printable QR (otpauth-free URL payload).
 * PDF export uses browser print / jspdf when available.
 */
export default function AdminIDCardsPage() {
  const { toast } = useToast();
  const [students, setStudents] = useState<Student[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const printRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch("/api/admin/students", { cache: "no-store" });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "Unable to load students.");
      setStudents(
        (j.students || []).map((s: Student & { currentClass?: { displayName: string } }) => ({
          id: s.id,
          studentId: s.studentId,
          displayName: s.displayName,
          className: s.className || s.currentClass?.displayName || "—",
          gender: s.gender,
        })),
      );
    } catch (e) {
      toast(e instanceof Error ? e.message : "Unable to load students.", "error");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return students.filter(
      (s) =>
        !q ||
        s.displayName.toLowerCase().includes(q) ||
        s.studentId.toLowerCase().includes(q) ||
        s.className.toLowerCase().includes(q),
    );
  }, [students, search]);

  const selectedStudents = students.filter((s) => selected.includes(s.id));

  function toggle(id: string) {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  function toggleAll() {
    if (selected.length === filtered.length) setSelected([]);
    else setSelected(filtered.map((s) => s.id));
  }

  function qrPayload(student: Student) {
    return JSON.stringify({
      v: 1,
      school: "YKAY",
      sid: student.studentId,
      n: student.displayName,
      c: student.className,
    });
  }

  async function exportPdf() {
    if (!selectedStudents.length) {
      toast("Select at least one student.", "error");
      return;
    }
    try {
      const { jsPDF } = await import("jspdf");
      const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
      const cardW = 86;
      const cardH = 54;
      let x = 10;
      let y = 10;
      let i = 0;
      for (const s of selectedStudents) {
        if (i > 0 && i % 8 === 0) {
          doc.addPage();
          x = 10;
          y = 10;
        } else if (i > 0 && i % 2 === 0) {
          x = 10;
          y += cardH + 8;
        } else if (i > 0) {
          x += cardW + 8;
        }
        doc.setFillColor(12, 24, 36);
        doc.roundedRect(x, y, cardW, cardH, 3, 3, "F");
        doc.setTextColor(78, 197, 77);
        doc.setFontSize(8);
        doc.text("YKAY COLLEGE", x + 4, y + 8);
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(12);
        doc.text(s.displayName.slice(0, 28), x + 4, y + 18);
        doc.setFontSize(9);
        doc.setTextColor(200, 200, 200);
        doc.text(s.studentId, x + 4, y + 26);
        doc.text(s.className, x + 4, y + 32);
        doc.setTextColor(78, 197, 77);
        doc.setFontSize(7);
        doc.text("Student Identity Card", x + 4, y + 48);
        i += 1;
      }
      doc.save(`ykay-id-cards-${Date.now()}.pdf`);
      toast("PDF downloaded. QR images are on the print sheet for scanning.", "success");
    } catch {
      toast("PDF export failed. Use Print instead.", "error");
    }
  }

  function printSheet() {
    window.print();
  }

  return (
    <>
      <PortalTopbar title="ID cards" />
      <main className="mx-auto flex max-w-[1600px] gap-8 px-4 py-6 sm:px-6 print:block">
        <div className="print:hidden">
          <AdminSidebar />
        </div>
        <section className="min-w-0 flex-1 space-y-6">
          <div className="rounded-[2rem] bg-brand-navy p-7 text-white print:hidden">
            <p className="text-xs font-bold uppercase tracking-widest text-brand-green">
              Operations
            </p>
            <h1 className="mt-2 font-display text-4xl tracking-widest">
              ID <span className="text-brand-green">CARDS</span>
            </h1>
            <p className="mt-3 text-sm text-white/65">
              Generate student identity cards from live records. Each card embeds a QR payload for
              gate verification.
            </p>
          </div>

          <div className="flex flex-col gap-3 print:hidden sm:flex-row sm:items-center sm:justify-between">
            <label className="relative flex-1">
              <Search className="absolute left-3 top-3 text-[var(--text-muted)]" size={16} />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full rounded-full border border-[var(--input-border)] bg-[var(--input-bg)] py-2.5 pl-9 pr-4 text-sm"
                placeholder="Search students"
              />
            </label>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={toggleAll}
                className="rounded-full border border-[var(--border-default)] px-4 py-2 text-xs font-bold uppercase tracking-widest"
              >
                {selected.length === filtered.length && filtered.length ? "Clear" : "Select page"}
              </button>
              <button
                onClick={() => void exportPdf()}
                className="inline-flex items-center gap-2 rounded-full bg-brand-navy px-4 py-2 text-xs font-bold uppercase tracking-widest text-white"
              >
                <Download size={14} /> PDF
              </button>
              <button
                onClick={printSheet}
                className="inline-flex items-center gap-2 rounded-full bg-brand-green px-4 py-2 text-xs font-bold uppercase tracking-widest text-brand-navy"
              >
                <Printer size={14} /> Print
              </button>
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-2 print:hidden">
            <div className="max-h-[480px] overflow-auto rounded-3xl border border-[var(--border-subtle)] bg-[var(--surface-card)]">
              {loading ? (
                <div className="flex items-center justify-center gap-2 p-10 text-sm text-[var(--text-muted)]">
                  <LoaderCircle className="animate-spin" /> Loading…
                </div>
              ) : (
                filtered.map((s) => (
                  <label
                    key={s.id}
                    className="flex cursor-pointer items-center gap-3 border-b border-[var(--border-subtle)] p-4 text-sm hover:bg-[var(--surface-card-hover)]"
                  >
                    <input
                      type="checkbox"
                      checked={selected.includes(s.id)}
                      onChange={() => toggle(s.id)}
                    />
                    <div className="min-w-0 flex-1">
                      <b className="block truncate">{s.displayName}</b>
                      <span className="text-xs text-[var(--text-muted)]">
                        {s.studentId} · {s.className}
                      </span>
                    </div>
                    <IdCard size={16} className="text-[var(--text-accent)]" />
                  </label>
                ))
              )}
            </div>

            <div ref={printRef} className="grid gap-4 sm:grid-cols-2">
              {selectedStudents.map((s) => (
                <div
                  key={s.id}
                  className="relative overflow-hidden rounded-2xl border border-white/10 bg-brand-navy p-4 text-white shadow-lg"
                  style={{ minHeight: 180 }}
                >
                  <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-brand-green">
                    Ykay College
                  </div>
                  <div className="mt-3 font-display text-xl tracking-wide">{s.displayName}</div>
                  <div className="mt-1 font-mono text-xs text-white/70">{s.studentId}</div>
                  <div className="mt-1 text-xs text-white/60">{s.className}</div>
                  <QrImage
                    value={qrPayload(s)}
                    size={140}
                    alt={`QR ${s.studentId}`}
                    className="absolute bottom-3 right-3 h-16 w-16 rounded-md bg-white p-1"
                  />
                  <div className="mt-8 text-[9px] uppercase tracking-widest text-white/40">
                    Student identity card
                  </div>
                </div>
              ))}
              {!selectedStudents.length && (
                <p className="col-span-full rounded-2xl border border-dashed border-[var(--border-default)] p-10 text-center text-sm text-[var(--text-muted)]">
                  Select students to preview ID cards.
                </p>
              )}
            </div>
          </div>

          {/* Print-only sheet */}
          <div className="hidden print:grid print:grid-cols-2 print:gap-4">
            {selectedStudents.map((s) => (
              <div
                key={`print-${s.id}`}
                className="relative border border-black p-4"
                style={{ height: 200 }}
              >
                <div className="text-xs font-bold">YKAY COLLEGE & LEADERSHIP ACADEMY</div>
                <div className="mt-3 text-lg font-bold">{s.displayName}</div>
                <div className="font-mono text-sm">{s.studentId}</div>
                <div className="text-sm">{s.className}</div>
                <QrImage
                  value={qrPayload(s)}
                  size={140}
                  alt=""
                  className="absolute bottom-3 right-3 h-20 w-20"
                />
              </div>
            ))}
          </div>
        </section>
      </main>
    </>
  );
}
