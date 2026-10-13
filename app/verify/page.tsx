"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import Link from "next/link";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { FileText, Award, ArrowRight } from "lucide-react";

/**
 * /verify — the entry point for document verification.
 *
 * QR codes on report cards and IT certificates carry the full URL
 * (/verify/report/<n>, /verify/certificate/<n>), so scanners land directly on
 * a result. This page serves the human with a number and no QR: two forms,
 * one per document type. Previously the certificate verifier linked to bare
 * /verify/report, which 404'd.
 */
export default function VerifyEntryPage() {
  const router = useRouter();
  const [reportNumber, setReportNumber] = useState("");
  const [certificateNumber, setCertificateNumber] = useState("");

  const go = (kind: "report" | "certificate", value: string) => {
    const n = value.trim();
    if (!n) return;
    router.push(`/verify/${kind}/${encodeURIComponent(n)}`);
  };

  return (
    <>
      <Header />
      <main className="min-h-[70vh] bg-[var(--bg-page)] py-16">
        <section className="mx-auto w-full max-w-2xl px-6">
          <p className="text-center text-xs font-bold uppercase tracking-[0.22em] text-brand-green">
            Document verification
          </p>
          <h1 className="mt-3 text-center font-display text-4xl text-[var(--text-primary)]">
            Verify a document
          </h1>
          <p className="mx-auto mt-3 max-w-md text-center text-sm leading-6 text-[var(--text-secondary)]">
            Enter the number printed on the document (or scan its QR code with a phone camera) to
            confirm it was officially issued by Ykay College &amp; Leadership Academy.
          </p>

          <div className="mt-10 grid gap-5 sm:grid-cols-2">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                go("report", reportNumber);
              }}
              className="rounded-[2rem] border border-[var(--border-subtle)] bg-[var(--surface-card)] p-7 shadow-[var(--card-shadow)]"
            >
              <FileText size={26} className="text-brand-green" />
              <h2 className="mt-4 font-display text-xl text-[var(--text-primary)]">Report card</h2>
              <p className="mt-1 text-xs text-[var(--text-muted)]">Termly student report cards</p>
              <input
                value={reportNumber}
                onChange={(e) => setReportNumber(e.target.value)}
                placeholder="e.g. RC-2026-0001"
                aria-label="Report card number"
                className="mt-5 w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-page)] px-4 py-3 text-sm text-[var(--text-primary)] outline-none focus:border-brand-green"
              />
              <button
                type="submit"
                disabled={!reportNumber.trim()}
                className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-brand-green px-5 py-3 text-sm font-bold text-[#04140a] transition hover:opacity-90 disabled:opacity-40"
              >
                Verify report <ArrowRight size={15} />
              </button>
            </form>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                go("certificate", certificateNumber);
              }}
              className="rounded-[2rem] border border-[var(--border-subtle)] bg-[var(--surface-card)] p-7 shadow-[var(--card-shadow)]"
            >
              <Award size={26} className="text-brand-green" />
              <h2 className="mt-4 font-display text-xl text-[var(--text-primary)]">
                IT certificate
              </h2>
              <p className="mt-1 text-xs text-[var(--text-muted)]">
                IT Hub course completion certificates
              </p>
              <input
                value={certificateNumber}
                onChange={(e) => setCertificateNumber(e.target.value)}
                placeholder="e.g. YK-IT-2026-001"
                aria-label="IT certificate number"
                className="mt-5 w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-page)] px-4 py-3 text-sm text-[var(--text-primary)] outline-none focus:border-brand-green"
              />
              <button
                type="submit"
                disabled={!certificateNumber.trim()}
                className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-brand-green px-5 py-3 text-sm font-bold text-[#04140a] transition hover:opacity-90 disabled:opacity-40"
              >
                Verify certificate <ArrowRight size={15} />
              </button>
            </form>
          </div>

          <p className="mt-8 text-center text-xs text-[var(--text-muted)]">
            Received a document that fails verification?{" "}
            <Link href="/contact" className="text-brand-green hover:underline">
              Contact the school office
            </Link>
            .
          </p>
        </section>
      </main>
      <Footer />
    </>
  );
}
