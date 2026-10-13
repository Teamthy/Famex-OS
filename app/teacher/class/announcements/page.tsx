import { redirect } from "next/navigation";

/**
 * Superseded by /teacher/announcements.
 *
 * This page had its own composer with a "Send Announcement" button that
 * posted nowhere — a second, non-working copy of a screen that now works. Two
 * announcement composers is worse than one: staff find whichever they land on
 * first, and half of them find the broken one.
 *
 * Kept as a redirect so existing links and bookmarks resolve.
 */
export default function ClassAnnouncementsPage() {
  redirect("/teacher/announcements");
}
