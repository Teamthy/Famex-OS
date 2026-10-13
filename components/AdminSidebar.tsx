"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  BookOpen,
  CalendarDays,
  ClipboardCheck,
  CreditCard,
  FileText,
  GraduationCap,
  HelpCircle,
  IdCard,
  LayoutDashboard,
  Lock,
  LogOut,
  MapPin,
  MessageCircle,
  School,
  Send,
  Shield,
  UserPlus,
  Users,
} from "lucide-react";
import { useAuth } from "./AuthProvider";
import Image from "next/image";

const ADMIN_NAV = [
  { label: "Admin Dashboard", href: "/admin", icon: LayoutDashboard },
  { label: "Admissions Queue", href: "/admin-admissions", icon: ClipboardCheck },
  { label: "Student Records", href: "/admin/students", icon: Users },
  { label: "Staff Accounts", href: "/admin/staff", icon: UserPlus },
  { label: "Staff QR Attendance", href: "/admin/staff-attendance", icon: ClipboardCheck },
  { label: "Class Manager", href: "/admin/class-manager", icon: School },
  { label: "Timetable", href: "/admin/timetable", icon: CalendarDays },
  { label: "Subjects", href: "/admin/subjects", icon: BookOpen },
  { label: "Messages", href: "/admin/messages", icon: MessageCircle },
  { label: "Sessions & Terms", href: "/admin/sessions", icon: CalendarDays },
  { label: "Promotion", href: "/admin/promotion", icon: GraduationCap },
  { label: "Staff Assignments", href: "/admin/staff-assignments", icon: BookOpen },
  { label: "Fee Management", href: "/admin/fees", icon: CreditCard },
  { label: "Fee Structures", href: "/admin/fees/structures", icon: CreditCard },
  { label: "Generate Invoices", href: "/admin/fees/generate", icon: CreditCard },
  { label: "Transfer Review", href: "/admin/fees/transfers", icon: CreditCard },
  { label: "Expenses", href: "/admin/expenses", icon: CreditCard },
  { label: "Budgets", href: "/admin/budgets", icon: CreditCard },
  { label: "Finances", href: "/admin/finances", icon: CreditCard },
  { label: "Attendance Analytics", href: "/admin/attendance-analytics", icon: BarChart3 },
  { label: "Attendance Corrections", href: "/admin/attendance-corrections", icon: ClipboardCheck },
  { label: "Report Cards", href: "/admin/report-cards", icon: FileText },
  { label: "Gradebook Lock", href: "/admin/gradebook-lock", icon: Lock },
  { label: "Broadsheet", href: "/admin/broadsheet", icon: BarChart3 },
  { label: "ID Cards", href: "/admin/id-cards", icon: IdCard },
  { label: "Post & News", href: "/admin/news", icon: Send },
  { label: "Notifications", href: "/admin/notifications", icon: Send },
  { label: "School Profile", href: "/admin/school-profile", icon: MapPin },
  { label: "View Questions", href: "/admin/questions", icon: HelpCircle },
];

export default function AdminSidebar() {
  const pathname = usePathname();
  const { user, logout } = useAuth();

  return (
    <aside className="hidden w-[280px] shrink-0 lg:block">
      <div className="sticky top-24 space-y-4">
        <div className="rounded-2xl border border-white/10 bg-brand-navy p-4">
          <div className="flex items-center gap-3">
            <Image
              src="/ykay-logo.png"
              alt="Ykay"
              width={36}
              height={36}
              className="h-9 w-9 object-contain"
            />
            <div>
              <div className="text-[9px] font-bold uppercase tracking-widest text-brand-green">
                Admin workspace
              </div>
              <div className="font-display text-sm tracking-[1px] text-white">YKAY COLLEGE</div>
            </div>
          </div>
        </div>

        {user && (
          <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-card)] p-3">
            <div className="flex items-center gap-2 text-[10px] uppercase tracking-widest text-[var(--text-muted)]">
              <Shield size={12} /> Signed in
            </div>
            <div className="truncate text-sm font-bold text-[var(--text-primary)]">{user.name}</div>
            <div className="text-[10px] uppercase tracking-wider text-[var(--text-muted)]">
              {user.role?.replaceAll("_", " ")}
            </div>
          </div>
        )}

        <nav className="space-y-1">
          {ADMIN_NAV.map((item) => {
            const isActive =
              pathname === item.href || (item.href !== "/admin" && pathname.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 rounded-xl border px-4 py-2.5 text-sm font-medium transition-all ${
                  isActive
                    ? "border-brand-green/20 bg-brand-green/10 text-brand-green"
                    : "border-transparent text-[var(--text-muted)] hover:bg-[var(--surface-disabled)] hover:text-[var(--text-primary)]"
                }`}
              >
                <item.icon size={16} />
                <span className="tracking-wide">{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <button
          onClick={logout}
          className="flex w-full items-center gap-2 rounded-lg px-4 py-2 text-xs text-[var(--text-muted)] hover:text-red-500"
        >
          <LogOut size={14} /> Sign out
        </button>
      </div>
    </aside>
  );
}
