import {
  Calendar,
  CalendarDays,
  CreditCard,
  FileText,
  LayoutDashboard,
  MapPin,
  MessageCircle,
} from "lucide-react";

/**
 * The parent portal's navigation, in one place.
 *
 * ── Why this is a module and not a constant per page ───────────────────────
 * Seven parent pages each carried their own `SIDEBAR_ITEMS`. They had already
 * drifted: Attendance and Events listed six rows, Dashboard and GPS Clock-ins
 * listed seven, and none of them listed the timetable — which was the reason
 * /api/parent/timetable was unreachable for a year. A nav that is copied is a
 * nav that will disagree with itself, and the disagreement is invisible until
 * a parent cannot find something.
 *
 * Add a row here and every parent page gets it. `check:orphans` fails on a page
 * that no nav links to, so a new page must be added here to pass.
 */
export const PARENT_NAV = [
  { label: "Dashboard", href: "/parent/dashboard", icon: LayoutDashboard },
  { label: "Attendance", href: "/parent/attendance", icon: CalendarDays },
  { label: "GPS Clock-ins", href: "/parent/clock-ins", icon: MapPin },
  { label: "Timetable", href: "/parent/timetable", icon: Calendar },
  { label: "Fees", href: "/parent/fees", icon: CreditCard },
  { label: "Report Cards", href: "/parent/report-cards", icon: FileText },
  { label: "Messages", href: "/parent/messages", icon: MessageCircle },
];
