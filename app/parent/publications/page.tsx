"use client";

import Link from "next/link";
import { useApi } from "@/lib/useApi";
import PortalTopbar from "@/components/PortalTopbar";
import PortalSidebar from "@/components/PortalSidebar";
import {
  Calendar,
  CalendarDays,
  CreditCard,
  FileText,
  LayoutDashboard,
  Megaphone,
  MessageCircle,
} from "lucide-react";

const SIDEBAR_ITEMS = [
  { label: "Dashboard", href: "/parent/dashboard", icon: LayoutDashboard },
  { label: "Attendance", href: "/parent/attendance", icon: CalendarDays },
  { label: "Fees", href: "/parent/fees", icon: CreditCard },
  { label: "Report Cards", href: "/parent/report-cards", icon: FileText },
  { label: "Messages", href: "/parent/messages", icon: MessageCircle },
  { label: "Events", href: "/parent/events", icon: Calendar },
  { label: "Publications", href: "/parent/publications", icon: Megaphone },
];

type Publication = {
  id: string;
  title: string;
  category: string;
  excerpt: string;
  publishedAt: string | null;
};

export default function ParentPublicationsPage() {
  const { data, loading, error } = useApi<{ publications: Publication[] }>(
    "/api/parent/publications",
  );
  const publications = data?.publications ?? [];

  return (
    <>
      <PortalTopbar />
      <main className="min-h-screen bg-[var(--bg-primary)] theme-transition">
        <section className="bg-brand-navy px-6 pb-12 pt-28 text-white">
          <div className="mx-auto max-w-7xl">
            <span className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-famex-lime">
              <Megaphone size={15} /> School updates
            </span>
            <h1 className="mt-3 font-display text-4xl tracking-widest md:text-5xl">
              PARENT PUBLICATIONS
            </h1>
            <p className="mt-3 max-w-2xl text-sm text-white/80">
              Notices shared with you by the school. Your portal copy stays available here.
            </p>
          </div>
        </section>

        <section className="px-6 py-10">
          <div className="mx-auto flex max-w-7xl flex-col gap-8 lg:flex-row">
            <PortalSidebar portalName="Parent" portalType="parent" items={SIDEBAR_ITEMS} />
            <div className="min-w-0 flex-1 space-y-4">
              {loading ? (
                <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-card)] p-6 text-sm text-[var(--text-muted)]">
                  Loading publications…
                </div>
              ) : error ? (
                <div
                  role="alert"
                  className="rounded-2xl border border-red-500/30 bg-red-500/10 p-6 text-sm text-red-600"
                >
                  Unable to load school publications. Please try again.
                </div>
              ) : publications.length === 0 ? (
                <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-card)] p-8 text-sm text-[var(--text-muted)]">
                  No publications have been shared with you yet.
                </div>
              ) : (
                publications.map((publication) => (
                  <article
                    key={publication.id}
                    className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-card)] p-6 shadow-[var(--card-shadow)]"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <span className="rounded-full bg-famex-lime/15 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-brand-green">
                        {publication.category}
                      </span>
                      <time className="text-xs text-[var(--text-muted)]">
                        {publication.publishedAt
                          ? new Date(publication.publishedAt).toLocaleDateString()
                          : ""}
                      </time>
                    </div>
                    <h2 className="mt-3 font-display text-xl text-[var(--text-primary)]">
                      {publication.title}
                    </h2>
                    <p className="mt-2 line-clamp-3 text-sm leading-6 text-[var(--text-secondary)]">
                      {publication.excerpt}
                    </p>
                    <Link
                      href={`/parent/publications/${encodeURIComponent(publication.id)}`}
                      className="mt-4 inline-flex min-h-11 items-center rounded-full bg-[var(--famex-forest-dark)] px-5 text-xs font-bold uppercase tracking-widest text-white hover:bg-brand-green focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-green"
                    >
                      Read publication
                    </Link>
                  </article>
                ))
              )}
            </div>
          </div>
        </section>
      </main>
    </>
  );
}
