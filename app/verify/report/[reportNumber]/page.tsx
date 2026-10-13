import { ReportCardStatus } from "@prisma/client";
import Link from "next/link";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { prisma } from "@/lib/prisma";
import { BadgeCheck, ShieldAlert, ShieldCheck } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function VerifyReportPage({
  params,
}: {
  params: Promise<{ reportNumber: string }>;
}) {
  const { reportNumber } = await params;
  const decoded = decodeURIComponent(reportNumber);

  const report = await prisma.reportCard.findFirst({
    where: { reportNumber: decoded, status: ReportCardStatus.RELEASED },
    select: {
      reportNumber: true,
      sessionLabel: true,
      termLabel: true,
      classNameSnapshot: true,
      overallAverage: true,
      overallGrade: true,
      classPosition: true,
      releasedAt: true,
      studentProfile: { select: { displayName: true, studentId: true } },
    },
  });

  return (
    <>
      <Header />
      <main className="min-h-screen bg-[var(--bg-primary)] theme-transition">
        <section className="bg-brand-navy px-6 pt-28 pb-14">
          <div className="mx-auto max-w-3xl text-center">
            <span className="mb-4 inline-flex items-center gap-1.5 rounded-full border border-brand-green/40 bg-brand-green/20 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-brand-green">
              <ShieldCheck size={11} /> Document Verification
            </span>
            <h1 className="font-display text-4xl tracking-widest text-white md:text-6xl">
              REPORT <span className="text-brand-green">VERIFICATION</span>
            </h1>
          </div>
        </section>

        <section className="px-6 py-14">
          <div className="mx-auto max-w-2xl">
            {report ? (
              <div className="rounded-[2rem] border border-brand-green/30 bg-[var(--surface-card)] p-10 text-center shadow-[var(--card-shadow)]">
                <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-brand-green text-brand-navy">
                  <BadgeCheck size={40} />
                </div>
                <h2 className="font-display text-3xl text-[var(--text-accent)]">
                  AUTHENTIC DOCUMENT
                </h2>
                <p className="mt-2 text-sm text-[var(--text-secondary)]">
                  This report card was officially issued and released by Ykay College &amp;
                  Leadership Academy.
                </p>
                <div className="mt-8 space-y-3 rounded-2xl bg-[var(--surface-disabled)] p-6 text-left text-sm">
                  {[
                    ["Report Number", report.reportNumber],
                    [
                      "Student",
                      `${report.studentProfile.displayName} (${report.studentProfile.studentId})`,
                    ],
                    ["Class", report.classNameSnapshot],
                    ["Session · Term", `${report.sessionLabel} · ${report.termLabel}`],
                    [
                      "Overall",
                      `${report.overallAverage}% · ${report.overallGrade}${report.classPosition ? ` · ${report.classPosition}` : ""}`,
                    ],
                    [
                      "Released",
                      report.releasedAt ? new Date(report.releasedAt).toLocaleDateString() : "—",
                    ],
                  ].map(([label, value]) => (
                    <div key={label} className="flex items-start justify-between gap-6">
                      <span className="shrink-0 text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)]">
                        {label}
                      </span>
                      <span className="text-right font-medium text-[var(--text-primary)]">
                        {value}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="rounded-[2rem] border border-red-500/30 bg-[var(--surface-card)] p-10 text-center shadow-[var(--card-shadow)]">
                <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-red-500 text-white">
                  <ShieldAlert size={40} />
                </div>
                <h2 className="font-display text-3xl text-red-500">NOT VERIFIED</h2>
                <p className="mx-auto mt-2 max-w-md text-sm text-[var(--text-secondary)]">
                  No released report card matches the reference{" "}
                  <span className="font-bold text-[var(--text-primary)]">{decoded}</span>. The
                  document may be a draft, may have been withdrawn, or the reference may be
                  incorrect.
                </p>
                <Link
                  href="/contact"
                  className="mt-6 inline-flex items-center gap-2 rounded-full bg-brand-orange px-6 py-3 text-xs font-bold uppercase tracking-widest text-brand-navy hover:bg-brand-orange-dark"
                >
                  Contact the School
                </Link>
              </div>
            )}
            <p className="mt-6 text-center text-xs text-[var(--text-muted)]">
              Verification reference: scan the QR code on any released Ykay College report card, or
              enter the report number in the URL: /verify/report/&lt;report-number&gt;
            </p>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
