import { redirect } from "next/navigation";

/**
 * Superseded by /teacher/messages.
 *
 * This listed a class's parents with a "Send Message" button that posted
 * nowhere. Real threaded messaging — with replies, unread counts and an audit
 * trail — now lives at /teacher/messages, and it reaches the same parents.
 *
 * Kept as a redirect so existing links resolve.
 */
export default function ClassParentsPage() {
  redirect("/teacher/messages");
}
