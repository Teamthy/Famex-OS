"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useToast } from "@/components/Toast";
import { generateCertificatePDF } from "@/lib/branded-pdf";
import { useSchoolProfile } from "@/components/SchoolProfileContext";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import {
  Award,
  ChevronLeft,
  Download,
  ExternalLink,
  Flame,
  GraduationCap,
  LoaderCircle,
  Share2,
  BookOpen,
  Clock,
  Copy,
  CheckCircle2,
} from "lucide-react";

type Certificate = {
  id: string;
  certificateNumber: string;
  issuedAt: string;
  course: {
    slug: string;
    title: string;
    tagline: string;
    level: string;
    certification: string;
    durationWeeks: number;
    moduleCount: number;
  };
  modulesCompleted: number;
};

type CertData = {
  user: { name: string; email: string };
  certificates: Certificate[];
  stats: {
    totalCertificates: number;
    totalModulesCompleted: number;
    totalWeeksLearning: number;
    streakDays: number;
    totalEnrollments: number;
    completedCourses: number;
  };
};

export default function CertificatesPage() {
  const { address } = useSchoolProfile();
  const { toast } = useToast();
  const [data, setData] = useState<CertData | null>(null);
  const [loading, setLoading] = useState(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/it/certificates", { cache: "no-store" });
      if (r.ok) setData(await r.json());
    } catch {
      toast("Failed to load certificates.", "error");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    void load();
  }, [load]);

  function downloadCertificate(cert: Certificate) {
    generateCertificatePDF({
      schoolAddress: address,
      studentName: data!.user.name,
      courseTitle: cert.course.title,
      certification: cert.course.certification,
      certificateNumber: cert.certificateNumber,
      issuedAt: cert.issuedAt,
      level: cert.course.level,
    });
  }

  function copyCertNumber(certNumber: string, certId: string) {
    navigator.clipboard.writeText(certNumber);
    setCopiedId(certId);
    setTimeout(() => setCopiedId(null), 2000);
    toast("Certificate number copied!", "success");
  }

  function shareCertificate(cert: Certificate) {
    const text = `I just earned my ${cert.course.certification} from Ykay College IT Hub! 🎓\nCertificate: ${cert.certificateNumber}`;
    if (navigator.share) {
      navigator.share({ title: "My Certificate", text }).catch(() => {});
    } else {
      navigator.clipboard.writeText(text);
      toast("Certificate details copied to clipboard!", "success");
    }
  }

  if (loading) {
    return (
      <div className="grid min-h-screen place-items-center bg-[var(--bg-primary)]">
        <LoaderCircle className="animate-spin text-[var(--text-primary)]" size={32} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] theme-transition">
      <Header />
      {/* Nav */}
      <header className="sticky top-0 z-50 border-b border-[var(--border-subtle)] bg-[var(--surface-card)] shadow-[var(--card-shadow)]">
        <div className="mx-auto flex h-[72px] max-w-[1340px] items-center gap-4 px-6">
          <Link href="/it-portal/dashboard" className="flex items-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#0F1F2E]">
              <GraduationCap size={22} className="text-[#4EC54D]" />
            </div>
            <div className="hidden sm:block">
              <div className="text-[13px] font-extrabold tracking-wider text-[var(--text-primary)]">
                YKAY
              </div>
              <div className="text-[9px] font-bold uppercase tracking-[0.2em] text-[#4EC54D]">
                IT Hub
              </div>
            </div>
          </Link>
          <Link
            href="/it-portal/dashboard"
            className="ml-4 flex items-center gap-1.5 text-sm text-[var(--text-muted)] hover:text-[var(--text-primary)]"
          >
            <ChevronLeft size={16} /> My Courses
          </Link>
          <span className="text-[var(--text-muted)]">/</span>
          <span className="text-sm font-bold text-[var(--text-primary)]">Certificates</span>
        </div>
      </header>

      <main className="mx-auto max-w-[1340px] px-6 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-[var(--text-primary)]">My Certificates</h1>
          <p className="mt-1 text-sm text-[var(--text-muted)]">
            Your earned credentials from Ykay College IT Hub. Download, share, or verify.
          </p>
        </div>

        {/* Stats */}
        {data && (
          <div className="mb-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
            {[
              {
                label: "Certificates Earned",
                value: data.stats.totalCertificates,
                icon: Award,
                color: "#EA902E",
              },
              {
                label: "Modules Completed",
                value: data.stats.totalModulesCompleted,
                icon: BookOpen,
                color: "#4EC54D",
              },
              {
                label: "Weeks of Learning",
                value: data.stats.totalWeeksLearning,
                icon: Clock,
                color: "#6366f1",
              },
              { label: "Day Streak", value: data.stats.streakDays, icon: Flame, color: "#ef4444" },
            ].map((stat) => (
              <div
                key={stat.label}
                className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-card)] p-5 shadow-[var(--card-shadow)]"
              >
                <div className="flex items-center gap-3">
                  <div
                    className="flex h-10 w-10 items-center justify-center rounded-lg"
                    style={{ backgroundColor: `${stat.color}10` }}
                  >
                    <stat.icon size={20} style={{ color: stat.color }} />
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-[var(--text-primary)]">
                      {stat.value}
                    </div>
                    <div className="text-[11px] font-medium text-[var(--text-muted)]">
                      {stat.label}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Certificates grid */}
        {data && data.certificates.length > 0 ? (
          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {data.certificates.map((cert) => {
              return (
                <div
                  key={cert.id}
                  className="overflow-hidden rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-card)] shadow-[var(--card-shadow)] transition hover:shadow-lg"
                >
                  {/* Certificate preview header */}
                  <div className="relative bg-gradient-to-br from-[#0F1F2E] via-[#1A3148] to-[#0F1F2E] px-6 py-8 text-center">
                    <div
                      className="absolute inset-0 opacity-[0.06]"
                      style={{
                        backgroundImage:
                          "radial-gradient(circle at 50% 50%, #4EC54D 1px, transparent 1px)",
                        backgroundSize: "20px 20px",
                      }}
                    />
                    <div className="relative">
                      <Award size={32} className="mx-auto mb-2 text-[#EA902E]" />
                      <p className="text-[9px] font-bold uppercase tracking-[0.3em] text-white/50">
                        Certificate of Completion
                      </p>
                      <h3 className="mt-2 text-lg font-bold text-white">{data.user.name}</h3>
                      <p className="mt-1 text-xs text-[#4EC54D]">{cert.course.title}</p>
                      <div className="mt-3 inline-block rounded-full bg-[var(--surface-card)]/10 px-3 py-1 text-[10px] font-bold tracking-wider text-white/70">
                        {cert.certificateNumber}
                      </div>
                    </div>
                  </div>

                  {/* Info */}
                  <div className="p-5">
                    <div className="mb-4 space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-[var(--text-muted)]">Credential</span>
                        <span className="font-bold text-[var(--text-primary)]">
                          {cert.course.certification}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[var(--text-muted)]">Level</span>
                        <span className="font-bold text-[var(--text-primary)]">
                          {cert.course.level}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[var(--text-muted)]">Modules</span>
                        <span className="font-bold text-[var(--text-primary)]">
                          {cert.modulesCompleted} completed
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[var(--text-muted)]">Issued</span>
                        <span className="font-bold text-[var(--text-primary)]">
                          {new Date(cert.issuedAt).toLocaleDateString("en-GB", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          })}
                        </span>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2">
                      <button
                        onClick={() => downloadCertificate(cert)}
                        className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-[#0F1F2E] py-2.5 text-xs font-bold text-white hover:bg-[#1a3148]"
                      >
                        <Download size={14} /> Download PDF
                      </button>
                      <button
                        onClick={() => shareCertificate(cert)}
                        className="flex items-center justify-center gap-1.5 rounded-lg border border-[var(--border-subtle)] px-4 py-2.5 text-xs font-bold text-[var(--text-secondary)] hover:bg-[var(--surface-disabled)]"
                      >
                        <Share2 size={14} /> Share
                      </button>
                      <button
                        onClick={() => copyCertNumber(cert.certificateNumber, cert.id)}
                        className="flex items-center justify-center rounded-lg border border-[var(--border-subtle)] px-3 py-2.5 text-[var(--text-secondary)] hover:bg-[var(--surface-disabled)]"
                      >
                        {copiedId === cert.id ? (
                          <CheckCircle2 size={14} className="text-[#4EC54D]" />
                        ) : (
                          <Copy size={14} />
                        )}
                      </button>
                    </div>

                    {/* Verify link */}
                    <Link
                      href={`/verify/certificate/${cert.certificateNumber}`}
                      className="mt-3 flex items-center justify-center gap-1 text-[11px] text-[#4EC54D] hover:underline"
                    >
                      <ExternalLink size={11} /> Verify this certificate
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-card)] py-20 text-center">
            <Award size={48} className="mx-auto mb-4 text-[var(--text-muted)]" />
            <h3 className="text-xl font-bold text-[var(--text-primary)]">No certificates yet</h3>
            <p className="mt-2 text-sm text-[var(--text-muted)]">
              Complete a course to earn your first certificate.
            </p>
            <Link
              href="/it-portal/dashboard"
              className="mt-6 inline-block rounded-full bg-[#0F1F2E] px-8 py-3 text-sm font-bold text-white hover:bg-[#1a3148]"
            >
              Continue Learning
            </Link>
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
}
