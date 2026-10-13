"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { usePathname } from "next/navigation";
import {
  Bell,
  CheckCircle2,
  CreditCard,
  FileText,
  Clock,
  MessageSquare,
  Megaphone,
  LoaderCircle,
} from "lucide-react";
import { useAuth } from "./AuthProvider";

const PORTAL_PREFIXES = ["/admin", "/teacher", "/student", "/parent", "/it-portal"];

interface NotificationItem {
  id: string;
  kind: string;
  title: string;
  body: string;
  link: string | null;
  read: boolean;
  createdAt: string;
}

const KIND_CONFIG: Record<string, { icon: typeof Bell; color: string; bg: string }> = {
  ATTENDANCE_ALERT: { icon: CheckCircle2, color: "text-brand-green", bg: "bg-brand-green/10" },
  FEE_REMINDER: { icon: CreditCard, color: "text-brand-orange", bg: "bg-brand-orange/10" },
  REPORT_RELEASED: { icon: FileText, color: "text-blue-500", bg: "bg-blue-500/10" },
  BROADCAST: { icon: Megaphone, color: "text-brand-orange", bg: "bg-brand-orange/10" },
  ADMISSION_UPDATE: { icon: MessageSquare, color: "text-purple-500", bg: "bg-purple-500/10" },
  SYSTEM: { icon: Bell, color: "text-brand-green", bg: "bg-brand-green/10" },
};

function timeAgo(iso: string) {
  const seconds = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (seconds < 60) return "just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)} min ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} hr ago`;
  return `${Math.floor(seconds / 86400)} day(s) ago`;
}

export default function NotificationBell() {
  const pathname = usePathname();
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [mounted, setMounted] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  const isPortal = PORTAL_PREFIXES.some((prefix) => pathname.startsWith(prefix));

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const response = await fetch("/api/notifications", { cache: "no-store" });
      if (!response.ok) return;
      const body = (await response.json()) as {
        unreadCount: number;
        notifications: NotificationItem[];
      };
      setItems(body.notifications);
      setUnreadCount(body.unreadCount);
    } catch {
      /* silent — bell is non-critical */
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (!mounted || !isPortal || !user) return;
    void load();
    const interval = setInterval(() => void load(), 60_000);
    return () => clearInterval(interval);
  }, [mounted, isPortal, user, load]);

  useEffect(() => {
    const handler = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false);
    };
    if (open) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  if (!mounted || !isPortal || !user) return null;

  const markAllRead = async () => {
    setItems((previous) => previous.map((item) => ({ ...item, read: true })));
    setUnreadCount(0);
    await fetch("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ markAll: true }),
    }).catch(() => undefined);
  };

  const openItem = async (item: NotificationItem) => {
    if (!item.read) {
      setItems((previous) =>
        previous.map((entry) => (entry.id === item.id ? { ...entry, read: true } : entry)),
      );
      setUnreadCount((count) => Math.max(0, count - 1));
      await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notificationId: item.id }),
      }).catch(() => undefined);
    }
    if (item.link) {
      setOpen(false);
      window.location.href = item.link;
    }
  };

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="relative p-2 rounded-full text-[var(--nav-text)] hover:bg-[var(--surface-card-hover)] hover:text-brand-green transition-all"
        aria-label="Notifications"
      >
        <Bell size={18} />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 w-5 h-5 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div
          className="absolute right-0 top-full mt-3 w-96 max-h-[500px] rounded-2xl overflow-hidden shadow-2xl border border-white/10"
          style={{ zIndex: 200, backgroundColor: "#0C1824" }}
        >
          <div className="p-4 border-b border-white/10 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Bell size={16} className="text-brand-green" />
              <span className="font-display text-sm text-white tracking-widest">NOTIFICATIONS</span>
              {unreadCount > 0 && (
                <span className="text-[9px] px-2 py-0.5 rounded-full bg-red-500 text-white font-bold">
                  {unreadCount} new
                </span>
              )}
            </div>
            {unreadCount > 0 && (
              <button
                onClick={() => void markAllRead()}
                className="text-[10px] text-brand-green font-bold uppercase tracking-widest hover:underline"
              >
                Mark all read
              </button>
            )}
          </div>

          <div className="max-h-[380px] overflow-y-auto">
            {loading && !items.length ? (
              <div className="flex items-center gap-2 p-6 text-sm text-white/50">
                <LoaderCircle size={16} className="animate-spin text-brand-green" /> Loading...
              </div>
            ) : null}
            {items.map((item) => {
              const config = KIND_CONFIG[item.kind] || KIND_CONFIG.SYSTEM;
              const Icon = config.icon;
              return (
                <div
                  key={item.id}
                  onClick={() => void openItem(item)}
                  className={`flex items-start gap-3 p-4 border-b border-white/5 transition-colors cursor-pointer ${
                    item.read ? "opacity-60 hover:opacity-80" : "hover:bg-white/5"
                  }`}
                >
                  <div
                    className={`w-9 h-9 rounded-xl ${config.bg} ${config.color} flex items-center justify-center shrink-0`}
                  >
                    <Icon size={16} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div
                        className={`text-sm ${item.read ? "text-white/70" : "text-white font-bold"}`}
                      >
                        {item.title}
                      </div>
                      {!item.read && (
                        <div className="w-2 h-2 rounded-full bg-brand-green shrink-0 mt-1.5" />
                      )}
                    </div>
                    <div className="text-xs text-white/50 mt-0.5 line-clamp-2">{item.body}</div>
                    <div className="text-[10px] text-white/30 mt-1 flex items-center gap-1">
                      <Clock size={9} /> {timeAgo(item.createdAt)}
                    </div>
                  </div>
                </div>
              );
            })}
            {!loading && !items.length ? (
              <div className="p-8 text-center text-sm text-white/40">No notifications yet.</div>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
