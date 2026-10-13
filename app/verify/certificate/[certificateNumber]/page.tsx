import Link from "next/link";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { prisma } from "@/lib/prisma";
import { BadgeCheck, ShieldAlert, ShieldCheck } from "lucide-react";

export const dynamic = "force-dynamic";

/**
 * C-010: IT certificates used to link to /verify/report/<cert number>, but
 * that verifier only queries ReportCard — so every IT certificate "failed"
 * verification. This page is the certificate verifier: same visual language
 * as the report verifier, backed by ItCertificate (issued on completion of an
 * IT Hub course enrollment).
 */
export default async function VerifyCertificatePage({
  params,
}: {
  params: Promise<{ certificateNumber: string }>;
}) {
  const { certificateNumber } = await params;
  const decoded = decodeURIComponent(certificateNumber);

  const certificate = await prisma.itCertificate.findFirst({
    where: { certificateNumber: decoded },
    select: {
      certificateNumber: true,
      issuedAt: true,
      enrollment: {
        select: {
          completedAt: true,
          user: { select: { name: true, email: true } },
          course: { select: { title: true, certification: true, level: true } },
        },
      },
    },
  });

  // Only certs tied to a completed enrollment verify — matches how they are
  // issued, and blocks a draft/abandoned enrollment from ever "verifying".
  const verified = certificate !== null && certificate.enrollment.completedAt !== null;

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
              IT <span className="text-brand-green">CERTIFICATE</span> VERIFICATION
            </h1>
          </div>
        </section>

        <section className="px-6 py-14">
          <div className="mx-auto max-w-2xl">
            {verified && certificate ? (
              <div className="rounded-[2rem] border border-brand-green/30 bg-[var(--surface-card)] p-10 text-center shadow-[var(--card-shadow)]">
                <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-brand-green text-brand-navy">
                  <BadgeCheck size={40} />
                </div>
                <h2 className="font-display text-3xl text-[var(--text-accent)]">
                  AUTHENTIC CERTIFICATE
                </h2>
                <p className="mt-2 text-sm text-[var(--text-secondary)]">
                  This IT certificate was officially issued by the Ykay College IT Hub.
                </p>
                <div className="mt-8 space-y-3 rounded-2xl bg-[var(--surface-disabled)] p-6 text-left text-sm">
                  {[
                    ["Certificate Number", certificate.certificateNumber],
                    ["Graduate", certificate.enrollment.user.name],
                    ["Course", certificate.enrollment.course.title],
                    [
                      "Certification",
                      certificate.enrollment.course.certification ||
                        certificate.enrollment.course.title,
                    ],
                    ["Level", certificate.enrollment.course.level],
                    [
                      "Completed",
                      new Date(certificate.enrollment.completedAt as Date).toLocaleDateString(),
                    ],
                    ["Issued", new Date(certificate.issuedAt).toLocaleDateString()],
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
                  No officially issued IT certificate matches this number. If you hold this
                  certificate, contact the Ykay College IT Hub office.
                </p>
              </div>
            )}

            <p className="mt-8 text-center text-xs text-[var(--text-muted)]">
              Verifying a report card instead?{" "}
              <Link href="/verify" className="text-brand-green hover:underline">
                Use the report verifier
              </Link>
              .
            </p>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
