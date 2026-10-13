"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { LoaderCircle, PlayCircle } from "lucide-react";
import { useToast } from "@/components/Toast";

type Props = {
  courseId: string;
  slug: string;
  /** "outline" suits course cards; "solid" suits page-level calls to action. */
  variant?: "outline" | "solid";
  fullWidth?: boolean;
  /**
   * Runs after a successful enrolment instead of opening the course player. Use it when the
   * caller is already showing the course and must refresh its own state.
   */
  onEnrolled?: () => void;
};

const BASE =
  "inline-flex items-center justify-center gap-1.5 text-xs font-bold transition disabled:cursor-not-allowed disabled:opacity-60";

const VARIANTS: Record<NonNullable<Props["variant"]>, string> = {
  outline:
    "rounded-xl border border-brand-green px-4 py-2.5 text-brand-green hover:bg-brand-green hover:text-brand-navy",
  solid:
    "rounded-full bg-brand-green px-6 py-3 uppercase tracking-widest text-brand-navy hover:bg-brand-green-dark",
};

/**
 * Enrols the signed-in IT student through POST /api/it/enroll, then opens the
 * course player. The server decides whether enrolment succeeded; this button
 * only reports the response it got back.
 */
export default function EnrolButton({
  courseId,
  slug,
  variant = "outline",
  fullWidth = false,
  onEnrolled,
}: Props) {
  const router = useRouter();
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);

  async function enroll() {
    if (busy) return;
    setBusy(true);
    try {
      const res = await fetch("/api/it/enroll", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ courseId }),
      });
      if (res.status === 401) {
        toast("Your session has ended. Sign in again to enroll.", "error");
        return;
      }
      const body = (await res.json().catch(() => null)) as {
        ok?: boolean;
        message?: string;
        error?: string;
      } | null;
      if (!res.ok || !body?.ok) {
        toast(body?.error || "We could not enroll you in this course. Please try again.", "error");
        return;
      }
      toast(body.message || "You are enrolled. Start learning now!", "success");
      if (onEnrolled) {
        onEnrolled();
      } else {
        router.push(`/it-portal/courses/${slug}/learn`);
      }
      router.refresh();
    } catch {
      toast("We could not reach the server. Check your connection and try again.", "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={() => void enroll()}
      disabled={busy}
      aria-busy={busy}
      className={`${BASE} ${VARIANTS[variant]} ${fullWidth ? "w-full" : ""}`}
    >
      {busy ? <LoaderCircle size={14} className="animate-spin" /> : <PlayCircle size={14} />}
      {busy ? "Enrolling…" : "Enroll now — free"}
    </button>
  );
}
