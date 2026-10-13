"use client";

import { LucideIcon } from "lucide-react";

interface StatItem {
  label: string;
  value: string | number;
  change?: string;
  trend?: "up" | "down" | "neutral";
  icon: LucideIcon;
  color?: string;
}

export default function QuickStats({ stats }: { stats: StatItem[] }) {
  return (
    <div
      className={`grid gap-4 ${
        stats.length === 2
          ? "grid-cols-2"
          : stats.length === 3
            ? "grid-cols-3"
            : stats.length === 4
              ? "grid-cols-2 md:grid-cols-4"
              : "grid-cols-2 md:grid-cols-3 lg:grid-cols-4"
      }`}
    >
      {stats.map((s) => (
        <div
          key={s.label}
          className="p-5 rounded-2xl bg-[var(--surface-card)] border border-[var(--border-subtle)] shadow-[var(--card-shadow)]"
        >
          <div
            className={`w-10 h-10 rounded-xl bg-brand-green/10 flex items-center justify-center mb-3 ${s.color || "text-brand-green"}`}
          >
            <s.icon size={18} />
          </div>
          <div className="font-display text-3xl text-[var(--text-primary)]">{s.value}</div>
          <div className="text-[10px] uppercase tracking-widest text-[var(--text-muted)] mt-1 mb-2">
            {s.label}
          </div>
          {s.change && (
            <div
              className={`flex items-center gap-1 text-xs ${
                s.trend === "up"
                  ? "text-brand-green"
                  : s.trend === "down"
                    ? "text-red-500"
                    : "text-[var(--text-muted)]"
              }`}
            >
              <strong>{s.change}</strong>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
