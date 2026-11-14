"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useApi } from "@/lib/useApi";
import PortalTopbar from "@/components/PortalTopbar";
import PortalSidebar from "@/components/PortalSidebar";
import {
  ArrowLeft,
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
  content: string;
  publishedAt: string | null;
};

export default function ParentPublicationDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const { data, loading, error } = useApi<{ publication: Publication }>(
    `/api/parent/publications/${encodeURIComponent(id)}`,
  );
  const publication = data?.publication;

  return (
    <>
      <PortalTopbar />
      <main className="min-h-screen bg-[var(--bg-primary)] px-6 pb-16 pt-28">
        <div className="mx-auto flex max-w-7xl flex-col gap-8 lg:flex-row">
          <PortalSidebar portalName="Parent" portalType="parent" items={SIDEBAR_ITEMS} />
          <article className="min-w-0 flex-1 rounded-[2rem] border border-[var(--border-subtle)] bg-[var(--surface-card)] p-6 shadow-[var(--card-shadow)] md:p-10">
            <Link
              href="/parent/publications"
              className="inline-flex min-h-11 items-center gap-2 text-sm font-bold text-brand-green focus-visible:outline-2 focus-visible:outline-offset-2"
            >
              <ArrowLeft size={15} /> All publications
            </Link>
            {loading ? (
              <p className="mt-8 text-sm text-[var(--text-muted)]">Loading publication…</p>
            ) : error || !publication ? (
              <p role="alert" className="mt-8 rounded-xl bg-red-500/10 p-5 text-sm text-red-600">
                This publication is unavailable or was not shared with your account.
              </p>
            ) : (
              <>
                <p className="mt-8 text-[10px] font-bold uppercase tracking-widest text-brand-green">
                  {publication.category}
                </p>
                <h1 className="mt-3 font-display text-3xl text-[var(--text-primary)] md:text-5xl">
                  {publication.title}
                </h1>
                {publication.publishedAt ? (
                  <time className="mt-4 inline-flex items-center gap-2 text-sm text-[var(--text-muted)]">
                    <Calendar size={15} /> {new Date(publication.publishedAt).toLocaleString()}
                  </time>
                ) : null}
                <p className="mt-6 text-lg leading-8 text-[var(--text-secondary)]">
                  {publication.excerpt}
                </p>
                <div className="mt-8 whitespace-pre-wrap border-t border-[var(--border-subtle)] pt-8 text-sm leading-7 text-[var(--text-primary)]">
                  {publication.content}
                </div>
              </>
            )}
          </article>
        </div>
      </main>
    </>
  );
}
