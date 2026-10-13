"use client";

import Link from "next/link";
import PortalTopbar from "@/components/PortalTopbar";
import TeacherSidebar from "@/components/TeacherSidebar";
import MessagesInbox from "@/components/MessagesInbox";
import { MessageCircle, Plus } from "lucide-react";

/**
 * Teacher messages.
 *
 * This page was a permanently empty mock — `useState<any[]>([])`, no fetch
 * call anywhere in the file. It rendered a complete inbox UI over data that
 * could never arrive, so it looked like messaging existed and was simply
 * unused.
 *
 * It now uses the shared threaded inbox. Teachers see conversations about the
 * students in classes they are assigned to, and can start new ones. The
 * dedicated compose screen stays linked because it carries the class/student
 * picker teachers already know.
 */
export default function TeacherMessagesPage() {
  return (
    <>
      <PortalTopbar title="Messages" />
      <main className="min-h-screen bg-[var(--bg-primary)] theme-transition">
        <section className="bg-brand-navy px-6 pt-28 pb-14">
          <div className="mx-auto max-w-7xl">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-brand-green/40 bg-brand-green/20 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-brand-green">
              <MessageCircle size={11} /> Messages
            </span>
            <h1 className="mt-3 font-display text-4xl tracking-widest text-white md:text-6xl">
              MESSAGES
            </h1>
            <p className="mt-3 max-w-2xl font-body text-sm text-white/60">
              Conversations with parents and students about the children you teach.
            </p>
          </div>
        </section>

        <section className="px-6 py-10">
          <div className="mx-auto flex max-w-7xl flex-col gap-8 lg:flex-row">
            <TeacherSidebar />
            <div className="min-w-0 flex-1 space-y-4">
              <div className="flex justify-end">
                <Link
                  href="/teacher/messages/compose"
                  className="inline-flex items-center gap-2 rounded-full border border-[var(--border-default)] px-5 py-2.5 text-xs font-bold uppercase tracking-widest text-[var(--text-secondary)] hover:border-brand-green hover:text-brand-green"
                >
                  <Plus size={13} /> Compose with class picker
                </Link>
              </div>
              <MessagesInbox emptyHint="No conversations yet. Start one about a student in one of your classes." />
            </div>
          </div>
        </section>
      </main>
    </>
  );
}
