"use client";

import PortalTopbar from "@/components/PortalTopbar";
import AdminSidebar from "@/components/AdminSidebar";
import MessagesInbox from "@/components/MessagesInbox";
import { MessageCircle } from "lucide-react";

/**
 * School office messages.
 *
 * Admins had no messaging page at all, despite `reachableStudentIds()` already
 * granting oversight roles (ADMIN, DIRECTOR, COORDINATOR, SUPER_ADMIN) access
 * to every student in the school. The capability existed in the library and
 * the API; there was simply no way to reach it.
 *
 * Oversight is deliberately broad here — an admin resolving a fee dispute or a
 * safeguarding concern needs to see the conversation. Note that opening a
 * thread writes a `MessageParticipant` row and advances a read cursor, so
 * office access is recorded rather than silent.
 */
export default function AdminMessagesPage() {
  return (
    <>
      <PortalTopbar title="Messages" />
      <main className="min-h-screen bg-[var(--bg-primary)] theme-transition">
        <section className="bg-brand-navy px-6 pt-28 pb-14">
          <div className="mx-auto max-w-7xl">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-brand-green/40 bg-brand-green/20 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-brand-green">
              <MessageCircle size={11} /> Office
            </span>
            <h1 className="mt-3 font-display text-4xl tracking-widest text-white md:text-6xl">
              MESSAGES
            </h1>
            <p className="mt-3 max-w-2xl font-body text-sm text-white/60">
              Every conversation in the school. Start one with any family, or step into an existing
              thread.
            </p>
          </div>
        </section>

        <section className="px-6 py-10">
          <div className="mx-auto flex max-w-7xl flex-col gap-8 lg:flex-row">
            <AdminSidebar />
            <div className="min-w-0 flex-1">
              <MessagesInbox emptyHint="No conversations in the school yet." />
            </div>
          </div>
        </section>
      </main>
    </>
  );
}
