"use client";

import PortalTopbar from "@/components/PortalTopbar";
import PortalSidebar from "@/components/PortalSidebar";
import MessagesInbox from "@/components/MessagesInbox";
import {
  LayoutDashboard,
  CalendarDays,
  CreditCard,
  FileText,
  MessageCircle,
  Calendar,
} from "lucide-react";

const SIDEBAR_ITEMS = [
  { label: "Dashboard", href: "/parent/dashboard", icon: LayoutDashboard },
  { label: "Attendance", href: "/parent/attendance", icon: CalendarDays },
  { label: "Fees", href: "/parent/fees", icon: CreditCard },
  { label: "Report Cards", href: "/parent/report-cards", icon: FileText },
  { label: "Messages", href: "/parent/messages", icon: MessageCircle },
  { label: "Events", href: "/parent/events", icon: Calendar },
];

/**
 * Parent messages.
 *
 * This page used to read `/api/parent/messages`, which returns
 * `userNotification` rows — one-way system notices, every one of them labelled
 * `from: "School"`, with no reply path and no thread. A parent could see that
 * fees were due but could not answer a question their child's teacher asked.
 *
 * It now uses the real threaded system that was already built and, until now,
 * used by exactly one screen. Parents can start a conversation about their own
 * children (`reachableStudentIds` resolves a parent to their linked students)
 * and reply to anything a teacher or the office opens.
 */
export default function ParentMessagesPage() {
  return (
    <>
      <PortalTopbar />
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
              Talk to your child&apos;s teachers and the school office. Replies appear here.
            </p>
          </div>
        </section>

        <section className="px-6 py-10">
          <div className="mx-auto flex max-w-7xl flex-col gap-8 lg:flex-row">
            <PortalSidebar portalName="Parent" portalType="parent" items={SIDEBAR_ITEMS} />
            <div className="min-w-0 flex-1">
              <MessagesInbox emptyHint="No conversations yet. Use “New message” to contact your child's form teacher." />
            </div>
          </div>
        </section>
      </main>
    </>
  );
}
