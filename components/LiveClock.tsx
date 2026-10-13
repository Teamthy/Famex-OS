"use client";

import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import { Clock } from "lucide-react";

const PORTAL_PREFIXES = ["/admin", "/teacher", "/student", "/parent", "/portal", "/login"];

export default function LiveClock() {
  const pathname = usePathname();
  const [time, setTime] = useState("");
  const [date, setDate] = useState("");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const isPortal = PORTAL_PREFIXES.some((p) => pathname.startsWith(p));

  useEffect(() => {
    if (!isPortal) return;
    const update = () => {
      const now = new Date();
      setTime(
        now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true }),
      );
      setDate(
        now.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" }),
      );
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [isPortal]);

  if (!mounted || !isPortal || !time) return null;

  return (
    <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-full bg-[var(--surface-card)] border border-[var(--border-subtle)] text-xs">
      <Clock size={12} className="text-[var(--text-accent)]" />
      <span className="text-[var(--text-primary)] font-bold font-mono">{time}</span>
      <span className="text-[var(--text-muted)]">·</span>
      <span className="text-[var(--text-muted)]">{date}</span>
    </div>
  );
}
