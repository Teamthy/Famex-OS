import { Check, X, Clock, AlertCircle } from "lucide-react";

export interface AttendanceDay {
  date: string;
  status: "Present" | "Absent" | "Late";
  note?: string;
  subject?: string;
}

interface AttendanceCalendarProps {
  days: AttendanceDay[];
  month: string;
  year: number;
  title: string;
  subtitle?: string;
  viewType: "parent" | "student" | "teacher";
}

export default function AttendanceCalendar({
  days,
  month,
  year,
  title,
  subtitle,
}: AttendanceCalendarProps) {
  const today = new Date();
  const daysInMonth = new Date(year, new Date(month + " 1, 2025").getMonth() + 1, 0).getDate();

  const statusColor = (status: string) => {
    switch (status) {
      case "Present":
        return "bg-brand-green text-brand-navy-dark";
      case "Absent":
        return "bg-red-500 text-white";
      case "Late":
        return "bg-brand-orange text-white";
      default:
        return "bg-[var(--surface-disabled)] text-[var(--text-muted)]";
    }
  };

  const statusIcon = (status: string) => {
    switch (status) {
      case "Present":
        return <Check size={10} strokeWidth={3} />;
      case "Absent":
        return <X size={10} strokeWidth={3} />;
      case "Late":
        return <Clock size={10} strokeWidth={3} />;
      default:
        return <AlertCircle size={10} strokeWidth={2} />;
    }
  };

  const presentCount = days.filter((d) => d.status === "Present").length;
  const absentCount = days.filter((d) => d.status === "Absent").length;
  const lateCount = days.filter((d) => d.status === "Late").length;
  const total = days.length || 1;
  const percentage = Math.round((presentCount / total) * 100);

  return (
    <div className="rounded-[2rem] bg-[var(--surface-card)] border border-[var(--border-subtle)] p-8 shadow-[var(--card-shadow)] theme-transition">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
        <div>
          <h2 className="font-display text-xl tracking-[2px] text-[var(--text-primary)]">
            {title}
          </h2>
          {subtitle && (
            <p className="font-body text-xs text-[var(--text-muted)] mt-1">{subtitle}</p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-brand-green/10 text-brand-green text-[10px] font-bold">
            <Check size={8} strokeWidth={3} /> Present: {presentCount}
          </span>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-red-500/10 text-red-500 text-[10px] font-bold">
            <X size={8} strokeWidth={3} /> Absent: {absentCount}
          </span>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-brand-orange/10 text-brand-orange text-[10px] font-bold">
            <Clock size={8} strokeWidth={3} /> Late: {lateCount}
          </span>
        </div>
      </div>

      {/* Percentage bar */}
      <div className="mb-6">
        <div className="flex justify-between items-center mb-1.5">
          <span className="font-body text-[10px] font-bold tracking-[0.15em] uppercase text-[var(--text-muted)]">
            Attendance Rate
          </span>
          <span className="font-display text-xl tracking-[2px] text-brand-green">
            {percentage}%
          </span>
        </div>
        <div className="w-full h-2.5 rounded-full bg-[var(--surface-disabled)] overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-r from-brand-green to-brand-green-light transition-all duration-500"
            style={{ width: `${percentage}%` }}
          />
        </div>
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-1.5">
        {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
          <div
            key={d}
            className="text-center font-display text-[9px] tracking-[0.15em] uppercase text-[var(--text-muted)] py-1"
          >
            {d}
          </div>
        ))}
        {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((day) => {
          const dayData = days.find((d) => {
            const dDay = new Date(d.date).getDate();
            return dDay === day;
          });
          const isToday =
            today.getDate() === day &&
            today.getMonth() === new Date(month + " 1, 2025").getMonth() &&
            today.getFullYear() === year;
          return (
            <div
              key={day}
              className={`relative rounded-xl px-2 py-3 text-center transition-all duration-200 hover:scale-[1.08] ${
                isToday
                  ? "ring-2 ring-brand-green/40 bg-brand-green/10"
                  : "bg-[var(--surface-disabled)] hover:bg-brand-green/5"
              }`}
            >
              <div
                className={`font-display text-xs tracking-[1px] mb-1 ${
                  isToday ? "text-brand-green font-bold" : "text-[var(--text-secondary)]"
                }`}
              >
                {day}
              </div>
              {dayData ? (
                <div
                  className={`w-6 h-6 mx-auto rounded-full flex items-center justify-center text-[8px] font-bold shadow-sm ${statusColor(
                    dayData.status,
                  )}`}
                  title={`${dayData.status}${dayData.note ? ` — ${dayData.note}` : ""}`}
                >
                  {statusIcon(dayData.status)}
                </div>
              ) : (
                <div className="w-6 h-6 mx-auto rounded-full bg-[var(--border-subtle)] flex items-center justify-center text-[8px] text-[var(--text-muted)]">
                  —
                </div>
              )}
              {dayData?.note && (
                <span
                  className="absolute -top-1 -right-1 w-1.5 h-1.5 rounded-full bg-brand-orange"
                  title={dayData.note}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center justify-center gap-6 mt-6 pt-5 border-t border-[var(--border-subtle)]">
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-brand-green" />
          <span className="font-body text-[10px] text-[var(--text-muted)]">Present</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-red-500" />
          <span className="font-body text-[10px] text-[var(--text-muted)]">Absent</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-brand-orange" />
          <span className="font-body text-[10px] text-[var(--text-muted)]">Late</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-[var(--surface-disabled)] border border-[var(--border-subtle)]" />
          <span className="font-body text-[10px] text-[var(--text-muted)]">No Record</span>
        </div>
      </div>
    </div>
  );
}
